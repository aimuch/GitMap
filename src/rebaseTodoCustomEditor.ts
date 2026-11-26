export type RebaseTodoAction = 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop';

export interface RebaseTodoEntry {
	readonly kind: 'commit' | 'command' | 'comment';
	readonly action: string;
	readonly hash: string;
	readonly subject: string;
	readonly rawLine: string;
}

const SHORT_TO_LONG_ACTION: { readonly [key: string]: RebaseTodoAction } = {
	p: 'pick',
	pick: 'pick',
	r: 'reword',
	reword: 'reword',
	e: 'edit',
	edit: 'edit',
	s: 'squash',
	squash: 'squash',
	f: 'fixup',
	fixup: 'fixup',
	d: 'drop',
	drop: 'drop'
};

const COMMAND_ALIASES: { readonly [key: string]: string } = {
	x: 'exec',
	exec: 'exec',
	b: 'break',
	break: 'break',
	l: 'label',
	label: 'label',
	t: 'reset',
	reset: 'reset',
	m: 'merge',
	merge: 'merge',
	u: 'update-ref',
	'update-ref': 'update-ref'
};

/**
 * Parse the contents of a Git `git-rebase-todo` file into structured entries.
 */
export function parseRebaseTodoDocument(content: string): RebaseTodoEntry[] {
	const lines = content.split(/\r?\n/);
	const entries: RebaseTodoEntry[] = [];
	for (let i = 0; i < lines.length; i++) {
		const rawLine = lines[i];
		const trimmed = rawLine.trim();
		if (trimmed === '' || trimmed.startsWith('#')) {
			entries.push({ kind: 'comment', action: '', hash: '', subject: '', rawLine: rawLine });
			continue;
		}
		const commitMatch = trimmed.match(/^([a-zA-Z-]+)\s+([0-9a-fA-F]{4,64})(?:\s+(.*))?$/);
		if (commitMatch !== null) {
			const normalized = SHORT_TO_LONG_ACTION[commitMatch[1].toLowerCase()];
			if (typeof normalized !== 'undefined') {
				entries.push({
					kind: 'commit',
					action: normalized,
					hash: commitMatch[2],
					subject: commitMatch[3] || '',
					rawLine: rawLine
				});
				continue;
			}
		}
		const cmdMatch = trimmed.match(/^([a-zA-Z-]+)(?:\s+(.*))?$/);
		if (cmdMatch !== null && typeof COMMAND_ALIASES[cmdMatch[1].toLowerCase()] === 'string') {
			entries.push({
				kind: 'command',
				action: COMMAND_ALIASES[cmdMatch[1].toLowerCase()],
				hash: '',
				subject: cmdMatch[2] || '',
				rawLine: rawLine
			});
			continue;
		}
		entries.push({ kind: 'comment', action: '', hash: '', subject: '', rawLine: rawLine });
	}
	return entries;
}

/**
 * Serialize structured rebase todo entries back into Git `git-rebase-todo` text.
 */
export function serializeRebaseTodoDocument(entries: ReadonlyArray<RebaseTodoEntry>): string {
	return entries.map((entry) => {
		if (entry.kind === 'commit') {
			return entry.subject !== ''
				? entry.action + ' ' + entry.hash + ' ' + entry.subject
				: entry.action + ' ' + entry.hash;
		}
		if (entry.kind === 'command' && entry.action !== '') {
			return entry.subject !== '' ? entry.action + ' ' + entry.subject : entry.action;
		}
		return entry.rawLine;
	}).join('\n');
}
