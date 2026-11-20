import { useEffect, useState } from "react";
import { ChevronDown, Download, Puzzle, RefreshCw } from "lucide-react";
import {z} from "zod";
import type {Health} from "@claimlens/shared";
const ExtensionStatus=z.object({installed:z.boolean(),enabled:z.boolean(),apiUrl:z.string(),version:z.string()});
type Status=z.infer<typeof ExtensionStatus>;
type RequestType="get-status"|"set-enabled"|"connect";
function extensionRequest(type:RequestType, data:{enabled?:boolean;apiUrl?:string} = {}):Promise<Status> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timeout = setTimeout(() => { window.removeEventListener("message", receive); reject(new Error("Extension not detected. Install it, reload this page, then check again.")); }, 2500);
    function receive(event:MessageEvent<unknown>) {
      const parsed=z.object({channel:z.literal("CUDA_AI_EXTENSION"),id:z.string(),ok:z.boolean(),data:z.unknown().optional(),error:z.string().optional()}).safeParse(event.data);
      if (event.source !== window || event.origin !== window.location.origin || !parsed.success || parsed.data.id !== id) return;
      clearTimeout(timeout); window.removeEventListener("message", receive);
      const status=ExtensionStatus.safeParse(parsed.data.data);
      if (parsed.data.ok&&status.success) resolve(status.data);
      else reject(new Error(parsed.data.error || "The extension did not return a valid status."));
    }
    window.addEventListener("message", receive);
    window.postMessage({ channel: "CUDA_AI_WEBSITE", id, type, ...data }, window.location.origin);
  });
}
export default function Settings({ health }: {health:Health}) {
  const [extension, setExtension] = useState<Status|null>(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    extensionRequest("get-status").then(data => { if (active) setExtension(data); }).catch(() => {}).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);
  async function update(type:RequestType, data:{enabled?:boolean;apiUrl?:string}={}) {
    const previous = extension;
    if (type === "set-enabled"&&extension&&typeof data.enabled==="boolean") setExtension({ ...extension, enabled: data.enabled });
    setChecking(true); setNotice("");
    try { setExtension(await extensionRequest(type, data)); setNotice(type === "connect" ? "Extension connected to this backend." : type === "get-status" ? "Extension detected." : "Extension settings updated."); }
    catch (error) { if (type === "set-enabled") setExtension(previous); setNotice(error instanceof Error?error.message:"The extension could not be reached."); }
    finally { setChecking(false); }
  }
  return <section className="settings-view">
    <div className="section-label"><h1>SYSTEM_SETTINGS</h1><span>THIS_DEVICE</span></div>
    <div className="settings-card"><div className="settings-title"><Puzzle size={23} /><h2>Screen fact-checking extension</h2></div>
      <p>Capture a claim from the page you’re reading, review the text, and check its evidence. The installed extension works while this website is closed.</p>
      <div className="extension-install-actions"><a className="secondary-button" href="/claimlens-extension.zip" download><Download size={17} />Add extension · Download</a><span>Chrome & Edge</span></div>
      <details className="install-guide" open><summary>Installation instructions<span>5 steps · 2 min</span><ChevronDown size={16} /></summary><ol className="install-steps"><li><strong>Unzip</strong> the downloaded <code>claimlens-extension.zip</code> into a folder you will keep.</li><li>Open <code>chrome://extensions</code> in Chrome, or <code>edge://extensions</code> in Edge.</li><li>Turn on <strong>Developer mode</strong> in the top-right corner.</li><li>Click <strong>Load unpacked</strong> and choose the unzipped folder that contains <code>manifest.json</code>.</li><li>Reload this website, then click <strong>Connect extension to this website</strong> below and check that the status shows <strong>Installed</strong>.</li></ol><p className="view-description">Pin ClaimLens from the extensions menu to capture claims from any page. This ZIP is a development install; one-click installation needs a browser-store listing.</p></details>
      <div className="extension-connection"><span className={`extension-status ${extension ? "connected" : ""}`}><i className={`status-dot ${extension ? "good" : "idle"}`} />{checking ? "Checking extension…" : extension ? `Installed · v${extension.version}` : "Not installed or not detected"}</span><button className="text-button" disabled={checking} onClick={() => update("get-status")}><RefreshCw size={14} />Check connection</button></div>
      <label className="extension-toggle"><span><strong>Enable screen checking</strong><small>{extension ? "Your preference stays saved in the extension." : "Install the extension to enable screen checking."}</small></span><input type="checkbox" role="switch" checked={extension?.enabled || false} disabled={!extension || checking} onChange={event => update("set-enabled", { enabled: event.target.checked })} /></label>
      {extension && <><p className="view-description">Connected backend: <code>{extension.apiUrl}</code></p><button className="secondary-button" disabled={checking} onClick={() => update("connect", { apiUrl: window.location.origin })}>Connect extension to this website</button></>}
      {notice && <p className="notice" role="status">{notice}</p>}
    </div>
    <div className="settings-card"><h2>Verification providers</h2><p>Gemini reads screenshots and analyzes evidence. Tavily retrieves sources. {health.configured?.google ? `Google ${health.configured.google_mode === "web_search" ? "web search" : "fact-check index"} is configured as an additional evidence source.` : "Google evidence search is not configured on this backend."}</p><p className="view-description">The browser keeps the installed extension available. It captures only when you click, and a local backend must keep running. Screenshots are sent for reading only after you approve the preview; API keys remain on the server.</p></div>
  </section>;
}
