import express,{type Request,type Response,type NextFunction,type ErrorRequestHandler} from "express";
import path from "node:path";
import fs from "node:fs";
import { randomUUID,createHash } from "node:crypto";
import {z} from "zod";
import {ResultSchema,type Result} from "@claimlens/shared";
import {loadConfig,resolveConfig,type EngineConfig} from "./config";
import {createProviders} from "./providers";
import {createMockProviders} from "./mock";
import {createEngine,validateInput} from "./engine";
import {createScreenExtractor} from "./screen";
import {ServiceError} from "./errors";
import {JobQueue,TokenBucket} from "./queue";
import {Metrics} from "./metrics";
import {createStore,type Store} from "./store";
import {openApi} from "./openapi";
import type {Providers,EngineOptions} from "./types";
type AppOptions={config?:EngineConfig;providers?:Providers;transport?:Parameters<typeof createProviders>[1];analyze?:(body:unknown,options?:EngineOptions)=>Promise<Result>;testMode?:boolean;store?:Store};
type ApiRequest=Request&{requestId?:string};
export function createApp(options:AppOptions={}){
  const config=options.config?resolveConfig(options.config):loadConfig();if(options.testMode)config.demo=true;
  const providers=options.providers||(config.demo?createMockProviders():createProviders(config,options.transport)),engine=createEngine(config,providers),analyze=options.analyze||engine;
  const queue=new JobQueue(config.concurrency,config.queueSize),limiter=new TokenBucket(config.rateLimit),metrics=new Metrics(),controllers=new Set<AbortController>();
  let storeError=false;const storeReady=options.store?Promise.resolve(options.store):createStore(config).catch(error=>{storeError=true;throw error;});
  const app=express();app.disable("x-powered-by");app.set("trust proxy",config.vercel?1:false);
  app.use((req:ApiRequest,res,next)=>{
    req.requestId=randomUUID();const started=Date.now();res.set({"X-Request-Id":req.requestId,"X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"strict-origin-when-cross-origin","Permissions-Policy":"camera=(), microphone=(), geolocation=()"});
    if(config.production)res.set("Content-Security-Policy",`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ${config.allowedOrigins.join(" ")}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`);
    if(req.path.startsWith("/api")||["/health","/history","/analyze-claim"].includes(req.path))res.set("Cache-Control","no-store");
    res.on("finish",()=>{metrics.increment("claimlens_requests_total",`{status="${res.statusCode}"}`);if(!config.demo)console.log(JSON.stringify({event:"request_completed",requestId:req.requestId,status:res.statusCode,duration_ms:Date.now()-started}));});
    const origin=req.get("origin");if(origin){const own=`${req.protocol}://${req.get("host")}`,extension=origin.match(/^chrome-extension:\/\/([a-p]{32})$/);const allowedExtension=extension&&(config.allowedExtensionIds.includes(extension[1]!)||(!config.production&&["localhost","127.0.0.1"].includes(req.hostname)));
      if(origin!==own&&!allowedExtension&&!config.allowedOrigins.includes(origin))return next(new ServiceError(403,"ORIGIN_BLOCKED","Requests from this origin are not allowed."));res.set({"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"Content-Type, X-API-Key","Access-Control-Allow-Methods":"GET, POST, DELETE, OPTIONS"});res.vary("Origin");}
    if(req.method==="OPTIONS")return res.sendStatus(204);next();
  });
  app.use((req,res,next)=>{const screen=req.path.endsWith("extract-screen")||req.query.route==="extract-screen";express.json({limit:screen?"6mb":"16kb",strict:true})(req,res,next);});
  app.use((req,_res,next)=>{if(req.path==="/api"&&typeof req.query.route==="string"&&/^[a-z0-9/-]{1,50}$/.test(req.query.route))req.url=`/api/${req.query.route}`;next();});
  function admission(req:ApiRequest,res:Response,next:NextFunction){
    const clientKey=req.get("x-api-key");if(config.clientKeys.length&&!config.clientKeys.includes(clientKey||""))return next(new ServiceError(401,"API_KEY_REQUIRED","A valid client API key is required."));
    const ip=limiter.take(`ip:${req.ip}`);if(!ip.allowed){res.set("Retry-After",String(ip.retryAfter));return next(new ServiceError(429,"RATE_LIMITED","You have made several checks recently. Wait briefly before retrying."));}
    if(clientKey&&config.clientKeys.includes(clientKey)){const key=limiter.take(`key:${createHash("sha256").update(clientKey).digest("hex")}`);if(!key.allowed)return next(new ServiceError(429,"RATE_LIMITED","The client key limit has been reached."));}next();
  }
  function context(req:ApiRequest,res:Response){const controller=new AbortController();controllers.add(controller);const disconnect=()=>{if(!res.writableEnded)controller.abort();};res.on("close",disconnect);req.on("aborted",()=>controller.abort());const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(config.timeoutMs)]);return {signal,release:()=>{controllers.delete(controller);res.removeListener("close",disconnect);}};}
  const health=()=>({status:config.demo||config.geminiKey&&config.tavilyKey?"ready":"setup_required",configured:{evidence:config.demo||Boolean(config.tavilyKey),analysis:config.demo||Boolean(config.geminiKey),google:Boolean(config.googleKey),google_mode:config.googleEngineId?"web_search":"fact_check_index"},history:"browser",version:"1.0.0",test_mode:config.demo,persistence:config.persistenceEnabled});
  app.get(["/api/v1/health","/api/health","/health"],(_req,res)=>res.json(health()));
  app.get("/healthz",(_req,res)=>res.json({status:"alive"}));
  app.get("/readyz",(_req,res)=>{const ready=health().status==="ready"&&!storeError&&Object.values(providers.status?.()||{}).every(state=>state.state!=="open")&&(queue.state.active<config.concurrency||queue.state.queued<config.queueSize);res.status(ready?200:503).json({status:ready?"ready":"not_ready",capacity:queue.state});});
  app.get(["/api/v1/openapi.json","/openapi.json"],(_req,res)=>res.json(openApi()));
  app.get("/metrics",(_req,res)=>res.type("text/plain; version=0.0.4").send(metrics.render(queue.state)));
  app.get(["/api/history","/history"],(_req,res)=>res.json([]));
  async function check(req:ApiRequest,res:Response,next:NextFunction,stream=false){const ctx=context(req,res);try{const input=validateInput(req.body);if(stream){res.set({"Content-Type":"text/event-stream","Connection":"keep-alive","Cache-Control":"no-store","X-Accel-Buffering":"no"});res.flushHeaders();}
      const event=(name:string,value:unknown)=>{if(!res.destroyed)res.write(`event: ${name}\ndata: ${JSON.stringify(value)}\n\n`);};
      let result=await queue.run(()=>analyze(req.body,{signal:ctx.signal,onProgress:stream?progress=>event("stage",progress):undefined}),ctx.signal);ctx.signal.throwIfAborted();metrics.result(result);
      if(input.options.persist){const token=await(await storeReady).save(result);result={...result,permalink:`/shared/${token}`};}
      if(stream){event("result",result);res.end();}else res.json(result);
    }catch(error){metrics.increment("claimlens_check_errors_total");if(error instanceof ServiceError&&/^(PROVIDER_|CIRCUIT_)/.test(error.code))metrics.increment("claimlens_provider_errors_total",`{code="${error.code}"}`);if(ctx.signal.aborted&&res.destroyed)return;if(stream&&res.headersSent){const failure=error instanceof ServiceError?error:new ServiceError(502,"CHECK_FAILED","The check could not be completed.");res.write(`event: error\ndata: ${JSON.stringify({code:failure.code,message:failure.message,requestId:req.requestId})}\n\n`);res.end();}else next(error);}finally{ctx.release();}}
  app.post(["/api/v1/checks","/api/analyze-claim","/analyze-claim"],admission,(req,res,next)=>{void check(req,res,next);});
  app.post("/api/v1/checks/stream",admission,(req,res,next)=>{void check(req,res,next,true);});
  app.post("/api/v1/articles/claims",admission,async(req:ApiRequest,res,next)=>{const ctx=context(req,res);try{const input=z.object({pageUrl:z.string().max(2048)}).strict().parse(req.body);const claims=await queue.run(()=>engine.extractClaims(input.pageUrl,ctx.signal),ctx.signal);res.json({claims});}catch(error){next(error);}finally{ctx.release();}});
  app.post(["/api/v1/extract-screen","/api/extract-screen"],admission,async(req:ApiRequest,res,next)=>{const ctx=context(req,res);try{res.json(await queue.run(()=>createScreenExtractor(config,providers)(req.body,{signal:ctx.signal}),ctx.signal));}catch(error){next(error);}finally{ctx.release();}});
  app.get("/api/v1/shared/:token",async(req,res,next)=>{try{if(!/^[A-Za-z0-9_-]{32}$/.test(req.params.token))throw new ServiceError(404,"NOT_FOUND","This shared finding is unavailable.");const result=await(await storeReady).read(req.params.token);if(!result)throw new ServiceError(404,"NOT_FOUND","This shared finding is unavailable or expired.");res.json(ResultSchema.parse(result));}catch(error){next(error);}});
  const dist=path.resolve(__dirname,"../../web/dist");if(fs.existsSync(path.join(dist,"index.html"))&&!config.vercel){app.use(express.static(dist));app.get(["/","/shared/:token"],(_req,res)=>res.sendFile(path.join(dist,"index.html")));}
  app.use((_req,_res,next)=>next(new ServiceError(404,"NOT_FOUND","This endpoint does not exist.")));
  const errors:ErrorRequestHandler=(error:unknown,req:ApiRequest,res,_next)=>{if(res.headersSent)return;let failure=error;
    if(error&&typeof error==="object"&&"type"in error){if(error.type==="entity.parse.failed")failure=new ServiceError(400,"INVALID_JSON","Send a valid JSON request.");if(error.type==="entity.too.large")failure=new ServiceError(413,"INPUT_TOO_LARGE","This input is too large.");}
    if(error instanceof z.ZodError)failure=new ServiceError(400,"INVALID_INPUT","The request failed validation.");
    if(failure instanceof Error&&["AbortError","TimeoutError"].includes(failure.name))failure=new ServiceError(504,"CHECK_TIMEOUT","The check timed out or was cancelled.");
    const known=failure instanceof ServiceError?failure:new ServiceError(500,"INTERNAL_ERROR","The check could not be completed. Retry shortly.");res.status(known.status).json({code:known.code,message:known.message,requestId:req.requestId,error:known.code,request_id:req.requestId});};app.use(errors);
  app.locals.ready=storeReady;app.locals.shutdown=async()=>{for(const controller of controllers)controller.abort();await(await storeReady).close();};app.locals.queue=queue;return app;
}
