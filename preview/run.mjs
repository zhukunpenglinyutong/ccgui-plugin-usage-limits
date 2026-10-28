/**
 * Preview runner: screenshots (light + dark) of every surface in the mock
 * host, then scripted interactions with assertions. Fails on any page error
 * or console error. Uses the host repo's playwright-core + system Chrome.
 *
 *   node preview/run.mjs            # screenshots + interactions
 *   node preview/run.mjs --no-shots # interactions only
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./serve.mjs";

const require = createRequire(import.meta.url);
// playwright-core is a devDependency; PLAYWRIGHT_CORE can point at another copy.
const PW = process.env.PLAYWRIGHT_CORE ?? require.resolve("playwright-core");
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const { chromium } = require(PW);
const SHOTS = resolve(dirname(fileURLToPath(import.meta.url)), "shots");
const IGNORED = [/favicon/, /Download the React DevTools/, /Failed to load resource.*404/];

const server = await startServer(0);
const base = `http://127.0.0.1:${server.address().port}/preview/index.html`;
const browser = await chromium.launch({ executablePath: CHROME });
await mkdir(SHOTS, { recursive: true });

async function open(query, { width = 1440, height = 940, reduced = false, fast = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: reduced ? "reduce" : "no-preference" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORED.some((re) => re.test(m.text()))) errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  if (fast) {
    // Dev only: the chip's own cadences (2 min usage wake, 5 min limits poll)
    // are compressed so a few seconds of wall clock stand in for them.
    await page.addInitScript(() => {
      const real = window.setInterval;
      window.setInterval = (fn, ms, ...rest) => real(fn, Math.max(10, Math.round((ms || 0) / 100)), ...rest);
    });
  }
  await page.goto(`${base}?${query}`);
  await page.waitForTimeout(900);
  return { page, errors };
}

const allErrors = [];
async function done(ctx) {
  const extra = await ctx.page.evaluate(() => window.__errors.filter((e) => !/React DevTools/.test(e))).catch(() => []);
  allErrors.push(...ctx.errors, ...extra.map((e) => `window: ${e.slice(0, 300)}`));
  await ctx.page.close();
}

/* ---------------------------------------------------------------- shots */
const SCENES = [
  { name: "01-status-popover", query: "tight=1", act: async (p) => (await p.click(".ul-chip"), p.waitForTimeout(1200)) },
  { name: "02-overview", query: "view=overview" },
  {
    name: "03-overview-lower",
    query: "view=overview",
    act: async (p) => (await p.evaluate(() => document.querySelector(".ul-page__scroll").scrollTo(0, 99999)), p.waitForTimeout(300)),
  },
  { name: "04-overview-day", query: "view=overview", act: async (p) => (await p.getByRole("tab", { name: "日", exact: true }).click(), p.waitForTimeout(500)) },
  { name: "05-range-picker", query: "view=overview", act: async (p) => (await p.getByRole("tab", { name: "自定义" }).click(), p.waitForTimeout(300)) },
  {
    name: "06-project-drawer",
    query: "view=overview",
    act: async (p) => {
      await p.getByRole("tab", { name: "按项目" }).click();
      await p.locator(".ul-dt tbody tr.is-click").first().click();
      await p.waitForTimeout(400);
    },
  },
  {
    name: "07-sources-rescan",
    query: "view=overview",
    act: async (p) => {
      await p.getByRole("button", { name: "数据来源" }).click();
      await p.waitForTimeout(300);
      await p.getByRole("button", { name: "重新扫描全部" }).click();
      await p.waitForTimeout(500);
    },
  },
  { name: "07b-limits-codex-403", query: "view=limits&codex=error", act: async (p) => (await p.click(".ul-chip"), p.waitForTimeout(500)) },
  { name: "08-limits-tight", query: "view=limits&tight=1" },
  { name: "09-limits-states", query: "view=limits&claude=expired&codex=offline" },
  { name: "10-limits-ratelimited-weekly", query: "view=limits&claude=rateLimited&codex=weekly" },
  { name: "11-bell", query: "view=limits&tight=1", act: async (p) => (await p.getByRole("button", { name: "提醒设置" }).click(), p.waitForTimeout(300)) },
  { name: "12-settings", query: "view=settings", height: 1500 },
  { name: "13-scanning", query: "view=overview&scenario=scanning", act: async (p) => (await p.click(".ul-chip"), p.waitForTimeout(400)) },
  { name: "14-empty", query: "view=overview&scenario=empty", act: async (p) => (await p.click(".ul-chip"), p.waitForTimeout(400)) },
  { name: "15-overview-en", query: "view=overview&locale=en" },
  { name: "16-recent-history", query: "view=overview&history=recent&tight=1" },
  { name: "17-narrow", query: "view=overview", width: 900, height: 900 },
  { name: "18-chip-limit-mode", query: "tight=1&prefs=" + encodeURIComponent(JSON.stringify({ chipMode: "limit", logo: false })), height: 300 },
];

