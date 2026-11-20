// Heuristic audit, not an exhaustive secret-scanning guarantee. Never prints values.
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');
function git(args){return cp.execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024});}
const patterns=[['google-api-key',/AIza[0-9A-Za-z_-]{35}/],['tavily-key',/tvly-[A-Za-z0-9_-]{20,}/],['openai-key',/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/],['github-token',/gh[pousr]_[A-Za-z0-9]{36,}/]];
const report={recorded_at:new Date().toISOString(),scope:'All locally available Git revisions and current source/build files; recognized token patterns only.',commits:0,history_hits:[],working_tree_hits:[],env_tracked:[],local_secret_bundle_hits:[]};
const commits=git(['rev-list','--all']).trim().split(/\r?\n/).filter(Boolean);report.commits=commits.length;
for(const rev of commits){
  const files=git(['ls-tree','-r','--name-only',rev]).split(/\r?\n/).filter(Boolean);
  for(const file of files){
    if(/(^|\/)\.env(?:$|\.)/.test(file)&&!file.endsWith('.env.example'))report.env_tracked.push({rev,file});
    if(/\.(png|jpg|jpeg|ico|zip|gif|woff2?)$/i.test(file))continue;
    const content=git(['show',`${rev}:${file}`]);
    for(const [kind,pattern]of patterns)if(pattern.test(content))report.history_hits.push({rev,file,kind});
  }
}
const treeFiles=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','node_modules','docs'].includes(entry.name)||entry.name.startsWith('.env'))continue;const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.(js|jsx|json|css|html|md|yml|yaml)$/.test(file))treeFiles.push(file);}}
walk(root);
for(const file of treeFiles){const content=fs.readFileSync(file,'utf8');for(const [kind,pattern]of patterns)if(pattern.test(content))report.working_tree_hits.push({file:path.relative(root,file),kind});}
const localKeys=[];
for(const relative of ['.env','backend/api/.env','frontend/client/.env']){const file=path.join(root,relative);if(!fs.existsSync(file))continue;for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){const match=line.match(/^\s*(GEMINI_API_KEY|TAVILY_API_KEY|GOOGLE_SEARCH_API_KEY)\s*=\s*(.+)\s*$/);if(match){const value=match[2].trim().replace(/^["']|["']$/g,'');if(value.length>12)localKeys.push({name:match[1],value});}}}
for(const file of treeFiles.filter(file=>file.includes(`${path.sep}dist${path.sep}`)||file.includes(`${path.sep}extension${path.sep}`))){const content=fs.readFileSync(file,'utf8');for(const key of localKeys)if(content.includes(key.value))report.local_secret_bundle_hits.push({file:path.relative(root,file),key:key.name});}
fs.writeFileSync(path.join(__dirname,'secret-scan-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
