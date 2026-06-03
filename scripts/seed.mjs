import { readdir, readFile, writeFile } from 'fs/promises';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const seedDir = join(root, 'seed');
const outFile = join(root, 'seed.sql');

const files = (await readdir(seedDir))
  .filter(f => f.endsWith('.md'))
  .sort();

if (!files.length) {
  console.error('No .md files found in seed/');
  process.exit(1);
}

const esc = s => s.replace(/'/g, "''");

const rows = [];

for (const file of files) {
  const slug = basename(file, '.md');
  const raw = await readFile(join(seedDir, file), 'utf-8');
  const content = raw.replace(/\r\n/g, '\n');

  const lines = content.split('\n');
  const h1Index = lines.findIndex(l => /^#\s/.test(l));

  const title = h1Index >= 0
    ? lines[h1Index].replace(/^#\s+/, '').trim()
    : slug;

  const body_md = (h1Index >= 0 ? lines.slice(h1Index + 1) : lines)
    .join('\n')
    .trim();

  rows.push(
    `INSERT OR REPLACE INTO stories (slug, title, body_md, status) VALUES ('${esc(slug)}', '${esc(title)}', '${esc(body_md)}', 'published');`
  );

  const words = body_md.split(/\s+/).filter(Boolean).length;
  console.log(`  ${slug}: "${title}" (${words} words)`);
}

await writeFile(outFile, rows.join('\n') + '\n', 'utf-8');
console.log(`\nWrote ${rows.length} row(s) → seed.sql`);
