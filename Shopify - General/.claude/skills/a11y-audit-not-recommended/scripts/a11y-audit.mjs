/**
 * a11y-audit.mjs — Shopify accessibility crawler
 * Usage: node a11y-audit.mjs <storeUrl> [password]
 * Requires: Node.js 22+ (native WebSocket), Chrome on port 9222
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE_URL   = process.argv[2];
const PASSWORD   = process.argv[3] || '';
const CDP_PORT   = 9222;
const PAGE_LIMIT = 40;
const TMPL_LIMIT = 5;

if (!BASE_URL) { console.error('Usage: node a11y-audit.mjs <url> [password]'); process.exit(1); }

const SKIP_PATHS = /^\/(twitter\.com|facebook\.com|instagram\.com|pinterest\.com|youtube\.com|tiktok\.com|linkedin\.com|customer_authentication)/i;

// ── CDP ──────────────────────────────────────────────────────────────────────
function cdpHttp(urlPath, method = 'GET') {
  return new Promise((res, rej) => {
    const opts = { host: '127.0.0.1', port: CDP_PORT, path: urlPath, method };
    const req = http.request(opts, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    });
    req.on('error', rej);
    req.end();
  });
}

function cdpConnect(wsUrl) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map(), handlers = new Map();
    ws.onopen = () => res({
      send(method, params = {}) {
        return new Promise((r, e) => {
          const mid = ++id; pending.set(mid, { r, e });
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      },
      on(evt, fn) { handlers.set(evt, fn); },
      close() { ws.close(); }
    });
    ws.onmessage = ({ data }) => {
      const m = JSON.parse(data);
      if (m.id && pending.has(m.id)) {
        const { r, e } = pending.get(m.id); pending.delete(m.id);
        m.error ? e(m.error) : r(m.result);
      } else if (m.method && handlers.has(m.method)) handlers.get(m.method)(m.params);
    };
    ws.onerror = rej;
  });
}

async function navigate(cdp, url, ms = 20000) {
  await cdp.send('Page.enable');
  await new Promise((res) => {
    const t = setTimeout(res, ms);
    cdp.on('Page.loadEventFired', () => { clearTimeout(t); res(); });
    cdp.send('Page.navigate', { url }).catch(() => res());
  });
  await new Promise(r => setTimeout(r, 2000));
}

async function run(cdp, expr) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: expr, awaitPromise: true, returnByValue: true, timeout: 25000
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

// ── In-browser scripts ────────────────────────────────────────────────────────
const IS_PWD_PAGE = `!!(document.querySelector('form[action="/password"]') || location.pathname==='/password')`;

const SUBMIT_PWD = pwd => `(function(){
  const f=document.querySelector('form[action="/password"]');
  const i=f&&f.querySelector('input[name="password"],input[type="password"]');
  if(!i)return'NO_INPUT'; i.value=${JSON.stringify(pwd)}; f.submit(); return'ok';
})()`;

const COLLECT_LINKS = (limit) => `(function(){
  const origin=location.origin;
  const skipExt=/\\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|css|js|woff2?|ttf|ico)(\\?|$)/i;
  const skipScheme=/^(mailto:|tel:|javascript:|#)/i;
  const skipPath=/^\\/(twitter\\.com|facebook\\.com|instagram\\.com|pinterest\\.com|youtube\\.com|tiktok\\.com|linkedin\\.com|customer_authentication)/i;
  return JSON.stringify([...new Set(
    [...document.querySelectorAll('a[href]')]
      .map(a=>{try{return new URL(a.href,origin).href;}catch{return null;}})
      .filter(h=>h&&h.startsWith(origin)&&!skipScheme.test(h)&&!skipExt.test(h))
      .map(h=>{const u=new URL(h);u.hash='';if(!u.searchParams.has('variant'))u.search='';return u.href;})
      .filter(h=>{const p=new URL(h).pathname;return!skipPath.test(p);})
  )].slice(0,${limit}));
})()`;

const RUN_AXE = `(async function(){
  if(!window.axe){
    await new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.0/axe.min.js';
      s.onload=res;s.onerror=rej;document.head.appendChild(s);
    });
  }
  const r=await window.axe.run(document,{
    runOnly:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'],
    resultTypes:['violations','incomplete']
  });
  return JSON.stringify({violations:r.violations,incomplete:r.incomplete});
})()`;

// ── Dedup ────────────────────────────────────────────────────────────────────
function dedup(urls, seen) {
  const counts = {};
  return urls.filter(url => {
    if (seen.has(url)) return false;
    const seg = new URL(url).pathname.split('/')[1] || 'home';
    counts[seg] = (counts[seg] || 0) + 1;
    if (counts[seg] > TMPL_LIMIT) return false;
    seen.add(url); return true;
  });
}

// ── FILE_MAP ─────────────────────────────────────────────────────────────────
const FILE_MAP = {
  'image-alt':            'snippets/product-card.liquid, sections/main-product.liquid',
  'label':                'sections/contact-form.liquid, snippets/search-form.liquid',
  'color-contrast':       'assets/base.css',
  'heading-order':        'layout/theme.liquid, sections/*.liquid',
  'page-has-heading-one': 'sections/*.liquid (missing <h1> in section template)',
  'html-has-lang':        'layout/theme.liquid',
  'document-title':       'layout/theme.liquid ({% if page_title %})',
  'skip-link':            'layout/theme.liquid (first element in <body>)',
  'link-name':            'snippets/*.liquid, sections/*.liquid',
  'button-name':          'snippets/*.liquid, sections/*.liquid',
  'landmark-one-main':    'layout/theme.liquid',
  'region':               'layout/theme.liquid',
  'aria-required-attr':   'snippets/*.liquid',
  'aria-valid-attr-value':'snippets/*.liquid',
  'focus-visible':        'assets/base.css',
  'image-redundant-alt':  'snippets/product-card.liquid',
  'aria-allowed-role':    'sections/*.liquid (remove or correct role= attribute)',
};

// ── HTML Report ───────────────────────────────────────────────────────────────
function buildHtml(allResults, total, storeUrl) {
  const byRule = {};
  for (const { pageUrl, violations } of allResults) {
    for (const v of violations) {
      if (!byRule[v.id]) byRule[v.id] = { id: v.id, impact: v.impact, desc: v.description, help: v.help, helpUrl: v.helpUrl, pages: new Set(), nodes: [] };
      byRule[v.id].pages.add(pageUrl);
      for (const n of v.nodes) byRule[v.id].nodes.push({ page: pageUrl, sel: (n.target||[]).join(', '), why: n.failureSummary||'' });
    }
  }

  const ORDER = { critical:0, serious:1, moderate:2, minor:3 };
  const rules = Object.values(byRule).sort((a,b)=>(ORDER[a.impact]??9)-(ORDER[b.impact]??9)||b.nodes.length-a.nodes.length);
  const counts = { critical:0, serious:0, moderate:0, minor:0 };
  for (const r of rules) counts[r.impact] = (counts[r.impact]||0) + r.nodes.length;
  const origin = new URL(storeUrl).origin;
  const totalViolations = Object.values(counts).reduce((a,b)=>a+b,0);

  const COLORS = { critical:'#dc2626', serious:'#ea580c', moderate:'#d97706', minor:'#2563eb' };
  const BG = { critical:'#fef2f2', serious:'#fff7ed', moderate:'#fffbeb', minor:'#eff6ff' };
  const BORDER = { critical:'#fca5a5', serious:'#fdba74', moderate:'#fcd34d', minor:'#93c5fd' };

  const badge = (impact) => `<span style="background:${COLORS[impact]};color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;text-transform:uppercase">${impact}</span>`;

  let violationHtml = '';
  for (const impact of ['critical','serious','moderate','minor']) {
    const group = rules.filter(r=>r.impact===impact);
    if (!group.length) continue;
    violationHtml += `<h2 style="color:${COLORS[impact]};border-bottom:2px solid ${BORDER[impact]};padding-bottom:8px;margin-top:40px">${impact.charAt(0).toUpperCase()+impact.slice(1)} Violations (${group.reduce((s,r)=>s+r.nodes.length,0)})</h2>`;
    for (const r of group) {
      const sw = r.pages.size >= 5 ? '<span style="background:#7c3aed;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;margin-left:8px">SITE-WIDE</span>' : '';
      violationHtml += `
      <div style="background:${BG[impact]};border:1px solid ${BORDER[impact]};border-radius:8px;padding:16px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          ${badge(impact)}${sw}
          <code style="background:#1e293b;color:#e2e8f0;padding:2px 8px;border-radius:4px;font-size:13px">${r.id}</code>
          <a href="${r.helpUrl||'#'}" target="_blank" style="font-size:12px;color:#6b7280">Learn more ↗</a>
        </div>
        <p style="margin:0 0 8px;font-weight:600">${r.desc}</p>
        <p style="margin:0 0 12px;color:#6b7280;font-size:13px">${r.pages.size} page(s) · ${r.nodes.length} element(s) · Fix in: <code>${FILE_MAP[r.id]||'theme file'}</code></p>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:rgba(0,0,0,0.05)"><th style="text-align:left;padding:6px 8px">Page</th><th style="text-align:left;padding:6px 8px">Selector</th></tr></thead>
          <tbody>
            ${r.nodes.slice(0,8).map(n=>`<tr style="border-top:1px solid ${BORDER[impact]}"><td style="padding:6px 8px;color:#374151">${n.page.replace(origin,'')||'/'}</td><td style="padding:6px 8px;font-family:monospace;color:#6b7280;word-break:break-all">${(n.sel||'').slice(0,120)}</td></tr>`).join('')}
            ${r.nodes.length>8?`<tr><td colspan="2" style="padding:6px 8px;color:#9ca3af;font-style:italic">… and ${r.nodes.length-8} more instances</td></tr>`:''}
          </tbody>
        </table>
      </div>`;
    }
  }

  const priorityList = rules.slice(0,10).map((r,i)=>{
    const scope = r.pages.size>=5?'site-wide':`${r.pages.size} page(s)`;
    return `<li style="margin-bottom:8px"><strong>${badge(r.impact)}</strong> <code>${r.id}</code> — ${scope} — Fix in: <code>${FILE_MAP[r.id]||'theme file'}</code></li>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>A11y Audit — ${storeUrl}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#f8fafc;color:#1e293b}
  .header{background:linear-gradient(135deg,#1e293b,#334155);color:#fff;padding:40px;margin-bottom:32px}
  .header h1{margin:0 0 8px;font-size:28px}
  .header p{margin:0;opacity:.7;font-size:14px}
  .container{max-width:1100px;margin:0 auto;padding:0 24px 60px}
  .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px}
  .card{background:#fff;border-radius:10px;padding:20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1)}
  .card .num{font-size:36px;font-weight:800;margin-bottom:4px}
  .card .lbl{font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em}
  code{background:#f1f5f9;padding:1px 5px;border-radius:3px;font-size:13px}
  h2{font-size:20px}
  ul{padding-left:20px}
  .priority{background:#fff;border-radius:10px;padding:24px;margin-bottom:32px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
  .meta{background:#fff;border-radius:10px;padding:20px;margin-bottom:32px;box-shadow:0 1px 3px rgba(0,0,0,.1);font-size:14px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .meta span{color:#6b7280}
</style>
</head>
<body>
<div class="header">
  <h1>Accessibility Audit Report</h1>
  <p>${storeUrl} · WCAG 2.1 AA · ${new Date().toISOString().split('T')[0]} · ${total} pages audited</p>
</div>
<div class="container">
  <div class="cards">
    <div class="card"><div class="num" style="color:#dc2626">${counts.critical}</div><div class="lbl">Critical</div></div>
    <div class="card"><div class="num" style="color:#ea580c">${counts.serious}</div><div class="lbl">Serious</div></div>
    <div class="card"><div class="num" style="color:#d97706">${counts.moderate}</div><div class="lbl">Moderate</div></div>
    <div class="card"><div class="num" style="color:#2563eb">${counts.minor}</div><div class="lbl">Minor</div></div>
  </div>

  <div class="meta">
    <div><span>Store:</span> ${storeUrl}</div>
    <div><span>Date:</span> ${new Date().toLocaleDateString()}</div>
    <div><span>Pages audited:</span> ${total}</div>
    <div><span>Total violations:</span> ${totalViolations} across ${rules.length} rules</div>
    <div><span>Standard:</span> WCAG 2.1 AA</div>
    <div><span>Tool:</span> axe-core 4.10.0</div>
  </div>

  <div class="priority">
    <h2 style="margin-top:0">Priority Fix List</h2>
    <ol>${priorityList}</ol>
  </div>

  ${violationHtml}
</div>
</body>
</html>`;
}

// ── Console Report ────────────────────────────────────────────────────────────
function report(allResults, total) {
  const byRule = {};
  for (const { pageUrl, violations } of allResults) {
    for (const v of violations) {
      if (!byRule[v.id]) byRule[v.id] = { id: v.id, impact: v.impact, desc: v.description, pages: new Set(), nodes: [] };
      byRule[v.id].pages.add(pageUrl);
      for (const n of v.nodes) byRule[v.id].nodes.push({ page: pageUrl, sel: (n.target||[]).join(', '), why: n.failureSummary||'' });
    }
  }

  const ORDER = { critical:0, serious:1, moderate:2, minor:3 };
  const rules = Object.values(byRule).sort((a,b)=>(ORDER[a.impact]??9)-(ORDER[b.impact]??9)||b.nodes.length-a.nodes.length);
  const counts = {};
  for (const r of rules) counts[r.impact] = (counts[r.impact]||0) + r.nodes.length;
  const siteWide = rules.filter(r => r.pages.size >= 5);
  const origin = new URL(BASE_URL).origin;

  const hr  = '═'.repeat(68);
  const hr2 = '─'.repeat(68);
  console.log(`\n${hr}\n  ACCESSIBILITY AUDIT REPORT\n${hr}`);
  console.log(`  Store   : ${BASE_URL}`);
  console.log(`  Audited : ${total} pages  |  Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`  Standard: WCAG 2.1 AA  |  Session: Incognito Chrome\n${hr}`);

  console.log(`\n── SUMMARY ${hr2.slice(10)}`);
  for (const s of ['critical','serious','moderate','minor'])
    console.log(`  ${s.padEnd(10)}: ${counts[s]||0} violations`);
  console.log(`  ${'total'.padEnd(10)}: ${Object.values(counts).reduce((a,b)=>a+b,0)} across ${rules.length} unique rules`);

  for (const impact of ['critical','serious','moderate','minor']) {
    const group = rules.filter(r=>r.impact===impact);
    if (!group.length) continue;
    console.log(`\n── ${impact.toUpperCase()} ${hr2.slice(impact.length+4)}`);
    for (const r of group) {
      const sw = r.pages.size>=5?' ⚠ SITE-WIDE':'';
      console.log(`\n  [${r.id}]${sw}\n  ${r.desc}`);
      console.log(`  Appears on ${r.pages.size} page(s) | ${r.nodes.length} element(s)`);
      for (const n of r.nodes.slice(0,5)) {
        console.log(`    • ${n.page.replace(origin,'')||'/'}`);
        if (n.sel) console.log(`      ${n.sel.slice(0,100)}`);
      }
      if (r.nodes.length>5) console.log(`    … and ${r.nodes.length-5} more`);
      if (FILE_MAP[r.id]) console.log(`  Fix in: ${FILE_MAP[r.id]}`);
    }
  }

  if (siteWide.length) {
    console.log(`\n── SITE-WIDE FIXES (template-level) ${hr2.slice(36)}`);
    for (const r of siteWide)
      console.log(`  • [${r.impact.toUpperCase()}] ${r.id} → ${FILE_MAP[r.id]||'shared Liquid file'}`);
  }

  console.log(`\n── PRIORITY FIX LIST ${hr2.slice(20)}`);
  rules.slice(0,10).forEach((r,i)=>{
    const scope = r.pages.size>=5?'site-wide':`${r.pages.size} page(s)`;
    console.log(`  ${i+1}. [${r.impact.toUpperCase()}, ${scope}] ${r.id} → ${FILE_MAP[r.id]||'theme file'}`);
  });

  // Write HTML report
  try {
    const subdomain = new URL(BASE_URL).hostname.split('.')[0];
    const outDir = path.join(process.cwd(), `${subdomain}-audit`);
    fs.mkdirSync(outDir, { recursive: true });
    const htmlPath = path.join(outDir, 'report.html');
    fs.writeFileSync(htmlPath, buildHtml(allResults, total, BASE_URL));
    console.log(`\n${hr}`);
    console.log(`  Folder : ${outDir}`);
    console.log(`  HTML   : ${htmlPath}`);
    console.log(hr);
  } catch(e) {
    console.log(`\n  ⚠ Could not write HTML report: ${e.message}`);
  }

  console.log(`\n${hr}\n`);
  return { byRule, rules, counts };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Normalize URL
  let storeUrl = BASE_URL;
  if (!/^https?:\/\//i.test(storeUrl)) storeUrl = 'https://' + storeUrl;

  console.log(`\nA11y Audit — ${storeUrl}`);

  const list   = await cdpHttp('/json/list');
  const target = list.find(t=>t.type==='page' && (t.url==='about:blank'||t.url==='')) || await cdpHttp('/json/new', 'PUT');
  const cdp    = await cdpConnect(target.webSocketDebuggerUrl);

  console.log('Loading home page…');
  await navigate(cdp, storeUrl);
  if (await run(cdp, IS_PWD_PAGE)) {
    if (!PASSWORD) { console.error('Password gate detected — re-run with password as 2nd argument'); process.exit(1); }
    console.log('Password gate — authenticating…');
    await run(cdp, SUBMIT_PWD(PASSWORD));
    await new Promise(r=>setTimeout(r,3500));
    await navigate(cdp, storeUrl);
    console.log('Authenticated ✓');
  }

  // Crawl
  const seen = new Set([storeUrl]);
  const l1raw  = JSON.parse(await run(cdp, COLLECT_LINKS(PAGE_LIMIT)));
  const level1 = dedup(l1raw, seen);

  const l2raw = [];
  for (const url of level1) {
    await navigate(cdp, url);
    try { l2raw.push(...JSON.parse(await run(cdp, COLLECT_LINKS(PAGE_LIMIT)))); } catch {}
  }
  const level2 = dedup(l2raw, seen);

  const pages = [storeUrl, ...level1, ...level2];
  console.log(`\nPages to audit: ${pages.length}`);
  console.log(`  Level 0: /`);
  console.log(`  Level 1: ${level1.slice(0,4).map(u=>new URL(u).pathname).join(', ')}${level1.length>4?` +${level1.length-4} more`:''}`);
  console.log(`  Level 2: ${level2.slice(0,4).map(u=>new URL(u).pathname).join(', ')}${level2.length>4?` +${level2.length-4} more`:''}\n`);

  // Audit
  const results = [];
  for (let i=0; i<pages.length; i++) {
    const url = pages[i];
    const pg = new URL(url).pathname || '/';
    process.stdout.write(`\r  [${i+1}/${pages.length}] ${pg.padEnd(55)}`);
    try {
      await navigate(cdp, url);
      if (await run(cdp, IS_PWD_PAGE)) {
        await run(cdp, SUBMIT_PWD(PASSWORD));
        await new Promise(r=>setTimeout(r,3000));
        await navigate(cdp, url);
      }
      const raw = await run(cdp, RUN_AXE);
      const { violations } = JSON.parse(raw);
      results.push({ pageUrl: url, violations });
    } catch(e) {
      console.log(`\n  ⚠ Skipped ${pg}: ${e.message?.slice(0,80)}`);
    }
  }

  process.stdout.write('\n');
  cdp.close();
  report(results, pages.length);
}

main().catch(e=>{ console.error('Fatal:', e.message); process.exit(1); });
