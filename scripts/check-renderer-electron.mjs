import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript(() => {
  window.zeus = {
    isDesktop: true,
    invoke: async (cmd) => {
      if (cmd === "window:setTitle") return;
      if (cmd === "list_threads") return [];
      if (cmd === "list_projects") return [];
      if (cmd === "list_local_models") return [];
      if (cmd === "get_settings") return { theme: "dark", language: "en", serverEnabled: false };
      return null;
    },
    onEvent: () => () => {},
  };
});

await page.goto("http://localhost:5173/", { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: "scripts/electron-ui-test.png", fullPage: true });
const text = await page.evaluate(() => document.body.innerText.slice(0, 200));
console.log("body text sample:", JSON.stringify(text));
await browser.close();
