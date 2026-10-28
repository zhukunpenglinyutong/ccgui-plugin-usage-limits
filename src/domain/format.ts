/**
 * Number / date / duration formatters. Deterministic (no Intl locale data)
 * so tests are stable; `lang` picks zh or en wording.
 */
import { daysBetween, fromKey, keyOf, type DayKey } from "./dates.ts";

export type Lang = "zh" | "en";

const trim1 = (x: number): string => String(Math.round(x * 10) / 10);

export function tokens(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return `${trim1(n / 1e9)}B`;
  if (a >= 1e6) return `${trim1(n / 1e6)}M`;
  if (a >= 1e3) return `${trim1(n / 1e3)}K`;
  return String(Math.round(n));
}

export function int(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function usd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n > 0 && n < 0.01) return "<$0.01";
  if (n >= 1000) return `$${int(n)}`;
  return `$${n.toFixed(2)}`;
}

export function share(x: number): string {
  if (x > 0 && x < 0.0001) return "<0.01%";
  const p = x * 100;
  return `${p >= 10 ? p.toFixed(1) : p.toFixed(2)}%`;
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** Ratio with one decimal, trimmed: 0.9867 → "98.7%" (cache hit rates). */
export function rate(x: number): string {
  return `${trim1(x * 100)}%`;
}

const minutesOf = (ms: number): number => Math.max(0, Math.round(ms / 60000));

/** Compact countdown used in dense rows: "1d 4h", "1h 12m", "12m". */
export function durShort(ms: number): string {
  const m = minutesOf(ms);
  if (m >= 1440) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

/** Sentence duration: "3 小时 5 分" / "3 h 5 min". */
export function durLong(ms: number, lang: Lang): string {
  const m = minutesOf(ms);
  const zh = lang === "zh";
  if (m >= 1440) {
    const d = Math.floor(m / 1440);
    const h = Math.floor((m % 1440) / 60);
    if (zh) return `${d} 天${h ? ` ${h} 小时` : ""}`;
    return `${d} d${h ? ` ${h} h` : ""}`;
  }
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    if (zh) return `${h} 小时${rest ? ` ${rest} 分` : ""}`;
    return `${h} h${rest ? ` ${rest} min` : ""}`;
  }
  return zh ? `${Math.max(1, m)} 分钟` : `${Math.max(1, m)} min`;
}

export function ago(ms: number | null, lang: Lang): string {
  if (ms == null) return "";
  const zh = lang === "zh";
  if (ms < 30_000) return zh ? "刚刚" : "just now";
  if (ms < 3_600_000) return zh ? `${Math.round(ms / 60000)} 分钟前` : `${Math.round(ms / 60000)} min ago`;
  if (ms < 86_400_000) return zh ? `${Math.round(ms / 3_600_000)} 小时前` : `${Math.round(ms / 3_600_000)} h ago`;
  return zh ? `${Math.round(ms / 86_400_000)} 天前` : `${Math.round(ms / 86_400_000)} d ago`;
}

const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ZH_WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const EN_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number): string => String(n).padStart(2, "0");

export function dateShort(key: DayKey, lang: Lang): string {
  const d = fromKey(key);
  return lang === "zh" ? `${d.getMonth() + 1}月${d.getDate()}日` : `${EN_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function dateWeek(key: DayKey, lang: Lang): string {
  const d = fromKey(key);
  return lang === "zh" ? `${dateShort(key, lang)} ${ZH_WEEK[d.getDay()]}` : `${EN_WEEK[d.getDay()]}, ${dateShort(key, lang)}`;
}

export function monthLabel(key: DayKey, lang: Lang): string {
  const d = fromKey(key);
  return lang === "zh" ? `${d.getFullYear()}年${d.getMonth() + 1}月` : `${EN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function monthShort(key: DayKey, lang: Lang): string {
  const d = fromKey(key);
  return lang === "zh" ? `${d.getMonth() + 1}月` : EN_MONTHS[d.getMonth()];
}

export function yearLabel(key: DayKey, lang: Lang): string {
  return lang === "zh" ? `${key.slice(0, 4)}年` : key.slice(0, 4);
}

export function dateRange(from: DayKey, to: DayKey, lang: Lang): string {
  return `${dateShort(from, lang)} – ${dateShort(to, lang)}`;
}

export function hourRange(h: number): string {
  return `${pad(h)}:00–${pad((h + 1) % 24 === 0 ? 24 : h + 1)}:00`;
}

export function clock(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "今天 21:06" / "明天 09:00" / "10月29日 周四 09:00". */
export function resetAt(ts: number, now: number, lang: Lang): string {
  const dd = daysBetween(keyOf(new Date(now)), keyOf(new Date(ts)));
  const hm = clock(ts);
  if (dd === 0) return lang === "zh" ? `今天 ${hm}` : `today ${hm}`;
  if (dd === 1) return lang === "zh" ? `明天 ${hm}` : `tomorrow ${hm}`;
  return `${dateWeek(keyOf(new Date(ts)), lang)} ${hm}`;
}

/** "2026-10-20 14:03" for absolute timestamps in settings. */
export function stamp(ts: number): string {
  const d = new Date(ts);
  return `${keyOf(d)} ${clock(ts)}`;
}
