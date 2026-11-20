import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { createGunzip, createInflate } from "node:zlib";
import type { Readable } from "node:stream";
import { ServiceError } from "./errors";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export function publicUrl(value: unknown): string|null {
  if(typeof value!=="string"||value.length>2048)return null;
  try {const url=new URL(value);const host=url.hostname.toLowerCase().replace(/^\[|\]$/g,"");
    if(!["http:","https:"].includes(url.protocol)||url.username||url.password||(url.port&&!["80","443"].includes(url.port)))return null;
    if(isIP(host)||!host.includes(".")||/(^|\.)(localhost|local|internal|home|lan|test|invalid)$/.test(host)||!/^[a-z\d.-]+$/.test(host)||host.endsWith("."))return null;
    url.hash="";return url.href;
  }catch{return null;}
}
export function publicAddress(address:string):boolean {
  if(isIP(address)===4){const parts=address.split(".").map(Number);const a=parts[0]!,b=parts[1]!,c=parts[2]!;
    return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||(b===2)))||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));
  }
  if(isIP(address)===6){const lower=address.toLowerCase();if(lower.includes("."))return false;return /^[23][0-9a-f]{3}:/.test(lower)&&!lower.startsWith("2001:db8:")&&!lower.startsWith("2001:0:")&&!lower.startsWith("2002:");}
  return false;
}
export async function resolvePublic(url:URL,resolver:typeof lookup=lookup):Promise<{address:string;family:number}> {
  const addresses=await resolver(url.hostname,{all:true,verbatim:true});
  if(!addresses.length||addresses.some(item=>!publicAddress(item.address)))throw new ServiceError(400,"UNSAFE_URL","The article resolves to a restricted network address.");
  return addresses[0]!;
}
export async function fetchArticle(value:string,signal:AbortSignal,resolver:typeof lookup=lookup):Promise<string> {
  let current=value;
  for(let hop=0;hop<=3;hop++){
    signal.throwIfAborted();const safe=publicUrl(current);if(!safe)throw new ServiceError(400,"INVALID_URL","Use a public HTTP or HTTPS article URL.");
    const url=new URL(safe),address=await resolvePublic(url,resolver);
    const response=await new Promise<{redirect?:string;body?:string;type?:string}>((resolve,reject)=>{
      const request=(url.protocol==="https:"?https:http).request({hostname:address.address,family:address.family,port:url.port||(url.protocol==="https:"?443:80),path:url.pathname+url.search,method:"GET",servername:url.hostname,agent:false,signal,headers:{Host:url.host,"User-Agent":"ClaimLens/1.0 (+article verification)",Accept:"text/html,text/plain","Accept-Encoding":"identity"}},res=>{
        void(async()=>{
          if(res.statusCode&&res.statusCode>=300&&res.statusCode<400){res.resume();if(!res.headers.location)throw new ServiceError(422,"ARTICLE_UNREADABLE","The article redirect was incomplete.");resolve({redirect:new URL(res.headers.location,url).href});return;}
          if(res.statusCode!==200){res.resume();throw new ServiceError(422,"ARTICLE_UNREADABLE","This article could not be read. Paste a factual claim instead.");}
          const type=res.headers["content-type"]||"";if(!/^(text\/html|text\/plain)(;|$)/i.test(type)){res.destroy();throw new ServiceError(422,"ARTICLE_UNREADABLE","Only HTML and plain-text articles are supported.");}
          const declared=Number(res.headers["content-length"]||0);if(declared>2_000_000){res.destroy();throw new ServiceError(413,"ARTICLE_TOO_LARGE","Use a shorter article.");}
          let stream:Readable=res;const encoding=res.headers["content-encoding"];if(encoding==="gzip")stream=res.pipe(createGunzip());else if(encoding==="deflate")stream=res.pipe(createInflate());else if(encoding&&encoding!=="identity"){res.destroy();throw new ServiceError(422,"ARTICLE_UNREADABLE","The article uses an unsupported encoding.");}
          let received=0,raw=0;res.on("data",(chunk:Buffer)=>{raw+=chunk.length;if(raw>2_000_000)res.destroy(new ServiceError(413,"ARTICLE_TOO_LARGE","Use a shorter article."));});
          const chunks:Buffer[]=[];for await(const chunk of stream){signal.throwIfAborted();const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk as string);received+=bytes.length;if(received>2_000_000){stream.destroy();res.destroy();throw new ServiceError(413,"ARTICLE_TOO_LARGE","Use a shorter article.");}chunks.push(bytes);}
          resolve({body:Buffer.concat(chunks).toString("utf8"),type});
        })().catch(reject);
      });request.on("error",reject);request.end();
    });
    if(response.redirect){current=response.redirect;continue;}
    const body=response.body||"";if(response.type?.startsWith("text/plain"))return body.slice(0,20000);
    const dom=new JSDOM(body,{url:safe});try{const article=new Readability(dom.window.document).parse();const text=article?.textContent?.trim()||"";if(text.length<30)throw new ServiceError(422,"ARTICLE_UNREADABLE","No article body was found. Paste a factual claim instead.");return text.slice(0,20000);}finally{dom.window.close();}
  }
  throw new ServiceError(422,"ARTICLE_REDIRECTS","The article redirected too many times.");
}
