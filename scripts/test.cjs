const {spawnSync}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const tests=fs.readdirSync(path.join(root,'apps/api/tests')).filter(name=>/\.test\.(js|cjs)$/.test(name)).map(name=>path.join('apps/api/tests',name));
const result=spawnSync(process.execPath,['--test',...tests],{cwd:root,stdio:'inherit',windowsHide:true});process.exitCode=result.status??1;
