/**
 * Marketplace artwork: renders docs/icon.png and docs/screenshot-1…4.png.
 *
 *   node scripts/make-assets.mjs            # icon + screenshots (rebuild first)
 *   node scripts/make-assets.mjs icon       # icon only
 *   node scripts/make-assets.mjs shots      # screenshots only
 *
 * Screenshots are composed from real renders of the built plugin inside the
 * preview mock host (preview/index.html), not hand-made mockups: the UI in the
 * pictures is the UI that ships. Each canvas is 1600×1000 (16:10, the market
 * asks for ≥1200 wide), with a caption block so the gallery reads as one set.
 * Raw captures are written to preview/.market/ and deleted afterwards.
 */
import { mkdir, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../preview/serve.mjs";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// playwright-core is a devDependency; PLAYWRIGHT_CORE can point at another copy.
const PW = process.env.PLAYWRIGHT_CORE ?? require.resolve("playwright-core");
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const { chromium } = require(PW);

const ICON = resolve(root, "docs/icon.svg");
const SHOTS = resolve(root, "docs");
const RAW = resolve(root, "preview/.market");

const want = process.argv[2] ?? "all";
const doIcon = want === "all" || want === "icon";
const doShots = want === "all" || want === "shots";

/** App captures: 1440×800 CSS px at DPR 2 (the popover fits above the chip). */
const APP = { width: 1440, height: 800, dpr: 2 };
/** Market canvas: 16:10, wide enough for the guide's ≥1200 px rule. */
const CANVAS = { width: 1600, height: 1000 };
/** 1456 + 2×72 padding = 1600; the 1440×800 capture scales to 1456×808.9. */
const SHOT_W = 1456;

const SCENES = [
  {
    file: "screenshot-1",
    query: "view=overview&tight=1",
    act: async (page) => {
      // Dismiss the unpriced-model banner so the popover does not cut it in half.
      const dismiss = page.locator(".ul-warn-row__x").first();
      if (await dismiss.count()) await dismiss.click();
      await page.click(".ul-chip");
      await page.waitForTimeout(1200);
    },
    eyebrow: "CC GUI 插件 · 状态栏",
    title: "用量与限额",
    sub: "状态栏常驻今日用量与各平台最紧的窗口，点开看趋势、项目与完整限额。",
  },
  {
    file: "screenshot-2",
    query: "view=overview",
    eyebrow: "用量看板",
    title: "趋势、项目与模型，全都对得上",
    sub: "日 / 周 / 月 / 年任意切换；堆叠趋势与明细表可下钻，费用按价格表逐模型估算。",
  },
  {
    file: "screenshot-3",
    query: "view=limits&tight=1",
    eyebrow: "订阅限额",
    title: "5 小时与每周额度，用得快不快一目了然",
    sub: "进度条上的竖标是「匀速用到现在」应在的位置；悬停看节奏、重置时间与预计用完的时刻。",
  },
  {
    file: "screenshot-4",
    query: "view=overview&dark=1",
    dark: true,
    eyebrow: "深色主题",
    title: "跟随 CC GUI 深浅色，数据只在你的机器上",
    sub: "只读本机日志与已有登录；插件不上传任何数据，也拿不到任何凭据。",
  },
];

const LOCK = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.2" y="7" width="9.6" height="6.4" rx="1.6"/><path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7"/></svg>`;

function canvasHtml(scene) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><base href="${base}/">
<style>
  html, body { margin: 0; padding: 0; width: ${CANVAS.width}px; height: ${CANVAS.height}px; overflow: hidden; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    background:
      radial-gradient(900px 540px at 88% -12%, rgba(43, 127, 255, 0.10), transparent 70%),
      radial-gradient(720px 440px at -8% 112%, rgba(0, 213, 190, 0.07), transparent 70%),
      linear-gradient(180deg, #fbfcfe 0%, #eef1f6 100%);
  }
  body.dark {
    background:
      radial-gradient(900px 540px at 88% -12%, rgba(43, 127, 255, 0.20), transparent 70%),
      radial-gradient(720px 440px at -8% 112%, rgba(0, 213, 190, 0.08), transparent 70%),
      linear-gradient(180deg, #0b0d10 0%, #101418 100%);
  }
  header { display: flex; align-items: center; gap: 18px; height: 96px; padding: 44px 72px 0; box-sizing: border-box; }
  .mark { width: 52px; height: 52px; flex: none; filter: drop-shadow(0 8px 16px rgba(9, 16, 29, 0.30)); }
  .titles { min-width: 0; }
  .eyebrow {
    font-size: 12.5px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase;
    color: #7b8798; line-height: 1;
  }
  h1 {
    margin: 7px 0 0; font-size: 33px; line-height: 1.12; font-weight: 650; letter-spacing: -0.01em;
    color: #0b1220; white-space: nowrap;
  }
  p { margin: 8px 0 0; font-size: 15px; line-height: 1.4; color: #5b6577; white-space: nowrap; }
  .pill {
    margin-left: auto; display: flex; align-items: center; gap: 7px; height: 34px; padding: 0 14px;
    border: 1px solid rgba(15, 23, 42, 0.08); border-radius: 999px;
    background: rgba(255, 255, 255, 0.85); box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
    font-size: 13px; font-weight: 500; color: #3d4a5c; white-space: nowrap;
  }
  .dark .eyebrow { color: #93a0b4; }
  .dark h1 { color: #f2f5fa; }
  .dark p { color: #a6b1c2; }
  .dark .pill { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.12); color: #cbd5e3; }
  .shot {
    width: ${SHOT_W}px; margin: 26px 72px 0; overflow: hidden;
    border: 1px solid rgba(15, 23, 42, 0.10); border-radius: 14px; background: #ffffff;
    box-shadow: 0 30px 70px -28px rgba(15, 23, 42, 0.42), 0 8px 20px -12px rgba(15, 23, 42, 0.22);
  }
  .dark .shot { border-color: rgba(255, 255, 255, 0.10); background: #171717; box-shadow: 0 30px 70px -28px rgba(0, 0, 0, 0.85); }
  .shot img { display: block; width: ${SHOT_W}px; height: auto; }
</style></head>
<body class="${scene.dark ? "dark" : ""}">
  <header>
    <img class="mark" src="/docs/icon.svg" alt="">
    <div class="titles">
      <div class="eyebrow">${scene.eyebrow}</div>
      <h1>${scene.title}</h1>
      <p>${scene.sub}</p>
    </div>
    <div class="pill">${LOCK}<span>本机计算 · 不上传</span></div>
  </header>
  <div class="shot"><img src="/preview/.market/${scene.file}.png" alt=""></div>
</body></html>`;
}

