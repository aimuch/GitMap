import { getConfig } from './config';
import { DataSource } from './dataSource';
import { runGit } from './historyRewrite';
import { getLanguage, t } from './l10n';
import { getCachedRepoPullRequestBadges } from './prStatusIntegration';
import { CommitOrdering, GitFileBlame, GitLineBlame, GitMapModeConfig } from './types';
import { abbrevCommit, getRelativeTimeDiff, getRepoName } from './utils';

/* 1. File Heatmap Buckets */

const BUCKET_COUNT = 6;

export interface HeatBucket {
	readonly isHot: boolean;
	readonly level: number; // 0 (oldest/coolest) .. 5 (newest/hottest)
}

export function computeHeatBucket(authorDateSec: number, nowSec: number, ageThresholdDays: number): HeatBucket {
	const ageDays = Math.max(0, (nowSec - authorDateSec) / 86400);
	const threshold = Math.max(1, ageThresholdDays);
	if (ageDays <= threshold) {
		const ratio = 1 - ageDays / threshold;
		return { isHot: true, level: Math.max(0, Math.min(BUCKET_COUNT - 1, Math.round(ratio * (BUCKET_COUNT - 1)))) };
	}
	const coldSpan = threshold * 4;
	const coldRatio = Math.min(1, (ageDays - threshold) / coldSpan);
	return { isHot: false, level: Math.max(0, Math.min(BUCKET_COUNT - 1, Math.round((1 - coldRatio) * (BUCKET_COUNT - 1)))) };
}

/* 2. File Changes Line Ranges */

export interface ChangedLineRange {
	readonly start: number; // 0-based inclusive
	readonly end: number; // 0-based inclusive
	readonly kind: 'added' | 'modified' | 'deleted';
}

export function parseChangedLineRangesFromDiff(unifiedZeroDiff: string): ChangedLineRange[] {
	if (typeof unifiedZeroDiff !== 'string' || unifiedZeroDiff === '') return [];
	const ranges: ChangedLineRange[] = [];
	const lines = unifiedZeroDiff.split(/\r?\n/);
	const hunkRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
	for (let i = 0; i < lines.length; i++) {
		const m = lines[i].match(hunkRegex);
		if (m === null) continue;
		const oldCount = typeof m[2] === 'string' ? parseInt(m[2], 10) : 1;
		const newStart = Math.max(1, parseInt(m[3], 10));
		const newCount = typeof m[4] === 'string' ? parseInt(m[4], 10) : 1;
		const start = Math.max(0, newStart - 1);
		const end = newCount > 0 ? start + newCount - 1 : start;
		const kind: ChangedLineRange['kind'] = newCount === 0
			? 'deleted'
			: oldCount === 0
				? 'added'
				: 'modified';
		ranges.push({ start: start, end: end, kind: kind });
	}
	return ranges;
}

/* 3. Blame Template Formatting & PR Resolution */

export interface BlamePrInfo {
	readonly number: number;
	readonly title?: string;
	readonly url?: string;
}

