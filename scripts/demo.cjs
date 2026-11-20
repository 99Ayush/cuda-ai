const {createApp}=require('../apps/api/dist/app.js');
const app=createApp({config:{geminiKey:'',tavilyKey:'',model:'demo-fixture',demo:true,rateLimit:100,persistenceEnabled:false}});
const port=Number(process.env.DEMO_PORT||18089);
const server=app.listen(port,'127.0.0.1',()=>console.log(`ClaimLens offline demo http://localhost:${port} — simulated provider responses`));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void app.locals.shutdown().then(()=>server.close(()=>process.exit(0)));});
