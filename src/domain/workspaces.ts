/**
 * Session cwd → registered workspace. The longest registered path that is
 * the cwd itself or one of its ancestors wins (so a worktree registered
 * inside its parent repo beats the parent). Anything else is "其他目录".
 */
import type { ProjectRef } from "./aggregate.ts";

export const OTHER_PROJECT_ID = "__other";

export interface WorkspaceLike {
  id: string;
  name: string;
  path: string;
  kind?: "worktree";
}

const WIN_DRIVE = /^[a-z]:\//i;

/** Forward slashes, no duplicate or trailing slash; Windows drive paths compare case-insensitively. */
export function normalizePath(p: string): string {
  let s = p.trim().replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  if (s.length > 1 && s.endsWith("/")) s = s.replace(/\/+$/, "");
  if (/^[a-z]:$/i.test(s)) s = `${s}/`;
  return WIN_DRIVE.test(s) ? s.toLowerCase() : s;
}

export function isWithin(child: string, parent: string): boolean {
  if (child === parent) return true;
  const base = parent.endsWith("/") ? parent : `${parent}/`;
  return child.startsWith(base);
}

export function createProjectResolver(
  workspaces: readonly WorkspaceLike[],
  otherName: string,
): (cwd: string | null) => ProjectRef {
  const other: ProjectRef = { id: OTHER_PROJECT_ID, name: otherName, path: null };
  const entries = workspaces
    .filter((w) => typeof w.path === "string" && w.path.trim())
    .map((w) => ({ ref: { id: w.id, name: w.name || w.path, path: w.path }, norm: normalizePath(w.path) }))
    .sort((a, b) => b.norm.length - a.norm.length);
  const cache = new Map<string, ProjectRef>();
  return (cwd) => {
    if (!cwd) return other;
    const hit = cache.get(cwd);
    if (hit) return hit;
    const norm = normalizePath(cwd);
    const match = entries.find((e) => isWithin(norm, e.norm));
    const ref = match ? match.ref : other;
    cache.set(cwd, ref);
    return ref;
  };
}
