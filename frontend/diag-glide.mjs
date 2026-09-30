import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
page.on("console", (m) => {
  if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160));
});
await page.setViewport({ width: 1600, height: 1000 });
await page.goto("http://localhost:5199/dashboard/login", { waitUntil: "domcontentloaded" });
await new Promise((r) => setTimeout(r, 1800));
await page.type('input[autocomplete="username"]', "lea");
await page.type('input[autocomplete="current-password"]', "demo");
await page.click('button[type="submit"]');
await new Promise((r) => setTimeout(r, 9000));

const roots = () => page.$$(".glide-select");
const triggers = () => page.$$(".glide-select__trigger");
const nRoots = (await roots()).length;
console.log("selects found:", nRoots);

const geom = () =>
  page.evaluate(() => {
    const menu = document.querySelector(".glide-select__menu");
    const trig = document.querySelector(".glide-select__trigger");
    if (!menu || !trig) return { open: false };
    const m = menu.getBoundingClientRect();
    const t = trig.getBoundingClientRect();
    // The panel that would clip an in-flow overlay, for reference.
    const panel = document.querySelector(".panel-glass")?.getBoundingClientRect();
    return {
      open: true,
      side: menu.dataset.side,
      alignedToTrigger: Math.abs(m.left - t.left) < 2,
      belowTrigger: Math.round(m.top - t.bottom),
      menuW: Math.round(m.width),
      triggerW: Math.round(t.width),
      options: menu.querySelectorAll(".glide-select__option").length,
      pillOpacity: getComputedStyle(menu.querySelector(".glide-select__pill")).opacity,
      pillTransform: menu.querySelector(".glide-select__pill").style.transform,
      escapesPanel: panel ? m.bottom > panel.bottom || m.top < panel.top : null,
      fullyInViewport: m.top >= 0 && m.bottom <= innerHeight && m.left >= 0 && m.right <= innerWidth,
      firstOption: menu.querySelector(".glide-select__option .glide-select__name")?.textContent,
    };
  });

const label = (i) =>
  page.evaluate((n) => {
    const t = document.querySelectorAll(".glide-select__trigger")[n];
    return t?.querySelector(".glide-select__label")?.textContent?.trim() ?? null;
  }, i);

// 1. Mouse open
await (await triggers())[1].click();
await new Promise((r) => setTimeout(r, 500));
console.log("1 mouse open:", JSON.stringify(await geom()));

// 2. Keyboard: arrow down moves the pill
await page.keyboard.press("ArrowDown");
await new Promise((r) => setTimeout(r, 350));
const afterArrow = await geom();
console.log("2 arrowdown pill:", afterArrow.pillTransform, "opacity", afterArrow.pillOpacity);

// 3. Typeahead
await page.keyboard.press("k");
await new Promise((r) => setTimeout(r, 350));
console.log("3 typeahead 'k' pill:", (await geom()).pillTransform);

// 4. Enter picks
const before = await label(1);
await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 600));
const after = await label(1);
console.log("4 enter pick:", JSON.stringify({ before, after, changed: before !== after }));

// 5. Reopen + Escape
await (await triggers())[2].click();
await new Promise((r) => setTimeout(r, 450));
const opened = (await geom()).open;
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 500));
console.log("5 escape closes:", JSON.stringify({ opened, stillOpen: (await geom()).open }));

// 6. Outside click closes
await (await triggers())[3].click();
await new Promise((r) => setTimeout(r, 450));
const opened2 = (await geom()).open;
await page.mouse.click(20, 500);
await new Promise((r) => setTimeout(r, 500));
console.log("6 outside click closes:", JSON.stringify({ opened2, stillOpen: (await geom()).open }));

// 7. Scrub: press down on row 1, drag to row 3, release
const box = await page.evaluate(() => {
  const t = document.querySelectorAll(".glide-select__trigger")[0];
  const b = t.getBoundingClientRect();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
});
await page.mouse.click(box.x, box.y);
await new Promise((r) => setTimeout(r, 450));
const scrub = await page.evaluate(() => {
  const list = document.querySelector(".glide-select__list");
  const opts = [...list.querySelectorAll(".glide-select__option")];
  const lb = list.getBoundingClientRect();
  const ob = opts[opts.length - 1].getBoundingClientRect();
  return { startX: lb.x + lb.width / 2, y1: lb.y + 8, yLast: ob.y + ob.height / 2 };
});
await page.mouse.move(scrub.startX, scrub.y1);
await page.mouse.down();
await new Promise((r) => setTimeout(r, 120));
await page.mouse.move(scrub.startX, scrub.yLast, { steps: 12 });
await new Promise((r) => setTimeout(r, 200));
const scrubbed = await label(0);
await page.mouse.up();
await new Promise((r) => setTimeout(r, 600));
console.log("7 scrub to last row:", JSON.stringify({ picked: scrubbed, labelNow: await label(0) }));

// 8. Menu follows on scroll (fixed positioning)
await (await triggers())[0].click();
await new Promise((r) => setTimeout(r, 450));
const preScroll = await page.evaluate(() => document.querySelector(".glide-select__menu").getBoundingClientRect().top);
await page.evaluate(() => window.scrollBy(0, 120));
await new Promise((r) => setTimeout(r, 500));
const postScroll = await page.evaluate(() => {
  const m = document.querySelector(".glide-select__menu");
  const t = document.querySelector(".glide-select__trigger");
  if (!m || !t) return null;
  return { gap: Math.round(m.getBoundingClientRect().top - t.getBoundingClientRect().bottom), menuTop: Math.round(m.getBoundingClientRect().top) };
});
console.log("8 follows scroll:", JSON.stringify({ preScroll: Math.round(preScroll), postScroll }));

await page.keyboard.press("Escape");
console.log("ERRORS:", errs.length ? [...new Set(errs)] : "none");
await browser.close();