if (!process.argv.includes("--no-shots")) {
  for (const scene of SCENES) {
    for (const dark of [false, true]) {
      const ctx = await open(`${scene.query}${dark ? "&dark=1" : ""}`, { width: scene.width, height: scene.height });
      if (scene.act) await scene.act(ctx.page);
      await ctx.page.screenshot({ path: resolve(SHOTS, `${scene.name}-${dark ? "dark" : "light"}.png`) });
      await done(ctx);
    }
  }
  process.stdout.write(`screenshots → ${SHOTS}\n`);
}

/* --------------------------------------------------------- interactions */
const checks = [];
const check = async (name, fn) => {
  try {
    await fn();
    checks.push(`✔ ${name}`);
  } catch (error) {
    checks.push(`✖ ${name}: ${error.message.split("\n")[0]}`);
  }
};

{
  const ctx = await open("tight=1");
  const p = ctx.page;
  const dialog = p.getByRole("dialog", { name: "用量概览" });
  await check("popover opens from the chip (aria-expanded)", async () => {
    await p.click(".ul-chip");
    await dialog.waitFor();
    assert.equal(await p.getAttribute(".ul-chip", "aria-expanded"), "true");
  });
  await check("Esc closes the popover and returns focus to the chip", async () => {
    await p.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.ok(await p.evaluate(() => document.activeElement?.classList.contains("ul-chip")));
  });
  await check("outside click closes; chip click toggles", async () => {
    await p.click(".ul-chip");
    await dialog.waitFor();
    await p.mouse.click(900, 300);
    await dialog.waitFor({ state: "detached" });
    await p.click(".ul-chip");
    await dialog.waitFor();
    await p.click(".ul-chip");
    await dialog.waitFor({ state: "detached" });
  });
  await check("popover is fixed, opens upward and stays in the viewport", async () => {
    await p.click(".ul-chip");
    const box = await dialog.boundingBox();
    const chip = await p.locator(".ul-chip").boundingBox();
    assert.ok(box && chip && box.y + box.height <= chip.y && box.x >= 0 && box.y >= 0);
    await p.setViewportSize({ width: 800, height: 700 });
    await p.waitForTimeout(100);
    const after = await dialog.boundingBox();
    const chip2 = await p.locator(".ul-chip").boundingBox();
    assert.ok(after && chip2 && after.y + after.height <= chip2.y + 1);
  });
  await check("auto refresh on open shows spin → check (§4.1)", async () => {
    await p.locator(".ul-pop .ul-fb.is-done").waitFor({ timeout: 4000 });
  });
  await check("sidebar badge shows the tightest window at 86%", async () => {
    assert.equal(await p.getByTestId("sidebar-badge").textContent(), "86%");
  });
  await check("status chip tags both providers with 5h + 7d and their own mark", async () => {
    const tags = p.locator(".ul-chip__lim");
    assert.equal(await tags.count(), 2);
    assert.match(await tags.nth(0).textContent(), /5h 86%\s+7d 37%/);
    assert.match(await tags.nth(1).textContent(), /5h 8%\s+7d 71%/);
    assert.equal(await p.locator(".ul-chip__lim .ul-plogo svg").count(), 2);
    assert.match(await tags.nth(0).getAttribute("class"), /is-warn/);
    assert.doesNotMatch(await tags.nth(1).getAttribute("class"), /is-/);
  });
  await check("a divider separates the usage numbers from the limit tags", async () => {
    assert.equal(await p.locator(".ul-chip > .ul-chip__sep").count(), 2);
  });
  await check("chip draws a vertical rule between tokens and cost", async () => {
    const box = await p.locator(".ul-chip > .ul-chip__sep").first().boundingBox();
    assert.ok(box && Math.abs(box.width - 1) <= 0.6 && box.height >= 8 && box.height <= 14, JSON.stringify(box));
    const unit = await p.locator(".ul-chip .ul-chip__unit").boundingBox();
    const cost = await p.locator(".ul-chip > b").last().boundingBox();
    assert.ok(unit && cost && unit.x + unit.width <= box.x + 1 && box.x + box.width <= cost.x + 1, JSON.stringify({ unit, box, cost }));
  });
  await check("bubble cycles (alert → tokens → cost) and wraps back", async () => {
    const say = p.locator(".ul-say--cycle");
    const first = await say.textContent();
    const clicks = [];
    for (let i = 0; i < 3; i += 1) {
      assert.ok(
        await p.evaluate(() => {
          const el = document.querySelector(".ul-say--cycle");
          return el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1;
        }),
        "bubble text must not clip",
      );
      await say.click();
      clicks.push(await say.textContent());
    }
    assert.equal(new Set([first, ...clicks.slice(0, 2)]).size, 3, [first, ...clicks].join(" | "));
    assert.match(clicks[1], /\$/);
    assert.equal(clicks[2], first);
  });
  await check("bubble also advances by itself (~5 s)", async () => {
    const say = p.locator(".ul-say--cycle");
    const before = await say.textContent();
    await p.waitForTimeout(5600);
    assert.notEqual(await say.textContent(), before);
  });
  await check("popover header keeps bubble + updated time on one row", async () => {
    const say = await p.locator(".ul-say--cycle").boundingBox();
    const ago = await p.locator(".ul-pop__ago").boundingBox();
    const head = await p.locator(".ul-pop__head").boundingBox();
    assert.ok(say && ago && head, JSON.stringify({ say, ago, head }));
    assert.ok(Math.abs(say.y + say.height / 2 - (ago.y + ago.height / 2)) < 5, JSON.stringify({ say, ago }));
    assert.ok(ago.x > say.x + say.width, JSON.stringify({ say, ago }));
    assert.ok(head.height < 60, String(head.height));
  });
  await check("popover limit row hover shows the same pace card", async () => {
    const row = p.locator(".ul-lrow--c").first();
    await row.hover();
    const tip = p.locator(".ul-ltip");
    await tip.waitFor();
    assert.match((await tip.textContent()) ?? "", /Claude/);
    await p.mouse.move(5, 5);
    await tip.waitFor({ state: "detached" });
  });
  await check("today card keeps cost + delta on one line", async () => {
    const meta = p.locator(".ul-ptoday__meta");
    const line = await meta.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight) || 16);
    const box = await meta.boundingBox();
    assert.ok(box && box.height <= line * 1.6, JSON.stringify({ box, line }));
  });
  await check("period card opens the breakdown in place, no navigation", async () => {
    const card = p.locator(".ul-pcard").first();
    await card.click();
    await p.locator(".ul-pdetail").waitFor();
    assert.equal(await card.getAttribute("aria-expanded"), "true");
    assert.equal(await p.evaluate(() => window.__host.state.tabOpen), false);
    const pop = await p.locator(".ul-pop").boundingBox();
    const det = await p.locator(".ul-pdetail").boundingBox();
    assert.ok(pop && det && det.width >= pop.width - 36 && det.x > pop.x, JSON.stringify({ pop, det }));
    assert.equal(await p.locator(".ul-pdetail span").count(), 5);
    assert.match(await p.locator(".ul-pdetail").textContent(), /缓存命中\s*\d+(\.\d)?%/);
    await card.click();
    await p.locator(".ul-pdetail").waitFor({ state: "detached" });
  });
  await check("today box opens the same breakdown in place", async () => {
    const today = p.locator(".ul-ptoday");
    await today.click();
    await p.locator(".ul-pdetail").waitFor();
    assert.equal(await today.getAttribute("aria-expanded"), "true");
    assert.equal(await p.evaluate(() => window.__host.state.tabOpen), false);
    await today.click();
    await p.locator(".ul-pdetail").waitFor({ state: "detached" });
  });
  await check("「限额详情」 opens the limits page in the usage tab and closes the popover", async () => {
    await p.getByRole("button", { name: "限额详情" }).click();
    await dialog.waitFor({ state: "detached" });
    await p.getByRole("tab", { name: /限额/ }).and(p.locator("[aria-selected=true]")).waitFor();
  });
  await done(ctx);
}

