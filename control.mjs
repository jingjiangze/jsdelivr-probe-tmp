// Control probe — runs on GitHub-hosted runner. Captures FULL bodies.
import fs from 'fs';
const urls = [
  { tag: 'jquery-known-good', url: 'https://cdn.jsdelivr.net/gh/jquery/jquery@main/dist/jquery.min.js' },
  { tag: 'thisrepo-tiny-gitattributes', url: 'https://cdn.jsdelivr.net/gh/jingjiangze/Stronghold-Protocol-CDN@assets-raw/.gitattributes' },
  { tag: 'thisrepo-tiny-readme', url: 'https://cdn.jsdelivr.net/gh/jingjiangze/Stronghold-Protocol-CDN@assets-raw/README.md' },
  { tag: 'thisrepo-tiny-json', url: 'https://cdn.jsdelivr.net/gh/jingjiangze/Stronghold-Protocol-CDN@assets-raw/assets.summary.json' },
  { tag: 'thisrepo-sample-skel', url: 'https://cdn.jsdelivr.net/gh/jingjiangze/Stronghold-Protocol-CDN@assets-raw/assets/spine/enemy/enemy_1214_mtrmgc/enemy_1214_mtrmgc.skel' },
  { tag: 'thisrepo-sample-mp3', url: 'https://cdn.jsdelivr.net/gh/jingjiangze/Stronghold-Protocol-CDN@assets-raw/assets/audio/bgm/m_bat_abyssalhunters_intro.mp3' },
  { tag: 'jsdelivr-api-branch', url: 'https://data.jsdelivr.com/v1/packages/gh/jingjiangze/Stronghold-Protocol-CDN@assets-raw' },
];
async function one(u) {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const to = setTimeout(()=>ctrl.abort(), 25000);
    const res = await fetch(u.url, { redirect:'follow', signal: ctrl.signal });
    clearTimeout(to);
    const ms = Date.now()-t0;
    let body = null;
    try { body = await res.text(); } catch(e){ body = 'read-err:'+e.message; }
    return { tag: u.tag, url: u.url, status: res.status, ms, cl: res.headers.get('content-length'), server: res.headers.get('server'), body: body.slice(0, 600) };
  } catch(e) {
    return { tag: u.tag, url: u.url, status: null, ms: Date.now()-t0, err: e.message };
  }
}
const out = [];
for (const u of urls) out.push(await one(u));
fs.writeFileSync('control.json', JSON.stringify(out, null, 1));
for (const o of out) {
  console.log('\n['+o.tag+'] status='+o.status+' ms='+o.ms+' cl='+(o.cl||'?')+' server='+(o.server||'?'));
  console.log('  body200?: ' + (o.status===200 ? ('(200, len '+(o.body?o.body.length:0)+')') : JSON.stringify(o.body)));
  if (o.err) console.log('  err='+o.err);
}
