/**
 * Crisp 16x16 pure-vector file & folder icons inspired by https://github.com/file-icons
 * Uses vivid file-icons palette hues for instant type recognition in both dark & light themes.
 */
interface FallbackFileIconDef {
	readonly text?: string;
	readonly svg?: string;
	readonly colour: string;
}

// Pure vector 16x16 glyphs (inspired by file-icons/icons)
const FI_MARKDOWN = '<svg viewBox="0 0 16 16" width="15" height="15"><path fill="currentColor" fill-rule="evenodd" d="M1.5 3.2A1.2 1.2 0 0 1 2.7 2h10.6a1.2 1.2 0 0 1 1.2 1.2v9.6a1.2 1.2 0 0 1-1.2 1.2H2.7a1.2 1.2 0 0 1-1.2-1.2V3.2zm1.2.1v9.4h10.6V3.3H2.7z"/><path fill="currentColor" d="M3.7 10.8V5.2h1.35l1.45 2.05L7.95 5.2H9.3v5.6H8V7.25L6.5 9.3 5 7.25v3.55H3.7zm6.75-2.65h1.05V5.2h1.25v2.95h1.05L12.12 10.9 10.45 8.15z"/></svg>';
const FI_EXCEL = '<svg viewBox="0 0 16 16" width="15" height="15"><path fill="currentColor" fill-opacity="0.22" d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5v-11z"/><path fill="none" stroke="currentColor" stroke-width="1.25" d="M2.5 2.5h11v11h-11zM9.2 2.5v11M9.2 6.2h4.3M9.2 9.8h4.3"/><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M4.3 5.5l3.2 5M7.5 5.5l-3.2 5"/></svg>';
const FI_CSV = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2.2" width="12" height="11.6" rx="1.4"/><path d="M2 5.8h12M2 9.8h12M6 5.8v8M10.2 5.8v8"/></svg>';
const FI_JSON = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="M5.8 2.5c-1.3 0-1.8.6-1.8 1.8v2.1c0 .9-.5 1.6-1.4 1.6.9 0 1.4.7 1.4 1.6v2.1c0 1.2.5 1.8 1.8 1.8"/><path d="M10.2 2.5c1.3 0 1.8.6 1.8 1.8v2.1c0 .9.5 1.6 1.4 1.6-.9 0-1.4.7-1.4 1.6v2.1c0 1.2-.5 1.8-1.8 1.8"/></svg>';
const FI_JSONL = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M4.6 2.6c-1 0-1.4.5-1.4 1.4v2.6c0 .8-.4 1.4-1.1 1.4.7 0 1.1.6 1.1 1.4V12c0 .9.4 1.4 1.4 1.4"/><path d="M11.4 2.6c1 0 1.4.5 1.4 1.4v2.6c0 .8.4 1.4 1.1 1.4-.7 0-1.1.6-1.1 1.4V12c0 .9-.4 1.4-1.4 1.4"/><path d="M6 5.3h4M6 8h4M6 10.7h4"/></svg>';
const FI_WORD = '<svg viewBox="0 0 16 16" width="15" height="15"><path fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" d="M3 1.8h6.4L13 5.4V14.2H3z"/><path fill="none" stroke="currentColor" stroke-width="1.2" d="M9.2 1.8v3.6H13"/><path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" d="M5 7.4l1.1 4.4 1.3-3.2 1.3 3.2L9.8 7.4"/></svg>';
const FI_PPT = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2.5" width="12" height="8.5" rx="1.2"/><path d="M8 11v3M5.5 14h5"/><circle cx="6.2" cy="6.8" r="2"/><path d="M6.2 4.8v2h2M10 5.8h2M10 8h1.5"/></svg>';
const FI_PDF = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 1.8h6.3L13 5.3v8.9H3.2z"/><path d="M9.3 1.8v3.6H13"/><path d="M5.5 11.4c1.3-2.6 2.1-4.8 2.4-6.3.3 1.9 1.4 3.8 3 4.8-1.8-.3-4.1.2-5.4 1.5z"/></svg>';
const FI_DIAGRAM = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="5.3" y="1.8" width="5.4" height="3.6" rx="0.9"/><rect x="1.6" y="10.4" width="4.8" height="3.6" rx="0.9"/><rect x="9.6" y="10.4" width="4.8" height="3.6" rx="0.9"/><path d="M8 5.4v2.4M4 10.4V7.8h8v2.6"/></svg>';
const FI_PYTHON = '<svg viewBox="0 0 16 16" width="15" height="15"><path fill="currentColor" d="M7.9 1.5c-2.6 0-2.5 1.1-2.5 1.1v1.2h2.6v.4H4.4S2 4 2 6.8c0 2.7 1.6 2.6 1.6 2.6h1V8.1s-.1-1.6 1.6-1.6h2.7s1.5 0 1.5-1.5V2.9s.2-1.4-2.5-1.4zM6.3 2.5a.55.55 0 1 1 0 1.1.55.55 0 0 1 0-1.1z"/><path fill="currentColor" fill-opacity="0.72" d="M8.1 14.5c2.6 0 2.5-1.1 2.5-1.1v-1.2H8v-.4h3.6s2.4.2 2.4-2.6c0-2.7-1.6-2.6-1.6-2.6h-1v1.3s.1 1.6-1.6 1.6H7.1s-1.5 0-1.5 1.5v2.1s-.2 1.4 2.5 1.4zm1.6-1a.55.55 0 1 1 0-1.1.55.55 0 0 1 0 1.1z"/></svg>';
const FI_JUPYTER = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M3 5.8C4.4 4.4 6.2 3.8 8 3.8s3.6.6 5 2"/><path d="M3 10.2c1.4 1.4 3.2 2 5 2s3.6-.6 5-2"/><circle cx="12.2" cy="3" r="1" fill="currentColor" stroke="none"/><circle cx="3.8" cy="13" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/></svg>';
const FI_REACT = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.15"><circle cx="8" cy="8" r="1.35" fill="currentColor" stroke="none"/><ellipse cx="8" cy="8" rx="6.2" ry="2.5"/><ellipse cx="8" cy="8" rx="6.2" ry="2.5" transform="rotate(60 8 8)"/><ellipse cx="8" cy="8" rx="6.2" ry="2.5" transform="rotate(120 8 8)"/></svg>';
const FI_VUE = '<svg viewBox="0 0 16 16" width="15" height="15"><path fill="currentColor" d="M1.4 2.5h2.7L8 9.2l3.9-6.7h2.7L8 14 1.4 2.5z"/><path fill="currentColor" fill-opacity="0.5" d="M4.1 2.5h2.2L8 5.5l1.7-3h2.2L8 9.2 4.1 2.5z"/></svg>';
const FI_CODE_TAGS = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="M5.4 4.2L1.8 8l3.6 3.8M10.6 4.2L14.2 8l-3.6 3.8M9 3L7 13"/></svg>';
const FI_HASH = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6.2 2.4L4.6 13.6M11.4 2.4L9.8 13.6M2.4 5.8h11.2M2 10.2h11.2"/></svg>';
const FI_SHELL = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><rect x="1.8" y="2.6" width="12.4" height="10.8" rx="1.6"/><path d="M4.4 6.2L6.8 8.2 4.4 10.2M8.2 10.2h3.4"/></svg>';
const FI_GIT = '<svg viewBox="0 0 16 16" width="15" height="15"><path fill="currentColor" d="M14.7 7.3L8.7 1.3a1 1 0 0 0-1.4 0L5.9 2.7l1.6 1.6a1.2 1.2 0 0 1 1.5 1.5l1.5 1.5a1.2 1.2 0 1 1-.7.7L8.4 6.6v3.9a1.2 1.2 0 1 1-1 0V6.5a1.2 1.2 0 0 1-.6-1.6L5.2 3.3 1.3 7.3a1 1 0 0 0 0 1.4l6 6a1 1 0 0 0 1.4 0l6-6a1 1 0 0 0 0-1.4z"/></svg>';
const FI_DOCKER = '<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><rect x="2.6" y="6" width="2.1" height="1.9" rx="0.3"/><rect x="5.2" y="6" width="2.1" height="1.9" rx="0.3"/><rect x="7.8" y="6" width="2.1" height="1.9" rx="0.3"/><rect x="5.2" y="3.6" width="2.1" height="1.9" rx="0.3"/><rect x="7.8" y="3.6" width="2.1" height="1.9" rx="0.3"/><path d="M14.6 8.3c-.5-.3-1.4-.4-2-.2-.1-.7-.5-1.3-1.1-1.7l-.3-.2-.2.3c-.3.5-.4 1.3-.2 1.9-.3.2-.8.3-1.4.3H1.5c-.2 1.5.2 3.3 1.4 4.3 1.1.9 2.6 1.2 4.3 1.2 3.4 0 6-1.5 7.1-4.5.5 0 1.4 0 1.8-.9l.1-.2-.6-.3z"/></svg>';
const FI_CONFIG = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"><circle cx="8" cy="8" r="2.4"/><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1"/></svg>';
const FI_YAML = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2.5 4h3.5M8.5 4H13.5M4.5 8H7.5M10 8h3.5M4.5 12H7.5M10 12h3.5"/><circle cx="7.2" cy="4" r="0.6" fill="currentColor" stroke="none"/><circle cx="8.8" cy="8" r="0.6" fill="currentColor" stroke="none"/><circle cx="8.8" cy="12" r="0.6" fill="currentColor" stroke="none"/></svg>';
const FI_KEY = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.2" cy="10.4" r="2.7"/><path d="M7.3 8.3L13.4 2.2M11.2 4.4l1.7 1.7M9.3 6.3l1.4 1.4"/></svg>';
const FI_PACKAGE = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.6L13.8 4.8v6.4L8 14.4 2.2 11.2V4.8z"/><path d="M2.2 4.8L8 8l5.8-3.2M8 8v6.4"/></svg>';
const FI_LOCK = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><rect x="3.2" y="7" width="9.6" height="7" rx="1.4"/><path d="M5.4 7V5a2.6 2.6 0 0 1 5.2 0v2"/></svg>';
const FI_DB = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="8" cy="3.8" rx="5.2" ry="2"/><path d="M2.8 3.8v8.4c0 1.1 2.3 2 5.2 2s5.2-.9 5.2-2V3.8"/><path d="M2.8 8c0 1.1 2.3 2 5.2 2s5.2-.9 5.2-2"/></svg>';
const FI_IMAGE = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="1.8" y="2.5" width="12.4" height="11" rx="1.5"/><circle cx="5.5" cy="5.9" r="1.15" fill="currentColor" stroke="none"/><path d="M2.4 11.8l3.1-3.1 2.3 2.1 2.1-2 3.7 3"/></svg>';
const FI_SVG_PEN = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13C3 7.5 7.5 3 13 3"/><circle cx="3" cy="13" r="1.4" fill="currentColor" stroke="none"/><circle cx="13" cy="3" r="1.4" fill="currentColor" stroke="none"/><rect x="6.6" y="6.6" width="2.8" height="2.8" rx="0.5"/><path d="M3 5.5h5M10.5 13V8"/></svg>';
const FI_AUDIO = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M6.2 12V4.2l7-1.7v7.8"/><circle cx="4.5" cy="12" r="1.7"/><circle cx="11.5" cy="10.3" r="1.7"/></svg>';
const FI_VIDEO = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="1.8" y="2.6" width="12.4" height="10.8" rx="1.6"/><polygon points="6.6,5.5 11.3,8 6.6,10.5" fill="currentColor" stroke="none"/></svg>';
const FI_ARCHIVE = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="2.2" y="2.2" width="11.6" height="11.6" rx="1.5"/><path d="M2.2 5.6h11.6M8 5.6v1.4M8 8.4v1.4M6.6 11.2h2.8"/></svg>';
const FI_LICENSE = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="6.2" r="3.6"/><path d="M5.8 9.2L4.6 14l3.4-1.5L11.4 14l-1.2-4.8"/></svg>';
const FI_RUBY = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><polygon points="4.5,2.5 11.5,2.5 14.2,6 8,13.6 1.8,6"/><path d="M1.8 6h12.4M4.5 2.5L6.2 6 8 13.6 9.8 6l1.7-3.5"/></svg>';
const FI_TEXT = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3.6 1.8h5.8L12.8 5.2v9H3.6z"/><path d="M9.2 1.8v3.5h3.5M5.6 8.2h4.8M5.6 10.8h3.5"/></svg>';
const FI_TS = '<svg viewBox="0 0 16 16" width="15" height="15"><rect x="1.8" y="1.8" width="12.4" height="12.4" rx="2" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.2"/><path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" d="M3.8 6.4h4M5.8 6.4v5.2M12.2 7.2c-.3-.6-1-.9-1.7-.8-.8.1-1.3.6-1.3 1.2 0 .7.6 1 1.5 1.2 1 .2 1.6.6 1.6 1.4 0 .8-.7 1.4-1.7 1.4-.9 0-1.5-.3-1.8-.9"/></svg>';
const FI_JS = '<svg viewBox="0 0 16 16" width="15" height="15"><rect x="1.8" y="1.8" width="12.4" height="12.4" rx="2" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.2"/><path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" d="M6.8 6.2v4c0 1-.6 1.5-1.5 1.5-.6 0-1.1-.3-1.3-.7M12.2 7.1c-.3-.6-.9-.9-1.6-.8-.8.1-1.3.6-1.3 1.2 0 .7.6 1 1.4 1.2 1 .2 1.6.6 1.6 1.4 0 .8-.7 1.4-1.7 1.4-.9 0-1.5-.3-1.8-.9"/></svg>';
const FI_FOLDER_CLOSED = '<svg viewBox="0 0 16 16" width="15" height="15"><path fill="currentColor" fill-opacity="0.25" d="M1.8 3.2A1.2 1.2 0 0 1 3 2h3.1c.4 0 .76.18 1 .5l.6.8h5.2a1.2 1.2 0 0 1 1.2 1.2v8a1.2 1.2 0 0 1-1.2 1.2H3a1.2 1.2 0 0 1-1.2-1.2V3.2z"/><path fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" d="M2 3.3A1.1 1.1 0 0 1 3.1 2.2h3c.36 0 .7.17.92.46l.6.78h5.28A1.1 1.1 0 0 1 14 4.54v7.96a1.1 1.1 0 0 1-1.1 1.1H3.1A1.1 1.1 0 0 1 2 12.5V3.3z"/></svg>';
const FI_FOLDER_OPEN = '<svg viewBox="0 0 16 16" width="15" height="15"><path fill="currentColor" fill-opacity="0.2" d="M2 3.4A1.1 1.1 0 0 1 3.1 2.3h3c.36 0 .7.17.92.46l.58.74h5.1a1.1 1.1 0 0 1 1.1 1.1v1.7H2V3.4z"/><path fill="currentColor" fill-opacity="0.32" d="M1.6 7.2a.9.9 0 0 1 .9-.8h11a.9.9 0 0 1 .88 1.1l-1 5.1a1.1 1.1 0 0 1-1.08.9H3.1a1.1 1.1 0 0 1-1.08-.9L1.6 7.2z"/><path fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" d="M2 6.3V3.4a1.1 1.1 0 0 1 1.1-1.1h3c.36 0 .7.17.92.46l.58.74h5.1a1.1 1.1 0 0 1 1.1 1.1v1.7M1.7 7.1a.85.85 0 0 1 .84-.7h10.92a.85.85 0 0 1 .83 1.04l-.98 5.1a1.1 1.1 0 0 1-1.08.9H3.15a1.1 1.1 0 0 1-1.08-.92L1.7 7.1z"/></svg>';

