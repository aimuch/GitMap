import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { getConfig } from './config';
import { DataSource } from './dataSource';
import { ExtensionState } from './extensionState';
import { Logger } from './logger';
import { resolveCustomRemoteAvatarUrl } from './remoteLinks';
import { Disposable, toDisposable } from './utils/disposable';
import { EventEmitter } from './utils/event';

/**
 * Manages fetching and caching Avatars.
 */
export class AvatarManager extends Disposable {
	private readonly dataSource: DataSource;
	private readonly extensionState: ExtensionState;
	private readonly logger: Logger;
	private readonly avatarStorageFolder: string;
	private readonly avatarEventEmitter: EventEmitter<AvatarEvent>;

	private avatars: AvatarCache;
	private imageDataCache = new Map<string, string>();
	private queue: AvatarRequestQueue;
	private remoteSourceCache: { [repo: string]: RemoteSource } = {};
	private interval: NodeJS.Timeout | null = null;

	private githubTimeout: number = 0;
	private gitLabTimeout: number = 0;

	constructor(dataSource: DataSource, extensionState: ExtensionState, logger: Logger) {
		super();
		this.dataSource = dataSource;
		this.extensionState = extensionState;
		this.logger = logger;
		this.avatarStorageFolder = this.extensionState.getAvatarStoragePath();
		this.avatarEventEmitter = new EventEmitter<AvatarEvent>();
		this.avatars = this.extensionState.getAvatarCache();
		this.queue = new AvatarRequestQueue(() => {
			if (this.interval !== null) return;
			this.interval = setInterval(() => {
				this.fetchAvatarsInterval();
			}, 10000);
			this.fetchAvatarsInterval();
		});

		this.registerDisposables(
			toDisposable(() => {
				this.stopInterval();
			}),
			this.avatarEventEmitter
		);
	}

	private stopInterval() {
		if (this.interval !== null) {
			clearInterval(this.interval);
			this.interval = null;
			this.remoteSourceCache = {};
		}
	}

	public fetchAvatarImage(email: string, repo: string, remote: string | null, commits: string[]) {
		if (typeof this.avatars[email] !== 'undefined') {
			let t = (new Date()).getTime();
			if (this.avatars[email].timestamp < t - 1209600000 || (this.avatars[email].identicon && this.avatars[email].timestamp < t - 345600000)) {
				this.queue.add(email, repo, remote, commits, false);
			}

			this.emitAvatar(email).catch(() => {
				this.removeAvatarFromCache(email);
				this.queue.add(email, repo, remote, commits, true);
			});
		} else {
			this.queue.add(email, repo, remote, commits, true);
		}
	}

	public getAvatarImage(email: string) {
		return new Promise<string | null>((resolve) => {
			if (typeof this.avatars[email] !== 'undefined' && this.avatars[email].image !== null) {
				const cached = this.imageDataCache.get(email);
				if (typeof cached === 'string') {
					resolve(cached);
					return;
				}
				fs.readFile(this.avatarStorageFolder + '/' + this.avatars[email].image, (err, data) => {
					if (err) {
						resolve(null);
						return;
					}
					const dataUri = 'data:image/' + this.avatars[email].image.split('.')[1] + ';base64,' + data.toString('base64');
					if (this.imageDataCache.size >= 200) {
						const oldest = this.imageDataCache.keys().next().value;
						if (typeof oldest === 'string') this.imageDataCache.delete(oldest);
					}
					this.imageDataCache.set(email, dataUri);
					resolve(dataUri);
				});
			} else {
				resolve(null);
			}
		});
	}

	get onAvatar() {
		return this.avatarEventEmitter.subscribe;
	}

	private removeAvatarFromCache(email: string) {
		delete this.avatars[email];
		this.imageDataCache.delete(email);
		this.extensionState.removeAvatarFromCache(email);
	}

	public clearCache() {
		this.avatars = {};
		this.imageDataCache.clear();
		return this.extensionState.clearAvatarCache();
	}

	private async fetchAvatarsInterval() {
		if (this.queue.hasItems()) {
			let avatarRequest = this.queue.takeItem();
			if (avatarRequest === null) return;

			let remoteSource = await this.getRemoteSource(avatarRequest);
			switch (remoteSource.type) {
				case 'github':
					this.fetchFromGithub(avatarRequest, remoteSource.owner, remoteSource.repo);
					break;
				case 'gitlab':
					this.fetchFromGitLab(avatarRequest);
					break;
				case 'custom':
					this.fetchFromCustomRemote(avatarRequest, remoteSource.remoteUrl);
					break;
				default:
					this.fetchFromGravatar(avatarRequest);
			}
		} else {
			this.stopInterval();
		}
	}

