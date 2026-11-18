/*---------------------------------------------------------------------------------------------
 *  This code is based on the askpass implementation in the Microsoft Visual Studio Code Git Extension
 *  https://github.com/microsoft/vscode/blob/473af338e1bd9ad4d9853933da1cd9d5d9e07dc9/extensions/git/src/askpass-main.ts,
 *  which has the following copyright notice & license:
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See ./licenses/LICENSE_MICROSOFT for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as http from 'http';

function fatal(err: unknown): void {
	console.error('Missing or invalid credentials.');
	console.error(err);
	process.exit(1);
}

function parsePromptArgs(args: string[]): { request: string; host: string } {
	const raw = args.join(' ').trim();
	if (!raw) {
		return { request: 'Password', host: 'Git repository' };
	}
	const keyMatch = raw.match(/^(Enter passphrase for key)\s+'([^']+)'\s*:?$/i);
	if (keyMatch) {
		return { request: keyMatch[1], host: keyMatch[2] };
	}
	const forMatch = raw.match(/^(.+?)\s+for\s+'([^']+)'\s*:?$/i);
	if (forMatch) {
		return { request: forMatch[1].trim(), host: forMatch[2].trim() };
	}
	return { request: raw.replace(/:\s*$/, ''), host: 'Git authentication' };
}

function main(argv: string[]): void {
	const socketPath = process.env['VSCODE_GIT_GRAPH_ASKPASS_HANDLE'];
	if (!socketPath) return fatal('Missing handle');

	const outputPipe = process.env['VSCODE_GIT_GRAPH_ASKPASS_PIPE'];
	const parsed = parsePromptArgs(argv.slice(2));

	const req = http.request({ socketPath, path: '/', method: 'POST' }, (res) => {
		if (res.statusCode !== 200) return fatal('Bad status code: ' + res.statusCode);

		let resData = '';
		res.setEncoding('utf8');
		res.on('data', (d) => (resData += d));
		res.on('end', () => {
			try {
				const response = String(JSON.parse(resData) ?? '');
				if (outputPipe) {
					fs.writeFileSync(outputPipe, response + '\n', { mode: 0o600 });
				} else {
					process.stdout.write(response + '\n');
				}
			} catch (_) {
				return fatal('Error parsing response');
			}
			setTimeout(() => process.exit(0), 0);
		});
	});

	req.on('error', () => fatal('Error in request'));
	req.write(JSON.stringify(parsed));
	req.end();
}

main(process.argv);
