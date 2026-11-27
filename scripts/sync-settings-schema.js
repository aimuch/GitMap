// Generate resources/settings-schema.json from the Extension Settings declared by vscode-git-map's package.json,
// so the standalone app knows every setting's default (like VS Code does) and the Settings panel can show them.
//   node scripts/sync-settings-schema.js [path/to/vscode-git-map]
const fs = require('fs');
const path = require('path');

const upstream = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'vscode-git-map'));
const pkg = JSON.parse(fs.readFileSync(path.join(upstream, 'package.json'), 'utf8'));
const sections = Array.isArray(pkg.contributes.configuration) ? pkg.contributes.configuration : [pkg.contributes.configuration];
const properties = {};
for (const section of sections) {
  for (const [key, def] of Object.entries(section.properties || {})) {
    const entry = {};
    if (Object.prototype.hasOwnProperty.call(def, 'default')) entry.default = def.default;
    if (def.type) entry.type = def.type;
    if (Array.isArray(def.enum)) entry.enum = def.enum;
    properties[key] = entry;
  }
}
const out = path.join(__dirname, '..', 'resources', 'settings-schema.json');
fs.writeFileSync(out, JSON.stringify({ source: 'vscode-git-map ' + pkg.version, properties }, null, 1) + '\n');
console.log('Wrote ' + Object.keys(properties).length + ' settings from vscode-git-map ' + pkg.version + ' to ' + path.relative(process.cwd(), out));
