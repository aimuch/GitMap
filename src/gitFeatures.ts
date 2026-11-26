import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GitProcessRunner, runGit } from './historyRewrite';
import { createRepoTempFiles, isRemoteRepo, parseRemoteRepo, readRepoFileBuffer, removeRepoTempDir, writeRepoFileBuffer } from './remote/repoTransport';
import { sshManager } from './remote/sshManager';
import {
	BranchCommitSummary,
	CommitSignatureDetails,
	ContributorSummary,
	GitBisectState,
	GitBranchCleanupCandidate,
	GitBranchComparison,
	GitFileChange,
	GitFileStatus,
	GitFileTimelineCommit,
	GitPatchInfo,
	GitStashableFile,
	RepoHookInfo,
	ReviewSessionScope,
	WorkingTreeStatusItem
} from './types';

const FIELD = '\x1f';
const RECORD = '\x1e';
const HASH_REGEXP = /^[0-9a-f]{40}([0-9a-f]{24})?$/;
const EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const MAX_EXPLAIN_DIFF_LINES = 3000;
const MAX_EXPLAIN_LINE_CHARS = 500;
const MAX_EXPLAIN_CHARS = 80000;
const MAX_EXPLAIN_BYTES = 256 * 1024;
const MAX_PATCH_BYTES = 25 * 1024 * 1024;

/**
 * The result of a Git command that changes a repository: NULL if it succeeded, otherwise its error message.
 */
export type GitFeatureError = string | null;

/**
 * Git operations used by the features of the Git Map View that aren't part of the original Git Graph.
 * Supports both local repositories and Remote-SSH (`ssh://`) repositories.
 */
export class GitFeatures {
	private readonly git: GitProcessRunner;

	constructor(git: GitProcessRunner) {
		this.git = git;
	}


	/* Comparing Branches & Branch Commits */

	public async compareBranches(repo: string, left: string, right: string): Promise<{ comparison: GitBranchComparison | null, error: GitFeatureError }> {
		const leftHash = await this.resolveCommit(repo, left), rightHash = await this.resolveCommit(repo, right);
		if (leftHash === null || rightHash === null) return { comparison: null, error: 'Unable to resolve "' + (leftHash === null ? left : right) + '" to a commit.' };
		const mergeBase = await this.run(repo, ['merge-base', leftHash, rightHash]);
		const commits = await this.run(repo, ['rev-list', '--left-right', leftHash + '...' + rightHash]);
		if (commits.code !== 0) return { comparison: null, error: commits.stderr || 'Unable to compare the branches.' };
		const lines = splitLines(commits.stdout);
		return {
			comparison: {
				left: left,
				right: right,
				leftHash: leftHash,
				rightHash: rightHash,
				mergeBase: mergeBase.code === 0 && HASH_REGEXP.test(mergeBase.stdout.toString().trim()) ? mergeBase.stdout.toString().trim() : null,
				leftOnly: lines.filter((line) => line.startsWith('<')).map((line) => line.substring(1)),
				rightOnly: lines.filter((line) => line.startsWith('>')).map((line) => line.substring(1))
			},
			error: null
		};
	}

	/**
	 * Load recent commits on a local or remote branch for the cross-branch commit comparison picker.
	 */
	public async getBranchCommits(repo: string, branch: string, maxCommits: number = 100): Promise<{ commits: BranchCommitSummary[], error: GitFeatureError }> {
		const clean = branch.trim();
		if (clean === '' || clean.startsWith('-')) return { commits: [], error: 'Invalid branch name.' };
		const directHash = await this.resolveCommit(repo, clean);
		const resolvedHash = directHash !== null ? directHash : await this.resolveCommit(repo, 'remotes/' + clean);
		if (resolvedHash === null) {
			return { commits: [], error: 'Unable to resolve "' + clean + '" to a commit.' };
		}
		const limit = Math.max(1, Math.min(500, maxCommits));
		const res = await this.run(repo, ['-c', 'log.showSignature=false', 'log', '--max-count=' + limit, '--format=%H' + FIELD + '%aN' + FIELD + '%at' + FIELD + '%s', resolvedHash, '--']);
		if (res.code !== 0) return { commits: [], error: errorOf(res) };
		const commits: BranchCommitSummary[] = splitLines(res.stdout).map((line) => {
			const parts = line.split(FIELD);
			return {
				hash: parts[0] || '',
				author: parts[1] || '',
				date: parseInt(parts[2], 10) || 0,
				subject: parts.slice(3).join(FIELD)
			};
		}).filter((c) => c.hash !== '');
		return { commits: commits, error: null };
	}


	/* Cleaning Up Branches */

	public async getBranchCleanupCandidates(repo: string): Promise<{ defaultBranch: string | null, candidates: GitBranchCleanupCandidate[], error: GitFeatureError }> {
		const current = (await this.run(repo, ['symbolic-ref', '-q', '--short', 'HEAD'])).stdout.toString().trim();
		const defaultBranch = await this.getDefaultBranch(repo);
		const branches = await this.run(repo, ['for-each-ref', '--format=' + ['%(refname:short)', '%(objectname)', '%(upstream:short)', '%(upstream:track)', '%(committerdate:unix)', '%(authorname)'].join('%1f'), 'refs/heads']);
		if (branches.code !== 0) return { defaultBranch: null, candidates: [], error: branches.stderr || 'Unable to read the branches.' };
		const merged = new Set(defaultBranch !== null ? splitLines((await this.run(repo, ['for-each-ref', '--merged', defaultBranch, '--format=%(refname:short)', 'refs/heads'])).stdout) : []);
		const remoteRefs = new Set(splitLines((await this.run(repo, ['for-each-ref', '--format=%(refname)', 'refs/remotes'])).stdout));
		const remotes = splitLines((await this.run(repo, ['remote'])).stdout);
		const worktreeBranches = new Set(splitLines((await this.run(repo, ['worktree', 'list', '--porcelain'])).stdout).filter((line) => line.startsWith('branch refs/heads/')).map((line) => line.substring(18)));
		const defaultLocal = defaultBranch !== null ? defaultBranch.replace(new RegExp('^(' + remotes.map(escapeRegExp).join('|') + ')/'), '') : null;

		const candidates: GitBranchCleanupCandidate[] = [];
		for (const line of splitLines(branches.stdout)) {
			const [name, hash, upstream, track, date, author] = line.split(FIELD);
			if (typeof author === 'undefined' || name === current || name === defaultBranch || name === defaultLocal || worktreeBranches.has(name)) continue;
			let isMerged = merged.has(name);
			const upstreamGone = upstream !== '' && track === '[gone]';
			if (!isMerged && !upstreamGone) continue;
			let unmergedCommits = 0;
			if (!isMerged) {
				const count = await this.run(repo, ['rev-list', '--count', 'refs/heads/' + name, '--not', '--exclude=' + name, '--branches', '--remotes', '--tags']);
				unmergedCommits = parseInt(count.stdout.toString().trim()) || 0;
				if (unmergedCommits > 0 && defaultBranch !== null) {
					const cherry = await this.run(repo, ['cherry', defaultBranch, 'refs/heads/' + name]);
					const cherryLines = splitLines(cherry.stdout);
					if (cherry.code === 0 && cherryLines.length > 0 && cherryLines.every((cherryLine) => cherryLine.startsWith('- '))) {
						isMerged = true;
						unmergedCommits = 0;
					}
				}
			}
			candidates.push({
				name: name,
				hash: hash,
				upstream: upstream !== '' ? upstream : null,
				upstreamGone: upstreamGone,
				merged: isMerged,
				unmergedCommits: unmergedCommits,
				date: parseInt(date) || 0,
				author: author,
				remotes: remotes.filter((remote) => remoteRefs.has('refs/remotes/' + remote + '/' + name))
			});
		}
		candidates.sort((a, b) => (a.unmergedCommits === 0) !== (b.unmergedCommits === 0) ? (a.unmergedCommits === 0 ? -1 : 1) : b.date - a.date);
		return { defaultBranch: defaultBranch, candidates: candidates, error: null };
	}

