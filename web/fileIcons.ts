/**
 * High-contrast color-coded icons for common file types & folders (clearly distinguishable in both dark & light themes).
 */
interface FallbackFileIconDef {
	readonly text?: string;
	readonly svg?: string;
	readonly colour: string;
	readonly pill?: boolean;
}

const ICON_SVG_SHEET = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="1.6"/><path d="M2 6h12M2 10h12M6.5 6v8"/></svg>';
const ICON_SVG_IMAGE = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2.5" width="12" height="11" rx="1.6"/><circle cx="5.7" cy="6" r="1.1" fill="currentColor" stroke="none"/><path d="M2.5 11.8l3.2-3.2 2.4 2.2 2-1.8 3.4 2.8"/></svg>';
const ICON_SVG_MEDIA = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2.5" width="12" height="11" rx="1.6"/><polygon points="6.6,5.5 11.2,8 6.6,10.5" fill="currentColor" stroke="none"/></svg>';
const ICON_SVG_ARCHIVE = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><rect x="2.2" y="2.5" width="11.6" height="11" rx="1.6"/><path d="M2.2 6h11.6M8 6v4.5M6.6 8.2h2.8"/></svg>';
const ICON_SVG_GIT = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="4.2" r="1.4"/><circle cx="5" cy="11.8" r="1.4"/><circle cx="11.2" cy="6.2" r="1.4"/><path d="M5 5.6v4.8M11.2 7.6c0 2.6-6.2 1.4-6.2 2.8"/></svg>';
const ICON_SVG_DOC = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2h5.2L12.5 5.3V14H4z"/><path d="M9.2 2v3.3h3.3M5.8 8.2h4.4M5.8 10.8h3.4"/></svg>';
const ICON_SVG_FOLDER_CLOSED = '<svg viewBox="0 0 16 16" width="15" height="15"><path fill="currentColor" d="M1.8 3.2A1.3 1.3 0 0 1 3.1 2h3.1c.4 0 .78.18 1.03.5l.62.8h5.05A1.3 1.3 0 0 1 14.2 4.6v7.9a1.3 1.3 0 0 1-1.3 1.3H3.1a1.3 1.3 0 0 1-1.3-1.3V3.2z"/></svg>';
const ICON_SVG_FOLDER_OPEN = '<svg viewBox="0 0 16 16" width="15" height="15"><path fill="currentColor" fill-opacity="0.72" d="M1.8 3.4A1.3 1.3 0 0 1 3.1 2.1h3.1c.4 0 .78.18 1.03.5l.62.8h4.95a1.2 1.2 0 0 1 1.2 1.2v1.2H2.9a1.2 1.2 0 0 0-1.1.85V3.4z"/><path fill="currentColor" d="M1.6 7.1a1 1 0 0 1 .98-.8h11.34a.95.95 0 0 1 .93 1.16l-1.12 5.2a1.2 1.2 0 0 1-1.17.94H2.95a1.2 1.2 0 0 1-1.18-.98L1.6 7.1z"/></svg>';

const FOLDER_COLOURS: { readonly [folderName: string]: string } = {
	'src': '#eab308', 'apps': '#f59e0b', 'app': '#f59e0b', 'packages': '#f59e0b', 'lib': '#eab308',
	'docs': '#38bdf8', 'doc': '#38bdf8', 'documentation': '#38bdf8',
	'data': '#34d399', 'datasets': '#34d399', 'db': '#34d399', 'assets': '#c084fc', 'images': '#c084fc', 'media': '#c084fc',
	'scripts': '#2dd4bf', 'bin': '#2dd4bf', 'tools': '#2dd4bf',
	'test': '#f472b6', 'tests': '#f472b6', '__tests__': '#f472b6', 'eval': '#f472b6', 'spec': '#f472b6',
	'prompts': '#a78bfa', 'config': '#fb923c', '.github': '#818cf8', '.claude': '#a78bfa', '.vscode': '#38bdf8', '.git': '#f05032'
};

