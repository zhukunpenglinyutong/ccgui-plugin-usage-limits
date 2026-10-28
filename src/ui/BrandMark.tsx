/**
 * CC GUI brand mark: the app icon's glossy black tile with two crescent eyes,
 * rebuilt as CSS + one SVG so it stays crisp from 14 px (status chip) up to
 * 44 px (empty state). Replaces the earlier pixel mascot.
 *
 * The eye geometry is the app icon's (420-unit tile, eyes r=51.2 centered at
 * ±75.2, bite r=34 offset +37.2), so the mark reads as the same tile people
 * already see in the CC GUI sidebar. It bobs gently while a session runs and
 * blinks every ~5 s; static under prefers-reduced-motion or when motion is
 * off. The eyes keep the icon's white in every state — alert information is
 * carried by the limit tags and the popover bubble, never by recolouring the
 * logo.
 */
import { cx } from "@ccgui/plugin-ui";

const EYES = [
  "M219.9 219.4A51.2 51.2 0 1 0 219.9 287.4A34 34 0 1 1 219.9 219.4Z",
  "M370.4 219.5A51.2 51.2 0 1 0 370.4 287.5A34 34 0 1 1 370.4 219.5Z",
];

export function BrandMark({ size, running = false, still = false }: { size: number; running?: boolean; still?: boolean }) {
  return (
    <span
      className={cx("ul-brand", running && !still && "is-running", still && "is-still")}
      style={{ height: size, width: size }}
      aria-hidden="true"
    >
      <svg viewBox="46 46 420 420">
        <g className="ul-brand__eyes">
          {EYES.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </svg>
    </span>
  );
}
