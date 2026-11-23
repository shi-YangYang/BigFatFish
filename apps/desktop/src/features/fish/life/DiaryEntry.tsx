import type { ReactNode } from "react";

/** The overview excerpt and full journal use the same dated reading layout. */
export function DiaryEntry({ day, content, children }: { day: string; content: string; children?: ReactNode }) {
  return <article className="fish-diary-entry">
    <h3><time dateTime={day}>{day}</time></h3>
    <p className="prewrap">{content}</p>
    {children}
  </article>;
}
