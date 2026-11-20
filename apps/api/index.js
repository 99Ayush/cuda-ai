const { createApp } = require('./src/app.js');
const app=createApp();
if(require.main===module){const port=Number(process.env.PORT||8080);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');const server=app.listen(port,process.env.HOST||'127.0.0.1',()=>console.log('ClaimLens http://localhost:'+port));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));}
module.exports=app;
