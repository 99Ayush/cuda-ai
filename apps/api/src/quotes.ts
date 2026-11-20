import { normalizeText } from "./sources";
export type QuoteMatch={valid:boolean;kind:"exact"|"fuzzy";score:number};
function distance(a:string,b:string):number{let previous=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]!+1,previous[j]!+1,previous[j-1]!+(a[i-1]===b[j-1]?0:1));previous=row;}return previous[b.length]!;}
export function matchQuote(content:string,quote:string,threshold=0.97):QuoteMatch {
  const haystack=normalizeText(content),needle=normalizeText(quote);
  if(needle.length<15||needle.length>600)return {valid:false,kind:"exact",score:0};
  if(haystack.includes(needle))return {valid:true,kind:"exact",score:1};
  const sensitive=(text:string)=>(text.match(/\b(not|never|no|without|always|every|none)\b|\d+(?:\.\d+)?/g)||[]).sort().join("|");
  let best=0;for(const candidate of haystack.match(/[^.!?]+[.!?]?/g)||[]){const cleaned=candidate.trim();if(Math.abs(cleaned.length-needle.length)>Math.ceil(needle.length*(1-threshold)))continue;if(sensitive(cleaned)!==sensitive(needle))continue;best=Math.max(best,1-distance(cleaned,needle)/Math.max(cleaned.length,needle.length));}
  // Fuzzy matches are flagged for review; they never establish a definitive verdict.
  return {valid:best>=threshold,kind:"fuzzy",score:best};
}
