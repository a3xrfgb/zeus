import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}\n${e.stack?.slice(0, 800)}`));
page.on("requestfailed", (r) => logs.push(`[fail] ${r.url()} ${r.failure()?.errorText}`));

await page.goto("http://localhost:5173/", { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForTimeout(8000);

const rootChildren = await page.evaluate(() => document.getElementById("root")?.childElementCount ?? -1);
console.log("root children:", rootChildren);
for (const line of logs.slice(-40)) console.log(line);

await browser.close();