const FOLDER_COLOURS: { readonly [folderName: string]: string } = {
	'src': '#e2b93d', 'apps': '#e37933', 'app': '#e37933', 'packages': '#e37933', 'lib': '#e2b93d',
	'docs': '#519aba', 'doc': '#519aba', 'documentation': '#519aba', 'reference': '#519aba',
	'data': '#4ec9b0', 'datasets': '#4ec9b0', 'db': '#4ec9b0', 'assets': '#a074c4', 'images': '#a074c4', 'media': '#a074c4',
	'scripts': '#2dd4bf', 'bin': '#2dd4bf', 'tools': '#2dd4bf',
	'test': '#f55385', 'tests': '#f55385', '__tests__': '#f55385', 'eval': '#f55385', 'spec': '#f55385',
	'prompts': '#a074c4', 'config': '#e37933', '.github': '#818cf8', '.claude': '#a074c4', '.vscode': '#519aba', '.git': '#f05032'
};

const FALLBACK_FILE_NAMES: { readonly [fileName: string]: FallbackFileIconDef } = {
	'.gitignore': { svg: FI_GIT, colour: '#f05032' },
	'.gitattributes': { svg: FI_GIT, colour: '#f05032' },
	'.gitmodules': { svg: FI_GIT, colour: '#f05032' },
	'.gitkeep': { svg: FI_GIT, colour: '#f05032' },
	'dockerfile': { svg: FI_DOCKER, colour: '#2496ed' },
	'.dockerignore': { svg: FI_DOCKER, colour: '#2496ed' },
	'docker-compose.yml': { svg: FI_DOCKER, colour: '#2496ed' },
	'docker-compose.yaml': { svg: FI_DOCKER, colour: '#2496ed' },
	'makefile': { svg: FI_CONFIG, colour: '#e37933' },
	'cmakelists.txt': { svg: FI_CONFIG, colour: '#e37933' },
	'license': { svg: FI_LICENSE, colour: '#cbcb41' },
	'license.md': { svg: FI_LICENSE, colour: '#cbcb41' },
	'license.txt': { svg: FI_LICENSE, colour: '#cbcb41' },
	'package.json': { svg: FI_PACKAGE, colour: '#8dc149' },
	'package-lock.json': { svg: FI_LOCK, colour: '#8dc149' },
	'pnpm-lock.yaml': { svg: FI_LOCK, colour: '#e37933' },
	'yarn.lock': { svg: FI_LOCK, colour: '#519aba' },
	'uv.lock': { svg: FI_LOCK, colour: '#a074c4' },
	'poetry.lock': { svg: FI_LOCK, colour: '#519aba' },
	'cargo.toml': { svg: FI_PACKAGE, colour: '#e37933' },
	'pyproject.toml': { svg: FI_PACKAGE, colour: '#519aba' },
	'requirements.txt': { svg: FI_PYTHON, colour: '#519aba' },
	'tsconfig.json': { svg: FI_TS, colour: '#519aba' },
	'.env': { svg: FI_KEY, colour: '#cbcb41' },
	'.env.local': { svg: FI_KEY, colour: '#cbcb41' },
	'.env.example': { svg: FI_KEY, colour: '#cbcb41' },
	'.env.production': { svg: FI_KEY, colour: '#cbcb41' }
};

