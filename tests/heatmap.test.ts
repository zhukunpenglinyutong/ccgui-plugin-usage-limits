import test from "node:test";
import assert from "node:assert/strict";
import * as H from "../src/domain/heatmap.ts";
import { row } from "./helpers.ts";

test("quantile cuts ignore idle days and one extreme day does not flatten the rest", () => {
  const values = [0, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 1_000_000];
  const cuts = H.quantileCuts(values);
  assert.deepEqual(cuts, [30, 50, 70]);
  assert.equal(H.levelOf(0, cuts), 0);
  assert.equal(H.levelOf(10, cuts), 1);
  assert.equal(H.levelOf(40, cuts), 2);
  assert.equal(H.levelOf(60, cuts), 3);
  // The outlier only lands in the top level with the other busy days.
  assert.equal(H.levelOf(80, cuts), 4);
  assert.equal(H.levelOf(1_000_000, cuts), 4);
  assert.equal(H.levelOf(5, [1, 2, 3, 4]), 4);
  assert.deepEqual(H.quantileCuts([]), [0, 0, 0]);
});

test("heat cells cover 26 Mon-start weeks ending this Sunday; future days are empty", () => {
  const cells = H.heatCells([row({ bucket: "2026-10-27", cost: 2.5 }), row({ bucket: "2026-10-20" })], "2026-10-27");
  assert.equal(cells.length, 26 * 7);
  assert.equal(cells[0].key, "2026-05-04"); // a Monday
  assert.equal(cells[cells.length - 1].key, "2026-11-01"); // Sunday of this week
  const today = cells.find((c) => c.key === "2026-10-27")!;
  assert.equal(today.total, 1000);
  assert.equal(today.cost, 2.5);
  assert.ok(today.level > 0);
  const future = cells.find((c) => c.key === "2026-10-30")!;
  assert.equal(future.future, true);
  assert.equal(future.level, 0);
});
