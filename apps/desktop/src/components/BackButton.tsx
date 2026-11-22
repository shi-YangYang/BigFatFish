import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Controls";
import "./BackButton.css";

export function BackButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <Button size="compact" variant="ghost" className="ui-back-button" onClick={onClick}>
    <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" /><span className="ui-back-label">{children}</span>
  </Button>;
}
