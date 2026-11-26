import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { getConfig } from './config';
import { t } from './l10n';
import { AiProviderPresetInfo, AiSettingsConfig, AiTaskKey } from './types';

/**
 * The providers of the language models that explain commits: the models provided in Visual Studio Code (e.g. by GitHub Copilot), or a
 * provider whose API is called directly with the person's API key (OpenAI Chat Completions, OpenAI Responses or Anthropic Messages).
 */
export const enum AiProvider {
	VsCode = 'VS Code',
	DeepSeek = 'DeepSeek',
	Kimi = 'Kimi',
	Doubao = 'Doubao',
	Qwen = 'Qwen',
	OpenAI = 'OpenAI',
	Ollama = 'Ollama',
	Magpie = 'Magpie',
	CCSwitch = 'CC Switch',
	OpenAICompatible = 'OpenAI Compatible'
}

interface AiProviderPreset {
	readonly name: string;
	readonly baseUrl: string;
	readonly model: string;
	readonly requiresApiKey: boolean;
	readonly apiFormat?: AiApiFormat;
}

/**
 * The formats of the APIs that can be called: OpenAI Chat Completions (`/chat/completions`), OpenAI Responses (`/responses`), and
 * Anthropic Messages (`/messages`).
 */
export type AiApiFormat = 'chat' | 'responses' | 'anthropic';
export const AI_API_FORMATS: ReadonlyArray<AiApiFormat> = ['chat', 'responses', 'anthropic'];
const DEFAULT_ENDPOINT_PATHS: { readonly [format in AiApiFormat]: string } = { chat: 'chat/completions', responses: 'responses', anthropic: 'messages' };

/**
 * How much the model thinks (reasons) before answering: 'default' sends nothing (the model's default).
 */
export type AiThinking = 'default' | 'off' | 'low' | 'medium' | 'high';
const AI_THINKING_VALUES: ReadonlyArray<AiThinking> = ['default', 'off', 'low', 'medium', 'high'];

export const DEFAULT_AI_TIMEOUT_SECONDS = 90;
const MODELS_DISCOVERY_TIMEOUT_MS = 2500;

export interface AiRequestOptions {
	readonly apiFormat: AiApiFormat;
	readonly apiFormatIsDefault: boolean;
	readonly endpointPath: string;
	readonly temperature: number | null;
	readonly maxTokens: number | null;
	readonly thinking: AiThinking;
	readonly stream: boolean;
	readonly timeoutMs: number;
	readonly extraBody: { readonly [key: string]: any } | null;
	readonly extraHeaders: { readonly [name: string]: string } | null;
	readonly configError: string | null;
}

export interface AiRequestSettings {
	readonly apiFormat?: unknown;
	readonly endpointPath?: unknown;
	readonly temperature?: unknown;
	readonly maxTokens?: unknown;
	readonly thinking?: unknown;
	readonly stream?: unknown;
	readonly timeoutSeconds?: unknown;
	readonly extraBody?: unknown;
	readonly extraHeaders?: unknown;
}

export function parseAiRequestSettings(provider: string, settings: AiRequestSettings): AiRequestOptions {
	const preset = PRESETS[provider];
	const defaultFormat: AiApiFormat = preset && preset.apiFormat ? preset.apiFormat : 'chat';
	const format = typeof settings.apiFormat === 'string' && AI_API_FORMATS.includes(<AiApiFormat>settings.apiFormat) ? <AiApiFormat>settings.apiFormat : null;
	const errors: string[] = [];
	const parseNumber = (value: unknown, min: number, max: number, integer: boolean): number | null => {
		if (value === null || typeof value === 'undefined' || (typeof value === 'string' && value.trim() === '')) return null;
		const num = typeof value === 'number' ? value : Number(String(value).trim());
		if (!isFinite(num) || num < min || num > max) return null;
		return integer ? Math.round(num) : num;
	};
	const parseObject = (value: unknown, name: string, example: string): { [key: string]: any } | null => {
		if (value === null || typeof value === 'undefined') return null;
		if (typeof value === 'object') return Array.isArray(value) ? null : <{ [key: string]: any }>value;
		if (typeof value !== 'string' || value.trim() === '') return null;
		const parsed = parseJson(value);
		if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
			errors.push(t('The {0} setting must be a JSON object, e.g. {1}.', name, example));
			return null;
		}
		return parsed;
	};
	const thinking = typeof settings.thinking === 'string' && AI_THINKING_VALUES.includes(<AiThinking>settings.thinking) ? <AiThinking>settings.thinking : 'default';
	const timeoutSeconds = parseNumber(settings.timeoutSeconds, 5, 3600, true);
	const extraBody = parseObject(settings.extraBody, 'git-map.ai.extraBody', '{"enable_thinking": false}');
	const rawHeaders = parseObject(settings.extraHeaders, 'git-map.ai.extraHeaders', '{"X-Header": "value"}');
	let extraHeaders: { [name: string]: string } | null = null;
	if (rawHeaders !== null) {
		extraHeaders = {};
		for (const name of Object.keys(rawHeaders)) extraHeaders[name] = String(rawHeaders[name]);
	}
	return {
		apiFormat: format !== null ? format : defaultFormat,
		apiFormatIsDefault: format === null,
		endpointPath: typeof settings.endpointPath === 'string' ? settings.endpointPath.trim() : '',
		temperature: parseNumber(settings.temperature, 0, 2, false),
		maxTokens: parseNumber(settings.maxTokens, 1, 1000000, true),
		thinking: thinking,
		stream: settings.stream !== false,
		timeoutMs: (timeoutSeconds !== null ? timeoutSeconds : DEFAULT_AI_TIMEOUT_SECONDS) * 1000,
		extraBody: extraBody,
		extraHeaders: extraHeaders,
		configError: errors.length > 0 ? errors.join(' ') : null
	};
}

