import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
await page.goto("http://localhost:5199/dashboard/login", { waitUntil: "domcontentloaded" });
await new Promise((r) => setTimeout(r, 1800));
await page.type('input[autocomplete="username"]', "lea");
await page.type('input[autocomplete="current-password"]', "demo");
await page.click('button[type="submit"]');
await new Promise((r) => setTimeout(r, 9000));

const closed = await page.evaluate(() => {
  const t = document.querySelector(".glide-select__trigger");
  const cs = getComputedStyle(t);
  const r = t.getBoundingClientRect();
  return {
    height: Math.round(r.height),
    width: Math.round(r.width),
    radius: cs.borderRadius,
    fontSize: cs.fontSize,
    background: cs.backgroundColor,
    labelOverflow: getComputedStyle(t.querySelector(".glide-select__label")).textOverflow,
  };
});
console.log("trigger (closed):", JSON.stringify(closed));

await page.evaluate(() => {
  const t = document.querySelectorAll(".glide-select__trigger")[0];
  t.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1 }));
});
await new Promise((r) => setTimeout(r, 500));

const open = await page.evaluate(() => {
  const menu = document.querySelector(".glide-select__menu");
  const opts = [...menu.querySelectorAll(".glide-select__option")];
  const sel = opts.find((o) => o.getAttribute("aria-selected") === "true");
  const pill = menu.querySelector(".glide-select__pill");
  const rowH = opts[0].getBoundingClientRect().height;
  const pillBox = pill.getBoundingClientRect();
  const selBox = sel.getBoundingClientRect();
  return {
    rowHeight: Math.round(rowH),
    pillOpacity: getComputedStyle(pill).opacity,
    pillOnSelectedRow: Math.abs(pillBox.top - selBox.top) < 1.5,
    selectedLabel: sel.querySelector(".glide-select__name").textContent,
    tickVisible: getComputedStyle(sel.querySelector(".glide-select__check")).visibility,
    menuBg: getComputedStyle(menu).backgroundColor,
    widestOptionClipped: opts.some((o) => o.scrollWidth > o.clientWidth + 1),
  };
});
console.log("menu (open):", JSON.stringify(open));
await browser.close();