{
  const ctx = await open("view=overview");
  const p = ctx.page;
  const label = () => p.locator(".ul-pnav__lbl").textContent();
  await check("period switch to week, then ‹ back and 「回到本周」", async () => {
    await p.getByRole("tab", { name: "周", exact: true }).click();
    const wk = await label();
    await p.getByRole("button", { name: "上一周" }).click();
    assert.notEqual(await label(), wk);
    await p.getByRole("button", { name: "回到本周" }).click();
    assert.equal(await label(), wk);
    assert.ok(await p.getByRole("button", { name: "下一周" }).isDisabled());
  });
  await check("engine filter: card → chip → ✕ clears", async () => {
    await p.getByRole("tab", { name: "月", exact: true }).click();
    await p.locator(".ul-ecard").nth(1).click();
    await p.locator(".ul-fchip").waitFor();
    assert.equal(await p.locator(".ul-ecard").nth(1).getAttribute("aria-pressed"), "true");
    await p.getByRole("button", { name: "取消筛选" }).click();
    await p.locator(".ul-fchip").waitFor({ state: "detached" });
  });
  await check("trend bar drill-down → 日, arrow keys move focus", async () => {
    const first = p.locator(".ul-tcol:not(.is-static)").first();
    await first.focus();
    await p.keyboard.press("ArrowRight");
    assert.ok(await p.evaluate(() => document.activeElement?.classList.contains("ul-tcol")));
    await p.locator(".ul-tip").waitFor();
    await p.keyboard.press("Enter");
    await p.getByRole("tab", { name: "日", exact: true }).and(p.locator("[aria-selected=true]")).waitFor();
    assert.equal(await p.locator(".ul-tcol").count(), 24);
  });
  await check("table sort toggles aria-sort", async () => {
    await p.getByRole("tab", { name: "月", exact: true }).click();
    const th = p.locator("th", { hasText: "总计" });
    await th.locator("button").click();
    assert.equal(await th.getAttribute("aria-sort"), "descending");
    await th.locator("button").click();
    assert.equal(await th.getAttribute("aria-sort"), "ascending");
  });
  await check("project drawer opens from a row and closes with Esc", async () => {
    await p.getByRole("tab", { name: "按项目" }).click();
    const names = await p.locator(".ul-dt__name").allTextContents();
    assert.ok(names.includes("desktop-cc-gui") && names.includes("其他目录"), `projects: ${names.join(",")}`);
    await p.locator(".ul-dt tbody tr.is-click").first().click();
    const drawer = p.getByRole("dialog", { name: /项目用量/ });
    await drawer.waitFor();
    await p.keyboard.press("Escape");
    await drawer.waitFor({ state: "detached" });
  });
  await check("model table shows — for unpriced models", async () => {
    await p.getByRole("tab", { name: "按模型" }).click();
    const row = p.locator("tr", { hasText: "kimi-k3" }).first();
    assert.match(await row.textContent(), /—/);
    assert.match(await row.textContent(), /未知价格/);
  });
  await check("model ranking gives each model its own color", async () => {
    const colors = await p
      .locator(".ul-mlist")
      .first()
      .locator(".ul-mbar i")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
    assert.ok(colors.length >= 5, String(colors.length));
    assert.equal(new Set(colors).size, colors.length, colors.join(" | "));
  });
  await check("model color follows the model, not its rank", async () => {
    const colorOf = (name) =>
      p
        .locator(".ul-mlist li", { hasText: name })
        .first()
        .locator(".ul-mbar i")
        .evaluate((el) => getComputedStyle(el).backgroundColor);
    const before = await colorOf("claude-opus-5-5");
    await p.getByRole("tab", { name: "年", exact: true }).click();
    const after = await colorOf("claude-opus-5-5");
    await p.getByRole("tab", { name: "月", exact: true }).click();
    assert.equal(after, before);
  });
  await check("date range: pick two days and apply", async () => {
    await p.getByRole("tab", { name: "自定义" }).click();
    const layer = p.getByRole("dialog", { name: "自定义日期区间" });
    await layer.waitFor();
    const days = layer.locator(".ul-cal__d:not([disabled])");
    await days.nth(3).click();
    await days.nth(12).click();
    await layer.getByRole("button", { name: "应用" }).click();
    await layer.waitFor({ state: "detached" });
    assert.equal(await p.getByRole("tab", { name: "自定义" }).getAttribute("aria-selected"), "true");
    assert.match(await label(), /–/);
  });
  await check("range preset applies and closes at once", async () => {
    await p.getByRole("tab", { name: "自定义" }).click();
    await p.getByRole("button", { name: "近 7 天" }).click();
    await p.getByRole("dialog", { name: "自定义日期区间" }).waitFor({ state: "detached" });
    assert.match(await p.locator(".ul-pnav__muted").textContent(), /7 天/);
  });
  await check("models expand / collapse (§2.4, aria-expanded)", async () => {
    await p.getByRole("tab", { name: "年", exact: true }).click();
    const btn = p.locator(".ul-models__more");
    await btn.click();
    assert.equal(await btn.getAttribute("aria-expanded"), "true");
    assert.equal(await p.locator("#ul-models-more").getAttribute("aria-hidden"), null);
    await btn.click();
    assert.equal(await p.locator("#ul-models-more").getAttribute("inert"), "");
  });
  await check("overview refresh: spin → check", async () => {
    await p.locator(".ul-phead__r .ul-icon-btn").last().click();
    await p.locator(".ul-phead__r .ul-fb.is-done").waitFor({ timeout: 4000 });
  });
  await check("rescan runs at once with Loader + %; a throttled second run shows role=alert", async () => {
    await p.getByRole("button", { name: "数据来源" }).click();
    await p.getByRole("button", { name: "重新扫描全部" }).click();
    await p.locator(".ul-layer .ul-progress-line").waitFor();
    await p.getByRole("button", { name: "重新扫描全部" }).waitFor({ timeout: 5000 });
    assert.equal(await p.evaluate(() => window.__calls.filter((c) => c.name === "usage.rescan").length), 1);
    await p.getByRole("button", { name: "重新扫描全部" }).click();
    const alert = p.locator(".ul-layer .ul-rescan__alert");
    await alert.waitFor();
    assert.equal(await alert.getAttribute("role"), "alert");
    assert.match(await alert.textContent(), /try again in \d+s/);
  });
  await check("unpriced warning closes with ✕ and the dismissal is saved", async () => {
    await p.keyboard.press("Escape");
    await p.getByRole("tab", { name: "月", exact: true }).click();
    const row = p.locator(".ul-warn-row");
    await row.waitFor();
    await row.getByRole("button", { name: "关闭提示" }).click();
    await row.waitFor({ state: "detached" });
    await p.waitForTimeout(400);
    const saved = await p.evaluate(() => window.__storage.get("prefs:v1"));
    assert.ok(saved.ackUnpriced.includes("kimi-k3"), JSON.stringify(saved.ackUnpriced));
  });
  await done(ctx);
}