export function resolvePrInfoForLineBlame(repo: string, blame: GitLineBlame): BlamePrInfo | null {
	if (!blame.committed) return null;
	const cached = getCachedRepoPullRequestBadges(repo);
	const m = blame.summary.match(/(?:Merge pull request |PR )?#(\d+)\b/i) || blame.summary.match(/\(#(\d+)\)/);
	if (m !== null) {
		const num = parseInt(m[1], 10);
		if (cached !== null) {
			const matchBadge = Object.values(cached).find((b) => b.number === num);
			if (matchBadge) return { number: matchBadge.number, title: matchBadge.title, url: matchBadge.url };
		}
		return { number: num };
	}
	return null;
}

export function formatBlameTemplate(template: string, blame: GitLineBlame, prInfo: BlamePrInfo | null): string {
	if (!blame.committed) {
		const ago = t('just now');
		return template
			.replace(/\$\{agoOrDate\}/g, ago)
			.replace(/\$\{ago\}/g, ago)
			.replace(/\$\{date\}/g, ago)
			.replace(/\$\{author([^}]*)\}/g, (_, suffix: string) => t('You') + (suffix || ''))
			.replace(/\$\{sha\}/g, '')
			.replace(/\$\{[^}]+\}/g, '')
			.trim();
	}
	const ago = getRelativeTimeDiff(blame.authorDate);
	const absDate = new Date(blame.authorDate * 1000).toLocaleDateString(getLanguage() === 'zh-cn' ? 'zh-CN' : 'en');
	const prText = prInfo !== null ? ('PR #' + prInfo.number) : '';

	const resolveToken = (expr: string): string => {
		const truncMatch = expr.match(/^([A-Za-z]+)\|(\d+)\??$/);
		const tokenName = truncMatch ? truncMatch[1] : expr.replace(/\?$/, '');
		const maxLen = truncMatch ? parseInt(truncMatch[2], 10) : 0;
		let val = '';
		switch (tokenName) {
			case 'author': val = blame.author; break;
			case 'ago': val = ago; break;
			case 'date': val = absDate; break;
			case 'agoOrDate': val = ago; break;
			case 'summary':
			case 'message': val = blame.summary; break;
			case 'sha': val = abbrevCommit(blame.hash); break;
			case 'pullRequest': val = prText; break;
			default: val = '';
		}
		if (maxLen > 0 && val.length > maxLen) {
			val = val.substring(0, Math.max(1, maxLen - 1)) + '…';
		}
		return val;
	};

	return template.replace(/\$\{([^}]+)\}/g, (_, inner: string) => {
		const quoted = inner.match(/^'([^']*)'([A-Za-z0-9|?]+)$/);
		if (quoted !== null) {
			const v = resolveToken(quoted[2]);
			return v !== '' ? quoted[1] + v : '';
		}
		const spaced = inner.match(/^(\s+[^A-Za-z\s]+\s+)([A-Za-z0-9|?]+)$/);
		if (spaced !== null) {
			const v = resolveToken(spaced[2]);
			return v !== '' ? spaced[1] + v : '';
		}
		const trailingSuffix = inner.match(/^([A-Za-z0-9|?]+)([^A-Za-z0-9|?]+)$/);
		if (trailingSuffix !== null) {
			const v = resolveToken(trailingSuffix[1]);
			return v !== '' ? v + trailingSuffix[2] : '';
		}
		return resolveToken(inner);
	}).replace(/\s{2,}/g, ' ').trim();
}

export function getBlameText(blame: GitLineBlame, options?: { readonly inlineFormat?: string, readonly uncommittedFormat?: string, readonly prInfo?: BlamePrInfo | null }): string {
	if (!blame.committed) {
		if (options && typeof options.uncommittedFormat === 'string' && options.uncommittedFormat !== 'You, Uncommitted changes (${ago})') {
			return formatBlameTemplate(options.uncommittedFormat, blame, null);
		}
		return t('You, Uncommitted changes');
	}
	if (options && typeof options.inlineFormat === 'string' && options.inlineFormat !== '${author}, ${agoOrDate}${\' via \'pullRequest}${ • summary|60?}') {
		return formatBlameTemplate(options.inlineFormat, blame, options.prInfo || null);
	}
	const summary = blame.summary.length > 60 ? blame.summary.substring(0, 59) + '…' : blame.summary;
	const base = t('{0}, {1} • {2}', blame.author, getRelativeTimeDiff(blame.authorDate), summary);
	return options && options.prInfo ? base + ' · PR #' + options.prInfo.number : base;
}

/* 4. SCM Tree Node Template Formatting & Grouped Sections */

export type ScmSectionId =
	| 'commits'
	| 'branches'
	| 'remotes'
	| 'stashes'
	| 'tags'
	| 'worktrees'
	| 'contributors'
	| 'repositories'
	| 'searchAndCompare'
	| 'launchpad'
	| 'fileHistory';