const FALLBACK_FILE_NAMES: { readonly [fileName: string]: FallbackFileIconDef } = {
	'.gitignore': { svg: ICON_SVG_GIT, colour: '#f05032' },
	'.gitattributes': { svg: ICON_SVG_GIT, colour: '#f05032' },
	'.gitmodules': { svg: ICON_SVG_GIT, colour: '#f05032' },
	'.gitkeep': { svg: ICON_SVG_GIT, colour: '#f05032' },
	'dockerfile': { text: 'DK', colour: '#38bdf8', pill: true },
	'makefile': { text: 'MK', colour: '#fb923c', pill: true },
	'license': { text: 'LIC', colour: '#fbbf24' },
	'license.md': { text: 'LIC', colour: '#fbbf24' },
	'package.json': { text: '{}', colour: '#4ade80' },
	'tsconfig.json': { text: 'TS', colour: '#38bdf8' },
	'.env': { text: 'ENV', colour: '#facc15' },
	'.env.local': { text: 'ENV', colour: '#facc15' },
	'.env.example': { text: 'ENV', colour: '#facc15' }
};

const FALLBACK_FILE_ICONS: { readonly [extension: string]: FallbackFileIconDef } = {
	// Spreadsheets & Data
	'xlsx': { svg: ICON_SVG_SHEET, colour: '#22c55e' }, 'xls': { svg: ICON_SVG_SHEET, colour: '#22c55e' },
	'xlsm': { svg: ICON_SVG_SHEET, colour: '#22c55e' }, 'ods': { svg: ICON_SVG_SHEET, colour: '#22c55e' },
	'csv': { text: 'CSV', colour: '#34d399', pill: true }, 'tsv': { text: 'TSV', colour: '#34d399', pill: true },
	// Docs & Office
	'md': { text: 'M↓', colour: '#38bdf8', pill: true }, 'markdown': { text: 'M↓', colour: '#38bdf8', pill: true }, 'mdx': { text: 'M↓', colour: '#38bdf8', pill: true },
	'pdf': { text: 'PDF', colour: '#f87171', pill: true },
	'doc': { text: 'DOC', colour: '#60a5fa', pill: true }, 'docx': { text: 'DOC', colour: '#60a5fa', pill: true }, 'rtf': { text: 'RTF', colour: '#60a5fa' },
	'ppt': { text: 'PPT', colour: '#fb923c', pill: true }, 'pptx': { text: 'PPT', colour: '#fb923c', pill: true },
	'txt': { svg: ICON_SVG_DOC, colour: '#94a3b8' }, 'log': { svg: ICON_SVG_DOC, colour: '#94a3b8' }, 'rst': { svg: ICON_SVG_DOC, colour: '#38bdf8' },
	// Images & Media
	'png': { svg: ICON_SVG_IMAGE, colour: '#c084fc' }, 'jpg': { svg: ICON_SVG_IMAGE, colour: '#c084fc' }, 'jpeg': { svg: ICON_SVG_IMAGE, colour: '#c084fc' },
	'gif': { svg: ICON_SVG_IMAGE, colour: '#c084fc' }, 'webp': { svg: ICON_SVG_IMAGE, colour: '#c084fc' }, 'ico': { svg: ICON_SVG_IMAGE, colour: '#c084fc' },
	'bmp': { svg: ICON_SVG_IMAGE, colour: '#c084fc' }, 'avif': { svg: ICON_SVG_IMAGE, colour: '#c084fc' }, 'svg': { svg: ICON_SVG_IMAGE, colour: '#f59e0b' },
	'mp3': { svg: ICON_SVG_MEDIA, colour: '#f472b6' }, 'wav': { svg: ICON_SVG_MEDIA, colour: '#f472b6' }, 'ogg': { svg: ICON_SVG_MEDIA, colour: '#f472b6' }, 'm4a': { svg: ICON_SVG_MEDIA, colour: '#f472b6' }, 'flac': { svg: ICON_SVG_MEDIA, colour: '#f472b6' },
	'mp4': { svg: ICON_SVG_MEDIA, colour: '#ec4899' }, 'webm': { svg: ICON_SVG_MEDIA, colour: '#ec4899' }, 'mov': { svg: ICON_SVG_MEDIA, colour: '#ec4899' }, 'mkv': { svg: ICON_SVG_MEDIA, colour: '#ec4899' },
	// Archives
	'zip': { svg: ICON_SVG_ARCHIVE, colour: '#f59e0b' }, 'tar': { svg: ICON_SVG_ARCHIVE, colour: '#f59e0b' }, 'gz': { svg: ICON_SVG_ARCHIVE, colour: '#f59e0b' },
	'tgz': { svg: ICON_SVG_ARCHIVE, colour: '#f59e0b' }, '7z': { svg: ICON_SVG_ARCHIVE, colour: '#f59e0b' }, 'rar': { svg: ICON_SVG_ARCHIVE, colour: '#f59e0b' }, 'dmg': { svg: ICON_SVG_ARCHIVE, colour: '#f59e0b' },
	'vsix': { svg: ICON_SVG_ARCHIVE, colour: '#f59e0b' }, 'whl': { svg: ICON_SVG_ARCHIVE, colour: '#f59e0b' }, 'jar': { svg: ICON_SVG_ARCHIVE, colour: '#f59e0b' }, 'apk': { svg: ICON_SVG_ARCHIVE, colour: '#f59e0b' }, 'nupkg': { svg: ICON_SVG_ARCHIVE, colour: '#f59e0b' }, 'epub': { svg: ICON_SVG_ARCHIVE, colour: '#f59e0b' },
	// Code & Config
	'ts': { text: 'TS', colour: '#3b82f6' }, 'tsx': { text: 'TX', colour: '#38bdf8' }, 'mts': { text: 'TS', colour: '#3b82f6' }, 'cts': { text: 'TS', colour: '#3b82f6' },
	'js': { text: 'JS', colour: '#eab308' }, 'jsx': { text: 'JX', colour: '#facc15' }, 'mjs': { text: 'JS', colour: '#eab308' }, 'cjs': { text: 'JS', colour: '#eab308' },
	'json': { text: '{}', colour: '#facc15' }, 'jsonc': { text: '{}', colour: '#facc15' },
	'jsonl': { text: 'JL', colour: '#f59e0b', pill: true }, 'ndjson': { text: 'JL', colour: '#f59e0b', pill: true }, 'jsonlines': { text: 'JL', colour: '#f59e0b', pill: true },
	'css': { text: '#', colour: '#38bdf8' }, 'scss': { text: 'S#', colour: '#f472b6' }, 'less': { text: '#', colour: '#60a5fa' },
	'html': { text: '<>', colour: '#fb923c' }, 'htm': { text: '<>', colour: '#fb923c' }, 'xml': { text: '<>', colour: '#fb923c' }, 'vue': { text: 'V', colour: '#4ade80' }, 'svelte': { text: 'SV', colour: '#fb923c' },
	'py': { text: 'PY', colour: '#60a5fa' }, 'ipynb': { text: 'NB', colour: '#fb923c' }, 'go': { text: 'GO', colour: '#22d3ee' }, 'rs': { text: 'RS', colour: '#fb923c' },
	'java': { text: 'JV', colour: '#f87171' }, 'kt': { text: 'KT', colour: '#a78bfa' }, 'rb': { text: 'RB', colour: '#f43f5e' }, 'php': { text: 'PH', colour: '#818cf8' }, 'swift': { text: 'SW', colour: '#fb923c' },
	'c': { text: 'C', colour: '#60a5fa' }, 'h': { text: 'H', colour: '#c084fc' }, 'cpp': { text: 'C+', colour: '#60a5fa' }, 'hpp': { text: 'H+', colour: '#c084fc' }, 'cs': { text: 'C#', colour: '#4ade80' },
	'sh': { text: '$_', colour: '#4ade80' }, 'bash': { text: '$_', colour: '#4ade80' }, 'zsh': { text: '$_', colour: '#4ade80' }, 'ps1': { text: 'PS', colour: '#38bdf8' },
	'sql': { text: 'SQ', colour: '#a78bfa' }, 'db': { text: 'DB', colour: '#a78bfa' }, 'sqlite': { text: 'DB', colour: '#a78bfa' },
	'yml': { text: 'YM', colour: '#c084fc' }, 'yaml': { text: 'YM', colour: '#c084fc' }, 'toml': { text: 'TM', colour: '#fbbf24' }, 'ini': { text: 'IN', colour: '#94a3b8' }, 'conf': { text: 'CF', colour: '#94a3b8' }, 'env': { text: 'EV', colour: '#facc15' }
};

