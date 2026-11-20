import { validResult as sharedValidResult } from "@claimlens/shared";
export const HISTORY_KEY="claimlens-checks-v1";
const LEGACY_HISTORY_KEY="cuda-ai-checks-v3";
export function validResult(value){return sharedValidResult(value);}
function normalized(history){const seen=new Set();return history.filter(row=>{if(!validResult(row)||seen.has(row.id))return false;seen.add(row.id);return true;}).slice(0,50);}
function defaultStorage(){try{return window.localStorage;}catch{return null;}}
export function readHistory(storage=defaultStorage()){try{const data=JSON.parse(storage?.getItem(HISTORY_KEY)??storage?.getItem(LEGACY_HISTORY_KEY)??"[]");return Array.isArray(data)?normalized(data):[];}catch{return [];}}
export function saveHistory(history,storage=defaultStorage()){try{if(!storage)return false;storage.setItem(HISTORY_KEY,JSON.stringify(normalized(history)));return true;}catch{return false;}}
export function downloadJson(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));const link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
