import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from './dataSource';
import { runGit } from './historyRewrite';
import { t } from './l10n';
import { isRemoteRepo, parseRemoteRepo } from './remote/repoTransport';
import { sshManager } from './remote/sshManager';

export interface RepoHealthReport {
	readonly repo: string;
	readonly hasCommitGraph: boolean;
	readonly coreCommitGraphEnabled: boolean;
	readonly looseObjects: number;
	readonly sizeKb: number;
	readonly sshSignersFile: string | null;
	readonly sshSignersExists: boolean;
	readonly recommendations: ReadonlyArray<string>;
}

export function parseCountObjectsOutput(raw: string): { readonly looseObjects: number, readonly sizeKb: number } {
	let looseObjects = 0;
	let sizeKb = 0;
	const lines = raw.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const mCount = lines[i].match(/^count:\s*(\d+)/);
		if (mCount !== null) looseObjects = parseInt(mCount[1], 10);
		const mSize = lines[i].match(/^size:\s*(\d+)/);
		if (mSize !== null) sizeKb = parseInt(mSize[1], 10);
	}
	return { looseObjects: looseObjects, sizeKb: sizeKb };
}

async function checkPathExists(repo: string, resolvedOrRelPath: string): Promise<boolean> {
	const parsed = parseRemoteRepo(repo);
	if (parsed !== null) {
		const target = resolvedOrRelPath.startsWith('/') ? resolvedOrRelPath : path.posix.join(parsed.remotePath, resolvedOrRelPath);
		return sshManager.remoteExists(parsed.hostId, target).catch(() => false);
	}
	return fs.existsSync(resolvedOrRelPath);
}

export async function inspectRepoHealth(dataSource: DataSource, repo: string): Promise<RepoHealthReport> {
	const gitDirRes = await runGit(dataSource, repo, ['rev-parse', '--git-common-dir']);
	const rawGitDir = gitDirRes.code === 0 ? gitDirRes.stdout.toString().trim() : '.git';
	const parsed = parseRemoteRepo(repo);
	const gitCommonDir = parsed !== null
		? (rawGitDir.startsWith('/') ? rawGitDir : path.posix.join(parsed.remotePath, rawGitDir))
		: (path.isAbsolute(rawGitDir) ? rawGitDir : path.resolve(repo, rawGitDir));

	const joinFn = parsed !== null ? path.posix.join : path.join;
	const graphSingle = joinFn(gitCommonDir, 'objects', 'info', 'commit-graph');
	const graphChain = joinFn(gitCommonDir, 'objects', 'info', 'commit-graphs');
	const [singleExists, chainExists] = await Promise.all([
		checkPathExists(repo, graphSingle),
		checkPathExists(repo, graphChain)
	]);
	const hasCommitGraph = singleExists || chainExists;

	const cfgGraph = await runGit(dataSource, repo, ['config', '--get', 'core.commitGraph']);
	const coreCommitGraphEnabled = cfgGraph.code === 0 && cfgGraph.stdout.toString().trim().toLowerCase() === 'true';

	const countRes = await runGit(dataSource, repo, ['count-objects', '-v']);
	const counts = countRes.code === 0 ? parseCountObjectsOutput(countRes.stdout.toString()) : { looseObjects: 0, sizeKb: 0 };

	const signersRes = await runGit(dataSource, repo, ['config', '--get', 'gpg.ssh.allowedSignersFile']);
	const rawSigners = signersRes.code === 0 ? signersRes.stdout.toString().trim() : '';
	let resolvedSigners: string | null = null;
	if (rawSigners !== '') {
		if (parsed !== null) {
			resolvedSigners = rawSigners.startsWith('/') ? rawSigners : path.posix.join(parsed.remotePath, rawSigners);
		} else {
			resolvedSigners = rawSigners.startsWith('~/')
				? path.join(os.homedir(), rawSigners.slice(2))
				: (path.isAbsolute(rawSigners) ? rawSigners : path.resolve(repo, rawSigners));
		}
	}
	const sshSignersExists = resolvedSigners !== null && await checkPathExists(repo, resolvedSigners);

	const recommendations: string[] = [];
	if (!hasCommitGraph || !coreCommitGraphEnabled) {
		recommendations.push(t('Enable Git commit-graph index to accelerate log, blame, and graph rendering.'));
	}
	if (counts.looseObjects > 500) {
		recommendations.push(t('Pack {0} loose Git objects ({1} KB) with git gc to speed up repository operations.', counts.looseObjects, counts.sizeKb));
	}
	if (!sshSignersExists) {
		recommendations.push(t('Configure SSH allowed_signers file if verifying SSH-signed commits locally.'));
	}

	return {
		repo: repo,
		hasCommitGraph: hasCommitGraph,
		coreCommitGraphEnabled: coreCommitGraphEnabled,
		looseObjects: counts.looseObjects,
		sizeKb: counts.sizeKb,
		sshSignersFile: resolvedSigners,
		sshSignersExists: sshSignersExists,
		recommendations: recommendations
	};
}