	private async getRemoteSource(avatarRequest: AvatarRequestItem) {
		if (typeof this.remoteSourceCache[avatarRequest.repo] === 'object') {
			return this.remoteSourceCache[avatarRequest.repo];
		} else {
			let remoteSource: RemoteSource = { type: 'gravatar' };
			if (avatarRequest.remote !== null) {
				let remoteUrl = await this.dataSource.getRemoteUrl(avatarRequest.repo, avatarRequest.remote);
				if (remoteUrl !== null) {
					const customAvatarUrl = resolveCustomRemoteAvatarUrl(remoteUrl, avatarRequest.email, '', getConfig(avatarRequest.repo).customRemotes);
					if (customAvatarUrl !== null) {
						remoteSource = { type: 'custom', remoteUrl: remoteUrl };
					} else {
						let match;
						if ((match = remoteUrl.match(/^(https:\/\/github\.com\/|git@github\.com:)([^\/]+)\/(.+?)(\.git)?\/?$/)) !== null) {
							remoteSource = { type: 'github', owner: match[2], repo: match[3] };
						} else if (remoteUrl.startsWith('https://gitlab.com/') || remoteUrl.startsWith('git@gitlab.com:')) {
							remoteSource = { type: 'gitlab' };
						}
					}
				}
			}
			this.remoteSourceCache[avatarRequest.repo] = remoteSource;
			return remoteSource;
		}
	}

	private fetchFromGithub(avatarRequest: AvatarRequestItem, owner: string, repo: string) {
		let t = (new Date()).getTime();
		if (t < this.githubTimeout) {
			this.queue.addItem(avatarRequest, this.githubTimeout, false);
			this.fetchAvatarsInterval();
			return;
		}

		this.logger.log('Requesting Avatar for ' + maskEmail(avatarRequest.email) + ' from GitHub');

		const commitIndex = avatarRequest.commits.length < 5
			? avatarRequest.commits.length - 1 - avatarRequest.attempts
			: Math.round((4 - avatarRequest.attempts) * 0.25 * (avatarRequest.commits.length - 1));

		let triggeredOnError = false;
		const onError = () => {
			if (!triggeredOnError) {
				triggeredOnError = true;
				this.githubTimeout = t + 300000;
				this.queue.addItem(avatarRequest, this.githubTimeout, false);
			}
		};

		const req = https.get({
			hostname: 'api.github.com', path: '/repos/' + owner + '/' + repo + '/commits/' + avatarRequest.commits[commitIndex],
			headers: { 'User-Agent': 'vscode-git-graph' },
			agent: false, timeout: 15000
		}, (res) => {
			let respBody = '';
			res.on('data', (chunk: Buffer) => { respBody += chunk; });
			res.on('end', async () => {
				if (res.headers['x-ratelimit-remaining'] === '0') {
					this.githubTimeout = parseInt(<string>res.headers['x-ratelimit-reset']) * 1000;
					this.logger.log('GitHub API Rate Limit Reached - Paused fetching from GitHub until the Rate Limit is reset');
				}

				if (res.statusCode === 200) {
					let commit: any = JSON.parse(respBody);
					if (commit.author && commit.author.avatar_url) {
						let img = await this.downloadAvatarImage(avatarRequest.email, commit.author.avatar_url + (commit.author.avatar_url.includes('?') ? '&' : '?') + 'size=162');
						if (img !== null) {
							this.saveAvatar(avatarRequest.email, img, false);
						} else {
							this.logger.log('Failed to download avatar from GitHub for ' + maskEmail(avatarRequest.email));
						}
						return;
					}
				} else if (res.statusCode === 403 || res.statusCode === 429) {
					if (this.githubTimeout <= t) {
						this.githubTimeout = t + 300000;
					}
					if (avatarRequest.attempts < 4) {
						this.queue.addItem(avatarRequest, this.githubTimeout, true);
						return;
					}
				} else if (res.statusCode === 422 && avatarRequest.commits.length > avatarRequest.attempts + 1 && avatarRequest.attempts < 4) {
					this.queue.addItem(avatarRequest, 0, true);
					return;
				} else if (res.statusCode! >= 500) {
					this.githubTimeout = t + 600000;
					this.queue.addItem(avatarRequest, this.githubTimeout, false);
					return;
				}
				this.fetchFromGravatar(avatarRequest);
			});
			res.on('error', onError);
		});
		req.on('error', onError);
		req.on('timeout', () => {
			if (typeof req.destroy === 'function') req.destroy();
			onError();
		});
	}

