import { DataSource } from './dataSource';
import { runGit } from './historyRewrite';

export interface HotspotFile {
	readonly path: string;
	readonly commits: number;
	readonly additions: number;
	readonly deletions: number;
	readonly authors: number;
	readonly topAuthor: string;
	readonly topAuthorShare: number;
}

export interface ContributorStat {
	readonly author: string;
	readonly email: string;
	readonly commits: number;
	readonly additions: number;
	readonly deletions: number;
	readonly activeDays: number;
}

export interface CoChangeCluster {
	readonly fileA: string;
	readonly fileB: string;
	readonly coCommits: number;
	readonly couplingPct: number;
}

export interface RepoInsightsData {
	readonly totalCommits: number;
	readonly totalAuthors: number;
	readonly hotspots: ReadonlyArray<HotspotFile>;
	readonly knowledgeSilos: ReadonlyArray<HotspotFile>;
	readonly coChangeClusters: ReadonlyArray<CoChangeCluster>;
	readonly contributors: ReadonlyArray<ContributorStat>;
	readonly heatmap: ReadonlyArray<ReadonlyArray<number>>; // 7 (Sun..Sat) x 24 (0..23)
	readonly monthlyCommits: ReadonlyArray<{ readonly month: string; readonly count: number }>;
}

export function getMonthDateRange(yearMonth: string): { readonly after: string; readonly before: string } | null {
	const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
	if (match === null) return null;
	const year = parseInt(match[1], 10);
	const month = parseInt(match[2], 10);
	if (month < 1 || month > 12) return null;
	const lastDay = new Date(year, month, 0).getDate();
	return {
		after: yearMonth + '-01',
		before: yearMonth + '-' + String(lastDay).padStart(2, '0')
	};
}

