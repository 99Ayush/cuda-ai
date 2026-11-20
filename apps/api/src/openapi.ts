import {z} from "zod";
import {CheckInputSchema,ResultSchema,ApiErrorSchema,HealthSchema,ScreenSchema} from "@claimlens/shared";
const json=(schema:z.ZodType)=>({"application/json":{schema:z.toJSONSchema(schema,{target:"openapi-3.0"})}});
export function openApi(){return {
  openapi:"3.0.3",info:{title:"ClaimLens API",version:"1.0.0",description:"Local-first evidence verification. Persistence is explicit opt-in; results are AI-assisted."},servers:[{url:"/"}],
  paths:{
    "/api/v1/checks":{post:{operationId:"verify",requestBody:{required:true,content:json(CheckInputSchema)},responses:{"200":{description:"Validated finding",content:json(ResultSchema)},"400":{description:"Invalid input",content:json(ApiErrorSchema)},"429":{description:"Rate or spend limit",content:json(ApiErrorSchema)},"503":{description:"Provider or queue unavailable",content:json(ApiErrorSchema)}}}},
    "/api/v1/checks/stream":{post:{operationId:"verifyStream",requestBody:{required:true,content:json(CheckInputSchema)},responses:{"200":{description:"SSE stage, result and error events. Disconnecting cancels provider work.",content:{"text/event-stream":{schema:{type:"string"}}}}}}},
    "/api/v1/articles/claims":{post:{operationId:"extractArticleClaims",requestBody:{required:true,content:json(z.object({pageUrl:z.string().max(2048)}).strict())},responses:{"200":{description:"Atomic article claims",content:json(z.object({claims:z.array(z.string()).max(3)}))}}}},
    "/api/v1/extract-screen":{post:{operationId:"extractVisibleClaims",requestBody:{required:true,content:json(z.object({image:z.string().max(4194330)}).strict())},responses:{"200":{description:"Editable visible text and claims",content:json(ScreenSchema)}}}},
    "/api/v1/shared/{token}":{get:{operationId:"readSharedFinding",parameters:[{name:"token",in:"path",required:true,schema:{type:"string"}}],responses:{"200":{description:"Explicitly shared read-only finding",content:json(ResultSchema)},"404":{description:"Expired or unknown share",content:json(ApiErrorSchema)}}}},
    "/api/v1/health":{get:{operationId:"configurationHealth",responses:{"200":{description:"Configuration presence and demo status",content:json(HealthSchema)}}}},
    "/healthz":{get:{operationId:"liveness",responses:{"200":{description:"Process is serving requests"}}}},
    "/readyz":{get:{operationId:"readiness",responses:{"200":{description:"Configured dependencies and admission capacity available"},"503":{description:"Not ready"}}}},
    "/metrics":{get:{operationId:"metrics",responses:{"200":{description:"Prometheus stage histograms and bounded counters"}}}},
  },
};}