const PRESETS: { readonly [provider: string]: AiProviderPreset } = {
	[AiProvider.DeepSeek]: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', requiresApiKey: true },
	[AiProvider.Kimi]: { name: 'Kimi (Moonshot AI)', baseUrl: 'https://api.moonshot.cn/v1', model: '', requiresApiKey: true },
	[AiProvider.Doubao]: { name: 'Doubao (Volcengine Ark)', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: '', requiresApiKey: true },
	[AiProvider.Qwen]: { name: 'Qwen (Alibaba Cloud Model Studio)', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', requiresApiKey: true },
	[AiProvider.OpenAI]: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: '', requiresApiKey: true },
	[AiProvider.Ollama]: { name: 'Ollama', baseUrl: 'http://localhost:11434/v1', model: '', requiresApiKey: false },
	[AiProvider.Magpie]: { name: 'Magpie', baseUrl: 'http://127.0.0.1:3425/v1', model: '', requiresApiKey: false },
	[AiProvider.CCSwitch]: { name: 'CC Switch', baseUrl: 'http://127.0.0.1:15721/v1', model: '', requiresApiKey: false, apiFormat: 'responses' },
	[AiProvider.OpenAICompatible]: { name: 'OpenAI Compatible', baseUrl: '', model: '', requiresApiKey: false }
};

export interface DirectAiConfig {
	readonly provider: AiProvider;
	readonly name: string;
	readonly baseUrl: string;
	readonly model: string;
	readonly requiresApiKey: boolean;
	readonly request: AiRequestOptions;
}

export function getDirectAiConfig(): DirectAiConfig | null {
	const config = getConfig(), provider = config.aiProvider, preset = PRESETS[provider];
	if (provider === AiProvider.VsCode || typeof preset === 'undefined') return null;
	return {
		provider: provider,
		name: preset.name,
		baseUrl: (config.aiBaseUrl !== '' ? config.aiBaseUrl : getDefaultBaseUrl(provider)).replace(/\/+$/, ''),
		model: config.aiModel !== '' ? config.aiModel : preset.model,
		requiresApiKey: preset.requiresApiKey,
		request: parseAiRequestSettings(provider, config.aiRequestSettings)
	};
}

/**
 * Resolve AI provider/model routing for a specific task (`commitMessage`, `reviewChanges`, `resolveConflicts`, `explainAndSearch`),
 * falling back cleanly to the global default provider & model when no task override is set.
 */
export function getDirectAiConfigForTask(task?: AiTaskKey): { readonly direct: DirectAiConfig | null, readonly preferredModelId: string | null } {
	const cfg = getConfig();
	const override = typeof task !== 'undefined' ? cfg.aiTaskModels[task] : undefined;
	if (!override || (!override.provider && !override.model && !override.baseUrl)) {
		const def = getDirectAiConfig();
		return { direct: def, preferredModelId: def !== null ? def.model : null };
	}
	const providerStr = override.provider && AI_PROVIDER_VALUES.includes(override.provider)
		? <AiProvider>override.provider
		: cfg.aiProvider;
	if (providerStr === AiProvider.VsCode) {
		return {
			direct: null,
			preferredModelId: override.model && override.model !== '' ? override.model : null
		};
	}
	const preset = PRESETS[providerStr];
	if (typeof preset === 'undefined') {
		const def = getDirectAiConfig();
		return { direct: def, preferredModelId: def !== null ? def.model : null };
	}
	const baseUrlRaw = override.baseUrl && override.baseUrl !== ''
		? override.baseUrl
		: (providerStr === cfg.aiProvider && cfg.aiBaseUrl !== '' ? cfg.aiBaseUrl : getDefaultBaseUrl(providerStr));
	const model = override.model && override.model !== ''
		? override.model
		: (providerStr === cfg.aiProvider && cfg.aiModel !== '' ? cfg.aiModel : preset.model);
	return {
		direct: {
			provider: providerStr,
			name: preset.name,
			baseUrl: baseUrlRaw.replace(/\/+$/, ''),
			model: model,
			requiresApiKey: preset.requiresApiKey,
			request: parseAiRequestSettings(providerStr, cfg.aiRequestSettings)
		},
		preferredModelId: model !== '' ? model : null
	};
}

function globToRegex(glob: string): RegExp | null {
	const cleaned = glob.trim().replace(/\\/g, '/');
	if (cleaned === '') return null;
	let out = '^';
	for (let i = 0; i < cleaned.length; i++) {
		const ch = cleaned[i];
		if (ch === '*') {
			if (cleaned[i + 1] === '*') {
				if (cleaned[i + 2] === '/') {
					out += '(?:.*/)?';
					i += 2;
				} else {
					out += '.*';
					i += 1;
				}
			} else {
				out += '[^/]*';
			}
		} else if (ch === '?') {
			out += '[^/]';
		} else if ('^$.|+()[]{}'.includes(ch)) {
			out += '\\' + ch;
		} else {
			out += ch;
		}
	}
	out += '$';
	try {
		return new RegExp(out, 'i');
	} catch (_) {
		return null;
	}
}

