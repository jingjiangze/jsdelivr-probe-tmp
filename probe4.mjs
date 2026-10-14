// probe4 (fixed): full 253-sample paced HTTP coverage. Robust: per-item try/catch + incremental write.
import fs from 'fs';
const REPO = 'jingjiangze/Stronghold-Protocol-CDN@assets-raw';
const BIG = 20*1024*1024;
const TIMEOUT_MS = 30000;
const SPACING = 1200;
const sleep = (ms)=>new Promise(z=>setTimeout(z,ms));
function buildUrl(p){return 'https://cdn.jsdelivr.net/gh/'+REPO+'/'+p.split('/').map(encodeURIComponent).join('/');}
async function doFetch(url){
  const t0=Date.now();
  try{
    const ctrl=new AbortController(); const to=setTimeout(()=>ctrl.abort(),TIMEOUT_MS);
    const res=await fetch(url,{method:'GET',redirect:'follow',signal:ctrl.signal}); clearTimeout(to);
    const ms=Date.now()-t0; const cl=res.headers.get('content-length');
    let body=null; if(res.status!==200){try{body=(await res.text()).slice(0,400);}catch(e){body='re:'+e.message;}} else {try{await res.body?.cancel?.();}catch(e){}}
    return {status:res.status,ms,cl,body};
  }catch(e){return {status:null,ms:Date.now()-t0,err:e.message};}
}
const paths=JSON.parse(fs.readFileSync('paths.json','utf8'));
const results=[]; let i=0;
function dump(){ fs.writeFileSync('results4.json', JSON.stringify({total:results.length, partial:true, results},null,1)); }
for(const p of paths){
  i++;
  let o;
  try{
    const url=buildUrl(p.path);
    let last=null, thr=0;
    for(let a=0;a<3;a++){
      const r=await doFetch(url); last=r;
      if(r.status===200){ o={path:p.path,size:p.size,big:(p.size||0)>=BIG,s1:200,ms1:r.ms,cl1:r.cl}; break; }
      if(r.status===404){ o={path:p.path,size:p.size,big:(p.size||0)>=BIG,s1:404,ms1:r.ms,cl1:r.cl,hint1:r.body}; break; }
      thr++; await sleep(3000);
    }
    if(!o){
      const kind = last?(last.status??('net:'+last.err)):'net';
      o={path:p.path,size:p.size,big:(p.size||0)>=BIG,s1:(last?last.status:null),ms1:(last?last.ms:null),cl1:(last?last.cl:null),hint1:(last?last.body:null),throttle:true,throttleKind:kind};
    }
    if(o.s1===404){ await sleep(1500); const r2=await doFetch(url); o.s2=r2.status; o.ms2=r2.ms; o.cl2=r2.cl; o.hint2=r2.body; }
    results.push(o);
    const tag = o.s1===200?'OK':(o.s1===404?('404->'+(o.s2??'?')):(o.throttle?'THR:'+o.throttleKind:'?'+o.s1));
    console.log(`[${i}/${paths.length}] ${p.path.split('/').pop().slice(0,28).padEnd(28)} ${tag}`);
  }catch(e){
    results.push({path:p.path,size:p.size,error:String(e)});
    console.log(`[${i}/${paths.length}] ${p.path.split('/').pop().slice(0,28).padEnd(28)} ERROR ${e.message}`);
  }
  if(i%20===0) dump();
  await sleep(SPACING);
}
dump();
const thr=results.filter(r=>r.throttle).length, f404=results.filter(r=>r.s1===404).length;
console.log(`DONE total=${results.length} ok=${results.filter(r=>r.s1===200).length} 404=${f404} throttled=${thr}`);
