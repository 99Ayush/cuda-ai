import { useEffect, useState } from "react";
import { ChevronDown, Download, Puzzle, RefreshCw, Shield, Globe2, Sparkles } from "lucide-react";
import { z } from "zod";
import type { Health } from "@claimlens/shared";
import type { Appearance } from "./hooks/feedback";
import { evidenceProviders } from "./provider-catalog";
const ExtensionStatus = z.object({
  installed: z.boolean(),
  version: z.string(),
});
type Status = z.infer<typeof ExtensionStatus>;
function extensionRequest(): Promise<Status> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timeout = setTimeout(() => {
      window.removeEventListener("message", receive);
      reject(new Error("Extension not detected. Install it, reload this page, then check again."));
    }, 2500);
    function receive(event: MessageEvent<unknown>) {
      const parsed = z
        .object({
          channel: z.literal("CUDA_AI_EXTENSION"),
          id: z.string(),
          ok: z.boolean(),
          data: z.unknown().optional(),
          error: z.string().optional(),
        })
        .safeParse(event.data);
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        !parsed.success ||
        parsed.data.id !== id
      )
        return;
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
      const status = ExtensionStatus.safeParse(parsed.data.data);
      if (parsed.data.ok && status.success) resolve(status.data);
      else reject(new Error(parsed.data.error || "The extension did not return a valid status."));
    }
    window.addEventListener("message", receive);
    window.postMessage(
      { channel: "CUDA_AI_WEBSITE", id, type: "get-status" },
      window.location.origin,
    );
  });
}
export default function Settings({
  health,
  appearance,
  onAppearanceChange,
}: {
  health: Health;
  appearance: Appearance;
  onAppearanceChange: (value: Appearance) => void;
}) {
  const [extension, setExtension] = useState<Status | null>(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    extensionRequest()
      .then((data) => {
        if (active) setExtension(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function checkConnection() {
    setChecking(true);
    setNotice("");
    try {
      setExtension(await extensionRequest());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The extension could not be reached.");
    } finally {
      setChecking(false);
    }
  }
  return (
    <section className="settings-view">
      <div className="page-heading">
        <h1>Settings</h1>
        <p>Your browser, connected.</p>
      </div>
      <div className="settings-card">
        <div className="settings-title">
          <span className="settings-feature-icon">
            <Puzzle size={25} />
          </span>
          <h2>Take Verity with you</h2>
        </div>
        <p>Check a claim on the page you’re reading, without switching tabs.</p>
        <div className="extension-install-actions">
          <a className="secondary-button" href="/verity-extension.zip" download>
            <Download size={17} />
            Download extension
          </a>
          <span>Chrome & Edge</span>
        </div>
        <details className="install-guide">
          <summary>
            How to install
            <ChevronDown size={16} />
          </summary>
          <ol className="install-steps">
            <li>
              <strong>Unzip</strong> the downloaded <code>verity-extension.zip</code> into a folder
              you will keep.
            </li>
            <li>
              Open <code>chrome://extensions</code> in Chrome, or <code>edge://extensions</code> in
              Edge.
            </li>
            <li>
              Turn on <strong>Developer mode</strong> in the top-right corner.
            </li>
            <li>
              Click <strong>Load unpacked</strong> and choose the unzipped folder that contains{" "}
              <code>manifest.json</code>.
            </li>
          </ol>
          <p className="view-description">
            Pin Verity from the extensions menu to capture claims from any page. This ZIP is a
            development install; one-click installation needs a browser-store listing.
          </p>
        </details>
        <div className="extension-connection">
          <span className={`extension-status ${extension ? "connected" : ""}`}>
            <i className={`status-dot ${extension ? "good" : "idle"}`} />
            {checking
              ? "Checking extension…"
              : extension
                ? `Installed · v${extension.version}`
                : "Not connected"}
          </span>
          <button
            className="text-button"
            disabled={checking}
            onClick={() => void checkConnection()}
          >
            <RefreshCw size={14} />
            Check connection
          </button>
        </div>
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
      </div>
      <div className="settings-secondary-grid">
        <div className="settings-card appearance-card">
          <div className="settings-title">
            <h2>Appearance</h2>
          </div>
          <label htmlFor="appearance">Colour preference</label>
          <select
            id="appearance"
            value={appearance}
            onChange={(event) => onAppearanceChange(event.target.value as Appearance)}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">Follow system</option>
          </select>
          <p>Dark is the default. System follows your device setting.</p>
        </div>
        <div className="settings-card provider-card">
          <div className="settings-title">
            <Globe2 size={20} />
            <h2>Evidence providers</h2>
          </div>
          {evidenceProviders(health).map((provider) => (
            <div className="provider-row" key={provider.name}>
              <span className="provider-description">
                <strong>{provider.name}</strong>
                <small>{provider.detail}</small>
              </span>
              <span className={`provider-state ${provider.enabled ? "connected" : ""}`}>
                {provider.enabled ? "Enabled" : provider.missing}
              </span>
            </div>
          ))}
          <div className="analysis-provider">
            <Sparkles size={16} />
            <span>Analysis · Gemini</span>
            <span className={`provider-state ${health.configured?.analysis ? "connected" : ""}`}>
              {health.configured?.analysis ? "Configured" : "Key needed"}
            </span>
          </div>
        </div>
        <div className="settings-card privacy-card">
          <div className="settings-title">
            <Shield size={20} />
            <h2>Private by default</h2>
          </div>
          <p>
            History stays on this device. Selecting an area in the extension sends that crop to
            Gemini for reading and checking.
          </p>
          <span className="privacy-footnote">Provider keys stay on the server.</span>
        </div>
      </div>
    </section>
  );
}