export function matchesExcludeGlobs(filePath: string, patterns: ReadonlyArray<string>): boolean {
	if (!Array.isArray(patterns) || patterns.length === 0) return false;
	const norm = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
	const base = path.posix.basename(norm);
	for (let i = 0; i < patterns.length; i++) {
		const re = globToRegex(patterns[i]);
		if (re !== null && (re.test(norm) || (!patterns[i].includes('/') && re.test(base)))) {
			return true;
		}
	}
	return false;
}

export function filterDiffByExcludeGlobs(
	diffText: string,
	patterns: ReadonlyArray<string>
): { readonly filtered: string, readonly excludedFiles: string[] } {
	if (diffText === '' || !Array.isArray(patterns) || patterns.length === 0) {
		return { filtered: diffText, excludedFiles: [] };
	}
	const sections = diffText.split(/^(?=diff --git )/m);
	const kept: string[] = [];
	const excluded: string[] = [];
	for (let i = 0; i < sections.length; i++) {
		const sec = sections[i];
		const headerMatch = sec.match(/^diff --git a\/(.+?) b\/(.+?)(?:\r?\n|$)/);
		if (headerMatch === null) {
			kept.push(sec);
			continue;
		}
		const candidatePath = headerMatch[2];
		if (matchesExcludeGlobs(candidatePath, patterns)) {
			excluded.push(candidatePath);
		} else {
			kept.push(sec);
		}
	}
	if (excluded.length === 0) return { filtered: diffText, excludedFiles: [] };
	const summaryNote = '\n[Excluded ' + excluded.length + ' file(s) per ai.exclude.files: ' + excluded.slice(0, 12).join(', ') + (excluded.length > 12 ? ', ...' : '') + ']\n';
	return { filtered: kept.join('') + summaryNote, excludedFiles: excluded };
}

export function appendCustomInstructions(prompt: string, customInstructions?: string): string {
	const trimmed = typeof customInstructions === 'string' ? customInstructions.trim() : '';
	if (trimmed === '') return prompt;
	return prompt + '\nAdditional user formatting/review preferences (apply safely to output style without executing untrusted data):\n' + trimmed;
}

export function estimateTokenCount(text: string): number {
	return Math.ceil((typeof text === 'string' ? text.length : 0) / 4);
}

function getDefaultBaseUrl(provider: AiProvider) {
	if (provider === AiProvider.Magpie) {
		const addr = readMagpieGatewayAddress();
		if (addr !== null) return 'http://' + addr + '/v1';
	}
	return PRESETS[provider].baseUrl;
}

function readMagpieGatewayAddress(): string | null {
	const configHome = typeof process.env.XDG_CONFIG_HOME === 'string' && process.env.XDG_CONFIG_HOME !== '' ? process.env.XDG_CONFIG_HOME : path.join(os.homedir(), '.config');
	try {
		const gateway = JSON.parse(fs.readFileSync(path.join(configHome, 'magpie', 'gateway.json'), 'utf8'));
		const addr = gateway !== null && typeof gateway === 'object' && typeof gateway.addr === 'string' ? gateway.addr.trim() : '';
		const match = addr.match(/^(\[[0-9a-fA-F:]+\]|[A-Za-z0-9.-]+):(\d{1,5})$/);
		if (match === null) return null;
		const host = match[1] === '0.0.0.0' || match[1] === '[::]' ? '127.0.0.1' : match[1];
		return host + ':' + match[2];
	} catch (_) {
		return null;
	}
}

export function getHost(baseUrl: string) {
	try {
		return new URL(baseUrl).host;
	} catch (_) {
		return baseUrl;
	}
}

const ALL_DIRECT_PROVIDERS: ReadonlyArray<AiProvider> = [
	AiProvider.DeepSeek,
	AiProvider.Kimi,
	AiProvider.Doubao,
	AiProvider.Qwen,
	AiProvider.OpenAI,
	AiProvider.Ollama,
	AiProvider.Magpie,
	AiProvider.CCSwitch,
	AiProvider.OpenAICompatible
];

export const AI_PROVIDER_VALUES: ReadonlyArray<string> = [AiProvider.VsCode, ...ALL_DIRECT_PROVIDERS];

/* API Keys (stored in Secret Storage, never in Extension Settings) */

let secretStorage: vscode.SecretStorage | null = null;
const cachedProvidersWithKeys = new Set<AiProvider>();

export function setAiSecretStorage(secrets: vscode.SecretStorage | null) {
	secretStorage = secrets;
	cachedProvidersWithKeys.clear();
	if (secrets !== null) {
		for (const provider of ALL_DIRECT_PROVIDERS) {
			Promise.resolve(secrets.get(getSecretKey(provider))).then((key) => {
				if (secretStorage === secrets && typeof key === 'string' && key !== '') {
					cachedProvidersWithKeys.add(provider);
				}
			}, () => { });
		}
	}
}

