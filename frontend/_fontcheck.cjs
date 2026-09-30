const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  const failed = [];
  page.on("requestfailed", (r) => failed.push(`${r.failure().errorText} ${r.url().slice(0, 90)}`));

  await page.goto("http://localhost:4173/login", { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2500));

  const info = await page.evaluate(async () => {
    await document.fonts.ready;
    const loaded = [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`);
    // Measure the same string in the target family vs a known fallback.
    const span = document.createElement("span");
    span.style.cssText = "position:absolute;visibility:hidden;font-size:64px;white-space:nowrap";
    document.body.appendChild(span);
    const measure = (family) => {
      span.style.fontFamily = family;
      span.textContent = "Ranked cash-out candidates 0123";
      return span.getBoundingClientRect().width;
    };
    const interTight = measure('"Inter Tight", "Inter", system-ui, sans-serif');
    const interOnly = measure('"Inter Tight"');
    const systemUi = measure("system-ui");
    const jbMono = measure('"JetBrains Mono", monospace');
    const monoOnly = measure('"JetBrains Mono"');
    const genericMono = measure("monospace");
    span.remove();
    return {
      loaded,
      check: {
        interTight: document.fonts.check('16px "Inter Tight"'),
        jetbrains: document.fonts.check('16px "JetBrains Mono"'),
      },
      widths: { interTight, interOnly, systemUi, jbMono, monoOnly, genericMono },
    };
  });

  console.log("document.fonts entries:", info.loaded.length);
  info.loaded.forEach((l) => console.log("  ", l));
  console.log("fonts.check:", JSON.stringify(info.check));
  console.log("widths:", JSON.stringify(info.widths, null, 2));
  console.log(
    "Inter Tight actually rendering?",
    Math.abs(info.widths.interOnly - info.widths.systemUi) > 0.5
      ? "YES (differs from system-ui)"
      : "NO — falling back to system-ui"
  );
  console.log(
    "JetBrains Mono actually rendering?",
    Math.abs(info.widths.monoOnly - info.widths.genericMono) > 0.5
      ? "YES (differs from monospace)"
      : "NO — falling back to monospace"
  );
  console.log("failed requests:", failed.length ? failed : "none");

  await browser.close();
})();
