import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
const notFound = [];
page.on("requestfailed", (r) => notFound.push(r.url()));
page.on("response", (r) => {
  if (r.status() >= 400) notFound.push(r.status() + " " + r.url());
});
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 200)));
await page.setViewport({ width: 1600, height: 1000 });
await page.goto("http://localhost:5199/dashboard/login", { waitUntil: "domcontentloaded" });
await new Promise((r) => setTimeout(r, 1800));
await page.type('input[autocomplete="username"]', "lea");
await page.type('input[autocomplete="current-password"]', "demo");
await page.click('button[type="submit"]');
await new Promise((r) => setTimeout(r, 9000));

// Open each select in isolation and measure the menu against ITS OWN trigger.
for (let i = 0; i < 4; i += 1) {
  const res = await page.evaluate(async (n) => {
    const trig = document.querySelectorAll(".glide-select__trigger")[n];
    const r = trig.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    trig.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1 }));
    await new Promise((res2) => setTimeout(res2, 500));
    const menu = document.querySelector(".glide-select__menu");
    if (!menu) return { index: n, opened: false, trigY: Math.round(r.y) };
    const m = menu.getBoundingClientRect();
    const gap =
      menu.dataset.side === "bottom" ? m.top - r.bottom : r.top - m.bottom;
    return {
      index: n,
      opened: true,
      side: menu.dataset.side,
      leftAligned: Math.abs(m.left - r.left) < 2,
      leftDelta: Math.round(m.left - r.left),
      gap: Math.round(gap),
      widthMatch: Math.round(m.width) === Math.round(r.width),
      inViewport: m.top >= 0 && m.bottom <= innerHeight,
      options: menu.querySelectorAll(".glide-select__option").length,
      label: trig.querySelector(".glide-select__label").textContent.trim(),
    };
  }, i);
  console.log("select", i, JSON.stringify(res));
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 450));
}

console.log("4xx/failed requests:", notFound.length ? [...new Set(notFound)] : "none");
await browser.close();