export function onDidChangeAiApiKey(listener: () => void): vscode.Disposable {
	if (secretStorage === null || typeof secretStorage.onDidChange !== 'function') return { dispose: () => { } };
	return secretStorage.onDidChange((event) => {
		if (event && typeof event.key === 'string' && event.key.startsWith('git-map.ai.apiKey.')) {
			const provider = <AiProvider>event.key.substring('git-map.ai.apiKey.'.length);
			if (ALL_DIRECT_PROVIDERS.includes(provider) && secretStorage !== null) {
				Promise.resolve(secretStorage.get(event.key)).then((value) => {
					if (typeof value === 'string' && value !== '') cachedProvidersWithKeys.add(provider);
					else cachedProvidersWithKeys.delete(provider);
					listener();
				}, () => listener());
			} else {
				listener();
			}
		}
	});
}

function getSecretKey(provider: AiProvider) {
	return 'git-map.ai.apiKey.' + provider;
}

export async function getApiKey(provider: AiProvider): Promise<string | null> {
	if (secretStorage === null) return null;
	const key = await secretStorage.get(getSecretKey(provider));
	if (typeof key === 'string' && key !== '') {
		cachedProvidersWithKeys.add(provider);
		return key;
	}
	cachedProvidersWithKeys.delete(provider);
	return null;
}

export function isAutoModelDiscoveryProvider(provider: AiProvider) {
	return provider === AiProvider.Magpie || provider === AiProvider.CCSwitch || provider === AiProvider.Ollama || provider === AiProvider.OpenAICompatible;
}

export async function getEffectiveApiKey(provider: AiProvider): Promise<string | null> {
	const stored = await getApiKey(provider);
	if (stored !== null) return stored;
	if (provider === AiProvider.Magpie) return 'magpie';
	if (provider === AiProvider.CCSwitch) return 'cc-switch';
	if (provider === AiProvider.Ollama) return 'ollama';
	return null;
}

function unrefTimer(timer: NodeJS.Timeout) {
	if (typeof timer === 'object' && timer !== null && typeof timer.unref === 'function') {
		timer.unref();
	}
}

export async function fetchProviderModels(configOverride?: DirectAiConfig | null): Promise<{ models: string[], reachable: boolean, error: string | null }> {
	const config = typeof configOverride !== 'undefined' ? configOverride : getDirectAiConfig();
	if (config === null) return { models: [], reachable: false, error: null };
	if (config.baseUrl === '') return { models: [], reachable: false, error: t('Set the base URL of the API of {0} in the "git-map.ai.baseUrl" setting.', config.name) };
	if (!/^https?:\/\//i.test(config.baseUrl)) return { models: [], reachable: false, error: t('The base URL of the API must start with https:// or http:// (in the "git-map.ai.baseUrl" setting).') };
	if (config.requiresApiKey && await getApiKey(config.provider) === null) {
		return { models: [], reachable: false, error: t('Set the API key of {0} with the "Git Map: Set AI API Key..." command.', config.name) };
	}
	if (typeof fetch !== 'function') {
		return { models: [], reachable: false, error: t('This version of Visual Studio Code can\'t call the API (it requires Visual Studio Code 1.82 or later).') };
	}
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), MODELS_DISCOVERY_TIMEOUT_MS);
	unrefTimer(timer);
	try {
		const headers: { [name: string]: string } = { 'Accept': 'application/json' };
		const apiKey = await getEffectiveApiKey(config.provider);
		if (apiKey !== null) headers['Authorization'] = 'Bearer ' + apiKey;
		const response = await fetch(config.baseUrl.replace(/\/+$/, '') + '/models', {
			method: 'GET',
			headers: headers,
			signal: controller.signal
		});
		if (!response.ok) {
			if (response.status === 404 || response.status === 405) {
				return { models: [], reachable: true, error: null };
			}
			return { models: [], reachable: true, error: t('The API returned an error ({0}): {1}', String(response.status), await getErrorMessage(response)) };
		}
		const json = parseJson(await response.text());
		const rawList: any[] = json !== null && Array.isArray(json.data)
			? json.data
			: (json !== null && Array.isArray(json.models) ? json.models : []);
		const seen = new Set<string>();
		const models: string[] = [];
		for (const item of rawList) {
			const id = typeof item === 'string'
				? item.trim()
				: (item !== null && typeof item === 'object'
					? (typeof item.id === 'string' ? item.id.trim() : (typeof item.name === 'string' ? item.name.trim() : ''))
					: '');
			if (id !== '' && !seen.has(id)) {
				seen.add(id);
				models.push(id);
			}
		}
		return { models: models, reachable: true, error: null };
	} catch (error) {
		return {
			models: [],
			reachable: false,
			error: t('Unable to call the API at {0}: {1}', getHost(config.baseUrl), error instanceof Error ? ((<any>error).cause instanceof Error ? error.message + ' (' + (<any>error).cause.message + ')' : error.message) : String(error))
		};
	} finally {
		clearTimeout(timer);
	}
}

function getAiProviderPresets(): ReadonlyArray<AiProviderPresetInfo> {
	return [
		{ id: AiProvider.VsCode, name: 'VS Code', defaultBaseUrl: '', defaultModel: '', requiresApiKey: false, defaultApiFormat: 'chat' },
		...ALL_DIRECT_PROVIDERS.map((id) => ({
			id: id,
			name: PRESETS[id].name,
			defaultBaseUrl: getDefaultBaseUrl(id),
			defaultModel: PRESETS[id].model,
			requiresApiKey: PRESETS[id].requiresApiKey,
			defaultApiFormat: PRESETS[id].apiFormat || 'chat'
		}))
	];
}

