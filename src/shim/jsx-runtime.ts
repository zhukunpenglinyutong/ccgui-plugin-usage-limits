/**
 * `react/jsx-runtime` shim: the automatic JSX transform calls `jsx/jsxs(type,
 * props, key)`; we forward to the bound host `createElement` at call time.
 *
 * - `jsx` (one child or a dynamic array): children stay inside `props`, so a
 *   `.map()` without keys still gets React's missing-key warning.
 * - `jsxs` (static children written side by side in JSX): children are
 *   passed as separate arguments, which is how createElement marks them as
 *   validated — the same effect as React's own jsxs, so static siblings never
 *   trigger key warnings.
 */
import { createElement, Fragment } from "./react.ts";

export { Fragment };

type Props = Record<string, unknown> & { children?: unknown };

export function jsx(type: unknown, props: Props, key?: unknown): unknown {
  return createElement(type, key == null ? props : { ...props, key });
}

export function jsxs(type: unknown, props: Props, key?: unknown): unknown {
  const { children, ...rest } = props;
  if (!Array.isArray(children)) return jsx(type, props, key);
  return createElement(type, key == null ? rest : { ...rest, key }, ...children);
}

export function jsxDEV(type: unknown, props: Props, key?: unknown, isStaticChildren?: boolean): unknown {
  return isStaticChildren ? jsxs(type, props, key) : jsx(type, props, key);
}
