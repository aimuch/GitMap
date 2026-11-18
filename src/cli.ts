#!/usr/bin/env node
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { GitMapServer } from './server/appServer';

function readPackageVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '1.0.0';
  } catch (_) {
    return '1.0.0';
  }
}

process.on('uncaughtException', (err) => {
  console.error('[GitMap] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[GitMap] Unhandled rejection:', reason);
});

async function main() {
  const args = process.argv.slice(2);
  let port = Number(process.env.GITMAP_PORT) || 3847;
  let host = process.env.GITMAP_HOST || '127.0.0.1';
  let authToken: string | undefined = process.env.GITMAP_AUTH_TOKEN || undefined;
  let requireAuth = true;
  let openBrowser = false;
  let jsonOutput = false;
  const initialRepos: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--web') {
      continue;
    } else if (arg === '--json') {
      jsonOutput = true;
    } else if (arg === '--version' || arg === '-v') {
      const version = readPackageVersion();
      if (args.includes('--json')) {
        console.log(JSON.stringify({ name: 'gitmap', version, node: process.version, platform: process.platform }));
      } else {
        console.log(`GitMap v${version}`);
      }
      process.exit(0);
    } else if (arg === '--port' || arg === '-p') {
      port = Number(args[++i]) || 3847;
    } else if (arg.startsWith('--port=')) {
      port = Number(arg.split('=')[1]) || 3847;
    } else if (arg === '--host' || arg === '-H') {
      host = args[++i] || '127.0.0.1';
    } else if (arg.startsWith('--host=')) {
      host = arg.split('=')[1] || '127.0.0.1';
    } else if (arg === '--auth-token') {
      authToken = args[++i] || undefined;
    } else if (arg.startsWith('--auth-token=')) {
      authToken = arg.substring('--auth-token='.length) || undefined;
    } else if (arg === '--no-auth') {
      requireAuth = false;
    } else if (arg === '--open' || arg === '-o') {
      openBrowser = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`GitMap Standalone Server & CLI (v${readPackageVersion()})
Usage:
  gitmap [--web] [--port 3847] [--host 127.0.0.1] [--auth-token <secret>] [--open] [--json] [--version] [repo-path-or-ssh-uri...]

Examples:
  npm run web
  gitmap --version
  gitmap --web --port 4000 --open /path/to/repo
  gitmap --web --host 0.0.0.0 --auth-token my-secret-token
  gitmap --web --json /path/to/repo
  gitmap --web ssh://my-server/home/ubuntu/project
`);
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      initialRepos.push(arg);
    }
  }

  const server = new GitMapServer({ port, host, requireAuth, authToken, initialRepos });
  await server.start();
  const launchUrl = server.getAuthUrl();
  if (jsonOutput) {
    console.log(
      JSON.stringify({
        ok: true,
        version: readPackageVersion(),
        url: server.getUrl(),
        authUrl: launchUrl,
        diagnosticsUrl: `${server.getUrl()}/api/diagnostics`,
        pid: process.pid
      })
    );
  } else {
    console.log(`\n  GitMap Web Server running at: ${launchUrl}\n  Press Ctrl+C to stop.\n`);
  }

  if (openBrowser) {
    if (process.platform === 'win32') {
      cp.spawn('cmd.exe', ['/d', '/c', 'start', '""', '"%GITMAP_OPEN_URL%"'], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, GITMAP_OPEN_URL: launchUrl }
      }).unref();
    } else {
      const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
      cp.spawn(opener, [launchUrl], { detached: true, stdio: 'ignore' }).unref();
    }
  }

  const shutdown = async () => {
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start GitMap Server:', err);
  process.exit(1);
});
