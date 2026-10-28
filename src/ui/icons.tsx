/**
 * Lucide icon geometry (ISC), inlined because Tier-1 plugins cannot import
 * the host's lucide-react. Same 24×24 / stroke-2 drawing as the host icons.
 */
import type { SVGProps } from "react";

type Shape =
  | ["path", { d: string }]
  | ["circle", { cx: number; cy: number; r: number }]
  | ["rect", { x: number; y: number; width: number; height: number; rx?: number }]
  | ["ellipse", { cx: number; cy: number; rx: number; ry: number }];

const p = (d: string): Shape => ["path", { d }];

const SHAPES = {
  refresh: [p("M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"), p("M21 3v5h-5"), p("M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"), p("M8 16H3v5")],
  check: [p("M20 6 9 17l-5-5")],
  sliders: [p("M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4")],
  bell: [p("M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"), p("M10.3 21a1.94 1.94 0 0 0 3.4 0")],
  bellOff: [p("M10.3 21a1.94 1.94 0 0 0 3.4 0"), p("M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7"), p("M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5"), p("m2 2 20 20")],
  chevD: [p("m6 9 6 6 6-6")],
  chevL: [p("m15 18-6-6 6-6")],
  chevR: [p("m9 18 6-6-6-6")],
  x: [p("M18 6 6 18"), p("m6 6 12 12")],
  info: [["circle", { cx: 12, cy: 12, r: 10 }], p("M12 16v-4"), p("M12 8h.01")],
  copy: [["rect", { x: 8, y: 8, width: 14, height: 14, rx: 2 }], p("M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2")],
  cal: [["rect", { x: 3, y: 4, width: 18, height: 18, rx: 2 }], p("M16 2v4M8 2v4M3 10h18")],
  db: [["ellipse", { cx: 12, cy: 5, rx: 9, ry: 3 }], p("M3 5v14a9 3 0 0 0 18 0V5"), p("M3 12a9 3 0 0 0 18 0")],
  alert: [p("m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"), p("M12 9v4M12 17h.01")],
  loader: [p("M21 12a9 9 0 1 1-6.219-8.56")],
  arrowR: [p("M5 12h14"), p("m12 5 7 7-7 7")],
  gauge: [p("m12 14 4-4"), p("M3.34 19a10 10 0 1 1 17.32 0")],
  term: [p("m4 17 6-6-6-6"), p("M12 19h8")],
  link: [p("M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"), p("M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71")],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof SHAPES;

export function Icon({ name, size = 16, className, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {SHAPES[name].map(([tag, attrs], i) => {
        const Tag = tag;
        return <Tag key={i} {...(attrs as Record<string, unknown>)} />;
      })}
    </svg>
  );
}

/** Sidebar / tab icon for the host (receives className only). */
export function GaugeIcon({ className }: { className?: string }) {
  return <Icon name="gauge" className={className} />;
}
