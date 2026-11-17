import assert from 'node:assert/strict';
import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import * as vscode from 'vscode';
import { AiProvider, DirectAiConfig, EventStreamParser, buildAiRequestBody, getAiRequestUrl, parseAiRequestSettings, streamAiCompletion } from '../aiProviders';

function config(provider: AiProvider, baseUrl: string, settings: object): DirectAiConfig {
	return { provider, name: provider, baseUrl, model: 'm', requiresApiKey: false, request: parseAiRequestSettings(provider, settings) };
}

function parse(format: 'chat' | 'responses' | 'anthropic', stream: string) {
	let text = '';
	const parser = new EventStreamParser(format, (part) => { text += part; });
	parser.push(stream, true);
	return { text, error: parser.error, done: parser.done };
}

describe('AI request options', () => {
	it('uses each provider\'s default format and falls back only for defaults', () => {
		assert.equal(parseAiRequestSettings(AiProvider.DeepSeek, {}).apiFormat, 'chat');
		assert.equal(parseAiRequestSettings(AiProvider.CCSwitch, {}).apiFormat, 'responses');
		const chosen = parseAiRequestSettings(AiProvider.CCSwitch, { apiFormat: 'anthropic' });
		assert.equal(chosen.apiFormat, 'anthropic');
		assert.equal(chosen.apiFormatIsDefault, false);
	});

	it('ignores empty or out-of-range numbers and reports invalid JSON', () => {
		const options = parseAiRequestSettings(AiProvider.OpenAI, { temperature: '', maxTokens: '-3', timeoutSeconds: '30', extraBody: '{nope' });
		assert.equal(options.temperature, null);
		assert.equal(options.maxTokens, null);
		assert.equal(options.timeoutMs, 30000);
		assert.ok(options.configError !== null);
	});

	it('builds the URL from the base URL, a custom path, or a full URL', () => {
		assert.equal(getAiRequestUrl('http://h/v1/', 'chat', ''), 'http://h/v1/chat/completions');
		assert.equal(getAiRequestUrl('http://h/v1', 'responses', ''), 'http://h/v1/responses');
		assert.equal(getAiRequestUrl('http://h/v1', 'chat', '/custom/chat'), 'http://h/v1/custom/chat');
		assert.equal(getAiRequestUrl('http://h/v1', 'chat', 'https://other/x'), 'https://other/x');
	});

	it('maps thinking, temperature & max tokens to each format', () => {
		const opts = (s: object) => parseAiRequestSettings(AiProvider.OpenAI, s);
		assert.deepEqual(buildAiRequestBody('chat', AiProvider.OpenAI, 'm', 'p', opts({ temperature: 0.2, maxTokens: 100, thinking: 'low', stream: false })),
			{ model: 'm', messages: [{ role: 'user', content: 'p' }], temperature: 0.2, max_tokens: 100, reasoning_effort: 'low' });
		assert.equal(buildAiRequestBody('chat', AiProvider.Qwen, 'm', 'p', opts({ thinking: 'off' })).enable_thinking, false);
		assert.deepEqual(buildAiRequestBody('chat', AiProvider.Doubao, 'm', 'p', opts({ thinking: 'off' })).thinking, { type: 'disabled' });
		const responses = buildAiRequestBody('responses', AiProvider.OpenAI, 'm', 'p', opts({ maxTokens: 50, thinking: 'high' }));
		assert.equal(responses.input, 'p');
		assert.equal(responses.max_output_tokens, 50);
		assert.deepEqual(responses.reasoning, { effort: 'high' });
		assert.equal(responses.stream, true);
		const anthropic = buildAiRequestBody('anthropic', AiProvider.OpenAI, 'm', 'p', opts({ temperature: 0.5, thinking: 'medium' }));
		assert.deepEqual(anthropic.thinking, { type: 'enabled', budget_tokens: 4096 });
		assert.ok(anthropic.max_tokens > 4096);
		assert.equal(anthropic.temperature, undefined);
		assert.equal(buildAiRequestBody('chat', AiProvider.OpenAI, 'm', 'p', opts({ extraBody: '{"temperature": 1, "top_p": 0.9}', temperature: 0.2 })).top_p, 0.9);
	});
});

describe('AI streaming formats', () => {
	it('parses Chat Completions events', () => {
		const r = parse('chat', 'data: {"choices":[{"delta":{"content":"He"}}]}\n\ndata: {"choices":[{"delta":{"content":"llo"}}]}\n\ndata: [DONE]\n');
		assert.equal(r.text, 'Hello');
		assert.equal(r.done, true);
	});

	it('parses Responses events', () => {
		const r = parse('responses', 'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"O"}\n\nevent: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"K"}\n\ndata: {"type":"response.completed","response":{}}\n');
		assert.equal(r.text, 'OK');
		assert.equal(r.done, true);
		assert.match(parse('responses', 'data: {"type":"response.failed","response":{"error":{"message":"bad model"}}}\n').error || '', /bad model/);
	});

	it('parses Anthropic Messages events', () => {
		const r = parse('anthropic', 'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"hmm"}}\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\ndata: {"type":"message_stop"}\n');
		assert.equal(r.text, 'Hi');
		assert.equal(r.done, true);
	});
});

describe('AI format fallback', () => {
	let server: http.Server;
	let baseUrl = '';
	const hits: string[] = [];

	before(async () => {
		server = http.createServer((req, res) => {
			hits.push(req.url || '');
			if (req.url === '/v1/responses') {
				res.writeHead(200, { 'Content-Type': 'text/event-stream' });
				res.end('data: {"type":"response.output_text.delta","delta":"OK"}\n\ndata: {"type":"response.completed","response":{}}\n\n');
			} else {
				res.writeHead(404, { 'Content-Type': 'application/json' });
				res.end('{"error":{"message":"not found"}}');
			}
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		baseUrl = 'http://127.0.0.1:' + (<AddressInfo>server.address()).port + '/v1';
	});
	after(() => new Promise<void>((resolve) => server.close(() => resolve())));

	it('tries /responses when the default /chat/completions is 404', async () => {
		hits.length = 0;
		let text = '';
		const result = await streamAiCompletion(config(AiProvider.OpenAICompatible, baseUrl, {}), null, 'hi', (part) => { text += part; }, new vscode.CancellationTokenSource().token);
		assert.equal(result.error, null);
		assert.equal(result.format, 'responses');
		assert.equal(text, 'OK');
		assert.deepEqual(hits, ['/v1/chat/completions', '/v1/responses']);
	});

	it('doesn\'t fall back when the format was chosen explicitly', async () => {
		hits.length = 0;
		const result = await streamAiCompletion(config(AiProvider.OpenAICompatible, baseUrl, { apiFormat: 'chat' }), null, 'hi', () => { }, new vscode.CancellationTokenSource().token);
		assert.match(result.error || '', /404/);
		assert.match(result.error || '', /\/v1\/chat\/completions/);
		assert.deepEqual(hits, ['/v1/chat/completions']);
	});
});
