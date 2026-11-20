// Offline audit probes. Run: node docs/audit/probes.cjs
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { once } = require('node:events');
const root = path.resolve(__dirname, '../..');
const { createEngine, normalizeSources, validateAnalysis, publicUrl } = require(path.join(root,'frontend/client/server/engine.js'));
const { createApp } = require(path.join(root,'frontend/client/server/app.js'));
const { config, providers, source, modelOutput } = require(path.join(root,'backend/api/tests/helpers.js'));
const results = { recorded_at:new Date().toISOString(), node:process.version, probes:{}, dataset:{}, source_hash:null };
function sourceHash() {
  const files=[];
  function walk(dir) {
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
      if(['.git','node_modules','dist','docs'].includes(entry.name)) continue;
      const file=path.join(dir,entry.name);
      if(entry.isDirectory()) walk(file);
      else if(/\.(js|jsx|json|css|html|yml|yaml)$/.test(entry.name)) files.push(file);
    }
  }
  walk(root);
  const hash=crypto.createHash('sha256');
  for(const file of files.sort()) {hash.update(path.relative(root,file));hash.update(fs.readFileSync(file));}
  return hash.digest('hex');
}
(async()=>{
  const storage=await import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync(path.join(root,'frontend/client/src/storage.js'),'utf8')).toString('base64')}`);
  const noClaims=await createEngine(config,providers({generate:async()=>({claims:[]})}))({pageUrl:'https://example.org/article'});
  results.probes.empty_article={api_verdict:noClaims.verdict,claims:noClaims.claims.length,browser_accepts:storage.validResult(noClaims)};
  const groups=[normalizeSources([source],0)];
  const missingKind=validateAnalysis(modelOutput(),['Lightning never strikes the same place twice.'],groups)[0];
  results.probes.missing_required_claim_kind={input_has_claim_kind:false,accepted_verdict:missingKind.verdict};
  results.probes.single_source={verdict:missingKind.verdict,evidence_strength:missingKind.evidence_strength,independent_publishers:new Set(missingKind.sources.map(s=>s.publisher)).size};
  results.probes.url_lexical_only={input:'http://127.0.0.1.nip.io/article',accepted_url:publicUrl('http://127.0.0.1.nip.io/article'),note:'No DNS lookup or actual SSRF attempted; article extraction uses Tavily.'};
  results.probes.tracking_url_duplicates={retained_sources:normalizeSources([{...source,url:'https://example.org/story?utm_source=a'},{...source,url:'https://example.org/story?utm_source=b'}],0).length};
  const event={}; event.started=new Promise(resolve=>event.resolveStarted=resolve);
  let upstreamAborted=null, completed=false;
  const app=createApp({config,providers:providers({search:async(_query,_exclude,signal)=>{event.resolveStarted();await new Promise(resolve=>setTimeout(resolve,150));upstreamAborted=signal.aborted;completed=true;return [];}})});
  const listener=app.listen(0,'127.0.0.1');await once(listener,'listening');
  try {
    const abort=new AbortController();
    const request=fetch(`http://127.0.0.1:${listener.address().port}/api/analyze-claim`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Lightning never strikes the same place twice.'}),signal:abort.signal}).catch(()=>{});
    await event.started;abort.abort();await request;await new Promise(resolve=>setTimeout(resolve,200));
    results.probes.client_disconnect={upstream_completed:completed,upstream_aborted:upstreamAborted};
  } finally {listener.closeAllConnections();await new Promise(resolve=>listener.close(resolve));}
  const cases=JSON.parse(fs.readFileSync(path.join(root,'scripts/benchmark-cases.json'),'utf8'));
  results.dataset={cases:cases.length,missing_source_or_license:cases.filter(item=>!item.source||!item.license).length,allowed_verdict_counts:Object.fromEntries(['TRUE','FALSE','MIXED','UNVERIFIED'].map(verdict=>[verdict,cases.filter(item=>item.expected.includes(verdict)).length]))};
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  results.probes.offline_preview={documented_command_script:pkg.scripts['preview:test'],fixture_script:pkg.scripts['preview:fixtures'],fixture_port:18089,ui_blocks_test_mode:/if \(health\.test_mode\)/.test(fs.readFileSync(path.join(root,'frontend/client/src/App.jsx'),'utf8'))};
  results.source_hash=sourceHash();
  fs.writeFileSync(path.join(__dirname,'probe-results.json'),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