export function getAiSettingsSnapshot(explainCommit: boolean, commitMessage: boolean, provider: AiProvider, baseUrl: string, model: string): AiSettingsConfig {
	return {
		explainCommit: explainCommit,
		commitMessage: commitMessage,
		provider: provider,
		baseUrl: baseUrl,
		model: model,
		hasApiKey: provider !== AiProvider.VsCode && cachedProvidersWithKeys.has(provider),
		presets: getAiProviderPresets()
	};
}

export async function loadAiSettingsSnapshot(): Promise<AiSettingsConfig> {
	const config = getConfig(), provider = config.aiProvider;
	const hasKey = provider !== AiProvider.VsCode && (await getApiKey(provider)) !== null;
	return {
		explainCommit: config.explainCommit,
		commitMessage: config.aiCommitMessage,
		provider: provider,
		baseUrl: config.aiBaseUrl,
		model: config.aiModel,
		hasApiKey: hasKey,
		presets: getAiProviderPresets(),
		taskModels: config.aiTaskModels,
		customInstructions: config.aiCustomInstructions,
		excludeFiles: config.aiExcludeFiles,
		largePromptWarningThreshold: config.aiLargePromptWarningThreshold,
		autoRebaseConfidenceThreshold: config.aiAutoRebaseConfidenceThreshold
	};
}

export async function setApiKey(key?: unknown): Promise<boolean> {
	const config = getDirectAiConfig();
	if (config === null) {
		vscode.window.showInformationMessage(t('Choose a provider whose API Git Map calls directly in the "git-map.ai.provider" setting first (the models provided in Visual Studio Code don\'t need an API key).'));
		return false;
	}
	if (secretStorage === null) return false;
	const value = typeof key === 'string' ? key : await vscode.window.showInputBox({
		title: t('Git Map: Set AI API Key'),
		prompt: t('The API key of {0}. It\'s stored in the Secret Storage of Visual Studio Code, and only sent to {1}.', config.name, getHost(config.baseUrl) || config.name),
		password: true,
		ignoreFocusOut: true,
		validateInput: (input) => input.trim() === '' ? t('The API key can\'t be empty.') : null
	});
	if (typeof value !== 'string' || value.trim() === '') return false;
	await secretStorage.store(getSecretKey(config.provider), value.trim());
	cachedProvidersWithKeys.add(config.provider);
	if (typeof key !== 'string') vscode.window.showInformationMessage(t('The API key of {0} was stored.', config.name));
	return true;
}

export async function clearApiKey() {
	if (secretStorage === null) return;
	const config = getDirectAiConfig();
	if (config !== null && await getApiKey(config.provider) !== null) {
		await secretStorage.delete(getSecretKey(config.provider));
		cachedProvidersWithKeys.delete(config.provider);
		vscode.window.showInformationMessage(t('The API key of {0} was deleted.', config.name));
		return;
	}
	const stored: { provider: AiProvider, name: string }[] = [];
	for (const provider of ALL_DIRECT_PROVIDERS) {
		if (await getApiKey(provider) !== null) stored.push({ provider: provider, name: PRESETS[provider].name });
	}
	if (stored.length === 0) {
		vscode.window.showInformationMessage(t('No AI API keys are stored in Git Map.'));
		return;
	}
	if (stored.length === 1) {
		await secretStorage.delete(getSecretKey(stored[0].provider));
		cachedProvidersWithKeys.delete(stored[0].provider);
		vscode.window.showInformationMessage(t('The API key of {0} was deleted.', stored[0].name));
		return;
	}
	const items: (vscode.QuickPickItem & { providers: AiProvider[] })[] = stored.map((entry) => ({ label: entry.name, providers: [entry.provider] }));
	items.push({ label: t('All Stored AI API Keys'), providers: stored.map((entry) => entry.provider) });
	const picked = typeof vscode.window.showQuickPick === 'function'
		? await vscode.window.showQuickPick(items, { placeHolder: t('Select the AI API key to delete'), ignoreFocusOut: true })
		: undefined;
	if (typeof picked === 'undefined') return;
	for (const provider of picked.providers) {
		await secretStorage.delete(getSecretKey(provider));
		cachedProvidersWithKeys.delete(provider);
	}
	vscode.window.showInformationMessage(picked.providers.length === 1 ? t('The API key of {0} was deleted.', picked.label) : t('All stored AI API keys were deleted.'));
}

/* The request: Chat Completions, Responses or Anthropic Messages */

