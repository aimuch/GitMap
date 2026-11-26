import * as fs from 'fs';
import * as vscode from 'vscode';
import { DataSource } from './dataSource';
import { runGit } from './historyRewrite';
import { t } from './l10n';
import { getPathFromUri, getRepoName, showErrorMessage, showInformationMessage } from './utils';

export interface ChangelogCommitItem {
	readonly hash: string;
	readonly subject: string;
	readonly author: string;
	readonly dateIso: string;
}

/**
 * Group commits by Conventional Commit prefix into a clean Markdown changelog / weekly report.
 */
export function buildChangelogMarkdown(commits: ReadonlyArray<ChangelogCommitItem>, title: string): string {
	const groups: { [key: string]: ChangelogCommitItem[] } = {
		features: [],
		fixes: [],
		refactor: [],
		docs: [],
		other: []
	};

	for (const c of commits) {
		const lower = c.subject.toLowerCase();
		if (/^feat(?:\([^)]*\))?!?:\s*/.test(lower)) groups.features.push(c);
		else if (/^fix(?:\([^)]*\))?!?:\s*/.test(lower)) groups.fixes.push(c);
		else if (/^(?:refactor|perf)(?:\([^)]*\))?!?:\s*/.test(lower)) groups.refactor.push(c);
		else if (/^docs(?:\([^)]*\))?!?:\s*/.test(lower)) groups.docs.push(c);
		else groups.other.push(c);
	}

	const lines: string[] = ['# ' + title, ''];
	const appendSection = (heading: string, list: ReadonlyArray<ChangelogCommitItem>) => {
		if (list.length === 0) return;
		lines.push('## ' + heading);
		for (const c of list) {
			lines.push('- ' + c.subject + ' (`' + c.hash.substring(0, 7) + '`, ' + c.author + ', ' + c.dateIso + ')');
		}
		lines.push('');
	};

	appendSection('Features', groups.features);
	appendSection('Bug Fixes', groups.fixes);
	appendSection('Refactoring & Performance', groups.refactor);
	appendSection('Documentation', groups.docs);
	appendSection('Other Changes', groups.other);

	if (commits.length === 0) {
		lines.push('_No commits found in the selected range._', '');
	}
	return lines.join('\n');
}

export async function generateRepoChangelogMarkdown(
	dataSource: DataSource,
	repo: string,
	options?: { readonly since?: string | null, readonly rangeSpec?: string | null, readonly limit?: number, readonly label?: string }
): Promise<{ readonly markdown: string, readonly commitsCount: number, readonly error: string | null }> {
	const limit = options?.limit && options.limit > 0 ? Math.min(500, options.limit) : 200;
	const args = ['-c', 'log.showSignature=false', 'log', '--no-merges', '-n', String(limit), '--format=%H%x1f%s%x1f%an%x1f%cs'];
	if (options?.since) args.push('--since=' + options.since);
	if (options?.rangeSpec) args.push(options.rangeSpec);
	const res = await runGit(dataSource, repo, args);
	if (res.code !== 0) {
		return { markdown: '', commitsCount: 0, error: res.stderr || t('Failed to read commit log.') };
	}
	const commits: ChangelogCommitItem[] = res.stdout.toString().split(/\r?\n/).filter((l) => l.trim() !== '').map((line) => {
		const [hash, subject, author, dateIso] = line.split('\x1f');
		return { hash: hash || '', subject: subject || '', author: author || '', dateIso: dateIso || '' };
	});
	const title = getRepoName(repo) + ' — ' + (options?.label || t('Changelog'));
	return { markdown: buildChangelogMarkdown(commits, title), commitsCount: commits.length, error: null };
}

export async function exportGraphSvgToFile(repo: string, svgMarkup: string) {
	if (typeof vscode.window.showSaveDialog !== 'function') return;
	const defaultUri = vscode.Uri.file((repo.startsWith('ssh://') ? process.cwd() : repo) + '/' + getRepoName(repo) + '-git-map.svg');
	const uri = await vscode.window.showSaveDialog({
		defaultUri: defaultUri,
		filters: { 'SVG Image': ['svg'] },
		saveLabel: t('Export SVG')
	});
	if (typeof uri === 'undefined') return;
	try {
		await fs.promises.writeFile(getPathFromUri(uri), svgMarkup, 'utf8');
		showInformationMessage(t('Exported Git Map graph to "{0}".', uri.fsPath));
	} catch (e) {
		showErrorMessage(String(e));
	}
}
