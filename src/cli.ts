#!/usr/bin/env node
import * as cp from 'child_process';
import { GitMapServer } from './server/appServer';

async function main() {
  const args = process.argv.slice(2);
  let port = Number(process.env.GITMAP_PORT) || 3847;
  let host = process.env.GITMAP_HOST || '127.0.0.1';
  let openBrowser = false;
  const initialRepos: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--web') {
      continue;
    } else if (arg === '--port' || arg === '-p') {
      port = Number(args[++i]) || 3847;
    } else if (arg.startsWith('--port=')) {
      port = Number(arg.split('=')[1]) || 3847;
    } else if (arg === '--host' || arg === '-H') {
      host = args[++i] || '127.0.0.1';
    } else if (arg.startsWith('--host=')) {
      host = arg.split('=')[1] || '127.0.0.1';
    } else if (arg === '--open' || arg === '-o') {
      openBrowser = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`GitMap Standalone Server & CLI
Usage:
  gitmap [--web] [--port 3847] [--host 127.0.0.1] [--open] [repo-path-or-ssh-uri...]

Examples:
  npm run web
  gitmap --web --port 4000 --open /path/to/repo
  gitmap --web ssh://my-server/home/ubuntu/project
`);
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      initialRepos.push(arg);
    }
  }

  const server = new GitMapServer({ port, host, initialRepos });
  const url = await server.start();
  console.log(`\n  GitMap Web Server running at: ${url}\n  Press Ctrl+C to stop.\n`);

  if (openBrowser) {
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    cp.spawn(opener, [url], { detached: true, stdio: 'ignore' }).unref();
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