/**
 * Displays the icons of files & folders using the file icon theme of Visual Studio Code (as in its Explorer).
 */
class FileIcons {
	private theme: GG.FileIconTheme | null = null;
	private readonly styleElem: HTMLStyleElement;

	/**
	 * Construct a new FileIcons instance.
	 */
	constructor() {
		this.styleElem = document.createElement('style');
		document.head.appendChild(this.styleElem);
	}

	/**
	 * Set the file icon theme used by Visual Studio Code.
	 * @param theme The file icon theme, or NULL if no file icon theme is used.
	 */
	public setTheme(theme: GG.FileIconTheme | null) {
		this.theme = theme;
		this.styleElem.textContent = theme !== null
			? theme.fonts.map((font, index) =>
				'@font-face{font-family:"git-map-file-icons-' + index + '";src:url("' + cssEscape(font.src) + '")' + (font.format !== null ? ' format("' + cssEscape(font.format) + '")' : '') + ';font-weight:' + (font.weight !== null ? cssEscape(font.weight) : 'normal') + ';font-style:' + (font.style !== null ? cssEscape(font.style) : 'normal') + ';}' +
				'.fileTypeIcon.font' + index + '{font-family:"git-map-file-icons-' + index + '";' + (font.size !== null ? 'font-size:' + cssEscape(font.size) + ';' : '') + '}'
			).join('')
			: '';
	}

