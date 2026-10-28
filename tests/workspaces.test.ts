import test from "node:test";
import assert from "node:assert/strict";
import * as W from "../src/domain/workspaces.ts";

test("normalizePath handles separators, trailing slashes and Windows drives", () => {
  assert.equal(W.normalizePath("/a/b/"), "/a/b");
  assert.equal(W.normalizePath("/a//b"), "/a/b");
  assert.equal(W.normalizePath("C:\\Users\\Me\\Repo\\"), "c:/users/me/repo");
  assert.equal(W.normalizePath("/"), "/");
  assert.equal(W.normalizePath("D:"), "d:/");
});

test("longest registered prefix wins; siblings with a shared prefix do not match", () => {
  const resolve = W.createProjectResolver(
    [
      { id: "parent", name: "desktop-cc-gui", path: "/Users/me/CCGUI/desktop-cc-gui" },
      { id: "wt", name: "pr-1455", path: "/Users/me/CCGUI/desktop-cc-gui/.worktrees/pr-1455", kind: "worktree" },
      { id: "empty", name: "", path: "  " },
    ],
    "其他目录",
  );
  assert.equal(resolve("/Users/me/CCGUI/desktop-cc-gui").id, "parent");
  assert.equal(resolve("/Users/me/CCGUI/desktop-cc-gui/src").id, "parent");
  assert.equal(resolve("/Users/me/CCGUI/desktop-cc-gui/.worktrees/pr-1455/src").id, "wt");
  assert.equal(resolve("/Users/me/CCGUI/desktop-cc-gui-worktrees/x").id, W.OTHER_PROJECT_ID);
  assert.deepEqual(resolve(null), { id: W.OTHER_PROJECT_ID, name: "其他目录", path: null });
  // cached lookups return the same reference
  assert.equal(resolve("/Users/me/CCGUI/desktop-cc-gui/src"), resolve("/Users/me/CCGUI/desktop-cc-gui/src"));
});

test("Windows workspaces match case-insensitively", () => {
  const resolve = W.createProjectResolver([{ id: "w", name: "repo", path: "C:\\Code\\Repo" }], "other");
  assert.equal(resolve("c:/code/repo/src").id, "w");
  assert.equal(W.isWithin("/a", "/a"), true);
  assert.equal(W.isWithin("/ab", "/a"), false);
  assert.equal(W.isWithin("c:/x", "c:/"), true);
});
