import {createApp} from "./app";
const app=createApp();
if(require.main===module){
  void(async()=>{
    await app.locals.ready;
    const port=Number(process.env.PORT||8080);if(!Number.isInteger(port)||port<1||port>65535)throw new Error("PORT must be a valid TCP port.");
    const server=app.listen(port,process.env.HOST||"127.0.0.1",()=>console.log(`ClaimLens http://localhost:${port}`));
    let stopping=false;
    for(const signal of ["SIGINT","SIGTERM"] as const)process.once(signal,()=>{if(stopping)return;stopping=true;void app.locals.shutdown().then(()=>server.close(()=>process.exit(0)));setTimeout(()=>{server.closeAllConnections();process.exit(1);},5000).unref();});
  })().catch(error=>{console.error(error instanceof Error?error.message:"Startup failed");process.exitCode=1;});
}
export default app;