export function formatScmNodeTemplate(template: string, vars: { readonly [key: string]: string | undefined }): string {
	const lookup = (key: string): string => {
		if (key === 'agoOrDate') {
			return vars.agoOrDate ?? vars.ago ?? vars.date ?? '';
		}
		return vars[key] ?? '';
	};
	return template
		.replace(/\$\{'([^']*)'([a-zA-Z0-9_]+)\}/g, (_, prefix: string, key: string) => {
			const v = lookup(key);
			return v !== '' ? prefix + v : '';
		})
		.replace(/\$\{([^|{}]+)\|([a-zA-Z0-9_]+)\}/g, (_, prefix: string, key: string) => {
			const v = lookup(key);
			return v !== '' ? prefix + v : '';
		})
		.replace(/\$\{([a-zA-Z0-9_]+)([^a-zA-Z0-9_|{}]+)\}/g, (_, key: string, suffix: string) => {
			const v = lookup(key);
			return v !== '' ? v + suffix : '';
		})
		.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => lookup(key))
		.replace(/\$\{[^}]+\}/g, '')
		.trim();
}

export async function buildScmGroupedViewData(
	dataSource: DataSource,
	repo: string,
	allRepos: ReadonlyArray<string>,
	activeFilePath?: string | null
): Promise<{
	readonly repo: string;
	readonly repoName: string;
	readonly sections: ReadonlyArray<{
		readonly id: ScmSectionId;
		readonly title: string;
		readonly items: ReadonlyArray<{ readonly id: string; readonly label: string; readonly description: string; readonly action?: Record<string, unknown> }>;
	}>;
}> {
	const cfg = getConfig(repo).scmViewsConfig;
	const hidden = new Set(cfg.hiddenSections);
	const [info, commitsData, worktreesData] = await Promise.all([
		dataSource.getRepoInfo(repo, true, true, []),
		dataSource.getCommits(repo, null, 25, true, false, false, false, CommitOrdering.Date, [], [], []),
		dataSource.getWorktrees(repo)
	]);
	const prBadges = getCachedRepoPullRequestBadges(repo) || {};
	const sections: Array<{
		id: ScmSectionId;
		title: string;
		items: Array<{ id: string; label: string; description: string; action?: Record<string, unknown> }>;
	}> = [];

	if (!hidden.has('commits')) {
		sections.push({
			id: 'commits',
			title: t('Commits'),
			items: commitsData.commits.map((c) => {
				const shortSha = abbrevCommit(c.hash);
				const ago = getRelativeTimeDiff(c.date);
				const vars = { message: c.message || shortSha, author: c.author, ago, agoOrDate: ago, id: shortSha, sha: shortSha };
				return {
					id: c.hash,
					label: formatScmNodeTemplate(cfg.commitLabelFormat, vars) || c.message || shortSha,
					description: formatScmNodeTemplate(cfg.commitDescriptionFormat, vars),
					action: { type: 'viewCommit', hash: c.hash }
				};
			})
		});
	}
	if (!hidden.has('branches')) {
		sections.push({
			id: 'branches',
			title: t('Branches'),
			items: info.branches.map((b) => ({
				id: b,
				label: b === info.head ? '* ' + b : b,
				description: b.startsWith('remotes/') ? t('Remote') : (b === info.head ? 'HEAD' : t('Local')),
				action: { type: 'checkoutBranch', branch: b }
			}))
		});
	}
	if (!hidden.has('remotes')) {
		const cfgRes = await dataSource.getConfig(repo, info.remotes);
		const remotesList = cfgRes.config ? cfgRes.config.remotes : info.remotes.map((r) => ({ name: r, url: null, pushUrl: null }));
		sections.push({
			id: 'remotes',
			title: t('Remotes'),
			items: remotesList.map((r) => ({
				id: r.name,
				label: r.name,
				description: r.url || ''
			}))
		});
	}
	if (!hidden.has('stashes')) {
		sections.push({
			id: 'stashes',
			title: t('Stashes'),
			items: info.stashes.map((s) => {
				const ago = getRelativeTimeDiff(s.date);
				const vars = { message: s.message || s.selector, ago, agoOrDate: ago, stashOnRef: s.selector, id: abbrevCommit(s.hash) };
				return {
					id: s.selector,
					label: formatScmNodeTemplate(cfg.stashLabelFormat, vars) || s.message || s.selector,
					description: formatScmNodeTemplate(cfg.stashDescriptionFormat, vars) || s.selector,
					action: { type: 'viewCommit', hash: s.hash }
				};
			})
		});
	}
	if (!hidden.has('tags')) {
		const seen = new Set<string>();
		const tagItems: Array<{ id: string; label: string; description: string; action?: Record<string, unknown> }> = [];
		for (const c of commitsData.commits) {
			for (const tg of c.tags) {
				if (seen.has(tg.name)) continue;
				seen.add(tg.name);
				tagItems.push({ id: tg.name, label: tg.name, description: abbrevCommit(c.hash), action: { type: 'viewCommit', hash: c.hash } });
			}
		}
		sections.push({ id: 'tags', title: t('Tags'), items: tagItems });
	}
	if (!hidden.has('worktrees')) {
		sections.push({
			id: 'worktrees',
			title: t('Worktrees'),
			items: worktreesData.worktrees.map((w) => ({
				id: w.path,
				label: w.branch || abbrevCommit(w.head || ''),
				description: w.path + (typeof w.dirtyCount === 'number' && w.dirtyCount > 0 ? ` (${w.dirtyCount} dirty)` : ''),
				action: { type: 'openWorktree', path: w.path }
			}))
		});
	}
	if (!hidden.has('contributors')) {
		const shortlog = await runGit(dataSource, repo, ['shortlog', '-sne', '--all']);
		const contribItems = shortlog.code === 0
			? shortlog.stdout.toString().split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 30).map((line) => {
				const m = line.trim().match(/^(\d+)\s+(.+?)\s+<([^>]+)>$/);
				if (!m) return null;
				return {
					id: m[3],
					label: m[2],
					description: `${m[1]} · ${m[3]}`,
					action: { type: 'filterAuthor', author: m[2] }
				};
			}).filter((x): x is NonNullable<typeof x> => x !== null)
			: [];
		sections.push({ id: 'contributors', title: t('Contributors'), items: contribItems });
	}
	if (!hidden.has('repositories')) {
		sections.push({
			id: 'repositories',
			title: t('Repositories'),
			items: allRepos.map((rPath) => ({
				id: rPath,
				label: getRepoName(rPath),
				description: rPath === repo ? t('Active') : rPath,
				action: { type: 'switchRepo', repo: rPath }
			}))
		});
	}
	if (!hidden.has('searchAndCompare')) {
		sections.push({
			id: 'searchAndCompare',
			title: t('Search & Compare'),
			items: [
				{ id: 'search', label: t('Search Commits in Git Map'), description: getRepoName(repo), action: { type: 'openFind' } },
				{ id: 'branchDashboard', label: t('Branch Lifecycle Dashboard'), description: t('Compare & Manage Branches'), action: { type: 'openBranchDashboard' } },
				{ id: 'insights', label: t('Repository Insights & Hotspots'), description: t('Churn, Silos & Co-change'), action: { type: 'openInsights' } }
			]
		});
	}
	if (!hidden.has('launchpad')) {
		sections.push({
			id: 'launchpad',
			title: t('Launchpad PRs'),
			items: Object.entries(prBadges).map(([br, pr]) => ({
				id: String(pr.number),
				label: `#${pr.number} ${pr.title}`,
				description: `${br} → ${pr.baseBranch} · CI: ${pr.ciStatus}`,
				action: { type: 'openUrl', url: pr.url }
			}))
		});
	}
	if (!hidden.has('fileHistory')) {
		let fileItems: Array<{ id: string; label: string; description: string; action?: Record<string, unknown> }> = [];
		if (activeFilePath) {
			const fLog = await runGit(dataSource, repo, ['log', '-n', '15', '--format=%H%x1f%s%x1f%an', '--', activeFilePath]);
			if (fLog.code === 0) {
				fileItems = fLog.stdout.toString().split(/\r?\n/).filter((l) => l.trim() !== '').map((l) => {
					const [h, s, a] = l.split('\x1f');
					return { id: h, label: s || abbrevCommit(h), description: `${abbrevCommit(h)} · ${a}`, action: { type: 'viewCommit', hash: h } };
				});
			}
		}
		sections.push({ id: 'fileHistory', title: t('File History'), items: fileItems });
	}

	return { repo, repoName: getRepoName(repo), sections };
}