	/**
	 * Get the HTML of the icon of a file.
	 * @param path The path (or name) of the file.
	 * @returns The HTML.
	 */
	public getFileIcon(path: string) {
		const name = path.substring(path.lastIndexOf('/') + 1).toLowerCase();
		if (this.theme !== null) {
			const sections = this.getSections(this.theme);
			let definition = FileIcons.findMapping(sections, (section) => section.fileNames[name]);
			// The longest file extension is matched first (e.g. "d.ts" before "ts")
			for (let index = name.indexOf('.'); typeof definition === 'undefined' && index > -1; index = name.indexOf('.', index + 1)) {
				const extension = name.substring(index + 1);
				definition = FileIcons.findMapping(sections, (section) => section.fileExtensions[extension]);
			}
			if (typeof definition === 'undefined') definition = FileIcons.findMapping(sections, (section) => section.file !== null ? section.file : undefined);
			const html = typeof definition !== 'undefined' ? this.getDefinitionHtml(this.theme, definition) : null;
			if (html !== null) return html;
		}
		const byName = FALLBACK_FILE_NAMES[name];
		const extension = name.substring(name.lastIndexOf('.') + 1);
		const fallback = byName || (name.includes('.') ? FALLBACK_FILE_ICONS[extension] : undefined);
		if (typeof fallback !== 'undefined') {
			if (fallback.svg) {
				return '<span class="fileTypeIcon glyph" style="color:' + fallback.colour + '">' + fallback.svg + '</span>';
			}
			return '<span class="fileTypeIcon text' + (fallback.pill ? ' pill' : '') + '" style="color:' + fallback.colour + '">' + escapeHtml(fallback.text || '') + '</span>';
		}
		return '<span class="fileTypeIcon glyph" style="color:#94a3b8">' + ICON_SVG_DOC + '</span>';
	}

