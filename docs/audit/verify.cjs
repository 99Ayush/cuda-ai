// Re-run quality checks without contacting AI providers: node docs/audit/verify.cjs
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');
function run(command,args,name){
  const started=Date.now();
  const result=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024,timeout:180000});
  const output=(result.stdout||'')+(result.stderr||'');
  fs.writeFileSync(path.join(__dirname,`${name}.txt`),output);
  return {exit_code:result.status,duration_ms:Date.now()-started,output,error:result.error?.message};
}
const check=process.platform==='win32'?run('cmd.exe',['/d','/s','/c','npm.cmd run check'],'check'):run('npm',['run','check'],'check');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const testFiles=pkg.scripts.test.split(' --test ')[1].split(' ');
const coverage=run(process.execPath,['--experimental-test-coverage','--test-coverage-include=frontend/client/server/*.js','--test',...testFiles],'coverage');
const coverageLines=coverage.output.split(/\r?\n/).filter(line=>/^# (?:app\.js|config\.js|engine\.js|errors\.js|providers\.js|screen\.js|all files)\s*\|/.test(line.trim()));
const summary={recorded_at:new Date().toISOString(),node:process.version,check:{exit_code:check.exit_code,tests:Number(check.output.match(/# tests (\d+)/)?.[1]||0),passed:Number(check.output.match(/# pass (\d+)/)?.[1]||0),failed:Number(check.output.match(/# fail (\d+)/)?.[1]||0),duration_ms:check.duration_ms,error:check.error},core_coverage:{exit_code:coverage.exit_code,include:'frontend/client/server/*.js',table:coverageLines,error:coverage.error}};
fs.writeFileSync(path.join(__dirname,'quality-results.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
if(check.exit_code!==0||coverage.exit_code!==0)process.exitCode=1;
