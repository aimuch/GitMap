import { DataSource } from './dataSource';
import { runGit } from './historyRewrite';
import { GuardRiskEvidence, GuardRiskReport, PreCommitIssue } from './types';

export interface CommitSplitGroup {
	readonly message: string;
	readonly files: ReadonlyArray<string>;
	readonly rationale: string;
}

const SECRET_RULES: ReadonlyArray<{ readonly rx: RegExp, readonly label: string }> = [
	{ rx: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/, label: 'Private key material detected' },
	{ rx: /\bAKIA[0-9A-Z]{16}\b/, label: 'Possible AWS Access Key ID' },
	{ rx: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/, label: 'Possible GitHub Personal Access Token' },
	{ rx: /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/, label: 'Possible API secret key (sk-...)' },
	{ rx: /\bglpat-[A-Za-z0-9_-]{20,}\b/, label: 'Possible GitLab Personal Access Token' },
	{ rx: /\b(?:api[_-]?key|secret[_-]?key|access[_-]?token|private[_-]?key|password)\s*[:=]\s*['"][A-Za-z0-9/+_.-]{16,}['"]/i, label: 'Hardcoded secret or credential assignment' }
];

const DEBUG_RULES: ReadonlyArray<{ readonly rx: RegExp, readonly label: string }> = [
	{ rx: /\bconsole\.(?:log|debug|trace)\s*\(/, label: 'Debug console.log statement' },
	{ rx: /^\s*debugger\s*;?\s*$/, label: 'JavaScript debugger statement' },
	{ rx: /\bpdb\.set_trace\s*\(|\bbreakpoint\s*\(/, label: 'Python breakpoint / pdb.set_trace()' },
	{ rx: /\bbinding\.pry\b/, label: 'Ruby binding.pry breakpoint' }
];

const MARKER_RULES: ReadonlyArray<{ readonly rx: RegExp, readonly label: string }> = [
	{ rx: /\b(?:DO NOT COMMIT|DON'T COMMIT|NOCOMMIT)\b/i, label: 'DO NOT COMMIT marker' },
	{ rx: /\bFIXME\b/, label: 'Unresolved FIXME marker' }
];

/**
 * Scan unified diff text (added lines only) for leaked secrets, debug leftovers, and DO NOT COMMIT / FIXME markers.
 */
export function scanDiffForPreCommitIssues(diffText: string): PreCommitIssue[] {
	const issues: PreCommitIssue[] = [];
	const lines = diffText.replace(/\r\n/g, '\n').split('\n');
	let currentFile = '';
	let currentNewLine = 0;

	for (let i = 0; i < lines.length; i++) {
		const ln = lines[i];
		if (ln.startsWith('+++ b/')) {
			currentFile = ln.substring(6).trim();
			continue;
		}
		if (ln.startsWith('@@ ')) {
			const m = ln.match(/\+(\d+)/);
			currentNewLine = m !== null ? parseInt(m[1], 10) : 1;
			continue;
		}
		if (ln.startsWith('+') && !ln.startsWith('+++')) {
			const code = ln.substring(1);
			const snippet = code.trim().substring(0, 120);
			let matched = false;
			for (const rule of SECRET_RULES) {
				if (rule.rx.test(code)) {
					issues.push({ severity: 'high', kind: 'secret', file: currentFile, line: currentNewLine, message: rule.label, snippet: snippet });
					matched = true;
					break;
				}
			}
			if (!matched) {
				for (const rule of DEBUG_RULES) {
					if (rule.rx.test(code)) {
						issues.push({ severity: 'medium', kind: 'debug', file: currentFile, line: currentNewLine, message: rule.label, snippet: snippet });
						matched = true;
						break;
					}
				}
			}
			if (!matched) {
				for (const rule of MARKER_RULES) {
					if (rule.rx.test(code)) {
						issues.push({ severity: 'low', kind: 'marker', file: currentFile, line: currentNewLine, message: rule.label, snippet: snippet });
						break;
					}
				}
			}
			currentNewLine++;
			if (issues.length >= 60) break;
		} else if (!ln.startsWith('-') && !ln.startsWith('\\')) {
			currentNewLine++;
		}
	}
	return issues;
}

/**
 * Parse a JSON array of commit split groups returned by an AI model, filtering strictly to real changed files.
 */
export function parseCommitSplitPlan(rawText: string, validFiles: ReadonlyArray<string>): CommitSplitGroup[] {
	const validSet = new Set(validFiles);
	const stripped = rawText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
	const startIdx = stripped.indexOf('[');
	const endIdx = stripped.lastIndexOf(']');
	if (startIdx === -1 || endIdx <= startIdx) return [];
	try {
		const parsed = JSON.parse(stripped.substring(startIdx, endIdx + 1));
		if (!Array.isArray(parsed)) return [];
		const assigned = new Set<string>();
		const groups: CommitSplitGroup[] = [];
		for (const item of parsed) {
			if (!item || typeof item !== 'object') continue;
			const msg = typeof item.message === 'string' ? item.message.trim() : '';
			const rationale = typeof item.rationale === 'string' ? item.rationale.trim() : '';
			const rawFiles = Array.isArray(item.files) ? item.files : [];
			const files: string[] = rawFiles.filter((f: unknown): f is string => typeof f === 'string' && validSet.has(f) && !assigned.has(f));
			if (msg !== '' && files.length > 0) {
				files.forEach((f: string) => assigned.add(f));
				groups.push({ message: msg, files: files, rationale: rationale });
			}
		}
		const remaining = validFiles.filter((f) => !assigned.has(f));
		if (remaining.length > 0 && groups.length > 0) {
			groups.push({ message: 'chore: update remaining files', files: remaining, rationale: '' });
		}
		return groups;
	} catch (_) {
		return [];
	}
}

export async function scanRepoWorkingTreeForIssues(dataSource: DataSource, repo: string): Promise<PreCommitIssue[]> {
	const [stagedRes, unstagedRes] = await Promise.all([
		runGit(dataSource, repo, ['-c', 'core.quotepath=false', 'diff', '--cached', '--no-color', '-U0'], null, null, undefined, 2 * 1024 * 1024),
		runGit(dataSource, repo, ['-c', 'core.quotepath=false', 'diff', '--no-color', '-U0'], null, null, undefined, 2 * 1024 * 1024)
	]);
	const combined = (stagedRes.code === 0 || stagedRes.truncated ? stagedRes.stdout.toString() : '') + '\n' +
		(unstagedRes.code === 0 || unstagedRes.truncated ? unstagedRes.stdout.toString() : '');
	return scanDiffForPreCommitIssues(combined);
}

/**
 * Compute an explainable 0-100 change health/safety score with explicit evidence items.
 */
export function computeGuardRiskScore(
	issues: ReadonlyArray<PreCommitIssue>,
	fileCount: number = 0,
	totalChangedLines: number = 0
): GuardRiskReport {
	let score = 100;
	const evidence: GuardRiskEvidence[] = [];

	issues.forEach((iss) => {
		const deduction = iss.severity === 'high' ? 40 : (iss.severity === 'medium' ? 12 : 5);
		score -= deduction;
		evidence.push({
			severity: iss.severity,
			label: iss.message,
			detail: (iss.file !== '' ? iss.file + ':' + iss.line + ' — ' : '') + iss.snippet,
			deduction: deduction,
			file: iss.file,
			line: iss.line
		});
	});

	if (fileCount >= 20) {
		const deduction = fileCount >= 40 ? 15 : 8;
		score -= deduction;
		evidence.push({
			severity: 'medium',
			label: 'Broad multi-file change footprint',
			detail: fileCount + ' files modified in scope — consider splitting into atomic commits.',
			deduction: deduction
		});
	}

	if (totalChangedLines >= 600) {
		const deduction = totalChangedLines >= 1500 ? 15 : 8;
		score -= deduction;
		evidence.push({
			severity: 'medium',
			label: 'Large diff volume',
			detail: totalChangedLines + ' changed lines — higher cognitive load during review.',
			deduction: deduction
		});
	}

	if (evidence.length === 0) {
		evidence.push({
			severity: 'info',
			label: 'No secret, debug, or marker risks detected',
			detail: fileCount > 0 ? (fileCount + ' file(s) scanned cleanly.') : 'Working tree scanned cleanly.',
			deduction: 0
		});
	}

	const clamped = Math.max(0, Math.min(100, score));
	const grade: GuardRiskReport['grade'] = clamped >= 80 ? 'safe' : (clamped >= 50 ? 'caution' : 'high-risk');
	return { score: clamped, grade: grade, evidence: evidence };
}