/* 5. Terminal Links Extraction */

export interface TerminalLinkMatch {
	readonly startIndex: number;
	readonly length: number;
	readonly kind: 'range' | 'commit' | 'ref';
	readonly text: string;
	readonly fromRef?: string;
	readonly toRef?: string;
	readonly tooltip: string;
}

const HASH_OR_REF_PART = '[A-Za-z0-9._/-]{2,}';
const RANGE_REGEX = new RegExp('(^|[\\s(\\[{\'"`])(' + HASH_OR_REF_PART + ')(\\.{2,3})(' + HASH_OR_REF_PART + ')(?=$|[\\s)\\]}\'"`:;,.!?])', 'g');
const HASH_REGEX = /(^|[\s(\[{'"`])([0-9a-fA-F]{7,40})(?=$|[\s)\]}'"`:;,.!?])/g;

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isLikelyHexCommit(token: string): boolean {
	if (/^\d+$/.test(token)) return false;
	return /^[0-9a-fA-F]{7,40}$/.test(token);
}

export function extractTerminalLinks(line: string, knownRefs: ReadonlySet<string>): TerminalLinkMatch[] {
	if (typeof line !== 'string' || line.trim() === '') return [];
	const candidates: TerminalLinkMatch[] = [];

	RANGE_REGEX.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = RANGE_REGEX.exec(line)) !== null) {
		const prefixLen = match[1].length;
		const left = match[2];
		const sep = match[3];
		const right = match[4];
		const leftValid = isLikelyHexCommit(left) || knownRefs.has(left);
		const rightValid = isLikelyHexCommit(right) || knownRefs.has(right);
		if (leftValid && rightValid) {
			const full = left + sep + right;
			candidates.push({
				startIndex: match.index + prefixLen,
				length: full.length,
				kind: 'range',
				text: full,
				fromRef: left,
				toRef: right,
				tooltip: t('Open comparison {0} in Git Map', full)
			});
		}
		if (match.index === RANGE_REGEX.lastIndex) RANGE_REGEX.lastIndex++;
	}

	HASH_REGEX.lastIndex = 0;
	while ((match = HASH_REGEX.exec(line)) !== null) {
		const prefixLen = match[1].length;
		const hash = match[2];
		const start = match.index + prefixLen;
		if (start > 0 && line.charAt(start - 1) === '#') continue;
		if (isLikelyHexCommit(hash)) {
			candidates.push({
				startIndex: start,
				length: hash.length,
				kind: 'commit',
				text: hash,
				tooltip: t('Open commit {0} in Git Map', hash)
			});
		}
		if (match.index === HASH_REGEX.lastIndex) HASH_REGEX.lastIndex++;
	}

	if (knownRefs.size > 0) {
		const sortedRefs = Array.from(knownRefs).filter((r) => r.length >= 2).sort((a, b) => b.length - a.length);
		const slice = sortedRefs.slice(0, 250);
		if (slice.length > 0) {
			const refPattern = new RegExp('(^|[\\s(\\[{\'"`*])(' + slice.map(escapeRegExp).join('|') + ')(?=$|[\\s)\\]}\'"`:;,!?])', 'g');
			while ((match = refPattern.exec(line)) !== null) {
				const start = match.index + match[1].length;
				const ref = match[2];
				candidates.push({
					startIndex: start,
					length: ref.length,
					kind: 'ref',
					text: ref,
					tooltip: t('Open ref "{0}" in Git Map', ref)
				});
				if (match.index === refPattern.lastIndex) refPattern.lastIndex++;
			}
		}
	}

	candidates.sort((a, b) => a.startIndex !== b.startIndex ? a.startIndex - b.startIndex : b.length - a.length);
	const out: TerminalLinkMatch[] = [];
	let cursor = 0;
	for (let i = 0; i < candidates.length; i++) {
		const item = candidates[i];
		if (item.startIndex >= cursor) {
			out.push(item);
			cursor = item.startIndex + item.length;
		}
	}
	return out;
}

/* 6. Editor Modes & File Annotations Snapshot */

export function getBuiltInModes(): GitMapModeConfig[] {
	return [
		{ name: 'default', description: t('Use configured editor annotation settings') },
		{ name: 'zen', description: t('Hide all editor Git annotations for distraction-free coding'), annotations: 'off', codeLens: false, currentLine: false, statusBar: false, hovers: false },
		{ name: 'review', description: t('Enable inline blame, file changes, and heatmap for code review'), annotations: 'changes', codeLens: true, currentLine: true, statusBar: true, hovers: true }
	];
}

export async function computeEditorAnnotationsForFile(
	dataSource: DataSource,
	repo: string,
	filePath: string
): Promise<{
	readonly blame: GitFileBlame | null;
	readonly heatBuckets: ReadonlyArray<HeatBucket>;
	readonly changedRanges: ReadonlyArray<ChangedLineRange>;
	readonly changesSourceLabel: string;
	readonly recentChangeSummary: string | null;
	readonly authorCount: number;
}> {
	const cfg = getConfig(repo);
	const [blame, wtDiff] = await Promise.all([
		dataSource.getFileBlame(repo, filePath, null),
		runGit(dataSource, repo, ['diff', '-U0', 'HEAD', '--', filePath])
	]);

	let changedRanges = wtDiff.code === 0 ? parseChangedLineRangesFromDiff(wtDiff.stdout.toString()) : [];
	let changesSourceLabel = t('Uncommitted changes compared to HEAD');
	if (changedRanges.length === 0) {
		const lastDiff = await runGit(dataSource, repo, ['log', '-n', '1', '-p', '-U0', '--format=%h %s', '--', filePath]);
		if (lastDiff.code === 0) {
			const text = lastDiff.stdout.toString();
			changedRanges = parseChangedLineRangesFromDiff(text);
			const firstLine = text.split(/\r?\n/, 1)[0] || '';
			changesSourceLabel = firstLine !== '' ? t('Last commit change: {0}', firstLine) : t('Most recent change');
		}
	}

	const nowSec = Math.round(Date.now() / 1000);
	const ageThreshold = cfg.fileHeatmapConfig.ageThreshold;
	const heatBuckets: HeatBucket[] = [];
	const authors = new Set<string>();
	let latestCommitDate = 0;
	let latestSummary: string | null = null;

	if (blame !== null) {
		for (const ln of blame.lines) {
			const commit = blame.commits[ln.hash];
			if (!commit || !commit.committed) {
				heatBuckets.push({ isHot: true, level: 5 });
			} else {
				authors.add(commit.author);
				if (commit.authorDate >= latestCommitDate) {
					latestCommitDate = commit.authorDate;
					latestSummary = `${commit.author}, ${getRelativeTimeDiff(commit.authorDate)} · ${commit.summary}`;
				}
				heatBuckets.push(computeHeatBucket(commit.authorDate, nowSec, ageThreshold));
			}
		}
	}

	return {
		blame,
		heatBuckets,
		changedRanges,
		changesSourceLabel,
		recentChangeSummary: latestSummary,
		authorCount: authors.size
	};
}
