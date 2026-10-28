/**
 * Small controls plugin-ui does not ship (segmented control, switch,
 * threshold chips, collapse, inline alert). Styled with host tokens only.
 */
import { Button, cx } from "@ccgui/plugin-ui";
import type { ReactNode } from "react";
import { THRESHOLD_CHOICES, toggleThreshold } from "../domain/prefs.ts";
import { useApp } from "./app.tsx";
import { Icon, type IconName } from "./icons.tsx";

export function Segmented<V extends string>({
  value,
  options,
  onChange,
  label,
  size = "sm",
  role = "radiogroup",
  className,
}: {
  value: V;
  options: { value: V; label: ReactNode; icon?: IconName; badge?: ReactNode; anchorRef?: (el: HTMLButtonElement | null) => void }[];
  onChange: (v: V) => void;
  label: string;
  size?: "sm" | "xs";
  role?: "radiogroup" | "tablist";
  className?: string;
}) {
  const itemRole = role === "tablist" ? "tab" : "radio";
  return (
    <div className={cx("ul-seg", `ul-seg--${size}`, className)} role={role} aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={o.anchorRef}
            type="button"
            role={itemRole}
            {...(role === "tablist" ? { "aria-selected": on } : { "aria-checked": on })}
            className={cx("ul-seg__item", on && "is-on")}
            onClick={() => onChange(o.value)}
          >
            {o.icon && <Icon name={o.icon} size={13} />}
            {o.label}
            {o.badge}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cx("ul-switch", checked && "is-on")}
      onClick={() => onChange(!checked)}
    >
      <i />
    </button>
  );
}

export function ThresholdChips({ value, onChange, disabled }: { value: readonly number[]; onChange: (v: number[]) => void; disabled?: boolean }) {
  const { t } = useApp();
  return (
    <div className="ul-tchips" role="group" aria-label={t("bell.thresholds")}>
      {THRESHOLD_CHOICES.map((v) => {
        const on = value.includes(v);
        return (
          <button
            key={v}
            type="button"
            className={cx("ul-tchip", on && "is-on")}
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(toggleThreshold(value, v))}
          >
            {v}%
          </button>
        );
      })}
    </div>
  );
}

/** ⓘ with the explanation in the host-rendered native `title` bubble (also readable via aria-label). */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="ul-info" tabIndex={0} role="note" aria-label={text} title={text}>
      <Icon name="info" size={13} />
    </span>
  );
}

export function InlineAlert({
  message,
  onRetry,
  retrying,
  className,
}: {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const { t } = useApp();
  return (
    <div className={cx("ul-alert", className)} role="alert">
      <Icon name="alert" size={14} />
      <span className="ul-alert__text">{message}</span>
      {onRetry && (
        <Button size="sm" variant="secondary" disabled={retrying} aria-busy={retrying || undefined} onClick={onRetry}>
          {retrying ? t("common.retrying") : t("common.retry")}
        </Button>
      )}
    </div>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return <Icon name="loader" size={size} className="ul-spin" />;
}

/**
 * Height transition per UI spec §2.4 (grid-template-rows 1fr ⇄ 0fr). The
 * content stays mounted; while collapsed it is aria-hidden + inert.
 */
export function Collapse({ open, children, id }: { open: boolean; children: ReactNode; id?: string }) {
  return (
    <div id={id} className={cx("ul-collapse", open && "is-open")} aria-hidden={!open || undefined} {...(open ? {} : { inert: "" })}>
      <div className="ul-collapse__in">{children}</div>
    </div>
  );
}

export function EngineDot({ color }: { color: string }) {
  return <i className="ul-edot" style={{ background: color }} aria-hidden="true" />;
}
