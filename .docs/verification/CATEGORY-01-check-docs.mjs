import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const files = ['README.md', 'AGENTS.md'];
const reportPath = process.argv[2] ?? '.docs/verification/CATEGORY-01-docs.json';
if (!fs.existsSync(reportPath)) fs.writeFileSync(reportPath, '{}\n');
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith('.md')) files.push(file);
  }
}
walk('.docs'); walk('.agents/skills');
const broken = [], historicalRootReferences = [];
let localLinks = 0, anchors = 0;
const slug = text => text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[*`_]/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
for (const file of files) {
  for (const match of fs.readFileSync(file, 'utf8').matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const href = match[1].replace(/^<|>$/g, '');
    if (/^(https?:|mailto:|plugin:|app:|codex:)/i.test(href)) continue;
    const [pathname, hash] = href.split('#');
    let target = pathname ? path.resolve(path.dirname(file), decodeURIComponent(pathname)) : path.resolve(file);
    localLinks++;
    if (!fs.existsSync(target) && file.includes('conversations') && pathname.startsWith('.docs/') && fs.existsSync(path.resolve(pathname))) {
      historicalRootReferences.push({ file, href, reason: 'Original user transcript uses repository-root context; preserve the original text.' });
      target = path.resolve(pathname);
    }
    if (!fs.existsSync(target)) { broken.push({ file, href, reason: 'missing path' }); continue; }
    if (hash && target.endsWith('.md')) {
      anchors++;
      const headings = [...fs.readFileSync(target, 'utf8').matchAll(/^#{1,6}\s+(.+)$/gm)].map(m => slug(m[1].trim()));
      if (!headings.includes(decodeURIComponent(hash))) broken.push({ file, href, reason: 'missing heading' });
    }
  }
}
const protectedPaths = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.docs/과제_파일업로드_AI개발.md', 'migrations/0001_initial.sql', 'migrations/0002_budget.sql'];
const protectedUnchanged = Object.fromEntries(protectedPaths.map(file => [file, !execFileSync('git', ['diff', '--', file], { encoding: 'utf8' }).trim()]));
const result = {
  checkedAt: new Date().toISOString(), documents: files.length, localLinks, anchors, broken, historicalRootReferences, protectedUnchanged,
  result: broken.length || Object.values(protectedUnchanged).some(value => !value) ? 'failed' : 'passed',
};
fs.writeFileSync(reportPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (result.result !== 'passed') process.exitCode = 1;