const FALLBACK_FILE_ICONS: { readonly [extension: string]: FallbackFileIconDef } = {
	// Spreadsheets & Tabular Data
	'xlsx': { svg: FI_EXCEL, colour: '#43a047' }, 'xls': { svg: FI_EXCEL, colour: '#43a047' },
	'xlsm': { svg: FI_EXCEL, colour: '#43a047' }, 'ods': { svg: FI_EXCEL, colour: '#43a047' },
	'csv': { svg: FI_CSV, colour: '#4ec9b0' }, 'tsv': { svg: FI_CSV, colour: '#4ec9b0' },
	// Docs, Office & Diagrams
	'md': { svg: FI_MARKDOWN, colour: '#519aba' }, 'markdown': { svg: FI_MARKDOWN, colour: '#519aba' }, 'mdx': { svg: FI_MARKDOWN, colour: '#519aba' },
	'pdf': { svg: FI_PDF, colour: '#e05555' },
	'doc': { svg: FI_WORD, colour: '#42a5f5' }, 'docx': { svg: FI_WORD, colour: '#42a5f5' }, 'rtf': { svg: FI_WORD, colour: '#42a5f5' },
	'ppt': { svg: FI_PPT, colour: '#e37933' }, 'pptx': { svg: FI_PPT, colour: '#e37933' },
	'drawio': { svg: FI_DIAGRAM, colour: '#f08705' }, 'dio': { svg: FI_DIAGRAM, colour: '#f08705' },
	'excalidraw': { svg: FI_DIAGRAM, colour: '#a074c4' }, 'mmd': { svg: FI_DIAGRAM, colour: '#f55385' }, 'mermaid': { svg: FI_DIAGRAM, colour: '#f55385' },
	'txt': { svg: FI_TEXT, colour: '#94a3b8' }, 'log': { svg: FI_TEXT, colour: '#94a3b8' }, 'rst': { svg: FI_TEXT, colour: '#519aba' },
	// Images & Media
	'png': { svg: FI_IMAGE, colour: '#a074c4' }, 'jpg': { svg: FI_IMAGE, colour: '#a074c4' }, 'jpeg': { svg: FI_IMAGE, colour: '#a074c4' },
	'gif': { svg: FI_IMAGE, colour: '#a074c4' }, 'webp': { svg: FI_IMAGE, colour: '#a074c4' }, 'ico': { svg: FI_IMAGE, colour: '#a074c4' },
	'bmp': { svg: FI_IMAGE, colour: '#a074c4' }, 'avif': { svg: FI_IMAGE, colour: '#a074c4' }, 'svg': { svg: FI_SVG_PEN, colour: '#e37933' },
	'mp3': { svg: FI_AUDIO, colour: '#f55385' }, 'wav': { svg: FI_AUDIO, colour: '#f55385' }, 'ogg': { svg: FI_AUDIO, colour: '#f55385' }, 'm4a': { svg: FI_AUDIO, colour: '#f55385' }, 'flac': { svg: FI_AUDIO, colour: '#f55385' },
	'mp4': { svg: FI_VIDEO, colour: '#f55385' }, 'webm': { svg: FI_VIDEO, colour: '#f55385' }, 'mov': { svg: FI_VIDEO, colour: '#f55385' }, 'mkv': { svg: FI_VIDEO, colour: '#f55385' },
	// Archives
	'zip': { svg: FI_ARCHIVE, colour: '#e37933' }, 'tar': { svg: FI_ARCHIVE, colour: '#e37933' }, 'gz': { svg: FI_ARCHIVE, colour: '#e37933' },
	'tgz': { svg: FI_ARCHIVE, colour: '#e37933' }, '7z': { svg: FI_ARCHIVE, colour: '#e37933' }, 'rar': { svg: FI_ARCHIVE, colour: '#e37933' }, 'dmg': { svg: FI_ARCHIVE, colour: '#e37933' },
	'vsix': { svg: FI_ARCHIVE, colour: '#519aba' }, 'whl': { svg: FI_ARCHIVE, colour: '#519aba' }, 'jar': { svg: FI_ARCHIVE, colour: '#e05555' }, 'apk': { svg: FI_ARCHIVE, colour: '#8dc149' }, 'nupkg': { svg: FI_ARCHIVE, colour: '#519aba' }, 'epub': { svg: FI_ARCHIVE, colour: '#8dc149' },
	// Languages & Data Formats
	'ts': { svg: FI_TS, colour: '#519aba' }, 'mts': { svg: FI_TS, colour: '#519aba' }, 'cts': { svg: FI_TS, colour: '#519aba' },
	'tsx': { svg: FI_REACT, colour: '#519aba' },
	'js': { svg: FI_JS, colour: '#cbcb41' }, 'mjs': { svg: FI_JS, colour: '#cbcb41' }, 'cjs': { svg: FI_JS, colour: '#cbcb41' },
	'jsx': { svg: FI_REACT, colour: '#61dafb' },
	'json': { svg: FI_JSON, colour: '#cbcb41' }, 'jsonc': { svg: FI_JSON, colour: '#cbcb41' }, 'json5': { svg: FI_JSON, colour: '#cbcb41' },
	'jsonl': { svg: FI_JSONL, colour: '#f59e0b' }, 'ndjson': { svg: FI_JSONL, colour: '#f59e0b' }, 'jsonlines': { svg: FI_JSONL, colour: '#f59e0b' },
	'css': { svg: FI_HASH, colour: '#519aba' }, 'scss': { svg: FI_HASH, colour: '#f55385' }, 'sass': { svg: FI_HASH, colour: '#f55385' }, 'less': { svg: FI_HASH, colour: '#519aba' },
	'html': { svg: FI_CODE_TAGS, colour: '#e37933' }, 'htm': { svg: FI_CODE_TAGS, colour: '#e37933' }, 'xml': { svg: FI_CODE_TAGS, colour: '#e37933' }, 'plist': { svg: FI_CODE_TAGS, colour: '#e37933' },
	'vue': { svg: FI_VUE, colour: '#41b883' }, 'svelte': { svg: FI_CODE_TAGS, colour: '#ff3e00' },
	'py': { svg: FI_PYTHON, colour: '#519aba' }, 'pyw': { svg: FI_PYTHON, colour: '#519aba' }, 'pyi': { svg: FI_PYTHON, colour: '#a074c4' },
	'ipynb': { svg: FI_JUPYTER, colour: '#f37626' },
	'rb': { svg: FI_RUBY, colour: '#cc3e44' },
	'go': { text: 'GO', colour: '#519aba' }, 'rs': { svg: FI_CONFIG, colour: '#e37933' },
	'java': { text: 'JV', colour: '#cc3e44' }, 'kt': { text: 'KT', colour: '#a074c4' }, 'php': { text: 'PH', colour: '#a074c4' }, 'swift': { text: 'SW', colour: '#e37933' },
	'c': { text: 'C', colour: '#519aba' }, 'h': { text: 'H', colour: '#a074c4' }, 'cpp': { text: 'C+', colour: '#519aba' }, 'hpp': { text: 'H+', colour: '#a074c4' }, 'cs': { text: 'C#', colour: '#8dc149' },
	'sh': { svg: FI_SHELL, colour: '#8dc149' }, 'bash': { svg: FI_SHELL, colour: '#8dc149' }, 'zsh': { svg: FI_SHELL, colour: '#8dc149' }, 'fish': { svg: FI_SHELL, colour: '#8dc149' }, 'ps1': { svg: FI_SHELL, colour: '#519aba' }, 'bat': { svg: FI_SHELL, colour: '#8dc149' },
	'sql': { svg: FI_DB, colour: '#a074c4' }, 'db': { svg: FI_DB, colour: '#a074c4' }, 'sqlite': { svg: FI_DB, colour: '#519aba' }, 'sqlite3': { svg: FI_DB, colour: '#519aba' }, 'parquet': { svg: FI_DB, colour: '#4ec9b0' }, 'duckdb': { svg: FI_DB, colour: '#cbcb41' },
	'yml': { svg: FI_YAML, colour: '#a074c4' }, 'yaml': { svg: FI_YAML, colour: '#a074c4' },
	'toml': { svg: FI_CONFIG, colour: '#e37933' }, 'ini': { svg: FI_CONFIG, colour: '#94a3b8' }, 'conf': { svg: FI_CONFIG, colour: '#94a3b8' }, 'cfg': { svg: FI_CONFIG, colour: '#94a3b8' },
	'env': { svg: FI_KEY, colour: '#cbcb41' }, 'pem': { svg: FI_KEY, colour: '#cbcb41' }, 'key': { svg: FI_KEY, colour: '#cbcb41' }, 'lock': { svg: FI_LOCK, colour: '#94a3b8' }
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
		const fallback = byName || (name.startsWith('.env') ? { svg: FI_KEY, colour: '#cbcb41' } : (name.includes('.') ? FALLBACK_FILE_ICONS[extension] : undefined));
		if (typeof fallback !== 'undefined') {
			if (fallback.svg) {
				return '<span class="fileTypeIcon glyph" style="color:' + fallback.colour + '">' + fallback.svg + '</span>';
			}
			return '<span class="fileTypeIcon text" style="color:' + fallback.colour + '">' + escapeHtml(fallback.text || '') + '</span>';
		}
		return '<span class="fileTypeIcon glyph" style="color:#94a3b8">' + FI_TEXT + '</span>';
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
		const colour = FOLDER_COLOURS[baseName] || (open ? '#e5c07b' : '#dcb67a');
		return '<span class="fileTypeIcon folderGlyph" style="color:' + colour + '">' + (open ? FI_FOLDER_OPEN : FI_FOLDER_CLOSED) + '</span>';
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
