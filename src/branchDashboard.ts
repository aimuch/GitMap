import { DataSource } from './dataSource';
import { runGit } from './historyRewrite';
import { fetchRepoPullRequestBadges } from './prStatusIntegration';
import { PullRequestBadgeInfo } from './types';

export interface BranchLifecycleRow {
	readonly name: string;
	readonly isRemote: boolean;
	readonly isCurrent: boolean;
	readonly author: string;
	readonly lastCommitDate: number;
	readonly ageDays: number;
	readonly stale: boolean;
	readonly merged: boolean;
	readonly subject: string;
	readonly upstream: string;
	readonly prNumber: number | null;
	readonly prCiStatus: string | null;
}

const STALE_DAYS_THRESHOLD = 30;

/**
 * Parse `git for-each-ref` lines into sortable branch lifecycle rows.
 */
export function parseBranchLifecycleRows(
	forEachRefOutput: string,
	mergedBranches: ReadonlySet<string>,
	prBadges: { readonly [branch: string]: PullRequestBadgeInfo },
	nowSec: number = Math.round(Date.now() / 1000)
): BranchLifecycleRow[] {
	const rows: BranchLifecycleRow[] = [];
	for (const line of forEachRefOutput.split(/\r?\n/)) {
		if (line.trim() === '') continue;
		const [headMark, refType, shortName, author, tsStr, upstream, subject] = line.split('\x1f');
		if (!shortName || shortName.endsWith('/HEAD')) continue;
		const isRemote = refType === 'refs/remotes';
		const ts = parseInt(tsStr || '0', 10) || 0;
		const ageDays = ts > 0 ? Math.max(0, Math.floor((nowSec - ts) / 86400)) : 0;
		const pr = !isRemote ? prBadges[shortName] : undefined;
		rows.push({
			name: shortName,
			isRemote: isRemote,
			isCurrent: headMark === '*',
			author: author || '',
			lastCommitDate: ts,
			ageDays: ageDays,
			stale: ageDays >= STALE_DAYS_THRESHOLD,
			merged: mergedBranches.has(shortName),
			subject: subject || '',
			upstream: upstream || '',
			prNumber: typeof pr !== 'undefined' ? pr.number : null,
			prCiStatus: typeof pr !== 'undefined' ? pr.ciStatus : null
		});
	}
	return rows;
}

export function detectDefaultBranch(rows: ReadonlyArray<BranchLifecycleRow>, symbolicOriginHead: string | null): string | null {
	const names = new Set(rows.map((r) => r.name));
	if (typeof symbolicOriginHead === 'string' && symbolicOriginHead.trim() !== '') {
		const trimmed = symbolicOriginHead.trim();
		const stripped = trimmed.includes('/') ? trimmed.substring(trimmed.indexOf('/') + 1) : trimmed;
		if (names.has(stripped)) return stripped;
		if (names.has(trimmed)) return trimmed;
	}
	for (const candidate of ['main', 'master', 'develop', 'origin/main', 'origin/master']) {
		if (names.has(candidate)) return candidate;
	}
	const current = rows.find((r) => r.isCurrent);
	return current ? current.name : (rows[0] ? rows[0].name : null);
}

export async function loadBranchLifecycleData(
	dataSource: DataSource,
	repo: string
): Promise<{ readonly rows: BranchLifecycleRow[], readonly defaultBranch: string | null }> {
	const [refsRes, mergedRes, originHeadRes, prBadges] = await Promise.all([
		runGit(dataSource, repo, ['for-each-ref', '--sort=-committerdate', '--format=%(HEAD)%1f%(refname:lstrip=0)%1f%(refname:short)%1f%(authorname)%1f%(committerdate:unix)%1f%(upstream:short)%1f%(subject)', 'refs/heads', 'refs/remotes']),
		runGit(dataSource, repo, ['branch', '-a', '--merged', 'HEAD', '--format=%(refname:short)']),
		runGit(dataSource, repo, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']),
		fetchRepoPullRequestBadges(dataSource, repo).catch(() => ({} as { [b: string]: PullRequestBadgeInfo }))
	]);
	const normalizedRefLines = refsRes.code === 0
		? refsRes.stdout.toString().split(/\r?\n/).map((line) => {
			const parts = line.split('\x1f');
			if (parts.length < 7) return '';
			parts[1] = parts[1].startsWith('refs/remotes/') ? 'refs/remotes' : 'refs/heads';
			return parts.join('\x1f');
		}).join('\n')
		: '';
	const mergedSet = new Set<string>(
		mergedRes.code === 0 ? mergedRes.stdout.toString().split(/\r?\n/).map((s) => s.trim()).filter((s) => s !== '') : []
	);
	const rows = parseBranchLifecycleRows(normalizedRefLines, mergedSet, prBadges);
	const defaultBranch = detectDefaultBranch(rows, originHeadRes.code === 0 ? originHeadRes.stdout.toString().trim() : null);
	return { rows, defaultBranch };
}