	private fetchFromGitLab(avatarRequest: AvatarRequestItem) {
		let t = (new Date()).getTime();
		if (t < this.gitLabTimeout) {
			this.queue.addItem(avatarRequest, this.gitLabTimeout, false);
			this.fetchAvatarsInterval();
			return;
		}

		this.logger.log('Requesting Avatar for ' + maskEmail(avatarRequest.email) + ' from GitLab');

		let triggeredOnError = false;
		const onError = () => {
			if (!triggeredOnError) {
				triggeredOnError = true;
				this.gitLabTimeout = t + 300000;
				this.queue.addItem(avatarRequest, this.gitLabTimeout, false);
			}
		};

		const req = https.get({
			hostname: 'gitlab.com', path: '/api/v4/avatar?email=' + encodeURIComponent(avatarRequest.email).replace(/%40/g, '@') + '&size=162',
			headers: { 'User-Agent': 'vscode-git-graph' },
			agent: false, timeout: 15000
		}, (res) => {
			let respBody = '';
			res.on('data', (chunk: Buffer) => { respBody += chunk; });
			res.on('end', async () => {
				if (res.headers['ratelimit-remaining'] === '0') {
					this.gitLabTimeout = parseInt(<string>res.headers['ratelimit-reset']) * 1000;
					this.logger.log('GitLab API Rate Limit Reached - Paused fetching from GitLab until the Rate Limit is reset');
				}

				if (res.statusCode === 200) {
					let avatarUrl: string | null = null;
					try {
						const response: any = JSON.parse(respBody);
						if (typeof response === 'object' && response !== null && typeof response.avatar_url === 'string') avatarUrl = response.avatar_url;
					} catch (_) { }
					if (avatarUrl !== null && !/^https?:\/\/([^/]+\.)?(gravatar|libravatar)\.(com|org)\//.test(avatarUrl)) {
						let img = await this.downloadAvatarImage(avatarRequest.email, avatarUrl);
						if (img !== null) {
							this.saveAvatar(avatarRequest.email, img, false);
						} else {
							this.logger.log('Failed to download avatar from GitLab for ' + maskEmail(avatarRequest.email));
						}
						return;
					}
				} else if (res.statusCode === 429) {
					this.queue.addItem(avatarRequest, this.gitLabTimeout, false);
					return;
				} else if (res.statusCode! >= 500) {
					this.gitLabTimeout = t + 600000;
					this.queue.addItem(avatarRequest, this.gitLabTimeout, false);
					return;
				}
				this.fetchFromGravatar(avatarRequest);
			});
			res.on('error', onError);
		});
		req.on('error', onError);
		req.on('timeout', () => {
			if (typeof req.destroy === 'function') req.destroy();
			onError();
		});
	}

	private async fetchFromCustomRemote(avatarRequest: AvatarRequestItem, remoteUrl: string) {
		const url = resolveCustomRemoteAvatarUrl(remoteUrl, avatarRequest.email, '', getConfig(avatarRequest.repo).customRemotes);
		if (url !== null) {
			const img = await this.downloadAvatarImage(avatarRequest.email, url);
			if (img !== null) {
				this.saveAvatar(avatarRequest.email, img, false);
				return;
			}
		}
		this.fetchFromGravatar(avatarRequest);
	}

	private async fetchFromGravatar(avatarRequest: AvatarRequestItem) {
		this.logger.log('Requesting Avatar for ' + maskEmail(avatarRequest.email) + ' from Gravatar');
		const hash: string = crypto.createHash('md5').update(avatarRequest.email.trim().toLowerCase()).digest('hex');

		let img = await this.downloadAvatarImage(avatarRequest.email, 'https://secure.gravatar.com/avatar/' + hash + '?s=162&d=404'), identicon = false;
		if (img === null) {
			img = await this.downloadAvatarImage(avatarRequest.email, 'https://secure.gravatar.com/avatar/' + hash + '?s=162&d=identicon');
			identicon = true;
		}

		if (img !== null) {
			this.saveAvatar(avatarRequest.email, img, identicon);
		} else {
			this.logger.log('No Avatar could be found for ' + maskEmail(avatarRequest.email));
		}
	}

	private downloadAvatarImage(email: string, imageUrl: string) {
		return (new Promise<string | null>((resolve) => {
			const hash = crypto.createHash('md5').update(email).digest('hex');
			const imgUrl = new URL(imageUrl);

			let completed = false;
			const complete = (fileName: string | null = null) => {
				if (!completed) {
					completed = true;
					resolve(fileName);
				}
			};

			const client = imgUrl.protocol === 'http:' ? http : https;
			const req = client.get({
				hostname: imgUrl.hostname,
				port: imgUrl.port || undefined,
				path: imgUrl.pathname + imgUrl.search,
				headers: { 'User-Agent': 'vscode-git-graph' },
				agent: false, timeout: 15000
			}, (res) => {
				let imageBufferArray: Buffer[] = [];
				res.on('data', (chunk: Buffer) => { imageBufferArray.push(chunk); });
				res.on('end', () => {
					const contentType = /^image\/([A-Za-z0-9.+-]+)/.exec(res.headers['content-type'] || '');
					if (res.statusCode === 200 && contentType !== null) {
						let format = contentType[1];
						fs.writeFile(this.avatarStorageFolder + '/' + hash + '.' + format, Buffer.concat(imageBufferArray), err => {
							complete(err ? null : hash + '.' + format);
						});
					} else {
						complete();
					}
				});
				res.on('error', complete);
			});
			req.on('error', complete);
			req.on('timeout', () => {
				if (typeof req.destroy === 'function') req.destroy();
				complete();
			});
		})).catch(() => null);
	}