{
  const ctx = await open("view=limits&tight=1&codex=offline");
  const p = ctx.page;
  await check("limits card collapses with inert body and persists", async () => {
    const head = p.locator(".ul-pcard-lg__head").first();
    await head.click();
    assert.equal(await head.getAttribute("aria-expanded"), "false");
    assert.equal(await p.locator("#ul-prov-claude").getAttribute("inert"), "");
    await p.waitForTimeout(400);
    const saved = await p.evaluate(() => window.__storage.get("prefs:v1"));
    assert.equal(saved.collapsed.claude, true);
    await head.click();
    assert.equal(await head.getAttribute("aria-expanded"), "true");
  });
  await check("limits show used % only — no 剩余 switch anywhere", async () => {
    assert.equal(await p.getByRole("radio").count(), 0);
    assert.equal(await p.getByText("剩余", { exact: true }).count(), 0);
    const bar = p.locator(".ul-bar").first();
    assert.ok(Number(await bar.getAttribute("aria-valuenow")) > 50);
  });
  await check("limit row hover shows the pace card (pace, reset, tick note, age)", async () => {
    const row = p.locator(".ul-lrow").first();
    await row.hover();
    const tip = p.locator(".ul-ltip");
    await tip.waitFor();
    const text = (await tip.textContent()) ?? "";
    assert.match(text, /^Claude/);
    assert.match(text, /5h/);
    assert.match(text, /重置/);
    assert.match(text, /竖标为匀速/);
    assert.match(text, /更新/);
    const box = await tip.boundingBox();
    const rowBox = await row.boundingBox();
    // The card sits either fully above the hovered row or starts below it, and stays on screen.
    assert.ok(box && rowBox, JSON.stringify({ box, rowBox }));
    assert.ok(box.y >= 0 && box.x >= 0, JSON.stringify(box));
    assert.ok(box.y + box.height <= rowBox.y + 1 || box.y >= rowBox.y + rowBox.height - 1, JSON.stringify({ box, rowBox }));
    await p.mouse.move(5, 5);
    await tip.waitFor({ state: "detached" });
  });
  await check("limits refresh with an offline provider: no check mark", async () => {
    await p.locator(".ul-phead__r .ul-icon-btn").first().click();
    await p.waitForTimeout(1500);
    assert.equal(await p.locator(".ul-phead__r .ul-fb.is-done").count(), 0);
  });
  await check("offline provider shows role=alert with retry", async () => {
    const banner = p.locator(".ul-banner.is-error");
    assert.equal(await banner.getAttribute("role"), "alert");
    await banner.getByRole("button", { name: "重试" }).click();
  });
  await check("bell layer toggles a threshold", async () => {
    await p.getByRole("button", { name: "提醒设置" }).click();
    const chip = p.getByRole("button", { name: "70%" });
    await chip.click();
    assert.equal(await chip.getAttribute("aria-pressed"), "true");
    await p.keyboard.press("Escape");
  });
  await done(ctx);
}

