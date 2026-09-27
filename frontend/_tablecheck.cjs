const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Log in, then land on the dashboard where TopKTable + AlertRow live.
  await page.goto("http://localhost:4173/login", { waitUntil: "networkidle2", timeout: 30000 });
  await page.evaluate(() => localStorage.setItem("auth_token", "demo_token_123"));
  await page.goto("http://localhost:4173/", { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2500));

  const report = await page.evaluate(() => {
    const pick = (sel) => [...document.querySelectorAll(sel)];
    const row = pick(".panel").find((p) => p.textContent.includes("Ranked cash-out candidates"));
    const alertPanel = pick(".panel").find((p) => p.textContent.includes("Latest alerts"));
    const dump = (root, label) => {
      if (!root) return [`${label}: NOT FOUND`];
      return pick.length && root
        ? [...root.querySelectorAll("th, td, span")]
            .filter((e) => e.textContent.trim() && e.children.length === 0)
            .map((e) => {
              const cs = getComputedStyle(e);
              const mono = cs.fontFamily.includes("JetBrains");
              return `  ${mono ? "MONO" : "sans"}  ${cs.fontSize.padStart(7)}  ${JSON.stringify(e.textContent.trim().slice(0, 30))}`;
            })
        : [];
    };
    return {
      table: dump(row, "TopKTable"),
      alerts: dump(alertPanel, "AlertRow"),
    };
  });

  console.log("=== Ranked cash-out candidates ===");
  report.table.forEach((l) => console.log(l));
  console.log("\n=== Latest alerts ===");
  report.alerts.forEach((l) => console.log(l));

  await browser.close();
})();
