# Verity Screen Fact Checker

1. Download the ZIP from the website’s Settings and extract it.
2. Open chrome://extensions or edge://extensions, enable Developer mode, and choose Load unpacked. Select the extracted folder containing manifest.json.
3. Pin Verity to the browser toolbar. Click its icon while viewing a normal web page to open the side panel.
4. Click **Search on screen**, drag over the claim, and release the mouse. The selected area appears in the panel, its claim is extracted into the field, and verification starts automatically. No screenshot shortcut or separate reading step is required. Click **Cancel** on the selection overlay to stop.
5. You can also select text on the page and click Use selected text to check it automatically, or right-click it and choose Verify selected claim with Verity to start checking in that window.

The installed extension remains available when the website tab closes. It uses the backend directly. Manifest V3 workers sleep when idle and wake on interaction; no continuous screen monitoring runs. Keep Chrome or Edge running. Firefox and Safari are not supported by this package.

The Preferences section has been removed. The backend defaults to http://localhost:8080 and preserves an existing saved connection. Keep that backend running. Provider credentials stay on the backend; the extension receives only extracted claims and validated reports. When several claims are visible, the first is checked automatically and the others can be selected for another check.

Screen checking runs only when requested. A previously disabled preference cannot block the new capture action. The bridge supports the default deployment and localhost. Custom deployments must be included in content_scripts.matches and host_permissions before installation.

Captures contain only the selected area of the visible web page. Browser settings, extension stores, and protected browser pages cannot be captured. If you navigate to a new site while the panel stays open, click the Verity toolbar icon on that site before searching. This grants temporary access to that page; the extension does not request access to every site. The tabs permission identifies the active page in the panel’s own browser window. Selected text includes text fields and accessible frames; password fields are excluded. Releasing a selection sends that crop to Gemini for reading and starts a check. Screenshots are never saved in history; up to 20 text reports stay in extension-local storage. Removing the extension deletes its saved reports. This checks factual claims, not image authenticity or deepfakes.

This is a development distribution. Public one-click installation requires publishing in Chrome Web Store or Edge Add-ons and replacing the website download link with an approved store listing.