{
  const ctx = await open("view=limits&codex=error");
  await check("Codex HTTP 403 arrives as status error: inline role=alert + retry", async () => {
    const banner = ctx.page.locator(".ul-banner.is-error");
    assert.match(await banner.textContent(), /HTTP 403/);
    assert.equal(await banner.getAttribute("role"), "alert");
    await banner.getByRole("button", { name: "重试" }).waitFor();
  });
  await done(ctx);
}

{
  const ctx = await open("view=limits&claude=expired");
  const p = ctx.page;
  await check("expired login shows the command with copy → check", async () => {
    await p.locator(".ul-cmd code", { hasText: "claude" }).waitFor();
    await p.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await p.locator(".ul-cmd").getByRole("button", { name: "复制命令" }).click();
    await p.locator(".ul-cmd").getByRole("button", { name: "已复制" }).waitFor();
  });
  await done(ctx);
}

{
  const ctx = await open("");
  const p = ctx.page;
  await check("limit tags are always on, neutral until a threshold is crossed", async () => {
    const tags = p.locator(".ul-chip__lim");
    assert.equal(await tags.count(), 2);
    assert.equal(await p.locator(".ul-chip__lim.is-warn, .ul-chip__lim.is-danger").count(), 0);
    assert.match(await tags.nth(0).textContent(), /5h 52%\s+7d 37%/);
    assert.match(await tags.nth(1).textContent(), /5h 8%\s+7d 71%/);
  });
  await done(ctx);
}