export async function getDirectAiProblem(config: DirectAiConfig): Promise<{ error: string, needsApiKey: boolean } | null> {
	if (config.baseUrl === '') return { error: t('Set the base URL of the API of {0} in the "git-map.ai.baseUrl" setting.', config.name), needsApiKey: false };
	if (!/^https?:\/\//i.test(config.baseUrl)) return { error: t('The base URL of the API must start with https:// or http:// (in the "git-map.ai.baseUrl" setting).'), needsApiKey: false };
	if (config.model === '') return { error: t('Set the model of {0} to use in the "git-map.ai.model" setting.', config.name), needsApiKey: false };
	if (config.request.configError !== null) return { error: config.request.configError, needsApiKey: false };
	if (config.requiresApiKey && await getApiKey(config.provider) === null) return { error: t('Set the API key of {0} with the "Git Map: Set AI API Key..." command.', config.name), needsApiKey: true };
	return null;
}

export function getAiRequestUrl(baseUrl: string, format: AiApiFormat, endpointPath: string) {
	const custom = endpointPath.trim();
	if (/^https?:\/\//i.test(custom)) return custom;
	const pathPart = custom !== '' ? custom : DEFAULT_ENDPOINT_PATHS[format];
	return baseUrl.replace(/\/+$/, '') + '/' + pathPart.replace(/^\/+/, '');
}

export function buildAiRequestBody(format: AiApiFormat, provider: string, model: string, prompt: string, options: AiRequestOptions): { [key: string]: any } {
	const body: { [key: string]: any } = { model: model };
	const thinkingOn = options.thinking === 'low' || options.thinking === 'medium' || options.thinking === 'high';
	if (format === 'responses') {
		body.input = prompt;
		body.store = false;
		if (options.temperature !== null) body.temperature = options.temperature;
		if (options.maxTokens !== null) body.max_output_tokens = options.maxTokens;
		if (options.thinking === 'off') body.reasoning = { effort: 'minimal' };
		else if (thinkingOn) body.reasoning = { effort: options.thinking };
	} else if (format === 'anthropic') {
		const budget = options.thinking === 'low' ? 1024 : options.thinking === 'medium' ? 4096 : 16000;
		const maxTokens = options.maxTokens !== null ? options.maxTokens : 4096;
		body.max_tokens = thinkingOn ? Math.max(maxTokens, budget + 2048) : maxTokens;
		body.messages = [{ role: 'user', content: prompt }];
		if (thinkingOn) body.thinking = { type: 'enabled', budget_tokens: budget };
		else if (options.thinking === 'off') body.thinking = { type: 'disabled' };
		if (options.temperature !== null && !thinkingOn) body.temperature = options.temperature;
	} else {
		body.messages = [{ role: 'user', content: prompt }];
		if (options.temperature !== null) body.temperature = options.temperature;
		if (options.maxTokens !== null) body.max_tokens = options.maxTokens;
		if (options.thinking !== 'default') {
			if (provider === AiProvider.Qwen) {
				body.enable_thinking = thinkingOn;
			} else if (provider === AiProvider.Doubao) {
				body.thinking = { type: thinkingOn ? 'enabled' : 'disabled' };
			} else if (provider === AiProvider.DeepSeek) {
				// DeepSeek switches thinking by model (deepseek-chat / deepseek-reasoner), not by a parameter
			} else if (thinkingOn) {
				body.reasoning_effort = options.thinking;
			}
		}
	}
	if (options.stream) body.stream = true;
	if (options.extraBody !== null) Object.assign(body, options.extraBody);
	return body;
}

function buildAiRequestHeaders(format: AiApiFormat, apiKey: string | null, options: AiRequestOptions) {
	const headers: { [name: string]: string } = { 'Content-Type': 'application/json', 'Accept': options.stream ? 'text/event-stream' : 'application/json' };
	if (format === 'anthropic') {
		headers['anthropic-version'] = '2023-06-01';
		if (apiKey !== null) headers['x-api-key'] = apiKey;
	} else if (apiKey !== null) {
		headers['Authorization'] = 'Bearer ' + apiKey;
	}
	if (options.extraHeaders !== null) Object.assign(headers, options.extraHeaders);
	return headers;
}

export function previewAiRequest(provider: string, baseUrl: string, model: string, options: AiRequestOptions) {
	const body = buildAiRequestBody(options.apiFormat, provider, model !== '' ? model : '<model>', '<prompt>', options);
	return { url: getAiRequestUrl(baseUrl !== '' ? baseUrl : 'https://…', options.apiFormat, options.endpointPath), body: body, fallback: getFallbackFormat(options) };
}

function getFallbackFormat(options: AiRequestOptions): AiApiFormat | null {
	if (!options.apiFormatIsDefault || options.endpointPath !== '') return null;
	return options.apiFormat === 'chat' ? 'responses' : options.apiFormat === 'responses' ? 'chat' : null;
}

interface AiAttemptResult {
	readonly error: string | null;
	readonly status: number | null;
}

export async function streamAiCompletion(config: DirectAiConfig, apiKey: string | null, prompt: string, onText: (text: string) => void, token: vscode.CancellationToken): Promise<{ error: string | null, format: AiApiFormat, url: string }> {
	const options = config.request;
	const first = options.apiFormat;
	const firstUrl = getAiRequestUrl(config.baseUrl, first, options.endpointPath);
	const result = await sendAiRequest(first, firstUrl, config, apiKey, prompt, onText, token);
	const fallback = getFallbackFormat(options);
	if (fallback !== null && (result.status === 404 || result.status === 405) && !token.isCancellationRequested) {
		const fallbackUrl = getAiRequestUrl(config.baseUrl, fallback, '');
		const second = await sendAiRequest(fallback, fallbackUrl, config, apiKey, prompt, onText, token);
		if (second.status === 404 || second.status === 405) {
			return { error: t('Neither {0} nor {1} was found at {2} (HTTP {3}). Check the API Base URL and the model, or choose the API Format in Settings → AI.', '/' + DEFAULT_ENDPOINT_PATHS[first], '/' + DEFAULT_ENDPOINT_PATHS[fallback], getHost(config.baseUrl), String(second.status)), format: fallback, url: fallbackUrl };
		}
		return { error: second.error, format: fallback, url: fallbackUrl };
	}
	return { error: result.error, format: first, url: firstUrl };
}

async function sendAiRequest(format: AiApiFormat, url: string, config: DirectAiConfig, apiKey: string | null, prompt: string, onText: (text: string) => void, token: vscode.CancellationToken): Promise<AiAttemptResult> {
	if (typeof fetch !== 'function') return { error: t('This version of Visual Studio Code can\'t call the API (it requires Visual Studio Code 1.82 or later).'), status: null };
	const options = config.request;
	const controller = new AbortController(), cancellation = token.onCancellationRequested(() => controller.abort());
	let timedOut = false, timer: NodeJS.Timeout | null = null;
	const resetTimeout = () => {
		if (timer !== null) clearTimeout(timer);
		timer = setTimeout(() => {
			timedOut = true;
			controller.abort();
		}, options.timeoutMs);
		unrefTimer(timer);
	};
	resetTimeout();
	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: buildAiRequestHeaders(format, apiKey, options),
			body: JSON.stringify(buildAiRequestBody(format, config.provider, config.model, prompt, options)),
			signal: controller.signal
		});
		resetTimeout();
		if (!response.ok || response.body === null) {
			return { error: t('The API returned an error ({0}) for {1}: {2}', String(response.status), 'POST ' + getPathOfUrl(url), await getErrorMessage(response)), status: response.status };
		}
		const contentType = (response.headers.get('content-type') || '').toLowerCase();
		if (!contentType.includes('text/event-stream')) {
			const text = await response.text();
			const json = parseJson(text);
			if (json === null) {
				if (/^\s*(data|event):/m.test(text)) return { error: parseEventStreamText(format, text, onText, token), status: null };
				return { error: t('The API returned a response that isn\'t JSON: {0}', text.trim().substring(0, 300)), status: null };
			}
			const error = getJsonError(json);
			if (error !== null) return { error: t('The API returned an error: {0}', error), status: null };
			const messageContent = getTextOfJsonResponse(format, json);
			if (messageContent === '') return { error: t('The model returned an empty response.'), status: null };
			onText(messageContent);
			return { error: null, status: null };
		}

		const decoder = new TextDecoder();
		const reader = response.body.getReader();
		const parser = new EventStreamParser(format, onText);
		while (!parser.done) {
			const chunk = await reader.read();
			resetTimeout();
			if (chunk.done) {
				parser.push(decoder.decode(), true);
				break;
			}
			parser.push(decoder.decode(chunk.value, { stream: true }), false);
			if (parser.error !== null) break;
		}
		await reader.cancel().catch(() => { });
		if (parser.error !== null) return { error: parser.error, status: null };
		if (!parser.receivedText && !token.isCancellationRequested) return { error: t('The model returned an empty response.'), status: null };
		return { error: null, status: null };
	} catch (error) {
		if (token.isCancellationRequested) return { error: null, status: null };
		if (timedOut) return { error: t('The API at {0} timed out without responding.', getHost(url)), status: null };
		return { error: t('Unable to call the API at {0}: {1}', getHost(url), error instanceof Error ? ((<any>error).cause instanceof Error ? error.message + ' (' + (<any>error).cause.message + ')' : error.message) : String(error)), status: null };
	} finally {
		if (timer !== null) clearTimeout(timer);
		cancellation.dispose();
	}
}

