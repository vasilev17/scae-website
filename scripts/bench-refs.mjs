import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as chromeLauncher from 'chrome-launcher';
import lighthouse, { desktopConfig } from 'lighthouse';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'lighthouse-report');

const RUNS = 3;
const THREE_ASSET = /\.(glb|gltf|bin|ktx2|draco)(\?|$)/i;
const THREE_HINT = /draco|meshopt|ktx2|webgl|three(?:\.module)?/i;

const SITES = [
  { id: 'rocketlab', name: 'Rocket Lab', url: 'https://www.rocketlabusa.com/' },
  { id: 'isar', name: 'Isar Aerospace', url: 'https://www.isaraerospace.com/' },
  { id: 'nasaeyes', name: 'NASA Eyes', url: 'https://eyes.nasa.gov/apps/solar-system/' },
  { id: 'dare', name: 'DARE', url: 'https://dare.tudelft.nl/' },
  { id: 'warr', name: 'WARR', url: 'https://www.warr.de/' },
  {
    id: 'ours',
    name: 'SCAE',
    url: process.env.OUR_URL ?? 'http://127.0.0.1:4321/en/',
  },
];

const args = parseArgs(process.argv.slice(2));

function parseArgs(argv) {
  const only = new Set();
  let skipDesktop = false;
  for (const token of argv) {
    if (token === '--skip-desktop') skipDesktop = true;
    else if (token.startsWith('--only=')) {
      for (const id of token.slice('--only='.length).split(',')) {
        if (id) only.add(id);
      }
    }
  }
  return { only, skipDesktop };
}