{
  const ctx = await open("view=settings");
  const p = ctx.page;
  await check("settings: logo off → chip shows the line icon", async () => {
    assert.equal(await p.locator(".ul-chip .ul-brand").count(), 1);
    await p.getByRole("switch", { name: "CC GUI 标志" }).click();
    assert.equal(await p.locator(".ul-chip .ul-brand").count(), 0);
  });
  await check("settings: chip mode select → cost only", async () => {
    await p.selectOption("#ul-chip-mode", "cost");
    assert.doesNotMatch(await p.locator(".ul-chip").textContent(), /tokens/);
  });
  await check("settings: attribution line present", async () => {
    assert.match(await p.locator(".ul-settings").textContent(), /TokenTracker.*MIT © 2026 xiufengsun/);
  });
  await check("settings: rescan shows progress, then the button again", async () => {
    await p.getByRole("button", { name: "重新扫描全部" }).click();
    await p.locator(".ul-settings .ul-progress-line").waitFor();
    await p.getByRole("button", { name: "重新扫描全部" }).waitFor({ timeout: 5000 });
  });
  await check("settings: update price table now → check", async () => {
    await p.getByRole("button", { name: /立即更新/ }).click();
    await p.locator(".ul-settings .ul-fb.is-done").waitFor({ timeout: 4000 });
  });
  await done(ctx);
}

