/**
 * Lookup + interpolation. The SDK has no plugin-side lookup API (ctx.i18n
 * only registers bundles), so the plugin resolves its own strings from
 * `ctx.host.locale`: zh* → 简体中文, everything else → English.
 */
import type { Lang } from "../domain/format.ts";
import { en } from "./en.ts";
import { zh, type MsgKey } from "./zh.ts";

export type { MsgKey };
export type Params = Record<string, string | number>;
export type T = (key: MsgKey, params?: Params) => string;

export function langOf(locale: string | null | undefined): Lang {
  return /^zh/i.test(String(locale ?? "")) ? "zh" : "en";
}

export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Split a template around placeholders so callers can drop React nodes in. */
export function templateParts(template: string): { text: string; key: string | null }[] {
  const out: { text: string; key: string | null }[] = [];
  let last = 0;
  for (const m of template.matchAll(/\{(\w+)\}/g)) {
    if (m.index > last) out.push({ text: template.slice(last, m.index), key: null });
    out.push({ text: m[0], key: m[1] });
    last = m.index + m[0].length;
  }
  if (last < template.length) out.push({ text: template.slice(last), key: null });
  return out;
}

export function createT(lang: Lang): { t: T; raw: (key: MsgKey) => string } {
  const table: Record<MsgKey, string> = lang === "zh" ? zh : en;
  const raw = (key: MsgKey): string => table[key] ?? zh[key] ?? key;
  return { t: (key, params) => interpolate(raw(key), params), raw };
}
