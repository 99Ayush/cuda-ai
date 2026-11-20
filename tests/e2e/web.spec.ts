import {test,expect} from "@playwright/test";
test.beforeEach(async({page})=>{await page.goto("/");await expect(page.getByRole("status").filter({hasText:"TEST_MODE"})).toBeVisible();});
test("streamed finding, citations, private history and statistics",async({page})=>{
  await page.getByLabel("Claim or article URL",{exact:true}).fill("Lightning never strikes the same place twice.");await page.getByRole("button",{name:"Check",exact:true}).click();
  await expect(page.getByRole("article",{name:"Fact-check result"})).toContainText("Refuted");await expect(page.getByRole("article",{name:"Fact-check result"})).toContainText("simulated");
  await expect(page.locator(".source-cited")).toHaveCount(2);await expect(page.locator("#result-title")).toBeFocused();
  await page.getByRole("button",{name:"Check history",exact:true}).click();await expect(page.locator(".history-row")).toHaveCount(1);await page.reload();await page.getByRole("button",{name:"Check history",exact:true}).click();await expect(page.locator(".history-row")).toHaveCount(1);
  await page.getByRole("button",{name:"Your statistics",exact:true}).click();await expect(page.locator(".statistics-summary")).toContainText("TOTAL_SCANS 1");
});
test("cancel aborts the stream and preserves input",async({page})=>{
  const field=page.getByLabel("Claim or article URL",{exact:true});await field.fill("slow check for this claim about lightning");await page.getByRole("button",{name:"Check",exact:true}).click();await expect(page.getByRole("button",{name:"Cancel check",exact:true})).toBeVisible();await page.getByRole("button",{name:"Cancel check",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"Check cancelled"})).toBeVisible();await expect(field).toHaveValue("slow check for this claim about lightning");
});
test("provider failure is actionable and can recover",async({page})=>{
  const field=page.getByLabel("Claim or article URL",{exact:true});await field.fill("provider quota for this claim about lightning");await page.getByRole("button",{name:"Check",exact:true}).click();await expect(page.getByRole("alert")).toContainText("quota");await field.fill("Lightning never strikes the same place twice.");await page.getByRole("button",{name:"Check",exact:true}).click();await expect(page.getByRole("article",{name:"Fact-check result"})).toBeVisible();
});
test("article extraction lets the user choose claims",async({page})=>{
  await page.getByLabel("Claim or article URL",{exact:true}).fill("https://example.org/article");await page.getByRole("button",{name:"Choose article claims",exact:true}).click();const choice=page.getByRole("checkbox").first();await expect(choice).toBeChecked();await choice.uncheck();await expect(page.getByRole("button",{name:"Check",exact:true})).toBeDisabled();await choice.check();await page.getByRole("button",{name:"Check",exact:true}).click();await expect(page.getByRole("article",{name:"Fact-check result"})).toContainText("selected atomic claims");
});
test("history filters and JSON/CSV export/import preserve reports",async({page},info)=>{
  await page.getByLabel("Claim or article URL",{exact:true}).fill("Lightning never strikes the same place twice.");await page.getByRole("button",{name:"Check",exact:true}).click();await expect(page.getByRole("article",{name:"Fact-check result"})).toBeVisible();await page.getByRole("button",{name:"Check history",exact:true}).click();
  await page.getByRole("combobox",{name:"Filter history by verdict"}).selectOption("TRUE");await expect(page.getByText("No matching checks",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Clear search",exact:true}).click();await expect(page.locator(".history-row")).toHaveCount(1);
  for(const name of ["Export JSON","Export CSV"]){const [download]=await Promise.all([page.waitForEvent("download"),page.getByRole("button",{name,exact:true}).click()]);const file=info.outputPath(download.suggestedFilename());await download.saveAs(file);await page.getByRole("button",{name:"Clear history",exact:true}).click();await page.getByLabel("Import history file").setInputFiles(file);await expect(page.locator(".history-row")).toHaveCount(1);}
});
test("keyboard commands, themes and dialogs work",async({page})=>{
  await page.keyboard.press("Control+k");await expect(page.getByLabel("Claim or article URL",{exact:true})).toBeFocused();await page.keyboard.press("Control+Shift+p");await expect(page.getByRole("dialog")).toBeVisible();await page.keyboard.press("Escape");await page.getByRole("button",{name:"Switch to light theme",exact:true}).click();await expect(page.locator("html")).toHaveAttribute("data-theme","light");await page.getByRole("button",{name:"Switch to dark theme",exact:true}).click();await page.getByRole("button",{name:"Privacy and security",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();await page.keyboard.press("Escape");
});
test("every view fits desktop, mobile and landscape without runtime errors",async({page},info)=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  for(const [width,height]of [[1440,900],[390,844],[360,800],[844,390]]){await page.setViewportSize({width:width!,height:height!});for(const name of ["Investigate","Settings","Your statistics","Check history"]){await page.getByRole("button",{name,exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.locator("main").evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);}const privacy=page.getByRole("button",{name:"Privacy and security",exact:true});await privacy.scrollIntoViewIfNeeded();const bounds=await privacy.boundingBox();expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(height!);}
  await page.setViewportSize({width:1440,height:900});await page.getByRole("button",{name:"Investigate",exact:true}).click();await page.screenshot({path:info.outputPath("claimlens-desktop.png")});expect(errors).toEqual([]);
});