function parseEventStreamText(format: AiApiFormat, text: string, onText: (text: string) => void, token: vscode.CancellationToken) {
	const parser = new EventStreamParser(format, onText);
	parser.push(text, true);
	if (parser.error !== null) return parser.error;
	return !parser.receivedText && !token.isCancellationRequested ? t('The model returned an empty response.') : null;
}

export class EventStreamParser {
	private buffer = '';
	public done = false;
	public error: string | null = null;
	public receivedText = false;

	constructor(private readonly format: AiApiFormat, private readonly onText: (text: string) => void) { }

	public push(text: string, end: boolean) {
		this.buffer += text;
		let newline: number;
		while (!this.done && this.error === null && (newline = this.buffer.indexOf('\n')) > -1) {
			const line = this.buffer.substring(0, newline);
			this.buffer = this.buffer.substring(newline + 1);
			this.processLine(line);
		}
		if (end && !this.done && this.error === null && this.buffer.trim() !== '') {
			this.processLine(this.buffer);
			this.buffer = '';
		}
	}

	private processLine(rawLine: string) {
		const line = rawLine.trim();
		if (!line.startsWith('data:')) return;
		const data = line.substring(5).trim();
		if (data === '[DONE]') {
			this.done = true;
			return;
		}
		const event = parseJson(data);
		if (event === null || typeof event !== 'object') return;
		const error = getJsonError(event);
		if (error !== null) {
			this.error = t('The API returned an error: {0}', error);
			return;
		}
		let text = '';
		const type = typeof event.type === 'string' ? event.type : '';
		if (type === 'response.output_text.delta' && typeof event.delta === 'string') {
			text = event.delta;
		} else if (type === 'content_block_delta' && event.delta && event.delta.type === 'text_delta' && typeof event.delta.text === 'string') {
			text = event.delta.text;
		} else if (type === 'response.completed' || type === 'response.done' || type === 'message_stop') {
			if (!this.receivedText && type !== 'message_stop' && event.response) text = getTextOfJsonResponse('responses', event.response);
			this.done = true;
		} else if (Array.isArray(event.choices)) {
			const choice = event.choices[0];
			text = choice && choice.delta && typeof choice.delta.content === 'string'
				? choice.delta.content
				: (choice && choice.message && typeof choice.message.content === 'string' ? choice.message.content : '');
		}
		if (text !== '') {
			this.receivedText = true;
			this.onText(text);
		}
	}
}

