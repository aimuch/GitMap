import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface SshConfigHostEntry {
  alias: string;
  hostName: string;
  user?: string;
  port: number;
  identityFiles: string[];
  proxyJump?: string;
  forwardAgent?: boolean;
  sourceFile: string;
}

interface RawHostBlock {
  patterns: string[];
  options: { [key: string]: string[] };
  sourceFile: string;
}

function expandTilde(filePath: string): string {
  if (filePath === '~') return os.homedir();
  if (filePath.startsWith('~/') || filePath.startsWith('~\\')) {
    return path.join(os.homedir(), filePath.substring(2));
  }
  return filePath;
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp('^' + escaped + '$', 'i');
}

function matchesHostPattern(alias: string, patterns: string[]): boolean {
  let matchedPositive = false;
  for (const rawPat of patterns) {
    const negated = rawPat.startsWith('!');
    const pat = negated ? rawPat.substring(1) : rawPat;
    if (!pat) continue;
    const hit = globToRegExp(pat).test(alias);
    if (negated && hit) return false;
    if (!negated && hit) matchedPositive = true;
  }
  return matchedPositive;
}

function expandIncludeGlob(includePattern: string, baseDir: string): string[] {
  const expanded = expandTilde(includePattern);
  const fullPattern = path.isAbsolute(expanded) ? expanded : path.join(baseDir, expanded);
  const dir = path.dirname(fullPattern);
  const fileBase = path.basename(fullPattern);
  if (!fs.existsSync(dir)) return [];
  if (!fileBase.includes('*') && !fileBase.includes('?')) {
    return fs.existsSync(fullPattern) ? [fullPattern] : [];
  }
  const regex = globToRegExp(fileBase);
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => !name.startsWith('.') && regex.test(name))
      .sort()
      .map((name) => path.join(dir, name));
  } catch (_) {
    return [];
  }
}

function tokenizeLine(line: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '#' && !inQuotes) {
      break;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if ((ch === ' ' || ch === '\t' || ch === '=') && !inQuotes) {
      if (ch === '=' && tokens.length === 1 && current === '') {
        continue;
      }
      if (current !== '') {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current !== '') tokens.push(current);
  return tokens;
}

function parseConfigFileRecursive(filePath: string, visited: Set<string>, blocks: RawHostBlock[]): void {
  let real: string;
  try {
    real = fs.realpathSync(filePath);
  } catch (_) {
    return;
  }
  if (visited.has(real)) return;
  visited.add(real);

  let content: string;
  try {
    content = fs.readFileSync(real, 'utf8');
  } catch (_) {
    return;
  }

  const baseDir = path.dirname(real);
  let currentBlock: RawHostBlock = {
    patterns: ['*'],
    options: {},
    sourceFile: real
  };
  blocks.push(currentBlock);

  for (const rawLine of content.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const tokens = tokenizeLine(trimmed);
    if (tokens.length < 2) continue;
    const key = tokens[0].toLowerCase();
    const values = tokens.slice(1);

    if (key === 'include') {
      for (const incPat of values) {
        for (const incFile of expandIncludeGlob(incPat, baseDir)) {
          parseConfigFileRecursive(incFile, visited, blocks);
        }
      }
      continue;
    }

    if (key === 'host') {
      currentBlock = {
        patterns: values,
        options: {},
        sourceFile: real
      };
      blocks.push(currentBlock);
      continue;
    }

    if (key === 'match') {
      // Skip complex Match blocks cleanly
      currentBlock = {
        patterns: [],
        options: {},
        sourceFile: real
      };
      continue;
    }

    if (!currentBlock.options[key]) {
      currentBlock.options[key] = [];
    }
    currentBlock.options[key].push(values.join(' '));
  }
}

function expandSshTokens(value: string, hostName: string, port: number, user: string): string {
  return expandTilde(
    value
      .replace(/%%/g, '\0')
      .replace(/%h/g, hostName)
      .replace(/%p/g, String(port))
      .replace(/%r/g, user)
      .replace(/\0/g, '%')
  );
}

/**
 * Parse the user's ~/.ssh/config (including Include files) and return all concrete Host entries.
 */
export function parseUserSshConfig(customConfigPath?: string): SshConfigHostEntry[] {
  const sshConfigPath = customConfigPath || path.join(os.homedir(), '.ssh', 'config');
  if (!fs.existsSync(sshConfigPath)) return [];

  const blocks: RawHostBlock[] = [];
  parseConfigFileRecursive(sshConfigPath, new Set<string>(), blocks);

  const concreteAliases = new Map<string, string>();
  for (const block of blocks) {
    for (const pat of block.patterns) {
      if (!pat.includes('*') && !pat.includes('?') && !pat.startsWith('!')) {
        if (!concreteAliases.has(pat)) {
          concreteAliases.set(pat, block.sourceFile);
        }
      }
    }
  }

  const results: SshConfigHostEntry[] = [];
  const defaultSystemUser = os.userInfo().username;

  for (const [alias, sourceFile] of concreteAliases.entries()) {
    const merged: { [key: string]: string[] } = {};
    for (const block of blocks) {
      if (block.patterns.length === 0) continue;
      if (!matchesHostPattern(alias, block.patterns)) continue;
      for (const [k, vals] of Object.entries(block.options)) {
        if (k === 'identityfile') {
          merged[k] = (merged[k] || []).concat(vals);
        } else if (!merged[k]) {
          // OpenSSH: first obtained value for each parameter is used
          merged[k] = vals;
        }
      }
    }

    const rawHostName = merged['hostname']?.[0] || alias;
    const port = parseInt(merged['port']?.[0] || '22', 10) || 22;
    const user = merged['user']?.[0] || undefined;
    const effectiveUser = user || defaultSystemUser;
    const hostName = expandSshTokens(rawHostName, alias, port, effectiveUser);

    const identityFiles = (merged['identityfile'] || [])
      .map((f) => expandSshTokens(f, hostName, port, effectiveUser))
      .filter((f) => fs.existsSync(f));

    const proxyJump = merged['proxyjump']?.[0] && merged['proxyjump'][0].toLowerCase() !== 'none'
      ? merged['proxyjump'][0]
      : undefined;
    const forwardAgent = merged['forwardagent']?.[0]?.toLowerCase() === 'yes';

    results.push({
      alias,
      hostName,
      user,
      port,
      identityFiles,
      proxyJump,
      forwardAgent,
      sourceFile
    });
  }

  return results;
}
