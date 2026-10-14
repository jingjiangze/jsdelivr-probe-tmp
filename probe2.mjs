// probe2: paced jsDelivr coverage probe (cloud runner) with backoff on 503/429/timeout.
import fs from 'fs';
const REPO = 'jingjiangze/Stronghold-Protocol-CDN@assets-raw';
const BIG = 20 * 1024 * 1024;
const TIMEOUT_MS = 30000;
const SPACING = 650; // ms between requests
function buildUrl(path) {
  return 'https://cdn.jsdelivr.net/gh/' + REPO + '/' + path.split('/').map(encodeURIComponent).join('/');
}
const sleep = (ms) => new Promise(z => setTimeout(z, ms));
async function doFetch(url) {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
    clearTimeout(to);
    const ms = Date.now() - t0;
    const cl = res.headers.get('content-length');
    let body = null;
    if (res.status !== 200) { try { body = (await res.text()).slice(0, 1200); } catch (e) { body = 'read-err:' + e.message; } }
    else { try { await res.body?.cancel?.(); } catch (e) {} }
    return { status: res.status, ms, cl, body: body || null };
  } catch (e) {
    const ms = Date.now() - t0;
    let kind = e && e.name ? e.name : 'error';
    let msg = e && e.message ? e.message : String(e);
    if (kind === 'TimeoutError' || /aborted|timeout/i.test(msg)) kind = 'timeout';
    return { status: null, ms, cl: null, body: null, err: kind + ':' + msg };
  }
}
async function probeOne(p) {
  const url = buildUrl(p.path);
  const out = { path: p.path, size: p.size != null ? p.size : null, big: (p.size || 0) >= BIG };
  let last = null, throttleCount = 0;
  for (let attempt = 0; attempt < 7; attempt++) {
    const r = await doFetch(url);
    last = r;
    if (r.status === 200) { Object.assign(out, { s1: 200, ms1: r.ms, cl1: r.cl }); out.ok = true; return finalize(out); }
    if (r.status === 404) { Object.assign(out, { s1: 404, ms1: r.ms, cl1: r.cl, hint1: r.body }); return finalize(out); }
    // 503 / 429 / timeout / other -> backoff
    throttleCount++;
    const kind = r.status === 429 ? '429' : (r.status === 503 ? '503' : (r.err ? 'net' : 'other'));
    out.lastThrottle = kind + ':' + (r.status ?? r.err);
    const back = Math.min(20000, 1000 * Math.pow(2, attempt)) + Math.floor(Math.random() * 500);
    await sleep(back);
  }
  // exhausted after retries
  Object.assign(out, { s1: last ? last.status : null, ms1: last ? last.ms : null, cl1: last ? last.cl : null, hint1: last ? last.body : null, s1exhausted: true, throttleCount });
  return finalize(out);

  function finalize(o) {
    // 404 re-probe once for cache-flip detection
    if (o.s1 === 404) { return (async () => { await sleep(1500); const r2 = await doFetch(url); Object.assign(o, { s2: r2.status, ms2: r2.ms, cl2: r2.cl, hint2: r2.body }); return o; })(); }
    return o;
  }
}
const paths = JSON.parse(fs.readFileSync('paths.json', 'utf8'));
const results = [];
let i = 0;
for (const p of paths) {
  i++;
  const r = await probeOne(p);
  results.push(r);
  const tag = r.s1 === 200 ? 'OK' : (r.s1 === 404 ? ('404' + (r.s2 === 200 ? '->200' : '')) : ('THR:' + (r.lastThrottle || '?')));
  console.log(`[${i}/${paths.length}] ${(r.path.split('/').pop()).slice(0,30).padEnd(30)} ${tag}`);
  await sleep(SPACING);
}
const throttled = results.filter(r => r.s1 !== 200 && r.s1 !== 404).length;
fs.writeFileSync('results2.json', JSON.stringify({ total: results.length, throttledExhausted: throttled, results }, null, 1));
console.log('DONE total=' + results.length + ' throttledExhausted=' + throttled);