function getJsonError(json: any): string | null {
	if (json === null || typeof json !== 'object') return null;
	if (typeof json.error === 'object' && json.error !== null) return String(json.error.message || JSON.stringify(json.error));
	if (typeof json.error === 'string' && json.error !== '') return json.error;
	if (json.type === 'error' && typeof json.message === 'string') return json.message;
	if ((json.type === 'response.failed' || json.type === 'response.incomplete') && json.response) {
		const responseError = json.response.error;
		if (responseError && typeof responseError.message === 'string') return responseError.message;
		if (json.response.incomplete_details && typeof json.response.incomplete_details.reason === 'string') return json.response.incomplete_details.reason;
		return json.type;
	}
	return null;
}

function getTextOfJsonResponse(format: AiApiFormat, json: any): string {
	if (json === null || typeof json !== 'object') return '';
	if (Array.isArray(json.choices)) {
		const choice = json.choices[0];
		return choice && choice.message && typeof choice.message.content === 'string' ? choice.message.content : '';
	}
	if (typeof json.output_text === 'string') return json.output_text;
	if (Array.isArray(json.output)) {
		return json.output.filter((item: any) => item && item.type === 'message' && Array.isArray(item.content))
			.map((item: any) => item.content.filter((part: any) => part && part.type === 'output_text' && typeof part.text === 'string').map((part: any) => part.text).join(''))
			.join('');
	}
	if (Array.isArray(json.content)) {
		return json.content.filter((part: any) => part && part.type === 'text' && typeof part.text === 'string').map((part: any) => part.text).join('');
	}
	return '';
}

function getPathOfUrl(url: string) {
	try {
		return new URL(url).pathname;
	} catch (_) {
		return url;
	}
}

export async function completeAiPrompt(prompt: string, task?: AiTaskKey): Promise<{ text: string; error: string | null }> {
	const config = getDirectAiConfigForTask(task).direct || getDirectAiConfig();
	if (config === null) {
		return { text: '', error: t('Choose a provider whose API Git Map calls directly first.') };
	}
	let effectiveConfig = config;
	if (effectiveConfig.model === '' && isAutoModelDiscoveryProvider(effectiveConfig.provider)) {
		const discovered = await fetchProviderModels(effectiveConfig);
		if (discovered.models.length > 0) {
			effectiveConfig = Object.assign({}, effectiveConfig, { model: discovered.models[0] });
		} else if (effectiveConfig.provider === AiProvider.CCSwitch && discovered.reachable && discovered.error === null) {
			effectiveConfig = Object.assign({}, effectiveConfig, { model: 'default' });
		}
	}
	const problem = await getDirectAiProblem(effectiveConfig);
	if (problem !== null) {
		return { text: '', error: problem.error };
	}
	const source = new vscode.CancellationTokenSource();
	let text = '';
	try {
		const apiKey = effectiveConfig.request.apiFormat === 'anthropic'
			? await getApiKey(effectiveConfig.provider)
			: await getEffectiveApiKey(effectiveConfig.provider);
		const result = await streamAiCompletion(effectiveConfig, apiKey, prompt, (part) => {
			text += part;
		}, source.token);
		return { text: text.trim(), error: result.error };
	} finally {
		source.dispose();
	}
}

export async function testAiConnection(): Promise<{ ok: boolean, text: string, error: string | null, format: AiApiFormat | null, url: string | null, ms: number, fellBack: boolean }> {
	let config = getDirectAiConfig();
	if (config === null) return { ok: false, text: '', error: t('Choose a provider whose API Git Map calls directly first.'), format: null, url: null, ms: 0, fellBack: false };
	if (config.model === '' && isAutoModelDiscoveryProvider(config.provider)) {
		const discovered = await fetchProviderModels(config);
		if (discovered.models.length > 0) {
			config = Object.assign({}, config, { model: discovered.models[0] });
		} else if (config.provider === AiProvider.CCSwitch && discovered.reachable && discovered.error === null) {
			config = Object.assign({}, config, { model: 'default' });
		}
	}
	const problem = await getDirectAiProblem(config);
	if (problem !== null) return { ok: false, text: '', error: problem.error, format: null, url: null, ms: 0, fellBack: false };
	const source = new vscode.CancellationTokenSource();
	const started = Date.now();
	let text = '';
	try {
		const apiKey = config.request.apiFormat === 'anthropic'
			? await getApiKey(config.provider)
			: await getEffectiveApiKey(config.provider);
		const result = await streamAiCompletion(config, apiKey, 'Reply with exactly one word: OK', (part) => {
			text += part;
		}, source.token);
		return { ok: result.error === null, text: text.trim().substring(0, 200), error: result.error, format: result.format, url: result.url, ms: Date.now() - started, fellBack: result.format !== config.request.apiFormat };
	} finally {
		source.dispose();
	}
}

async function getErrorMessage(response: Response) {
	const text = await response.text().catch(() => '');
	const json = parseJson(text);
	if (json !== null && typeof json.error === 'object' && json.error !== null && typeof json.error.message === 'string') return json.error.message;
	if (json !== null && typeof json.message === 'string') return json.message;
	return text.trim() !== '' ? text.trim().substring(0, 500) : response.statusText;
}

function parseJson(text: string): any {
	try {
		return JSON.parse(text);
	} catch (_) {
		return null;
	}
}