	public async getDefaultBranch(repo: string): Promise<string | null> {
		const originHead = (await this.run(repo, ['symbolic-ref', '-q', '--short', 'refs/remotes/origin/HEAD'])).stdout.toString().trim();
		const candidates = originHead !== '' ? [originHead.replace(/^origin\//, ''), originHead] : [];
		candidates.push('main', 'master', 'origin/main', 'origin/master');
		for (const candidate of candidates) {
			const ref = candidate.startsWith('origin/') ? 'refs/remotes/' + candidate : 'refs/heads/' + candidate;
			if ((await this.run(repo, ['rev-parse', '-q', '--verify', ref])).code === 0) return candidate;
		}
		return null;
	}


	/* Rewriting the Latest Commits */

	public async amendCommit(repo: string, options: {
		message: string;
		sign: boolean;
		includeStaged?: boolean;
		stageAll?: boolean;
		author?: string | null;
		resetAuthorDate?: boolean;
		noVerify?: boolean;
	}): Promise<GitFeatureError> {
		if (options.message.trim() === '') return 'The message can\'t be empty.';
		if (options.stageAll) {
			const addErr = await this.change(repo, ['add', '-A']);
			if (addErr !== null) return addErr;
		}
		const args = ['commit', '--amend'];
		if (!(options.includeStaged || options.stageAll)) args.push('--only');
		args.push('--allow-empty', '--cleanup=strip', '-F', '-');
		if (options.author && options.author.trim()) {
			const cleanAuthor = options.author.trim().replace(/[\r\n\0]/g, '');
			if (cleanAuthor.startsWith('-')) return 'Invalid author format.';
			args.push('--author=' + cleanAuthor);
		}
		if (options.resetAuthorDate) args.push('--date=now');
		if (options.sign) args.push('-S');
		if (options.noVerify) args.push('--no-verify');
		const result = await runGit(this.git, repo, args, Buffer.from(options.message, 'utf8'), null, { GIT_EDITOR: ':' });
		return result.code === 0 ? null : errorOf(result);
	}

	public async amendMessage(repo: string, message: string, sign: boolean): Promise<GitFeatureError> {
		return this.amendCommit(repo, { message, sign, includeStaged: false });
	}

	public async getCommitAuthor(repo: string, hash: string): Promise<string | null> {
		if (!HASH_REGEXP.test(hash)) return null;
		const result = await this.run(repo, ['-c', 'log.showSignature=false', 'log', '-1', '--format=%an <%ae>', hash, '--']);
		const text = result.stdout.toString('utf8').trim();
		return result.code === 0 && text ? text : null;
	}

	public async getStagedFileCount(repo: string): Promise<number> {
		const result = await this.run(repo, ['diff', '--cached', '--name-only']);
		if (result.code !== 0) return 0;
		return splitLines(result.stdout).length;
	}

	public async undoCommit(repo: string, mode: 'soft' | 'mixed'): Promise<GitFeatureError> {
		if ((await this.run(repo, ['rev-parse', '-q', '--verify', 'HEAD^'])).code !== 0) return 'The commit doesn\'t have a parent, so it can\'t be undone.';
		return this.change(repo, ['reset', '--' + mode, 'HEAD^']);
	}

	public async fixupCommit(repo: string, hash: string, sign: boolean): Promise<GitFeatureError> {
		if (!HASH_REGEXP.test(hash)) return 'Invalid commit hash: ' + hash;
		if ((await this.run(repo, ['diff', '--cached', '--quiet'])).code === 0) return 'There aren\'t any staged changes to add to the commit.';
		const headBefore = await this.resolveCommit(repo, 'HEAD');
		const commit = await this.change(repo, ['commit', '--no-verify', '-m', 'fixup! ' + hash].concat(sign ? ['-S'] : []));
		if (commit !== null) return commit;
		const fixupHash = await this.resolveCommit(repo, 'HEAD');
		if (fixupHash === null) return 'Unable to resolve the fixup commit.';
		const isRoot = (await this.run(repo, ['rev-parse', '-q', '--verify', hash + '^'])).code !== 0;
		const revList = await this.run(repo, ['rev-list', '--reverse'].concat(isRoot ? ['HEAD'] : [hash + '^..HEAD']));
		const commits = splitLines(revList.stdout).filter((c) => c !== fixupHash);
		if (!commits.includes(hash)) {
			if (headBefore !== null) await this.change(repo, ['reset', '--soft', headBefore]);
			return 'Only commits of the current branch can be fixed up.';
		}
		const todoLines: string[] = [];
		commits.forEach((c) => {
			todoLines.push('pick ' + c);
			if (c === hash) todoLines.push('fixup ' + fixupHash);
		});
		const directory = await createRepoTempFiles(repo, 'git-map-fixup-', { 'git-rebase-todo': todoLines.join('\n') + '\n' });
		const todoFile = (isRemoteRepo(repo) ? path.posix.join(directory, 'git-rebase-todo') : path.join(directory, 'git-rebase-todo')).replace(/\\/g, '/');
		const args = ['rebase', '--interactive', '--autostash'].concat(sign ? ['-S'] : [], isRoot ? ['--root'] : [hash + '^']);
		const rebase = await runGit(this.git, repo, args, null, null, { GIT_SEQUENCE_EDITOR: 'cp \'' + todoFile.replace(/'/g, '\'\\\'\'') + '\'', GIT_EDITOR: ':' });
		const rebaseMerge = await this.getGitPath(repo, 'rebase-merge'), rebaseApply = await this.getGitPath(repo, 'rebase-apply');
		const inProgress = await this.gitPathExists(repo, rebaseMerge) || await this.gitPathExists(repo, rebaseApply);
		if (!inProgress) void removeRepoTempDir(repo, directory);
		return rebase.code === 0 ? null : errorOf(rebase);
	}


	/* Bisecting */

	public async getBisectState(repo: string): Promise<GitBisectState | null> {
		const startFile = await this.getGitPath(repo, 'BISECT_START');
		if (!(await this.gitPathExists(repo, startFile))) return null;
		const refs = splitLines((await this.run(repo, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/bisect'])).stdout).map((line) => line.split(' '));
		const bad = refs.find(([ref]) => ref === 'refs/bisect/bad'), good = refs.filter(([ref]) => ref.startsWith('refs/bisect/good-')).map(([, hash]) => hash);
		const skipped = refs.filter(([ref]) => ref.startsWith('refs/bisect/skip-')).map(([, hash]) => hash);
		const head = (await this.run(repo, ['rev-parse', '-q', '--verify', 'HEAD'])).stdout.toString().trim();
		let remaining: number | null = null, steps: number | null = null, candidates: string[] | null = null;
		if (typeof bad !== 'undefined' && good.length > 0) {
			const range = await this.run(repo, ['rev-list', '--max-count=10000', bad[1], '--not'].concat(good));
			if (range.code === 0) candidates = splitLines(range.stdout);
			const vars = (await this.run(repo, ['rev-list', '--bisect-vars', bad[1], '--not'].concat(good))).stdout.toString();
			const value = (name: string) => {
				const match = vars.match(new RegExp('^' + name + '=\'?(\\d+)', 'm'));
				return match !== null ? parseInt(match[1]) : null;
			};
			remaining = value('bisect_nr');
			steps = value('bisect_steps');
		}
		const logFile = await this.getGitPath(repo, 'BISECT_LOG');
		const logBuf = logFile !== null ? await readRepoFileBuffer(repo, logFile) : null;
		const log = logBuf !== null ? logBuf.toString('utf8') : '';
		const firstBad = log.match(/^# first '?[^\s']+'? commit: \[([0-9a-f]{40,64})\]/m);
		return {
			bad: typeof bad !== 'undefined' ? bad[1] : null,
			good: good,
			skipped: skipped,
			current: HASH_REGEXP.test(head) ? head : null,
			remaining: remaining,
			steps: steps,
			firstBad: firstBad !== null ? firstBad[1] : null,
			candidates: candidates
		};
	}

	public async bisect(repo: string, action: 'start' | 'good' | 'bad' | 'skip' | 'reset', hash: string | null, goodRef: string | null): Promise<GitFeatureError> {
		if (action === 'start') {
			if (hash === null || goodRef === null || goodRef.trim() === '') return 'A bad and a good commit are required to start bisecting.';
			const bad = await this.resolveCommit(repo, hash.trim()), good = await this.resolveCommit(repo, goodRef.trim());
			if (bad === null) return 'Unable to resolve "' + hash.trim() + '" to a commit.';
			if (good === null) return 'Unable to resolve "' + goodRef.trim() + '" to a commit.';
			if (bad === good || (await this.run(repo, ['merge-base', '--is-ancestor', good, bad])).code !== 0) return 'The good commit must be an ancestor of the bad commit.';
			return this.change(repo, ['bisect', 'start', bad, good, '--']);
		} else if (action === 'reset') {
			return this.change(repo, ['bisect', 'reset']);
		}
		if (hash !== null && !HASH_REGEXP.test(hash)) return 'Invalid commit hash: ' + hash;
		return this.change(repo, ['bisect', action].concat(hash !== null ? [hash] : []));
	}


	/* Patches */

	public async getCommitsPatch(repo: string, hashes: ReadonlyArray<string>): Promise<{ patch: string, error: GitFeatureError }> {
		const patches: string[] = [];
		let totalBytes = 0;
		for (const hash of hashes) {
			if (!HASH_REGEXP.test(hash)) return { patch: '', error: 'Invalid commit hash: ' + hash };
			const result = await runGit(this.git, repo, ['format-patch', '--stdout', '--binary', '--no-signature', '-1', hash], null, null, undefined, MAX_PATCH_BYTES - totalBytes);
			if (result.truncated) return { patch: '', error: 'The patch is larger than 25 MB.' };
			if (result.code !== 0) return { patch: '', error: errorOf(result) };
			totalBytes += result.stdout.length;
			patches.push(result.stdout.toString());
		}
		return { patch: patches.join(''), error: null };
	}

	public async getStashPatch(repo: string, hash: string): Promise<{ patch: string, error: GitFeatureError }> {
		const tracked = await runGit(this.git, repo, ['diff', '--binary', '--no-color', '--no-ext-diff', hash + '^1', hash, '--'], null, null, undefined, MAX_PATCH_BYTES);
		if (tracked.truncated) return { patch: '', error: 'The patch is larger than 25 MB.' };
		if (tracked.code !== 0) return { patch: '', error: errorOf(tracked) };
		let patch = tracked.stdout.toString();
		if ((await this.run(repo, ['rev-parse', '-q', '--verify', hash + '^3'])).code === 0) {
			const untracked = await runGit(this.git, repo, ['diff', '--binary', '--no-color', '--no-ext-diff', EMPTY_TREE_HASH, hash + '^3', '--'], null, null, undefined, Math.max(1, MAX_PATCH_BYTES - tracked.stdout.length));
			if (untracked.truncated) return { patch: '', error: 'The patch is larger than 25 MB.' };
			if (untracked.code === 0) patch += untracked.stdout.toString();
		}
		return { patch: patch, error: null };
	}

	public async getUncommittedPatch(repo: string): Promise<{ patch: string, error: GitFeatureError }> {
		const result = await runGit(this.git, repo, ['diff', '--binary', '--no-color', '--no-ext-diff', 'HEAD', '--'], null, null, undefined, MAX_PATCH_BYTES);
		if (result.truncated) return { patch: '', error: 'The patch is larger than 25 MB.' };
		return result.code === 0 ? { patch: result.stdout.toString(), error: null } : { patch: '', error: errorOf(result) };
	}

	public async checkPatch(repo: string, file: string): Promise<{ patch: GitPatchInfo | null, error: GitFeatureError }> {
		let patchBytes: Buffer;
		try {
			if (isRemoteRepo(file)) {
				const parsed = parseRemoteRepo(file)!;
				patchBytes = await sshManager.readRemoteFile(parsed.hostId, parsed.remotePath);
			} else {
				patchBytes = fs.readFileSync(file);
			}
		} catch (error) {
			return { patch: null, error: 'Unable to read the file: ' + String(error) };
		}
		const contents = patchBytes.toString('utf8');
		const numstat = await runGit(this.git, repo, ['apply', '--numstat', '-z', '-'], patchBytes);
		if (numstat.code !== 0) return { patch: null, error: 'The file isn\'t a patch: ' + errorOf(numstat) };
		let files = 0, additions = 0, deletions = 0;
		numstat.stdout.toString().split('\0').forEach((record) => {
			const fields = record.replace(/^\n/, '').split('\t');
			if (fields.length < 3) return;
			files++;
			additions += parseInt(fields[0]) || 0;
			deletions += parseInt(fields[1]) || 0;
		});
		const commits = (contents.match(/^From [0-9a-f]{40,64} Mon Sep 17 00:00:00 2001$/gm) || []).length;
		const check = await runGit(this.git, repo, commits > 0 ? ['apply', '--check', '-'] : ['apply', '--check', '--3way', '-'], patchBytes);
		return {
			patch: {
				file: file,
				name: path.basename(file),
				commits: commits,
				files: files,
				additions: additions,
				deletions: deletions,
				appliesCleanly: check.code === 0,
				checkError: check.code === 0 ? null : errorOf(check)
			},
			error: null
		};
	}

	public async applyPatch(repo: string, file: string, asCommits: boolean): Promise<GitFeatureError> {
		let patchBytes: Buffer;
		try {
			if (isRemoteRepo(file)) {
				const parsed = parseRemoteRepo(file)!;
				patchBytes = await sshManager.readRemoteFile(parsed.hostId, parsed.remotePath);
			} else {
				patchBytes = fs.readFileSync(file);
			}
		} catch (error) {
			return 'Unable to read the file: ' + String(error);
		}
		const args = asCommits ? ['am', '--3way'] : ['apply', '--3way', '-'];
		const result = await runGit(this.git, repo, args, patchBytes, null, { GIT_EDITOR: ':' });
		return result.code === 0 ? null : errorOf(result);
	}


	/* Stashes */

	public async getStashableFiles(repo: string): Promise<{ files: GitStashableFile[], error: GitFeatureError }> {
		const status = await this.run(repo, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
		if (status.code !== 0) return { files: [], error: errorOf(status) };
		const records = status.stdout.toString().split('\0'), files: GitStashableFile[] = [];
		for (let i = 0; i < records.length; i++) {
			const record = records[i];
			if (record.length < 4) continue;
			const x = record[0], y = record[1];
			files.push({ path: record.substring(3), staged: x !== ' ' && x !== '?', unstaged: y !== ' ' && y !== '?', untracked: x === '?' });
			if (x === 'R' || x === 'C') i++;
		}
		return { files: files, error: null };
	}

	public async restoreFileFromStash(repo: string, hash: string, filePath: string, untracked: boolean, force: boolean): Promise<{ error: GitFeatureError, hasChanges: boolean }> {
		if (!HASH_REGEXP.test(hash)) return { error: 'Invalid stash hash: ' + hash, hasChanges: false };
		if (path.isAbsolute(filePath) || filePath.startsWith('..') || filePath.includes('/../')) return { error: 'Invalid file path: ' + filePath, hasChanges: false };
		const status = await this.run(repo, ['status', '--porcelain', '--untracked-files=all', '--', ':(literal)' + filePath]);
		if (!force && status.stdout.toString().trim() !== '') return { error: null, hasChanges: true };
		const source = untracked ? hash + '^3' : hash;
		const restored = await this.change(repo, ['restore', '--source=' + source, '--worktree', '--', ':(literal)' + filePath]);
		if (restored === null) return { error: null, hasChanges: false };
		const contents = await this.run(repo, ['show', source + ':' + filePath]);
		if (contents.code !== 0) return { error: restored, hasChanges: false };
		try {
			await writeRepoFileBuffer(repo, filePath, contents.stdout);
		} catch (error) {
			return { error: 'Unable to write the file: ' + String(error), hasChanges: false };
		}
		return { error: null, hasChanges: false };
	}


	/* The Visual History of a File */

	public async getFileTimeline(repo: string, filePath: string, maxCommits: number, revision: string = 'HEAD'): Promise<{ commits: GitFileTimelineCommit[], error: GitFeatureError }> {
		const rev = revision === 'HEAD' || HASH_REGEXP.test(revision) ? revision : 'HEAD';
		const result = await this.run(repo, ['-c', 'core.quotepath=false', '-c', 'log.showSignature=false', 'log', '--follow', '-M', '--max-count=' + maxCommits, '--format=' + RECORD + '%H' + FIELD + '%aN' + FIELD + '%aE' + FIELD + '%at' + FIELD + '%s', '--numstat', '--summary', rev, '--', filePath]);
		if (result.code !== 0) return { commits: [], error: errorOf(result) };
		const commits: GitFileTimelineCommit[] = [];
		result.stdout.toString().split(RECORD).slice(1).forEach((record) => {
			const recordLines = record.split(/\r?\n/), header = recordLines[0].split(FIELD);
			if (header.length < 5) return;
			let additions = 0, deletions = 0, currentPath = filePath, oldFilePath: string | null = null, added = false;
			recordLines.slice(1).forEach((line) => {
				if (line.startsWith(' create mode ')) added = true;
				const fields = line.split('\t');
				if (fields.length < 3) return;
				additions += parseInt(fields[0]) || 0;
				deletions += parseInt(fields[1]) || 0;
				const changedPath = fields.slice(2).join('\t'), arrow = changedPath.indexOf(' => ');
				if (arrow > -1) {
					oldFilePath = changedPath.replace(/^(.*)\{(.*) => (.*)\}(.*)$/, '$1$2$4').replace(/ => .*$/, '').replace(/\/\//g, '/');
					currentPath = changedPath.replace(/^(.*)\{(.*) => (.*)\}(.*)$/, '$1$3$4').replace(/^.* => /, '').replace(/\/\//g, '/');
				} else {
					currentPath = changedPath;
				}
			});
			commits.push({ hash: header[0], author: header[1], email: header[2], date: parseInt(header[3]) || 0, subject: header.slice(4).join(FIELD), additions: additions, deletions: deletions, filePath: currentPath, oldFilePath: oldFilePath, added: added });
		});
		return { commits: commits, error: null };
	}


	/* Explaining a Commit & Generating a Commit Message */

	public async getCommitForExplanation(repo: string, hash: string): Promise<{ text: string, truncated: boolean, error: GitFeatureError }> {
		if (!HASH_REGEXP.test(hash)) return { text: '', truncated: false, error: 'Invalid commit hash: ' + hash };
		const result = await runGit(this.git, repo, ['-c', 'log.showSignature=false', 'show', '-m', '--first-parent', '--no-color', '--no-ext-diff', '-M', '--stat', '--patch', '--format=Subject: %s%n%n%b', hash, '--'], null, null, undefined, MAX_EXPLAIN_BYTES);
		if (result.code !== 0 && !result.truncated) return { text: '', truncated: false, error: errorOf(result) };
		const capped = truncateModelInput(result.stdout.toString(), result.truncated);
		return { text: capped.text, truncated: capped.truncated, error: null };
	}

	public async getChangesForCommitMessage(repo: string): Promise<{ text: string, scope: 'staged' | 'unstaged' | 'none', recentSubjects: string[], truncated: boolean, error: GitFeatureError }> {
		const staged = await runGit(this.git, repo, ['diff', '--cached', '--no-color', '--no-ext-diff', '-M', '--stat', '--patch', '--'], null, null, undefined, MAX_EXPLAIN_BYTES);
		if (staged.code !== 0 && !staged.truncated) return { text: '', scope: 'none', recentSubjects: [], truncated: false, error: errorOf(staged) };
		const getRecentSubjects = async () => {
			const recent = await this.run(repo, ['-c', 'log.showSignature=false', 'log', '-n', '5', '--format=%s']);
			return recent.code === 0 ? splitLines(recent.stdout).slice(0, 5) : [];
		};
		if (staged.stdout.length > 0) {
			const capped = truncateModelInput(staged.stdout.toString(), staged.truncated);
			return { text: capped.text, scope: 'staged', recentSubjects: await getRecentSubjects(), truncated: capped.truncated, error: null };
		}

		const [unstaged, untracked] = await Promise.all([
			runGit(this.git, repo, ['diff', '--no-color', '--no-ext-diff', '-M', '--stat', '--patch', '--'], null, null, undefined, MAX_EXPLAIN_BYTES),
			runGit(this.git, repo, ['ls-files', '--others', '--exclude-standard', '-z'], null, null, undefined, MAX_EXPLAIN_BYTES)
		]);
		if (unstaged.code !== 0 && !unstaged.truncated) return { text: '', scope: 'none', recentSubjects: [], truncated: false, error: errorOf(unstaged) };
		const untrackedPaths = untracked.code === 0 || untracked.truncated ? untracked.stdout.toString().split('\0').filter((p) => p !== '') : [];
		if (unstaged.stdout.length === 0 && untrackedPaths.length === 0) {
			return { text: '', scope: 'none', recentSubjects: [], truncated: false, error: null };
		}

		let combined = unstaged.stdout.toString();
		let extraTruncated = unstaged.truncated || untracked.truncated;
		if (untrackedPaths.length > 0) {
			const sections: string[] = ['Untracked files (' + untrackedPaths.length + '): ' + untrackedPaths.slice(0, 30).join(', ')];
			if (untrackedPaths.length > 30) extraTruncated = true;
			let totalPreviewBytes = 0;
			for (const relPath of untrackedPaths.slice(0, 15)) {
				if (totalPreviewBytes >= 32768) {
					extraTruncated = true;
					break;
				}
				if (relPath.startsWith('..') || path.isAbsolute(relPath)) continue;
				const buf = await readRepoFileBuffer(repo, relPath, 4097);
				if (buf === null) continue;
				if (buf.includes(0)) {
					sections.push('--- /dev/null\n+++ b/' + relPath + '\n(Binary file)');
				} else {
					const sliced = buf.length > 4096 ? buf.subarray(0, 4096) : buf;
					if (buf.length > 4096) extraTruncated = true;
					totalPreviewBytes += sliced.length;
					const addedLines = sliced.toString('utf8').split(/\r?\n/).map((line) => '+' + line).join('\n');
					sections.push('--- /dev/null\n+++ b/' + relPath + '\n' + addedLines);
				}
			}
			if (untrackedPaths.length > 15) extraTruncated = true;
			combined = (combined !== '' ? combined + '\n\n' : '') + sections.join('\n\n');
		}
		const capped = truncateModelInput(combined, extraTruncated);
		return { text: capped.text, scope: 'unstaged', recentSubjects: await getRecentSubjects(), truncated: capped.truncated, error: null };
	}


	/* Helpers */

	public async getCommitMessage(repo: string, hash: string): Promise<string | null> {
		if (!HASH_REGEXP.test(hash)) return null;
		const result = await this.run(repo, ['-c', 'log.showSignature=false', 'log', '-1', '--format=%B', hash, '--']);
		return result.code === 0 ? result.stdout.toString().replace(/\s+$/, '') : null;
	}

	public async getRemoteBranchContaining(repo: string, hash: string): Promise<string | null> {
		if (!HASH_REGEXP.test(hash)) return null;
		const result = await this.run(repo, ['for-each-ref', '--contains', hash, '--format=%(refname:short)', 'refs/remotes']);
		const branch = result.code === 0 ? splitLines(result.stdout).find((name) => !name.endsWith('/HEAD')) : undefined;
		return typeof branch !== 'undefined' ? branch : null;
	}

	public async resolveCommit(repo: string, revision: string): Promise<string | null> {
		if (revision.startsWith('-')) return null;
		const result = await this.run(repo, ['rev-parse', '-q', '--verify', revision + '^{commit}']);
		const hash = result.stdout.toString().trim();
		return result.code === 0 && HASH_REGEXP.test(hash) ? hash : null;
	}

	public async getBisectLogPath(repo: string): Promise<string | null> {
		const file = await this.getGitPath(repo, 'BISECT_LOG');
		if (!(await this.gitPathExists(repo, file))) return null;
		if (isRemoteRepo(repo) && file !== null) {
			const parsed = parseRemoteRepo(repo)!;
			return `ssh://${encodeURIComponent(parsed.hostId)}${file}`;
		}
		return file;
	}

	private async getGitPath(repo: string, file: string) {
		const result = await this.run(repo, ['rev-parse', '--git-path', file]);
		if (result.code !== 0) return null;
		const trimmed = result.stdout.toString().trim();
		const parsed = parseRemoteRepo(repo);
		if (parsed !== null) {
			return trimmed.startsWith('/') ? trimmed : path.posix.resolve(parsed.remotePath, trimmed);
		}
		return path.resolve(repo, trimmed);
	}

	private async gitPathExists(repo: string, gitPath: string | null): Promise<boolean> {
		if (gitPath === null) return false;
		const parsed = parseRemoteRepo(repo);
		if (parsed !== null) {
			return sshManager.remoteExists(parsed.hostId, gitPath);
		}
		return fs.existsSync(gitPath);
	}

	private async withMessageFile<T>(repo: string, message: string, fn: (file: string) => Promise<T>): Promise<T> {
		const directory = await createRepoTempFiles(repo, 'git-map-message-', { 'message.txt': message });
		const file = (isRemoteRepo(repo) ? path.posix.join(directory, 'message.txt') : path.join(directory, 'message.txt')).replace(/\\/g, '/');
		try {
			return await fn(file);
		} finally {
			await removeRepoTempDir(repo, directory).catch(() => { });
		}
	}


	/* Range Diff & Commit Log for AI Code Review & Release Notes */

	public async getRangeForReviewOrReleaseNotes(repo: string, fromRef: string, toRef: string): Promise<{ commitsText: string, diffText: string, truncated: boolean, error: GitFeatureError }> {
		const fromHash = await this.resolveCommit(repo, fromRef);
		const toHash = await this.resolveCommit(repo, toRef);
		if (fromHash === null || toHash === null) {
			return { commitsText: '', diffText: '', truncated: false, error: 'Unable to resolve "' + (fromHash === null ? fromRef : toRef) + '" to a commit.' };
		}
		const [logRes, diffRes] = await Promise.all([
			runGit(this.git, repo, ['-c', 'log.showSignature=false', 'log', '--no-merges', '--max-count=150', '--format=- %h (%an): %s', fromHash + '..' + toHash, '--'], null, null, undefined, MAX_EXPLAIN_BYTES),
			runGit(this.git, repo, ['diff', '--no-color', '--no-ext-diff', '-M', '--stat', '--patch', fromHash, toHash, '--'], null, null, undefined, MAX_EXPLAIN_BYTES)
		]);
		if (diffRes.code !== 0 && !diffRes.truncated) {
			return { commitsText: '', diffText: '', truncated: false, error: errorOf(diffRes) };
		}
		const capped = truncateModelInput(diffRes.stdout.toString(), diffRes.truncated);
		return {
			commitsText: logRes.code === 0 ? logRes.stdout.toString().trim() : '',
			diffText: capped.text,
			truncated: capped.truncated || logRes.truncated,
			error: null
		};
	}


	/* Inline Staging, Hunk Staging, Committing & Moving Branches */

	public async getWorkingTreeStatus(repo: string): Promise<{
		files: WorkingTreeStatusItem[],
		headMessage: string | null,
		error: GitFeatureError
	}> {
		const [statusRes, headHash] = await Promise.all([
			this.run(repo, ['-c', 'core.quotepath=false', 'status', '--porcelain=v1', '-z', '-uall']),
			this.resolveCommit(repo, 'HEAD')
		]);
		if (statusRes.code !== 0) return { files: [], headMessage: null, error: errorOf(statusRes) };
		const headMessage = headHash !== null ? await this.getCommitMessage(repo, headHash) : null;
		const tokens = statusRes.stdout.toString().split('\0');
		const files: WorkingTreeStatusItem[] = [];
		const conflictPairs = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);
		for (let i = 0; i < tokens.length; i++) {
			const entry = tokens[i];
			if (entry.length < 4) continue;
			const x = entry[0], y = entry[1], xy = x + y;
			const filePath = entry.substring(3);
			let oldPath: string | null = null;
			if ((x === 'R' || x === 'C') && i + 1 < tokens.length) {
				oldPath = tokens[++i] || null;
			}
			const untracked = xy === '??';
			const conflicted = conflictPairs.has(xy);
			const staged = !untracked && !conflicted && x !== ' ';
			const unstaged = untracked || conflicted || y !== ' ';
			files.push({
				path: filePath,
				oldPath: oldPath,
				indexStatus: x,
				workTreeStatus: y,
				staged: staged,
				unstaged: unstaged,
				untracked: untracked,
				conflicted: conflicted
			});
		}
		return { files: files, headMessage: headMessage, error: null };
	}

	public async stageFiles(repo: string, paths: ReadonlyArray<string> | null): Promise<GitFeatureError> {
		if (paths === null) return this.change(repo, ['add', '-A']);
		if (paths.length === 0) return null;
		return this.change(repo, ['add', '--', ...paths]);
	}

	public async unstageFiles(repo: string, paths: ReadonlyArray<string> | null): Promise<GitFeatureError> {
		const head = await this.resolveCommit(repo, 'HEAD');
		if (head === null) {
			return paths === null
				? this.change(repo, ['rm', '--cached', '-r', '-q', '--', '.'])
				: (paths.length === 0 ? null : this.change(repo, ['rm', '--cached', '-r', '-q', '--', ...paths]));
		}
		return paths === null
			? this.change(repo, ['reset', '-q', 'HEAD', '--'])
			: (paths.length === 0 ? null : this.change(repo, ['reset', '-q', 'HEAD', '--', ...paths]));
	}

	public async discardWorkingChanges(repo: string, trackedPaths: ReadonlyArray<string>, untrackedPaths: ReadonlyArray<string>): Promise<GitFeatureError> {
		if (trackedPaths.length > 0) {
			const err = await this.change(repo, ['checkout', '--', ...trackedPaths]);
			if (err !== null) return err;
		}
		if (untrackedPaths.length > 0) {
			if (isRemoteRepo(repo)) {
				const cleanErr = await this.change(repo, ['clean', '-fd', '--', ...untrackedPaths]);
				if (cleanErr !== null) return cleanErr;
			} else {
				const repoResolved = path.resolve(repo);
				for (const relPath of untrackedPaths) {
					const abs = path.resolve(repoResolved, relPath);
					const rel = path.relative(repoResolved, abs);
					if (rel.startsWith('..') || path.isAbsolute(rel)) return 'Refusing to delete path outside repository: ' + relPath;
					try {
						await fs.promises.rm(abs, { recursive: true, force: true });
					} catch (e) {
						return String(e);
					}
				}
			}
		}
		return null;
	}

	public async getFileHunkDiff(repo: string, filePath: string, staged: boolean): Promise<{ diff: string, error: GitFeatureError }> {
		const args = staged
			? ['-c', 'core.quotepath=false', 'diff', '--cached', '--no-color', '--no-ext-diff', '-U3', '--', filePath]
			: ['-c', 'core.quotepath=false', 'diff', '--no-color', '--no-ext-diff', '-U3', '--', filePath];
		const res = await runGit(this.git, repo, args, null, null, undefined, MAX_EXPLAIN_BYTES);
		if (res.code !== 0 && !res.truncated) return { diff: '', error: errorOf(res) };
		return { diff: res.stdout.toString(), error: null };
	}

	public async applyHunkPatch(repo: string, patch: string, action: 'stage' | 'unstage' | 'discard'): Promise<GitFeatureError> {
		const normalized = patch.endsWith('\n') ? patch : patch + '\n';
		const args = action === 'stage'
			? ['apply', '--cached', '--unidiff-zero', '--whitespace=nowarn', '-']
			: action === 'unstage'
				? ['apply', '--cached', '-R', '--unidiff-zero', '--whitespace=nowarn', '-']
				: ['apply', '-R', '--unidiff-zero', '--whitespace=nowarn', '-'];
		const res = await runGit(this.git, repo, args, Buffer.from(normalized, 'utf8'), null, { GIT_EDITOR: ':' });
		return res.code === 0 ? null : errorOf(res);
	}

	public async commitStagedChanges(
		repo: string,
		message: string,
		amend: boolean,
		stageAllIfEmpty: boolean,
		sign: boolean,
		options?: { readonly noVerify?: boolean, readonly signoff?: boolean }
	): Promise<GitFeatureError> {
		if (message.trim() === '') return 'The commit message can\'t be empty.';
		if (!amend && stageAllIfEmpty) {
			const cached = await this.run(repo, ['diff', '--cached', '--quiet', '--']);
			if (cached.code === 0) {
				const stageErr = await this.stageFiles(repo, null);
				if (stageErr !== null) return stageErr;
			}
		}
		const args = [
			'commit',
			...(sign ? ['-S'] : []),
			...(options && options.signoff ? ['-s'] : []),
			...(options && options.noVerify ? ['--no-verify'] : []),
			...(amend ? ['--amend'] : [])
		];
		return this.withMessageFile(repo, message, (file) => this.change(repo, [...args, '-F', file]));
	}

	public async getRepoHooksAndTemplate(repo: string): Promise<{
		readonly hooks: ReadonlyArray<RepoHookInfo>,
		readonly commitTemplate: string | null
	}> {
		const hooks: RepoHookInfo[] = [];
		const seenNames = new Set<string>();

		if (isRemoteRepo(repo)) {
			const parsed = parseRemoteRepo(repo)!;
			const hookNames = ['pre-commit', 'prepare-commit-msg', 'commit-msg', 'post-commit', 'pre-push', 'pre-rebase'];
			const hooksDir = await this.getGitPath(repo, 'hooks');
			if (hooksDir !== null) {
				for (const name of hookNames) {
					const full = path.posix.join(hooksDir, name);
					if (await sshManager.remoteExists(parsed.hostId, full).catch(() => false)) {
						hooks.push({ name: name, path: full });
					}
				}
			}
			for (const name of hookNames) {
				const huskyPath = path.posix.join(parsed.remotePath, '.husky', name);
				if (await sshManager.remoteExists(parsed.hostId, huskyPath).catch(() => false)) {
					hooks.push({ name: '.husky/' + name, path: huskyPath });
				}
			}
			const msgBuf = await readRepoFileBuffer(repo, '.gitmessage', 32768);
			const commitTemplate = msgBuf !== null
				? (msgBuf.toString('utf8').split(/\r?\n/).filter((l) => !l.trim().startsWith('#')).join('\n').trim() || null)
				: null;
			return { hooks: hooks, commitTemplate: commitTemplate };
		}

		const scanDir = async (dir: string, prefix: string) => {
			try {
				const entries = await fs.promises.readdir(dir, { withFileTypes: true });
				for (const ent of entries) {
					if (!ent.isFile() || ent.name.endsWith('.sample') || ent.name.startsWith('.')) continue;
					const key = prefix + ent.name;
					if (seenNames.has(key)) continue;
					seenNames.add(key);
					hooks.push({ name: key, path: path.join(dir, ent.name) });
				}
			} catch (_) { /* directory absent */ }
		};

		const hooksPathRes = await this.run(repo, ['rev-parse', '--git-path', 'hooks']);
		if (hooksPathRes.code === 0) {
			const raw = hooksPathRes.stdout.toString().trim();
			if (raw !== '') {
				const absHooks = path.isAbsolute(raw) ? raw : path.resolve(repo, raw);
				await scanDir(absHooks, '');
			}
		}
		await scanDir(path.join(repo, '.husky'), '.husky/');

		let commitTemplate: string | null = null;
		const tmplRes = await this.run(repo, ['config', '--get', 'commit.template']);
		const candidates: string[] = [];
		if (tmplRes.code === 0) {
			const configured = tmplRes.stdout.toString().trim();
			if (configured !== '') {
				candidates.push(configured.startsWith('~') ? path.join(os.homedir(), configured.substring(1)) : path.resolve(repo, configured));
			}
		}
		candidates.push(path.join(repo, '.gitmessage'));
		for (const cand of candidates) {
			try {
				const text = await fs.promises.readFile(cand, 'utf8');
				const cleaned = text.split(/\r?\n/).filter((l) => !l.trim().startsWith('#')).join('\n').trim();
				if (cleaned !== '') {
					commitTemplate = cleaned;
					break;
				}
			} catch (_) { /* not found */ }
		}
		return { hooks: hooks, commitTemplate: commitTemplate };
	}

	public async getCommitNote(repo: string, commitHash: string): Promise<string | null> {
		if (!HASH_REGEXP.test(commitHash)) return null;
		const res = await this.run(repo, ['notes', 'show', commitHash]);
		return res.code === 0 ? res.stdout.toString().trim() : null;
	}

	public async setCommitNote(repo: string, commitHash: string, note: string | null): Promise<GitFeatureError> {
		if (!HASH_REGEXP.test(commitHash)) return 'Invalid commit hash.';
		if (note === null || note.trim() === '') {
			const res = await this.run(repo, ['notes', 'remove', commitHash]);
			return res.code === 0 || res.stderr.includes('has no note') ? null : errorOf(res);
		}
		return this.withMessageFile(repo, note.trim(), (file) => this.change(repo, ['notes', 'add', '-f', '-F', file, commitHash]));
	}

	public async getCommitSignatureDetails(repo: string, commitHash: string): Promise<CommitSignatureDetails | null> {
		if (!HASH_REGEXP.test(commitHash)) return null;
		const res = await this.run(repo, ['log', '-1', '--format=%G?%x1f%GS%x1f%GK%x1f%GF', commitHash]);
		if (res.code !== 0) return null;
		const parts = res.stdout.toString().trim().split('\x1f');
		const status = (parts[0] || '').trim();
		if (status === '' || status === 'N') return null;
		return {
			status: status,
			signer: (parts[1] || '').trim(),
			keyId: (parts[2] || '').trim(),
			fingerprint: (parts[3] || '').trim()
		};
	}

	public async runWorkflowMacro(repo: string, macroId: string, customSteps?: ReadonlyArray<string>): Promise<{ summary: string, error: GitFeatureError }> {
		if (macroId === 'fetch-rebase-prune') {
			const fetchErr = await this.change(repo, ['fetch', '--all', '--prune']);
			if (fetchErr !== null) return { summary: '', error: fetchErr };
			const upRes = await this.run(repo, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
			if (upRes.code !== 0) {
				return { summary: 'Fetched and pruned remotes (no upstream tracking branch configured for rebase).', error: null };
			}
			const upstream = upRes.stdout.toString().trim();
			const rebaseErr = await this.change(repo, ['rebase', upstream]);
			if (rebaseErr !== null) return { summary: '', error: rebaseErr };
			return { summary: 'Fetched, pruned, and rebased onto ' + upstream + '.', error: null };
		}
		if (macroId === 'stash-pull-pop') {
			const wt = await this.getWorkingTreeStatus(repo);
			const hasDirty = wt.files.length > 0;
			if (hasDirty) {
				const stashErr = await this.change(repo, ['stash', 'push', '-u', '-m', 'git-map-macro-autostash']);
				if (stashErr !== null) return { summary: '', error: stashErr };
			}
			const pullErr = await this.change(repo, ['pull', '--rebase']);
			if (pullErr !== null) return { summary: '', error: pullErr };
			if (hasDirty) {
				const popErr = await this.change(repo, ['stash', 'pop']);
				if (popErr !== null) return { summary: '', error: popErr };
			}
			return { summary: hasDirty ? 'Stashed changes, pulled with rebase, and restored stash.' : 'Pulled latest changes with rebase.', error: null };
		}
		if (Array.isArray(customSteps) && customSteps.length > 0) {
			const executed: string[] = [];
			for (const rawStep of customSteps) {
				const tokens = rawStep.trim().split(/\s+/).filter((s: string) => s !== '');
				if (tokens.length === 0) continue;
				const args = tokens[0] === 'git' ? tokens.slice(1) : tokens;
				if (args.length === 0) continue;
				const err = await this.change(repo, args);
				if (err !== null) return { summary: executed.join(' → '), error: 'Step "git ' + args.join(' ') + '" failed: ' + err };
				executed.push('git ' + args.join(' '));
			}
			return { summary: 'Completed: ' + executed.join(' → '), error: null };
		}
		return { summary: '', error: 'Unknown workflow macro: ' + macroId };
	}

	public async getReviewSessionScopeFiles(
		repo: string,
		scope: ReviewSessionScope
	): Promise<{
		scopeKey: string,
		baseLabel: string,
		headLabel: string,
		fromHash: string,
		toHash: string,
		commitCount: number,
		files: GitFileChange[],
		error: GitFeatureError
	}> {
		const headRes = await this.run(repo, ['rev-parse', 'HEAD']);
		const headHash = headRes.code === 0 ? headRes.stdout.toString().trim() : EMPTY_TREE_HASH;
		const branchRes = await this.run(repo, ['symbolic-ref', '-q', '--short', 'HEAD']);
		const headBranch = branchRes.code === 0 ? branchRes.stdout.toString().trim() : headHash.substring(0, 8);

		if (scope === 'uncommitted') {
			const statusRes = await this.getWorkingTreeStatus(repo);
			const statusItems = statusRes.files;
			const numstatMap: { [p: string]: { add: number | null, del: number | null } } = {};
			const nsRes = await this.run(repo, ['-c', 'core.quotepath=false', 'diff', '--numstat', 'HEAD', '--']);
			if (nsRes.code === 0) {
				splitLines(nsRes.stdout).forEach((line) => {
					const parts = line.split('\t');
					if (parts.length >= 3) {
						const add = parts[0] === '-' ? null : parseInt(parts[0], 10);
						const del = parts[1] === '-' ? null : parseInt(parts[1], 10);
						numstatMap[parts[parts.length - 1]] = { add: add, del: del };
					}
				});
			}
			const files: GitFileChange[] = statusItems.map((item) => {
				const st: GitFileStatus = item.untracked
					? GitFileStatus.Untracked
					: item.indexStatus === 'A'
						? GitFileStatus.Added
						: (item.indexStatus === 'D' || item.workTreeStatus === 'D')
							? GitFileStatus.Deleted
							: item.indexStatus === 'R'
								? GitFileStatus.Renamed
								: GitFileStatus.Modified;
				const stats = numstatMap[item.path];
				return {
					oldFilePath: item.oldPath || item.path,
					newFilePath: item.path,
					type: st,
					additions: stats ? stats.add : null,
					deletions: stats ? stats.del : null
				};
			});
			return {
				scopeKey: 'uncommitted:' + headBranch,
				baseLabel: 'HEAD (' + headBranch + ')',
				headLabel: 'Working Tree',
				fromHash: headHash,
				toHash: '*',
				commitCount: 0,
				files: files,
				error: null
			};
		}

		let fromHash = '';
		let baseLabel = '';
		if (scope === 'unpushed') {
			const upRef = await this.run(repo, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
			const upHashRes = await this.run(repo, ['rev-parse', '--verify', '@{u}']);
			if (upRef.code !== 0 || upHashRes.code !== 0) {
				return {
					scopeKey: 'unpushed:' + headBranch,
					baseLabel: '',
					headLabel: headBranch,
					fromHash: '',
					toHash: headHash,
					commitCount: 0,
					files: [],
					error: 'No upstream tracking branch is configured for "' + headBranch + '".'
				};
			}
			baseLabel = upRef.stdout.toString().trim();
			fromHash = upHashRes.stdout.toString().trim();
		} else {
			let defaultBranch = '';
			const originHead = await this.run(repo, ['symbolic-ref', '-q', '--short', 'refs/remotes/origin/HEAD']);
			if (originHead.code === 0) {
				defaultBranch = originHead.stdout.toString().trim().replace(/^origin\//, '');
			}
			const candidates = [defaultBranch, 'main', 'master', 'develop'].filter((c) => c !== '');
			let baseRef = '';
			for (const c of candidates) {
				if (c === headBranch) continue;
				const checkLocal = await this.run(repo, ['rev-parse', '--verify', '--quiet', 'refs/heads/' + c]);
				if (checkLocal.code === 0) { baseRef = c; break; }
				const checkRemote = await this.run(repo, ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/' + c]);
				if (checkRemote.code === 0) { baseRef = 'origin/' + c; break; }
			}
			if (baseRef === '') {
				return {
					scopeKey: 'branch:' + headBranch,
					baseLabel: '',
					headLabel: headBranch,
					fromHash: '',
					toHash: headHash,
					commitCount: 0,
					files: [],
					error: 'No base branch (main / master / develop) found to compare "' + headBranch + '" against.'
				};
			}
			baseLabel = baseRef;
			const mb = await this.run(repo, ['merge-base', baseRef, headHash]);
			if (mb.code === 0 && mb.stdout.toString().trim() !== '') {
				fromHash = mb.stdout.toString().trim();
			} else {
				const refHash = await this.run(repo, ['rev-parse', '--verify', baseRef]);
				fromHash = refHash.code === 0 ? refHash.stdout.toString().trim() : EMPTY_TREE_HASH;
			}
		}

		const countRes = await this.run(repo, ['rev-list', '--count', fromHash + '..' + headHash]);
		const commitCount = countRes.code === 0 ? parseInt(countRes.stdout.toString().trim(), 10) || 0 : 0;
		const [nameStatusRes, numstatRes] = await Promise.all([
			this.run(repo, ['-c', 'core.quotepath=false', 'diff', '--name-status', '-M', fromHash, headHash, '--']),
			this.run(repo, ['-c', 'core.quotepath=false', 'diff', '--numstat', '-M', fromHash, headHash, '--'])
		]);
		const numMap: { [p: string]: { add: number | null, del: number | null } } = {};
		if (numstatRes.code === 0) {
			splitLines(numstatRes.stdout).forEach((line) => {
				const parts = line.split('\t');
				if (parts.length >= 3) {
					const add = parts[0] === '-' ? null : parseInt(parts[0], 10);
					const del = parts[1] === '-' ? null : parseInt(parts[1], 10);
					numMap[parts[parts.length - 1]] = { add: add, del: del };
				}
			});
		}
		const files: GitFileChange[] = [];
		if (nameStatusRes.code === 0) {
			splitLines(nameStatusRes.stdout).forEach((line) => {
				const parts = line.split('\t');
				if (parts.length < 2) return;
				const code = parts[0][0];
				const oldPath = parts[1];
				const newPath = parts.length >= 3 ? parts[2] : parts[1];
				const type: GitFileStatus = code === 'A'
					? GitFileStatus.Added
					: code === 'D'
						? GitFileStatus.Deleted
						: code === 'R'
							? GitFileStatus.Renamed
							: GitFileStatus.Modified;
				const stats = numMap[newPath];
				files.push({
					oldFilePath: oldPath,
					newFilePath: newPath,
					type: type,
					additions: stats ? stats.add : null,
					deletions: stats ? stats.del : null
				});
			});
		}
		return {
			scopeKey: scope + ':' + headBranch + ':' + fromHash.substring(0, 8),
			baseLabel: baseLabel,
			headLabel: headBranch,
			fromHash: fromHash,
			toHash: headHash,
			commitCount: commitCount,
			files: files,
			error: null
		};
	}

	public async buildAgentContextMarkdown(repo: string, selectedCommitHash?: string | null): Promise<string> {
		const [branchRes, statusRes, logRes, wtRes] = await Promise.all([
			this.run(repo, ['symbolic-ref', '-q', '--short', 'HEAD']),
			this.getWorkingTreeStatus(repo),
			this.run(repo, ['-c', 'log.showSignature=false', 'log', '-n', '5', '--format=%h %s (%an, %ar)']),
			this.run(repo, ['worktree', 'list', '--porcelain'])
		]);
		const statusItems = statusRes.files;
		const branch = branchRes.code === 0 ? branchRes.stdout.toString().trim() : '(detached HEAD)';
		const lines: string[] = [
			'# Repository Context: `' + path.basename(repo) + '`',
			'- **Path**: `' + repo + '`',
			'- **Branch**: `' + branch + '`'
		];
		const upRes = await this.run(repo, ['rev-list', '--left-right', '--count', '@{u}...HEAD']);
		if (upRes.code === 0) {
			const [behind, ahead] = upRes.stdout.toString().trim().split(/\s+/);
			lines.push('- **Upstream Sync**: ahead `' + (ahead || '0') + '`, behind `' + (behind || '0') + '`');
		}
		const staged = statusItems.filter((f) => f.staged);
		const unstaged = statusItems.filter((f) => f.unstaged);
		const untracked = statusItems.filter((f) => f.untracked);
		const conflicted = statusItems.filter((f) => f.conflicted);
		lines.push('- **Working Tree**: ' + staged.length + ' staged, ' + unstaged.length + ' unstaged, ' + untracked.length + ' untracked' + (conflicted.length > 0 ? ', **' + conflicted.length + ' conflicted**' : ''));

		if (statusItems.length > 0) {
			lines.push('', '## Changed Files');
			statusItems.slice(0, 40).forEach((f) => {
				const tag = f.conflicted ? 'CONFLICT' : (f.staged && f.unstaged ? 'SM' : f.staged ? 'S' : f.untracked ? 'U' : 'M');
				lines.push('- `[' + tag + ']` `' + f.path + '`');
			});
		}
		if (logRes.code === 0) {
			const commits = splitLines(logRes.stdout);
			if (commits.length > 0) {
				lines.push('', '## Recent Commits');
				commits.forEach((c) => lines.push('- ' + c));
			}
		}
		if (wtRes.code === 0) {
			const wtLines = wtRes.stdout.toString().split(/\r?\n\r?\n/).filter((b) => b.trim() !== '');
			if (wtLines.length > 1) {
				lines.push('', '## Worktrees (' + wtLines.length + ')');
				wtLines.forEach((blk) => {
					const wp = (blk.match(/^worktree (.+)$/m) || [])[1] || '';
					const wb = ((blk.match(/^branch (.+)$/m) || [])[1] || '(detached)').replace(/^refs\/heads\//, '');
					if (wp !== '') lines.push('- `' + wb + '` → `' + wp + '`');
				});
			}
		}
		if (typeof selectedCommitHash === 'string' && HASH_REGEXP.test(selectedCommitHash)) {
			const showRes = await this.run(repo, ['-c', 'log.showSignature=false', 'show', '--stat', '--format=fuller', selectedCommitHash]);
			if (showRes.code === 0) {
				lines.push('', '## Selected Commit (`' + selectedCommitHash.substring(0, 8) + '`)', '```', showRes.stdout.toString().trim().slice(0, 4000), '```');
			}
		}
		return lines.join('\n');
	}

	public async moveBranch(repo: string, branchName: string, targetHash: string): Promise<GitFeatureError> {
		if (branchName.startsWith('-') || branchName === '') return 'Invalid branch name.';
		if (!HASH_REGEXP.test(targetHash)) return 'Invalid commit hash.';
		const current = (await this.run(repo, ['symbolic-ref', '-q', '--short', 'HEAD'])).stdout.toString().trim();
		if (current === branchName) {
			return 'The checked-out branch "' + branchName + '" must be moved with Reset instead.';
		}
		return this.change(repo, ['branch', '-f', '--', branchName, targetHash]);
	}

	public async getContributors(repo: string): Promise<{ contributors: ContributorSummary[], error: GitFeatureError }> {
		const res = await this.run(repo, ['shortlog', '-sne', 'HEAD']);
		if (res.code !== 0) return { contributors: [], error: errorOf(res) };
		const contributors: ContributorSummary[] = [];
		const lines = splitLines(res.stdout);
		for (let i = 0; i < lines.length && contributors.length < 100; i++) {
			const m = lines[i].match(/^\s*(\d+)\t(.+?)\s+<([^>]+)>\s*$/);
			if (m !== null) {
				contributors.push({
					commits: parseInt(m[1], 10) || 0,
					name: m[2].trim(),
					email: m[3].trim()
				});
			}
		}
		return { contributors: contributors, error: null };
	}

	public async addToGitignore(repo: string, relPaths: ReadonlyArray<string>): Promise<{ addedCount: number, error: GitFeatureError }> {
		const safeEntries: string[] = [];
		for (let i = 0; i < relPaths.length; i++) {
			const raw = (relPaths[i] || '').replace(/\\/g, '/').trim();
			if (raw === '' || raw.startsWith('-') || raw.includes('\n') || raw.includes('\r')) continue;
			if (isRemoteRepo(repo)) {
				const normalized = path.posix.normalize(raw);
				if (normalized !== '' && normalized !== '.' && !normalized.startsWith('..') && !normalized.startsWith('/') && !safeEntries.includes(normalized)) {
					safeEntries.push(normalized);
				}
			} else {
				const repoRoot = path.resolve(repo);
				const abs = path.resolve(repoRoot, raw);
				const rel = path.relative(repoRoot, abs).replace(/\\/g, '/');
				if (rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel) && !safeEntries.includes(rel)) {
					safeEntries.push(rel);
				}
			}
		}
		if (safeEntries.length === 0) return { addedCount: 0, error: 'No valid repository paths were provided.' };
		try {
			const existingBuf = await readRepoFileBuffer(repo, '.gitignore', 256 * 1024);
			const existingRaw = existingBuf !== null ? existingBuf.toString('utf8') : '';
			const existingSet = new Set(existingRaw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('#')));
			const toAppend = safeEntries.filter((p) => !existingSet.has(p));
			if (toAppend.length === 0) return { addedCount: 0, error: null };
			const prefix = existingRaw !== '' && !existingRaw.endsWith('\n') ? '\n' : '';
			await writeRepoFileBuffer(repo, '.gitignore', existingRaw + prefix + toAppend.join('\n') + '\n');
			return { addedCount: toAppend.length, error: null };
		} catch (err) {
			return { addedCount: 0, error: err instanceof Error ? err.message : String(err) };
		}
	}

	public async copyWipToWorktree(sourceRepo: string, targetWorktreePath: string): Promise<{ copiedFiles: number, error: GitFeatureError }> {
		if (!isRemoteRepo(sourceRepo) && !isRemoteRepo(targetWorktreePath)) {
			const srcRoot = path.resolve(sourceRepo);
			const dstRoot = path.resolve(targetWorktreePath);
			if (srcRoot === dstRoot) {
				return { copiedFiles: 0, error: 'Source and target worktrees are identical.' };
			}
			if (!fs.existsSync(dstRoot)) {
				return { copiedFiles: 0, error: 'Target worktree directory does not exist.' };
			}
		} else if (sourceRepo === targetWorktreePath) {
			return { copiedFiles: 0, error: 'Source and target worktrees are identical.' };
		}

		let copiedFiles = 0;
		const diffRes = await this.run(sourceRepo, ['diff', 'HEAD', '--binary']);
		if (diffRes.code === 0 && diffRes.stdout.length > 0) {
			const applyRes = await runGit(this.git, targetWorktreePath, ['apply', '--3way', '-'], diffRes.stdout);
			if (applyRes.code !== 0) {
				const fallbackRes = await runGit(this.git, targetWorktreePath, ['apply', '-'], diffRes.stdout);
				if (fallbackRes.code !== 0) {
					return { copiedFiles: 0, error: errorOf(fallbackRes) };
				}
			}
			const namesRes = await this.run(sourceRepo, ['diff', 'HEAD', '--name-only']);
			copiedFiles += splitLines(namesRes.stdout).length;
		}
		const untrackedRes = await this.run(sourceRepo, ['ls-files', '--others', '--exclude-standard', '-z']);
		if (untrackedRes.code === 0 && untrackedRes.stdout.length > 0) {
			const relPaths = untrackedRes.stdout.toString('utf8').split('\0').filter((p) => p !== '');
			for (let i = 0; i < relPaths.length; i++) {
				const rel = relPaths[i];
				if (rel.startsWith('..') || path.isAbsolute(rel)) continue;
				const buf = await readRepoFileBuffer(sourceRepo, rel);
				if (buf === null) continue;
				await writeRepoFileBuffer(targetWorktreePath, rel, buf);
				copiedFiles++;
			}
		}
		return { copiedFiles: copiedFiles, error: null };
	}

	private async change(repo: string, args: string[]): Promise<GitFeatureError> {
		const result = await runGit(this.git, repo, args, null, null, { GIT_EDITOR: ':' });
		return result.code === 0 ? null : errorOf(result);
	}

	private run(repo: string, args: string[]) {
		return runGit(this.git, repo, args);
	}
}

function errorOf(result: { code: number, stdout: Buffer, stderr: string }) {
	const message = result.stderr !== '' ? result.stderr : result.stdout.toString().trim();
	return message !== '' ? message : 'Git exited with code ' + result.code + '.';
}

function splitLines(output: Buffer) {
	return output.toString().split(/\r?\n/).filter((line) => line !== '');
}

function escapeRegExp(text: string) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function truncateModelInput(raw: string, alreadyTruncated: boolean) {
	const rawLines = raw.split(/\r?\n/);
	let truncated = alreadyTruncated || rawLines.length > MAX_EXPLAIN_DIFF_LINES;
	const lines = (rawLines.length > MAX_EXPLAIN_DIFF_LINES ? rawLines.slice(0, MAX_EXPLAIN_DIFF_LINES) : rawLines).map((line) => {
		if (line.length > MAX_EXPLAIN_LINE_CHARS) {
			truncated = true;
			return line.substring(0, MAX_EXPLAIN_LINE_CHARS) + ' …';
		}
		return line;
	});
	let text = lines.join('\n');
	if (text.length > MAX_EXPLAIN_CHARS) {
		text = text.substring(0, MAX_EXPLAIN_CHARS);
		truncated = true;
	}
	return { text: text, truncated: truncated };
}

/**
 * Construct a unified-diff patch that stages, unstages, or discards only the selected `+` / `-` line indices within a single hunk.
 */
export function buildPartialHunkPatch(
	diffHeader: string,
	hunkHeaderLine: string,
	hunkLines: ReadonlyArray<string>,
	selectedIndices: ReadonlySet<number>,
	action: 'stage' | 'unstage' | 'discard',
	filePath?: string
): string | null {
	const m = hunkHeaderLine.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
	if (m === null) return null;
	let oldStart = parseInt(m[1], 10);
	let newStart = parseInt(m[3], 10);
	const tail = m[5] || '';
	const forward = action === 'stage';
	const out: string[] = [];
	let oldCount = 0, newCount = 0, changedCount = 0;
	let k = 0;
	while (k < hunkLines.length) {
		const ln = hunkLines[k];
		if (ln.startsWith(' ')) {
			out.push(ln);
			oldCount++;
			newCount++;
			k++;
			continue;
		}
		if (ln.startsWith('\\')) {
			out.push(ln);
			k++;
			continue;
		}
		const dels: { idx: number, text: string, noEol: string | null }[] = [];
		const adds: { idx: number, text: string, noEol: string | null }[] = [];
		while (k < hunkLines.length && (hunkLines[k].startsWith('-') || hunkLines[k].startsWith('\\'))) {
			if (hunkLines[k].startsWith('-')) {
				const item = { idx: k, text: hunkLines[k].substring(1), noEol: <string | null>null };
				if (k + 1 < hunkLines.length && hunkLines[k + 1].startsWith('\\')) {
					item.noEol = hunkLines[++k];
				}
				dels.push(item);
			}
			k++;
		}
		while (k < hunkLines.length && (hunkLines[k].startsWith('+') || hunkLines[k].startsWith('\\'))) {
			if (hunkLines[k].startsWith('+')) {
				const item = { idx: k, text: hunkLines[k].substring(1), noEol: <string | null>null };
				if (k + 1 < hunkLines.length && hunkLines[k + 1].startsWith('\\')) {
					item.noEol = hunkLines[++k];
				}
				adds.push(item);
			}
			k++;
		}

		let pendingDel: { text: string, noEol: string | null }[] = [];
		let pendingAdd: { text: string, noEol: string | null }[] = [];
		const flushPending = () => {
			for (const d of pendingDel) {
				out.push('-' + d.text);
				if (d.noEol !== null) out.push(d.noEol);
				oldCount++;
				changedCount++;
			}
			for (const a of pendingAdd) {
				out.push('+' + a.text);
				if (a.noEol !== null) out.push(a.noEol);
				newCount++;
				changedCount++;
			}
			pendingDel = [];
			pendingAdd = [];
		};

		const maxLen = Math.max(dels.length, adds.length);
		for (let i = 0; i < maxLen; i++) {
			const d = i < dels.length ? dels[i] : null;
			const a = i < adds.length ? adds[i] : null;
			if (forward) {
				if (d !== null) {
					if (selectedIndices.has(d.idx)) {
						pendingDel.push(d);
					} else {
						flushPending();
						out.push(' ' + d.text);
						if (d.noEol !== null) out.push(d.noEol);
						oldCount++;
						newCount++;
					}
				}
				if (a !== null && selectedIndices.has(a.idx)) {
					pendingAdd.push(a);
				}
			} else {
				if (d !== null && selectedIndices.has(d.idx)) {
					pendingDel.push(d);
				}
				if (a !== null) {
					if (selectedIndices.has(a.idx)) {
						pendingAdd.push(a);
					} else {
						flushPending();
						out.push(' ' + a.text);
						if (a.noEol !== null) out.push(a.noEol);
						oldCount++;
						newCount++;
					}
				}
			}
		}
		flushPending();
	}

	if (changedCount === 0) return null;
	if (oldStart === 0 && oldCount > 0) oldStart = 1;
	if (newStart === 0 && newCount > 0) newStart = 1;

	let header = diffHeader;
	const inferredPath = filePath || (header.match(/^\+\+\+ b\/(.+)$/m) || header.match(/^--- a\/(.+)$/m) || [])[1] || '';
	if (oldCount > 0 && header.includes('--- /dev/null') && inferredPath !== '') {
		header = header
			.split('\n')
			.filter((l) => !l.startsWith('new file mode ') && !l.startsWith('index '))
			.map((l) => l === '--- /dev/null' ? ('--- a/' + inferredPath) : l)
			.join('\n');
	}
	if (newCount > 0 && header.includes('+++ /dev/null') && inferredPath !== '') {
		header = header
			.split('\n')
			.filter((l) => !l.startsWith('deleted file mode ') && !l.startsWith('index '))
			.map((l) => l === '+++ /dev/null' ? ('+++ b/' + inferredPath) : l)
			.join('\n');
	}

	const newHeaderLine = '@@ -' + oldStart + ',' + oldCount + ' +' + newStart + ',' + newCount + ' @@' + tail;
	return header + '\n' + newHeaderLine + '\n' + out.join('\n') + '\n';
}