export function computeRepoInsights(rawLog: string): RepoInsightsData {
	const fileMap = new Map<string, { commits: number, add: number, del: number, authorCounts: Map<string, number> }>();
	const authorMap = new Map<string, { email: string, commits: number, add: number, del: number, days: Set<string> }>();
	const pairCounts = new Map<string, number>();
	const heatmap: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
	const monthMap = new Map<string, number>();
	let totalCommits = 0;

	const records = rawLog.split('\x1e');
	for (const rec of records) {
		const trimmed = rec.trim();
		if (trimmed === '') continue;
		const lines = trimmed.split(/\r?\n/);
		const header = lines[0].split('\x1f');
		if (header.length < 3) continue;
		const author = header[0] || 'Unknown';
		const email = header[1] || '';
		const ts = parseInt(header[2], 10) || 0;
		totalCommits++;

		const dt = new Date(ts * 1000);
		heatmap[dt.getDay()][dt.getHours()]++;
		const ym = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
		monthMap.set(ym, (monthMap.get(ym) || 0) + 1);
		const ymd = ym + '-' + String(dt.getDate()).padStart(2, '0');

		let aStat = authorMap.get(author);
		if (typeof aStat === 'undefined') {
			aStat = { email: email, commits: 0, add: 0, del: 0, days: new Set<string>() };
			authorMap.set(author, aStat);
		}
		aStat.commits++;
		aStat.days.add(ymd);

		const seenFilesInCommit = new Set<string>();
		for (let i = 1; i < lines.length; i++) {
			const cols = lines[i].split('\t');
			if (cols.length < 3) continue;
			const add = parseInt(cols[0], 10) || 0;
			const del = parseInt(cols[1], 10) || 0;
			let filePath = cols.slice(2).join('\t');
			if (filePath.includes(' => ')) {
				filePath = filePath.replace(/^(.*)\{(.*) => (.*)\}(.*)$/, '$1$3$4').replace(/^.* => /, '').replace(/\/\//g, '/');
			}
			aStat.add += add;
			aStat.del += del;

			let fStat = fileMap.get(filePath);
			if (typeof fStat === 'undefined') {
				fStat = { commits: 0, add: 0, del: 0, authorCounts: new Map<string, number>() };
				fileMap.set(filePath, fStat);
			}
			fStat.add += add;
			fStat.del += del;
			if (!seenFilesInCommit.has(filePath)) {
				seenFilesInCommit.add(filePath);
				fStat.commits++;
				fStat.authorCounts.set(author, (fStat.authorCounts.get(author) || 0) + 1);
			}
		}
		if (seenFilesInCommit.size >= 2 && seenFilesInCommit.size <= 20) {
			const sorted = Array.from(seenFilesInCommit).sort();
			for (let a = 0; a < sorted.length; a++) {
				for (let b = a + 1; b < sorted.length; b++) {
					const pairKey = sorted[a] + '\x00' + sorted[b];
					pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);
				}
			}
		}
	}

	const allFiles: HotspotFile[] = [];
	fileMap.forEach((stat, filePath) => {
		let topAuthor = '', topCount = 0;
		stat.authorCounts.forEach((c, name) => {
			if (c > topCount) {
				topCount = c;
				topAuthor = name;
			}
		});
		allFiles.push({
			path: filePath,
			commits: stat.commits,
			additions: stat.add,
			deletions: stat.del,
			authors: stat.authorCounts.size,
			topAuthor: topAuthor,
			topAuthorShare: stat.commits > 0 ? Math.round((topCount / stat.commits) * 100) : 0
		});
	});

	const hotspots = allFiles
		.slice()
		.sort((a, b) => (b.commits - a.commits) || ((b.additions + b.deletions) - (a.additions + a.deletions)))
		.slice(0, 20);

	const knowledgeSilos = allFiles
		.filter((f) => f.commits >= 3 && (f.authors === 1 || f.topAuthorShare >= 85))
		.sort((a, b) => b.commits - a.commits)
		.slice(0, 15);

	const contributors: ContributorStat[] = [];
	authorMap.forEach((stat, author) => {
		contributors.push({
			author: author,
			email: stat.email,
			commits: stat.commits,
			additions: stat.add,
			deletions: stat.del,
			activeDays: stat.days.size
		});
	});
	contributors.sort((a, b) => b.commits - a.commits);

	const monthlyCommits = Array.from(monthMap.entries())
		.sort((a, b) => a[0].localeCompare(b[0]))
		.slice(-12)
		.map(([month, count]) => ({ month, count }));

	const coChangeClusters: CoChangeCluster[] = [];
	pairCounts.forEach((coCommits, key) => {
		if (coCommits < 2) return;
		const sep = key.indexOf('\x00');
		const fileA = key.substring(0, sep), fileB = key.substring(sep + 1);
		const countA = fileMap.get(fileA)?.commits || coCommits;
		const countB = fileMap.get(fileB)?.commits || coCommits;
		const minCommits = Math.max(1, Math.min(countA, countB));
		coChangeClusters.push({
			fileA: fileA,
			fileB: fileB,
			coCommits: coCommits,
			couplingPct: Math.min(100, Math.round((coCommits / minCommits) * 100))
		});
	});
	coChangeClusters.sort((a, b) => (b.coCommits - a.coCommits) || (b.couplingPct - a.couplingPct));

	return {
		totalCommits: totalCommits,
		totalAuthors: contributors.length,
		hotspots: hotspots,
		knowledgeSilos: knowledgeSilos,
		coChangeClusters: coChangeClusters.slice(0, 12),
		contributors: contributors.slice(0, 20),
		heatmap: heatmap,
		monthlyCommits: monthlyCommits
	};
}

export async function loadRepoInsightsData(dataSource: DataSource, repo: string, days: number = 90): Promise<RepoInsightsData> {
	const args = ['-c', 'core.quotepath=false', '-c', 'log.showSignature=false', 'log', '--no-merges', '--max-count=1500', '--numstat', '--format=%x1e%an%x1f%ae%x1f%at'];
	if (days > 0) {
		const sinceSec = Math.round(Date.now() / 1000) - days * 86400;
		args.push('--since=' + sinceSec);
	}
	const res = await runGit(dataSource, repo, args, null, null, undefined, 8 * 1024 * 1024);
	return res.code === 0 || res.truncated ? computeRepoInsights(res.stdout.toString()) : computeRepoInsights('');
}
