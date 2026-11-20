import type { Stage } from "@claimlens/shared";
export type SearchResult = { url: string; title?: string; content: string; published_date?: string; provider?: string };
export type SearchResults = SearchResult[] & { warnings?: string[] };
export type JsonSchema = Record<string,unknown>;
export type Usage = { search_calls:number;llm_calls:number;input_tokens:number;output_tokens:number;estimated_cost_usd:number|null };
export interface Providers {
  search(query:string,excludeDomains:string[],signal:AbortSignal):Promise<SearchResults>;
  extract(url:string,signal:AbortSignal):Promise<string>;
  generate(task:string,data:unknown,schema:JsonSchema,signal:AbortSignal,image?:{mimeType:string;data:string}):Promise<unknown>;
  usage?(signal?:AbortSignal):Usage;
  status?():Record<string,{state:string;failures:number}>;
}
export type EngineOptions={signal?:AbortSignal;onProgress?:(event:{stage:Stage;detail:string;elapsed_ms:number})=>void;now?:()=>number};
