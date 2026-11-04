// Every built HTML page in dist/ as { rel: "/guides/x/", file, html }, for the checks.

import fs from 'node:fs';
import path from 'node:path';

export function htmlPages(dist) {
  if (!fs.existsSync(dist)) {
    console.error('dist/ not found: run npm run build first.');
    process.exit(1);
  }
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory() && e.name !== 'assets') walk(p);
      else if (e.name.endsWith('.html')) {
        const rel = `/${path.relative(dist, p).replace(/\\/g, '/').replace(/index\.html$/, '')}`;
        out.push({ rel, file: p, html: fs.readFileSync(p, 'utf8') });
      }
    }
  };
  walk(dist);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}