function median(values) {
  const sorted = values.filter((n) => Number.isFinite(n)).toSorted((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  const odd = sorted.length % 2 === 1;
  return odd ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function scoreOf(lhr, category) {
  const value = lhr.categories[category]?.score;
  return typeof value === 'number' ? Math.round(value * 100) : null;
}

function numericAudit(lhr, id) {
  const value = lhr.audits[id]?.numericValue;
  return typeof value === 'number' ? value : null;
}

function networkItems(lhr) {
  const items = lhr.audits['network-requests']?.details?.items;
  return Array.isArray(items) ? items : [];
}

function threeFromNetwork(items) {
  const hits = items.filter((item) => {
    const url = String(item.url ?? '');
    const mime = String(item.mimeType ?? '');
    return (
      THREE_ASSET.test(url) ||
      THREE_HINT.test(url) ||
      mime.includes('model') ||
      mime.includes('gltf')
    );
  });
  const bytes = hits.reduce((sum, item) => sum + (item.transferSize ?? 0), 0);
  return { hits, kb: bytes / 1024 };
}

function pageWeight(items) {
  const bytes = items.reduce((sum, item) => sum + (item.transferSize ?? 0), 0);
  return { kb: bytes / 1024, requests: items.length };
}

function a11yFails(lhr) {
  const refs = lhr.categories.accessibility?.auditRefs ?? [];
  let count = 0;
  for (const ref of refs) {
    const audit = lhr.audits[ref.id];
    if (audit?.scoreDisplayMode === 'binary' && audit.score === 0) count += 1;
  }
  return count;
}

function classify3d(html, three) {
  if (three.hits.length > 0) return 'реален WebGL';
  if (/<canvas[\s>]/i.test(html) && /webgl|three|babylon|unity/i.test(html)) {
    return 'реален WebGL';
  }
  if (/<video[\s>]/i.test(html) && /hero|launch|rocket/i.test(html)) {
    return 'видео';
  }
  return three.hits.length ? 'реален WebGL' : 'няма / статичен (провери screenshot)';
}

function classifyRender(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const visible = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const emptyRoot = /<div id="(?:root|app|__next)"[^>]*>\s*<\/div>/i.test(html);
  if (emptyRoot && visible.length < 400) return 'SPA';
  if (/__NEXT_DATA__|astro-island|data-astro-/i.test(html) && visible.length >= 400) {
    return 'SSG';
  }
  if (visible.length >= 400) return 'SSG / SSR';
  return 'SPA';
}

function countLocales(html) {
  const langs = new Set();
  const htmlLang = html.match(/<html[^>]*\blang=["']([^"']+)/i);
  if (htmlLang?.[1]) langs.add(htmlLang[1].slice(0, 2).toLowerCase());
  for (const match of html.matchAll(/\bhreflang=["']([^"']+)/gi)) {
    const tag = match[1];
    if (tag && tag !== 'x-default') langs.add(tag.slice(0, 2).toLowerCase());
  }
  return langs.size || 1;
}

async function fetchHtml(url) {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: control.signal,
      redirect: 'follow',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
      },
    });
    return await res.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

async function runLighthouse(url, port, form) {
  const flags = {
    port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility'],
  };
  const config = form === 'desktop' ? desktopConfig : undefined;
  const result = await lighthouse(url, flags, config);
  if (!result?.lhr) throw new Error(`Lighthouse returned no lhr for ${url}`);
  return result.lhr;
}

function readScreenshot(lhr) {
  const data = lhr.audits['final-screenshot']?.details?.data;
  return typeof data === 'string' ? data : null;
}

async function writeScreenshot(id, form, run, dataUrl) {
  if (!dataUrl) return;
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return;
  const buf = Buffer.from(dataUrl.slice(comma + 1), 'base64');
  const file = path.join(outDir, `${id}-${form}-${run}.webp`);
  await writeFile(file, buf);
}

function fmt(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toFixed(digits);
}

async function measureSite(site, chrome) {
  const html = await fetchHtml(site.url);
  const mobile = [];
  const desktop = [];

  for (let run = 1; run <= RUNS; run += 1) {
    process.stdout.write(`  ${site.id} mobile ${run}/${RUNS}\n`);
    const lhr = await runLighthouse(site.url, chrome.port, 'mobile');
    await writeFile(
      path.join(outDir, `${site.id}-mobile-${run}.json`),
      JSON.stringify(lhr),
    );
    await writeScreenshot(site.id, 'mobile', run, readScreenshot(lhr));
    mobile.push(lhr);
  }

  if (!args.skipDesktop) {
    for (let run = 1; run <= RUNS; run += 1) {
      process.stdout.write(`  ${site.id} desktop ${run}/${RUNS}\n`);
      const lhr = await runLighthouse(site.url, chrome.port, 'desktop');
      await writeFile(
        path.join(outDir, `${site.id}-desktop-${run}.json`),
        JSON.stringify(lhr),
      );
      desktop.push(lhr);
    }
  }

  const mid = mobile[Math.floor(mobile.length / 2)] ?? mobile[0];
  const items = networkItems(mid);
  const three = threeFromNetwork(items);
  const weight = pageWeight(items);

  return {
    id: site.id,
    name: site.name,
    url: site.url,
    three: classify3d(html, three),
    threeKb: three.kb,
    pageKb: weight.kb,
    requests: weight.requests,
    lcp: (() => {
      const ms = median(
        mobile.map((lhr) => numericAudit(lhr, 'largest-contentful-paint')),
      );
      return ms == null ? null : ms / 1000;
    })(),
    perfMobile: median(mobile.map((lhr) => scoreOf(lhr, 'performance'))),
    perfDesktop: desktop.length
      ? median(desktop.map((lhr) => scoreOf(lhr, 'performance')))
      : null,
    a11y: median(mobile.map((lhr) => scoreOf(lhr, 'accessibility'))),
    a11yFails: a11yFails(mid),
    locales: countLocales(html),
    render: classifyRender(html),
    threeOnMobile: three.hits.length > 0 ? 'зареден (не скрит)' : 'няма 3D заявка',
    reducedMotion: 'ръчно от screenshot (Lighthouse не емулира reduce)',
    lighthouse: mid.lighthouseVersion,
    userAgent: mid.environment?.hostUserAgent ?? '',
  };
}

function markdownTable(rows, meta) {
  const lines = [
    `# Гл. II comparison`,
    ``,
    `- Date: ${meta.date}`,
    `- Chrome: ${meta.chrome}`,
    `- Lighthouse: ${meta.lighthouse}`,
    `- Profile: mobile default (Moto G Power, Slow 4G, 4× CPU), ${RUNS} runs, median`,
    `- Desktop: ${args.skipDesktop ? 'skipped' : `${RUNS} runs, median`}`,
    `- Cache: disabled (fresh Chrome each launch)`,
    ``,
    `| Site | 3D | 3D KB | Page KB | Reqs | LCP s | Perf m/d | a11y | a11y fails | Locales | Render | 3D @ mobile | reduced-motion |`,
    `|---|---|---:|---:|---:|---:|---|---:|---:|---:|---|---|---|`,
  ];
  for (const row of rows) {
    const perf = `${fmt(row.perfMobile, 0)} / ${fmt(row.perfDesktop, 0)}`;
    lines.push(
      `| ${row.name} | ${row.three} | ${fmt(row.threeKb, 0)} | ${fmt(row.pageKb, 0)} | ${row.requests} | ${fmt(row.lcp, 2)} | ${perf} | ${fmt(row.a11y, 0)} | ${row.a11yFails} | ${row.locales} | ${row.render} | ${row.threeOnMobile} | ${row.reducedMotion} |`,
    );
  }
  lines.push('');
  lines.push(
    'Column 6 (reduced-motion) and the visual class of column 8 still need a 10-minute glance at the `*-mobile-*.webp` screenshots. Everything else is the median of the JSON in this folder.',
  );
  lines.push('');
  return `${lines.join('\n')}\n`;
}

const sites = SITES.filter((site) => args.only.size === 0 || args.only.has(site.id));
if (sites.length === 0) {
  console.error('No sites matched --only. Known ids: ' + SITES.map((s) => s.id).join(', '));
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const chrome = await chromeLauncher.launch({
  chromeFlags: ['--headless=new', '--disable-gpu', '--no-sandbox'],
});

const rows = [];
try {
  for (const site of sites) {
    process.stdout.write(`${site.name} ${site.url}\n`);
    rows.push(await measureSite(site, chrome));
  }
} finally {
  await chrome.kill();
}

const first = rows[0];
const table = markdownTable(rows, {
  date: new Date().toISOString(),
  chrome: first?.userAgent ?? 'unknown',
  lighthouse: first?.lighthouse ?? 'unknown',
});

await writeFile(path.join(outDir, 'table.md'), table);
await writeFile(path.join(outDir, 'table.json'), `${JSON.stringify(rows, null, 2)}\n`);
process.stdout.write(`\nWrote ${path.join(outDir, 'table.md')}\n`);
