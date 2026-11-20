import {defineConfig} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const baseURL=process.env.E2E_BASE_URL||"http://127.0.0.1:18089";
const localBrowser=path.resolve(__dirname,"../browsers/chromium-1234/chrome-win64/chrome.exe");
const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||(fs.existsSync(localBrowser)?localBrowser:undefined);
export default defineConfig({
  testDir:"tests/e2e",timeout:30000,fullyParallel:false,workers:1,
  reporter:[["list"],["json",{outputFile:"test-results/browser-results.json"}]],
  use:{baseURL,viewport:{width:1440,height:900},reducedMotion:"reduce",trace:"retain-on-failure",screenshot:"only-on-failure",launchOptions:{executablePath}},
  webServer:{command:"node scripts/demo.cjs",url:baseURL+"/api/v1/health",reuseExistingServer:!process.env.CI,timeout:30000},
});
