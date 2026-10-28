/**
 * React shim for a Tier-1 plugin.
 *
 * The host loader `import()`s main.js by URL, so a bare `import "react"` cannot
 * resolve at runtime, and Tier-1 plugins must not ship their own React copy.
 * The build aliases `react` (and `react/jsx-runtime`) to this module:
 *
 * - `bindReact(ctx.react)` runs first thing in `activate`; every hook and
 *   element factory below forwards to the bound host instance *at call time*.
 * - `forwardRef` / `memo` run at module-evaluation time (inside
 *   @ccgui/plugin-ui), before activation, so they return the standard
 *   element-type objects React itself would build, without touching React.
 * - Symbol-typed exports (Fragment, StrictMode…) are plain registry symbols.
 */

type AnyFn = (...args: never[]) => unknown;
type ReactLike = Record<string, unknown>;

let bound: ReactLike | null = null;

export function bindReact(instance: unknown): void {
  if (!instance || typeof (instance as ReactLike).createElement !== "function") {
    throw new Error("bindReact: expected the host React instance (ctx.react)");
  }
  bound = instance as ReactLike;
}

/** Test/hot-reload helper: forget the bound instance. */
export function unbindReact(): void {
  bound = null;
}

export function isReactBound(): boolean {
  return bound !== null;
}

function unboundError(name: string): Error {
  return new Error(
    `React.${name}() was called before bindReact(ctx.react); call bindReact first thing in activate().`,
  );
}

function host(name: string): AnyFn {
  if (!bound) throw unboundError(name);
  const fn = bound[name];
  if (typeof fn !== "function") {
    throw new Error(`The host React instance has no ${name}()`);
  }
  return fn as AnyFn;
}

const forward =
  (name: string) =>
  (...args: unknown[]): unknown =>
    (host(name) as (...a: unknown[]) => unknown)(...args);

export const REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
export const REACT_MEMO_TYPE = Symbol.for("react.memo");

export const Fragment = Symbol.for("react.fragment");
export const StrictMode = Symbol.for("react.strict_mode");
export const Profiler = Symbol.for("react.profiler");
export const Suspense = Symbol.for("react.suspense");

/** Same object shape React 18 builds in `forwardRef(render)`. */
export function forwardRef<T>(render: T): { $$typeof: symbol; render: T } {
  if (typeof render !== "function") {
    throw new Error("forwardRef requires a render function");
  }
  return { $$typeof: REACT_FORWARD_REF_TYPE, render };
}

/** Same object shape React 18 builds in `memo(type, compare)`. */
export function memo<T>(
  type: T,
  compare: ((a: unknown, b: unknown) => boolean) | null = null,
): { $$typeof: symbol; type: T; compare: ((a: unknown, b: unknown) => boolean) | null } {
  return { $$typeof: REACT_MEMO_TYPE, type, compare: compare ?? null };
}

export const createElement = forward("createElement");
export const cloneElement = forward("cloneElement");
export const isValidElement = forward("isValidElement");
export const createContext = forward("createContext");
export const createRef = forward("createRef");
export const startTransition = forward("startTransition");
export const lazy = forward("lazy");

export const useState = forward("useState");
export const useEffect = forward("useEffect");
export const useLayoutEffect = forward("useLayoutEffect");
export const useInsertionEffect = forward("useInsertionEffect");
export const useMemo = forward("useMemo");
export const useCallback = forward("useCallback");
export const useRef = forward("useRef");
export const useReducer = forward("useReducer");
export const useContext = forward("useContext");
export const useId = forward("useId");
export const useImperativeHandle = forward("useImperativeHandle");
export const useSyncExternalStore = forward("useSyncExternalStore");
export const useTransition = forward("useTransition");
export const useDeferredValue = forward("useDeferredValue");
export const useDebugValue = forward("useDebugValue");

function children(name: string) {
  return (...args: unknown[]): unknown => {
    if (!bound) throw unboundError(`Children.${name}`);
    const fn = (bound.Children as Record<string, unknown> | undefined)?.[name];
    if (typeof fn !== "function") throw new Error(`The host React instance has no Children.${name}()`);
    return (fn as (...a: unknown[]) => unknown)(...args);
  };
}

export const Children = {
  map: children("map"),
  forEach: children("forEach"),
  count: children("count"),
  toArray: children("toArray"),
  only: children("only"),
};

const ReactShim = {
  Children,
  Fragment,
  StrictMode,
  Profiler,
  Suspense,
  cloneElement,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  startTransition,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
};

export default ReactShim;