export async function optimizeRepo(
	dataSource: DataSource,
	repo: string,
	mode: 'commitGraph' | 'gc' | 'maintenance'
): Promise<string | null> {
	await runGit(dataSource, repo, ['config', '--local', 'core.commitGraph', 'true']);
	await runGit(dataSource, repo, ['config', '--local', 'fetch.writeCommitGraph', 'true']);
	const cgRes = await runGit(dataSource, repo, ['commit-graph', 'write', '--reachable', '--changed-paths']);
	if (mode === 'commitGraph') {
		return cgRes.code === 0 ? null : (cgRes.stderr.trim() || 'Failed to write commit-graph.');
	}
	if (mode === 'gc') {
		const gcRes = await runGit(dataSource, repo, ['gc', '--auto']);
		return gcRes.code === 0 ? null : (gcRes.stderr.trim() || 'Failed to run git gc.');
	}
	const maintRes = await runGit(dataSource, repo, ['maintenance', 'run', '--auto']);
	return maintRes.code === 0 ? null : (maintRes.stderr.trim() || null);
}

export async function ensureSshAllowedSignersFile(
	dataSource: DataSource,
	repo: string
): Promise<{ readonly filePath: string | null, readonly error: string | null }> {
	try {
		const emailRes = await runGit(dataSource, repo, ['config', '--get', 'user.email']);
		const userEmail = emailRes.code === 0 ? emailRes.stdout.toString().trim() : 'user@example.com';

		const signersRes = await runGit(dataSource, repo, ['config', '--get', 'gpg.ssh.allowedSignersFile']);
		const rawSigners = signersRes.code === 0 ? signersRes.stdout.toString().trim() : '';
		const parsed = parseRemoteRepo(repo);

		let targetPath: string;
		if (rawSigners !== '') {
			if (parsed !== null) {
				targetPath = rawSigners.startsWith('/') ? rawSigners : path.posix.join(parsed.remotePath, rawSigners);
			} else {
				targetPath = rawSigners.startsWith('~/')
					? path.join(os.homedir(), rawSigners.slice(2))
					: (path.isAbsolute(rawSigners) ? rawSigners : path.resolve(repo, rawSigners));
			}
		} else {
			const gitDirRes = await runGit(dataSource, repo, ['rev-parse', '--git-common-dir']);
			const rawGitDir = gitDirRes.code === 0 ? gitDirRes.stdout.toString().trim() : '.git';
			if (parsed !== null) {
				const gitCommonDir = rawGitDir.startsWith('/') ? rawGitDir : path.posix.join(parsed.remotePath, rawGitDir);
				targetPath = path.posix.join(gitCommonDir, 'allowed_signers');
			} else {
				const gitCommonDir = path.isAbsolute(rawGitDir) ? rawGitDir : path.resolve(repo, rawGitDir);
				targetPath = path.join(gitCommonDir, 'allowed_signers');
			}
			await runGit(dataSource, repo, ['config', '--local', 'gpg.ssh.allowedSignersFile', targetPath]);
		}

		const exists = await checkPathExists(repo, targetPath);
		if (!exists) {
			let pubKeyHint = 'ssh-ed25519 AAAA...';
			if (!isRemoteRepo(repo)) {
				const defaultEd = path.join(os.homedir(), '.ssh', 'id_ed25519.pub');
				try {
					if (fs.existsSync(defaultEd)) {
						const rawPub = (await fs.promises.readFile(defaultEd, 'utf8')).trim();
						if (rawPub !== '') pubKeyHint = rawPub;
					}
				} catch (_) {
					// Ignore unreadable ~/.ssh directory
				}
			}
			const template = [
				'# Git SSH Allowed Signers (<email-or-principal> <key-type> <base64-public-key>)',
				'# Uncomment or add trusted signer public keys below to verify SSH commit signatures:',
				'# ' + (userEmail || 'user@example.com') + ' ' + pubKeyHint,
				''
			].join('\n');
			if (parsed !== null) {
				await sshManager.writeRemoteFile(parsed.hostId, targetPath, template);
			} else {
				await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
				await fs.promises.writeFile(targetPath, template, 'utf8');
			}
		}
		return { filePath: targetPath, error: null };
	} catch (err) {
		return { filePath: null, error: err instanceof Error ? err.message : String(err) };
	}
}
