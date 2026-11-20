# ClaimLens Screen Fact Checker

1. Download the ZIP from the website’s Settings and extract it.
2. Open chrome://extensions or edge://extensions, enable Developer mode, and choose Load unpacked. Select the extracted folder containing manifest.json.
3. Pin ClaimLens to the browser toolbar. Click its icon while viewing a normal web page to open the side panel.
4. Capture screen, review the preview, then click Read claims from screenshot. Review or edit the extracted claim and click Verify claim.
5. You can also select text on the page and click Use selected text, or right-click it and choose Verify selected claim with ClaimLens.

The installed extension remains available when the website tab closes. It uses the backend directly. Manifest V3 workers sleep when idle and wake on interaction; no continuous screen monitoring runs. Keep Chrome or Edge running. Firefox and Safari are not supported by this package.

In panel Settings, use your deployed HTTPS backend URL. For development, enter http://localhost:18082 and keep the backend running. The default is https://cuda-ai.vercel.app. Provider keys are never included. Google web search requires GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID; with the key alone the backend uses Google’s Fact Check Tools index if that API is enabled.

Enable screen checking is a persistent switch. Reload the website after installation, then use website Settings to connect this backend or toggle the extension. The bridge supports the default deployment and localhost. For custom deployments add your origin to content_scripts.matches and host_permissions in manifest.json before installation.

Captures include the visible web-page viewport, not the desktop or other applications. Protected browser pages cannot be captured. Screenshots stay in panel memory until you explicitly send them to Gemini for reading and are never saved in history. Up to 20 text reports stay in extension-local storage; clear them in Settings. This checks claims against evidence, not image authenticity or deepfakes.

This is a development distribution. Public one-click installation requires publishing in Chrome Web Store or Edge Add-ons and replacing the website download link with an approved store listing.