	private emitAvatar(email: string) {
		return new Promise<boolean>((resolve, reject) => {
			if (this.avatarEventEmitter.hasSubscribers()) {
				this.getAvatarImage(email).then((image) => {
					if (image === null) {
						reject();
					} else {
						this.avatarEventEmitter.emit({
							email: email,
							image: image
						});
						resolve(true);
					}
				});
			} else {
				resolve(false);
			}
		});
	}

	private saveAvatar(email: string, image: string, identicon: boolean) {
		this.imageDataCache.delete(email);
		if (typeof this.avatars[email] !== 'undefined') {
			if (!identicon || this.avatars[email].identicon) {
				this.avatars[email].image = image;
				this.avatars[email].identicon = identicon;
			}
			this.avatars[email].timestamp = (new Date()).getTime();
		} else {
			this.avatars[email] = { image: image, timestamp: (new Date()).getTime(), identicon: identicon };
		}
		this.extensionState.saveAvatar(email, this.avatars[email]);
		this.logger.log('Saved Avatar for ' + maskEmail(email));
		this.emitAvatar(email).then(
			(sent) => this.logger.log(sent
				? 'Sent Avatar for ' + maskEmail(email) + ' to the Git Map View'
				: 'Avatar for ' + maskEmail(email) + ' is ready to be used the next time the Git Map View is opened'
			),
			() => this.logger.log('Failed to Send Avatar for ' + maskEmail(email) + ' to the Git Map View')
		);
	}
}

class AvatarRequestQueue {
	private queue: AvatarRequestItem[] = [];
	private itemsAvailableCallback: () => void;

	constructor(itemsAvailableCallback: () => void) {
		this.itemsAvailableCallback = itemsAvailableCallback;
	}

	public add(email: string, repo: string, remote: string | null, commits: string[], immediate: boolean) {
		const existingRequest = this.queue.find((request) => request.email === email && request.repo === repo);
		if (existingRequest) {
			commits.forEach((commit) => {
				if (!existingRequest.commits.includes(commit)) {
					existingRequest.commits.push(commit);
				}
			});
		} else {
			this.insertItem({
				email: email,
				repo: repo,
				remote: remote,
				commits: commits,
				checkAfter: immediate || this.queue.length === 0
					? 0
					: this.queue[this.queue.length - 1].checkAfter + 1,
				attempts: 0
			});
		}
	}

	public addItem(item: AvatarRequestItem, checkAfter: number, failedAttempt: boolean) {
		item.checkAfter = checkAfter;
		if (failedAttempt) item.attempts++;
		this.insertItem(item);
	}

	public hasItems() {
		return this.queue.length > 0;
	}

	public takeItem() {
		if (this.queue.length > 0 && this.queue[0].checkAfter < (new Date()).getTime()) return this.queue.shift()!;
		return null;
	}

	private insertItem(item: AvatarRequestItem) {
		let l = 0, r = this.queue.length - 1, c, prevLength = this.queue.length;
		while (l <= r) {
			c = l + r >> 1;
			if (this.queue[c].checkAfter <= item.checkAfter) {
				l = c + 1;
			} else {
				r = c - 1;
			}
		}
		this.queue.splice(l, 0, item);
		if (prevLength === 0) this.itemsAvailableCallback();
	}
}

function maskEmail(email: string) {
	return email.substring(0, email.indexOf('@')) + '@*****';
}

export interface Avatar {
	image: string;
	timestamp: number;
	identicon: boolean;
}

export type AvatarCache = { [email: string]: Avatar };

interface AvatarRequestItem {
	email: string;
	repo: string;
	remote: string | null;
	commits: string[];
	checkAfter: number;
	attempts: number;
}

interface GitHubRemoteSource {
	readonly type: 'github';
	readonly owner: string;
	readonly repo: string;
}

export interface AvatarEvent {
	email: string;
	image: string;
}

interface CustomRemoteSource {
	readonly type: 'custom';
	readonly remoteUrl: string;
}

interface GitLabRemoteSource {
	readonly type: 'gitlab';
}

interface GravatarRemoteSource {
	readonly type: 'gravatar';
}

type RemoteSource = GitHubRemoteSource | CustomRemoteSource | GitLabRemoteSource | GravatarRemoteSource;