const server = await startServer(0);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: CHROME });
await mkdir(SHOTS, { recursive: true });

try {
  if (doIcon) {
    const svg = await readFile(ICON, "utf8");
    const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 2 });
    await page.setContent(`<!doctype html><style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>${svg}`);
    await page.screenshot({ path: resolve(SHOTS, "icon.png"), omitBackground: true });
    await page.close();
    process.stdout.write(`icon → ${resolve(SHOTS, "icon.png")} (1024×1024)\n`);
  }

  if (doShots) {
    await mkdir(RAW, { recursive: true });
    for (const scene of SCENES) {
      const app = await browser.newPage({
        viewport: { width: APP.width, height: APP.height },
        deviceScaleFactor: APP.dpr,
      });
      const errors = [];
      app.on("pageerror", (e) => errors.push(e.message));
      await app.goto(`${base}/preview/index.html?${scene.query}`);
      await app.waitForTimeout(1000);
      await scene.act?.(app);
      await app.screenshot({ path: resolve(RAW, `${scene.file}.png`) });
      await app.close();
      if (errors.length) throw new Error(`${scene.file}: ${errors.join(" | ")}`);

      const page = await browser.newPage({ viewport: { width: CANVAS.width, height: CANVAS.height }, deviceScaleFactor: 1 });
      await page.setContent(canvasHtml(scene));
      await page.evaluate(async () => {
        await Promise.all([...document.images].map((img) => (img.complete ? 0 : img.decode().catch(() => 0))));
      });
      await page.waitForTimeout(150);
      await page.screenshot({ path: resolve(SHOTS, `${scene.file}.png`) });
      await page.close();
      process.stdout.write(`shot → ${resolve(SHOTS, `${scene.file}.png`)}\n`);
    }
    await rm(RAW, { recursive: true, force: true });
  }
} finally {
  await browser.close();
  server.close();
}
