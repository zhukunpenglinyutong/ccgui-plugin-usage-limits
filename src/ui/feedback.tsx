/**
 * Action feedback per the host UI spec:
 * §4.1 refresh — icon spins (0.6 s laps, at least one full lap), cross-fades
 *      to a green check for 900 ms on success, snaps back on failure.
 * §4.2 copy — copy icon → check for 1500 ms, accessible name becomes "已复制".
 */
import { Button, cx } from "@ccgui/plugin-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "./app.tsx";
import { Icon, type IconName } from "./icons.tsx";

export type Feedback = "idle" | "running" | "success";

export const SPIN_MS = 600;
export const SUCCESS_MS = 900;
export const COPY_FEEDBACK_MS = 1500;

function useTimers() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = useCallback(() => {
    for (const id of timers.current) clearTimeout(id);
    timers.current = [];
  }, []);
  useEffect(() => clear, [clear]);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current = [...timers.current, setTimeout(fn, ms)];
  }, []);
  return { clear, later };
}

/** Remaining time to finish the current lap (always ≥ one full lap). */
export function lapRemainder(elapsed: number): number {
  return elapsed < SPIN_MS ? SPIN_MS - elapsed : (SPIN_MS - (elapsed % SPIN_MS)) % SPIN_MS;
}

/** Click-driven: `run(action)` spins until the promise settles. */
export function useActionFeedback() {
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const { clear, later } = useTimers();
  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      clear();
      setFeedback("running");
      const started = performance.now();
      let ok = true;
      try {
        await action();
      } catch {
        ok = false;
      }
      later(() => {
        setFeedback(ok ? "success" : "idle");
        if (ok) later(() => setFeedback("idle"), SUCCESS_MS);
      }, lapRemainder(performance.now() - started));
      return ok;
    },
    [clear, later],
  );
  return { feedback, run };
}

/** State-driven: spins while `running`; check only if it ended without `failed`. */
export function useRunningFeedback(running: boolean, failed: boolean): Feedback {
  const [feedback, setFeedback] = useState<Feedback>(running ? "running" : "idle");
  const startedAt = useRef(0);
  const wasRunning = useRef(running);
  const { clear, later } = useTimers();
  const failedRef = useRef(failed);
  failedRef.current = failed;
  useEffect(() => {
    if (running) {
      clear();
      startedAt.current = performance.now();
      wasRunning.current = true;
      setFeedback("running");
      return;
    }
    if (!wasRunning.current) return;
    wasRunning.current = false;
    later(() => {
      const ok = !failedRef.current;
      setFeedback(ok ? "success" : "idle");
      if (ok) later(() => setFeedback("idle"), SUCCESS_MS);
    }, lapRemainder(performance.now() - startedAt.current));
  }, [running, clear, later]);
  return feedback;
}

export function FeedbackIcon({ icon, feedback, size = 16 }: { icon: IconName; feedback: Feedback; size?: number }) {
  return (
    <span className={cx("ul-fb", feedback === "running" && "is-running", feedback === "success" && "is-done")} aria-hidden="true">
      <Icon name={icon} size={size} className="ul-fb__icon" />
      <Icon name="check" size={size} className="ul-fb__check" />
    </span>
  );
}

/** Ghost icon button running a refresh-style action with §4.1 feedback. */
export function RefreshButton({
  onRefresh,
  label,
  feedback: external,
  size = "md",
}: {
  onRefresh: () => Promise<unknown>;
  label?: string;
  /** Optional state-driven feedback (e.g. an automatic background refresh). */
  feedback?: Feedback;
  size?: "md" | "sm";
}) {
  const { t } = useApp();
  const action = useActionFeedback();
  const feedback = action.feedback !== "idle" ? action.feedback : (external ?? "idle");
  const name = label ?? t("common.refresh");
  return (
    <Button
      variant="ghost"
      size={size}
      className="ul-icon-btn"
      aria-label={name}
      title={name}
      aria-busy={feedback === "running" || undefined}
      disabled={feedback === "running"}
      onClick={() => void action.run(onRefresh)}
    >
      <FeedbackIcon icon="refresh" feedback={feedback} size={size === "sm" ? 14 : 16} />
    </Button>
  );
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* fall through to the selection-based fallback */
    }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("copy failed");
}

/** Copy → check (§4.2). Failure is shown inline with role="alert". */
export function CopyButton({ text, label, copiedLabel }: { text: string; label?: string; copiedLabel?: string }) {
  const { t } = useApp();
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const { clear, later } = useTimers();
  const name = state === "done" ? (copiedLabel ?? t("common.copied")) : (label ?? t("common.copy"));
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="ul-icon-btn"
        aria-label={name}
        title={name}
        onClick={() => {
          clear();
          copyText(text).then(
            () => {
              setState("done");
              later(() => setState("idle"), COPY_FEEDBACK_MS);
            },
            () => setState("failed"),
          );
        }}
      >
        <FeedbackIcon icon="copy" feedback={state === "done" ? "success" : "idle"} size={14} />
      </Button>
      {state === "failed" && (
        <span className="ul-inline-error" role="alert">
          {t("common.copyFailed")}
        </span>
      )}
    </>
  );
}