{
  const ctx = await open("view=overview&usageError=1");
  await check("query failure shows role=alert with retry", async () => {
    await ctx.page.getByRole("alert").first().waitFor();
    await ctx.page.getByRole("button", { name: "重试" }).first().click();
  });
  await done(ctx);
}

{
  const ctx = await open("view=overview&reduced=1", { reduced: true });
  await check("reduced motion: brand mark does not animate", async () => {
    const anim = await ctx.page.evaluate(() => getComputedStyle(document.querySelector(".ul-brand__eyes")).animationName);
    assert.equal(anim, "none");
  });
  await done(ctx);
}

{
  const ctx = await open("tight=1", { fast: true });
  await check("status-bar chip updates on its own — no click needed", async () => {
    const polls = () => ctx.page.evaluate(() => window.__calls.filter((c) => c.name === "limits.get" && c.arg?.refresh).length);
    const wakes = () => ctx.page.evaluate(() => window.__calls.filter((c) => c.name === "usage.prices").length);
    const refreshed = await polls();
    const woken = await wakes();
    await ctx.page.waitForTimeout(4500);
    assert.ok((await polls()) > refreshed, "limits windows are polled while the tags are on screen");
    assert.ok((await wakes()) > woken, "the wake-up keeps the host scanner running");
    assert.equal(await ctx.page.evaluate(() => window.__host.state.tabOpen), false, "without opening the panel");
  });
  await done(ctx);
}

await browser.close();
server.close();
process.stdout.write(`${checks.join("\n")}\n`);
const failed = checks.filter((c) => c.startsWith("✖"));
if (allErrors.length) process.stdout.write(`\npage errors (${allErrors.length}):\n${[...new Set(allErrors)].join("\n")}\n`);
if (failed.length || allErrors.length) process.exit(1);
process.stdout.write(`\n${checks.length} interaction checks passed, 0 page errors\n`);