	/**
	 * Get the HTML of the icon of a folder.
	 * @param name The name of the folder.
	 * @param open Is the folder open (expanded).
	 * @returns The HTML.
	 */
	public getFolderIcon(name: string, open: boolean) {
		if (this.theme !== null) {
			const sections = this.getSections(this.theme), key = name.toLowerCase();
			const definition = FileIcons.findMapping(sections, (section) => open ? section.folderNamesExpanded[key] : section.folderNames[key])
				|| FileIcons.findMapping(sections, (section) => (open ? section.folderExpanded : section.folder) || undefined);
			const html = typeof definition !== 'undefined' ? this.getDefinitionHtml(this.theme, definition) : null;
			if (html !== null) return html;
		}
		const baseName = name.substring(name.lastIndexOf('/') + 1).toLowerCase();
		const colour = FOLDER_COLOURS[baseName] || (open ? '#f0c869' : '#dcb67a');
		return '<span class="fileTypeIcon folderGlyph" style="color:' + colour + '">' + (open ? ICON_SVG_FOLDER_OPEN : ICON_SVG_FOLDER_CLOSED) + '</span>';
	}

	/**
	 * Get the sections of the file icon theme that apply to the current colour theme (light & high contrast themes can override the icons).
	 * @param theme The file icon theme.
	 * @returns The sections, in order of priority.
	 */
	private getSections(theme: GG.FileIconTheme) {
		const sections: GG.FileIconThemeMappings[] = [];
		if (theme.highContrast !== null && document.body.classList.contains('vscode-high-contrast')) sections.push(theme.highContrast);
		if (theme.light !== null && (document.body.classList.contains('vscode-light') || document.body.classList.contains('vscode-high-contrast-light'))) sections.push(theme.light);
		sections.push(theme);
		return sections;
	}

	/**
	 * Get the HTML of an icon definition of the file icon theme.
	 * @param theme The file icon theme.
	 * @param id The id of the icon definition.
	 * @returns The HTML, or NULL if the theme doesn't define the icon.
	 */
	private getDefinitionHtml(theme: GG.FileIconTheme, id: string) {
		const definition = theme.definitions[id];
		if (typeof definition === 'undefined') return null;
		if (definition.iconPath !== null) {
			return '<span class="fileTypeIcon image" style="background-image:url(&quot;' + escapeHtml(cssEscape(definition.iconPath)) + '&quot;)"></span>';
		} else if (definition.fontCharacter !== null) {
			const fontIndex = definition.fontId !== null ? theme.fonts.findIndex((font) => font.id === definition.fontId) : 0;
			return '<span class="fileTypeIcon font' + Math.max(fontIndex, 0) + '" style="' + (definition.fontColor !== null ? 'color:' + escapeHtml(definition.fontColor) + ';' : '') + (definition.fontSize !== null ? 'font-size:' + escapeHtml(definition.fontSize) + ';' : '') + '">' + escapeHtml(definition.fontCharacter) + '</span>';
		}
		return null;
	}

	/**
	 * Find the first mapping in the sections of a file icon theme.
	 * @param sections The sections, in order of priority.
	 * @param getMapping Get the mapping of a section.
	 * @returns The id of the icon definition, or undefined if no section has the mapping.
	 */
	private static findMapping(sections: ReadonlyArray<GG.FileIconThemeMappings>, getMapping: (section: GG.FileIconThemeMappings) => string | undefined) {
		for (let i = 0; i < sections.length; i++) {
			const mapping = getMapping(sections[i]);
			if (typeof mapping === 'string') return mapping;
		}
		return undefined;
	}
}

/**
 * Escape a string for use in a quoted CSS string.
 * @param value The string.
 * @returns The escaped string.
 */
function cssEscape(value: string) {
	return value.replace(/["\\\n\r]/g, (char) => '\\' + char.charCodeAt(0).toString(16) + ' ');
}
