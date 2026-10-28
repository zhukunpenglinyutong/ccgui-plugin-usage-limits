/** Settings row / card layout. */
import type { ReactNode } from "react";

export function Row({ label, desc, children, htmlFor }: { label: string; desc?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="ul-srow">
      <div className="ul-srow__t">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <b>{label}</b>}
        {desc && <p>{desc}</p>}
      </div>
      <div className="ul-srow__c">{children}</div>
    </div>
  );
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ul-scard">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
