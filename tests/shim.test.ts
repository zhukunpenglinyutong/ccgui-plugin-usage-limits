import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as shim from "../src/shim/react.ts";
import { jsx, jsxs, jsxDEV, Fragment as JsxFragment } from "../src/shim/jsx-runtime.ts";

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

test("hooks and createElement throw a clear error before bindReact", () => {
  shim.unbindReact();
  assert.equal(shim.isReactBound(), false);
  assert.throws(() => shim.useState(0), /before bindReact/);
  assert.throws(() => shim.createElement("div"), /React\.createElement\(\) was called before bindReact/);
  assert.throws(() => shim.Children.count([]), /Children\.count/);
});

test("bindReact rejects things that are not React", () => {
  assert.throws(() => shim.bindReact(null), /expected the host React/);
  assert.throws(() => shim.bindReact({}), /expected the host React/);
});

test("forwardRef / memo build the standard element-type objects without React", () => {
  shim.unbindReact();
  const render = () => null;
  const fr = shim.forwardRef(render);
  assert.equal(fr.$$typeof, Symbol.for("react.forward_ref"));
  assert.equal(fr.render, render);
  const m = shim.memo(render);
  assert.equal(m.$$typeof, Symbol.for("react.memo"));
  assert.equal(m.type, render);
  assert.equal(m.compare, null);
  assert.throws(() => shim.forwardRef(null as never), /render function/);
  assert.equal(shim.Fragment, React.Fragment);
  assert.equal(shim.StrictMode, React.StrictMode);
  assert.equal(JsxFragment, React.Fragment);
});

test("forwarded calls reach the bound instance at call time", () => {
  shim.bindReact(React);
  assert.equal(shim.isReactBound(), true);
  const el = shim.createElement("span", { id: "a" }, "hi") as { type: string; props: Record<string, unknown> };
  assert.equal(el.type, "span");
  assert.equal(el.props.children, "hi");
  assert.equal(shim.isValidElement(el), true);
  assert.equal(shim.Children.count(["a", "b"]), 2);
  assert.deepEqual(shim.Children.toArray(["x"]).length, 1);
  assert.equal(shim.default.useState, shim.useState);
});

test("jsx runtime passes key separately and keeps children inside props", () => {
  shim.bindReact(React);
  const el = jsx("li", { children: "one" }, "k1") as { key: string; props: Record<string, unknown> };
  assert.equal(el.key, "k1");
  assert.equal(el.props.children, "one");
  // dev React defines a non-enumerable warning getter for props.key
  assert.equal(Object.keys(el.props).includes("key"), false);
  const noKey = jsxs("ul", { children: [jsx("li", { children: "a" }, "a"), jsx("li", { children: "b" }, "b")] }) as { key: null };
  assert.equal(noKey.key, null);
});

test("shim forwardRef + hooks render through real React (plugin-ui style)", () => {
  shim.bindReact(React);
  const Button = shim.forwardRef(function Button(props: { label: string }, ref: unknown) {
    const [n] = shim.useState(3) as [number];
    const memoed = shim.useMemo(() => n * 2, [n]) as number;
    return jsx("button", { ref, children: `${props.label}:${memoed}` });
  });
  const Memo = shim.memo(function Inner() {
    return jsxs(JsxFragment, { children: [jsx(Button, { label: "go" }), jsx("i", { children: "x" })] });
  });
  const html = renderToStaticMarkup(React.createElement(Memo));
  assert.equal(html, "<button>go:6</button><i>x</i>");
});

function captureErrors(fn: () => void): string[] {
  const seen: string[] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    seen.push(args.map(String).join(" "));
  };
  try {
    fn();
  } finally {
    console.error = orig;
  }
  return seen;
}

test("jsxs static siblings never trigger key warnings (children passed as varargs)", () => {
  shim.bindReact(React);
  const errors = captureErrors(() => {
    const tree = jsxs("ul", { children: [jsx("li", { children: "a" }), jsx("li", { children: "b" })] });
    assert.equal(renderToStaticMarkup(tree), "<ul><li>a</li><li>b</li></ul>");
    const viaDev = jsxDEV("p", { children: [jsx("b", { children: "x" }), "y"] }, undefined, true);
    assert.equal(renderToStaticMarkup(viaDev), "<p><b>x</b>y</p>");
  });
  assert.deepEqual(errors.filter((e) => e.includes("unique")), []);
});

test("jsxs marks static children as key-validated; jsx leaves dynamic arrays to React", () => {
  // React 18 dev builds record key validation on element._store; the client
  // reconciler warns for unvalidated, unkeyed array children. Static JSX
  // siblings must come out validated (as with React's own jsxs).
  shim.bindReact(React);
  type El = { _store?: { validated?: boolean | number } };
  const a = jsx("li", { children: "a" }) as El;
  const b = jsx("li", { children: "b" }) as El;
  jsxs("ul", { children: [a, b] });
  assert.ok(a._store?.validated);
  assert.ok(b._store?.validated);
  const c = jsx("li", { children: "c" }) as El;
  jsx("ol", { children: [c] });
  assert.ok(!c._store?.validated);
});

test("jsxs keeps the element key and a non-array child", () => {
  shim.bindReact(React);
  const el = jsxs("div", { children: "solo", id: "z" }, "k") as { key: string; props: Record<string, unknown> };
  assert.equal(el.key, "k");
  assert.equal(el.props.children, "solo");
  const keyed = jsxs("div", { children: [jsx("i", {}), jsx("b", {})] }, "k2") as { key: string; props: { children: unknown[] } };
  assert.equal(keyed.key, "k2");
  assert.equal(keyed.props.children.length, 2);
});
