// Builds data/generators.json, data/generators.csv and README.md from the live SkipTheCAD dataset.
// Usage: node scripts/build.mjs [url-or-file]   (default: https://skipthecad.com/generators.json)
// No dependencies. Exits non-zero, writing nothing, when the dataset looks wrong.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const SOURCE = process.argv[2] ?? 'https://skipthecad.com/generators.json';

async function load(source) {
  if (!/^https?:\/\//.test(source)) return JSON.parse(await readFile(source, 'utf8'));
  const res = await fetch(source, { headers: { 'User-Agent': '3d-print-generators-dataset sync' } });
  if (!res.ok) throw new Error(`${source}: HTTP ${res.status}`);
  return res.json();
}

function check(data) {
  const list = data?.generators;
  if (!Array.isArray(list) || list.length < 100) throw new Error('Dataset has no (or too few) generators');
  if (list.length !== data.count) throw new Error(`count says ${data.count}, list has ${list.length}`);
  if (!data.fields || !Array.isArray(data.categories)) throw new Error('Dataset misses fields or categories');
  const slugs = new Set(list.map((g) => g.slug));
  if (slugs.size !== list.length) throw new Error('Duplicate slugs in dataset');
}

// RFC 4180: quote every cell that needs it, arrays joined with ";".
function csvCell(value) {
  const text = Array.isArray(value) ? value.join(';') : value === undefined || value === null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(data) {
  const columns = Object.keys(data.fields);
  const rows = data.generators.map((g) => columns.map((c) => csvCell(g[c])).join(','));
  return `${[columns.join(','), ...rows].join('\r\n')}\r\n`;
}

const pct = (n, total) => `${Math.round((n / total) * 100)}%`;

function readme(data) {
  const list = data.generators;
  const total = list.length;
  const count = (fn) => list.filter(fn).length;
  const byCategory = data.categories
    .map((c) => ({ ...c, n: count((g) => g.category === c.slug) }))
    .filter((c) => c.n > 0);
  const fieldRows = Object.entries(data.fields).map(([k, v]) => `| \`${k}\` | ${v.replaceAll('|', '\\|')} |`);

  return `# No-CAD 3D print generators: open dataset

${total} tools that turn a form, a photo or a line of text into a printable 3D file (STL, 3MF and more)
without CAD skills: lithophanes, Gridfinity bins, signs, keychains, terrain maps, AI text-to-3D and more.
Every tool is listed and checked by hand on **[SkipTheCAD](https://skipthecad.com/)**, the directory of
3D print generators. This repository mirrors that list as open data and is updated every day.

- **JSON:** [\`data/generators.json\`](data/generators.json) (same file as https://skipthecad.com/generators.json)
- **CSV:** [\`data/generators.csv\`](data/generators.csv) (one row per tool, lists joined with \`;\`)
- **Last check of any listing:** ${data.dateModified}

## At a glance

| | Tools | Share |
| --- | ---: | ---: |
| Free | ${count((g) => g.pricing === 'free')} | ${pct(count((g) => g.pricing === 'free'), total)} |
| Freemium | ${count((g) => g.pricing === 'freemium')} | ${pct(count((g) => g.pricing === 'freemium'), total)} |
| Paid | ${count((g) => g.pricing === 'paid')} | ${pct(count((g) => g.pricing === 'paid'), total)} |
| Runs in a browser | ${count((g) => g.platform.includes('web'))} | ${pct(count((g) => g.platform.includes('web')), total)} |
| Exports STL | ${count((g) => g.outputs.includes('STL'))} | ${pct(count((g) => g.outputs.includes('STL')), total)} |
| Exports 3MF | ${count((g) => g.outputs.includes('3MF'))} | ${pct(count((g) => g.outputs.includes('3MF')), total)} |
| Multicolor | ${count((g) => g.multicolor)} | ${pct(count((g) => g.multicolor), total)} |
| No account needed | ${count((g) => !g.accountRequired)} | ${pct(count((g) => !g.accountRequired), total)} |
| Open source | ${count((g) => g.openSource)} | ${pct(count((g) => g.openSource), total)} |

More numbers per category: [skipthecad.com/stats](https://skipthecad.com/stats/).

## Categories

| Category | Tools |
| --- | ---: |
${byCategory.map((c) => `| [${c.name}](${c.page}) | ${c.n} |`).join('\n')}

Counted by primary category; tools can also appear in up to three other categories (\`secondaryCategories\`).

## Fields

| Field | Meaning |
| --- | --- |
${fieldRows.join('\n')}

The JSON also has a top-level \`categories\` list (slug, name and SkipTheCAD page of every category).

## Example

\`\`\`js
const data = await (await fetch('https://raw.githubusercontent.com/SimplySolid3D/3d-print-generators-dataset/main/data/generators.json')).json();
const freeBrowserStl = data.generators.filter(
  (g) => g.pricing === 'free' && g.platform.includes('web') && g.outputs.includes('STL'),
);
console.log(freeBrowserStl.map((g) => \`\${g.name}: \${g.page}\`));
\`\`\`

## Missing a tool or found a mistake?

Suggest a generator at [skipthecad.com/submit](https://skipthecad.com/submit/) or open an issue here.
The data comes from the site, so changes are made there and show up here within a day.

## License

[CC BY 4.0](${data.licenseUrl}). You can reuse, share and adapt the data, also commercially, as long as you
credit **SkipTheCAD** with a link to https://skipthecad.com/, for example:

> Data: [SkipTheCAD](https://skipthecad.com/) (CC BY 4.0)

<!-- Generated by scripts/build.mjs from ${SOURCE}. Edit the script, not this file. -->
`;
}

const data = await load(SOURCE);
check(data);
await mkdir('data', { recursive: true });
await writeFile('data/generators.json', `${JSON.stringify(data, null, 2)}\n`);
await writeFile('data/generators.csv', toCsv(data));
await writeFile('README.md', readme(data));
console.log(`${data.generators.length} generators, ${data.categories.length} categories, last check ${data.dateModified}`);
