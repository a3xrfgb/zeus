import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://localhost:5173/", { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForTimeout(5000);
const info = await page.evaluate(() => {
  const root = document.getElementById("root");
  const first = root?.firstElementChild;
  const sidebar = document.querySelector("aside");
  return {
    rootChildren: root?.childElementCount,
    firstClass: first?.className?.slice(0, 80),
    firstRect: first ? first.getBoundingClientRect() : null,
    sidebarText: sidebar?.textContent?.slice(0, 100),
    sidebarDisplay: sidebar ? getComputedStyle(sidebar).display : null,
    appBg: getComputedStyle(document.documentElement).getPropertyValue("--app-bg"),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    htmlDark: document.documentElement.classList.contains("dark"),
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: "scripts/ui-debug.png", fullPage: true });
await browser.close();
