import { Children, createContext, useContext, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { Button } from "./Controls";
import { Collapsible, CollapsibleTrigger, CollapsibleContent, CollapsibleIndicator } from "./beui/collapsible";
import { Popover, PopoverTrigger, PopoverContent } from "./beui/popover";
import { Card as BeCard } from "./beui/card";
import { Alert as BeAlert, AlertIcon } from "./beui/alert";
import { AnimatedBadge } from "./beui/animated-badge";
import { Loader } from "./beui/loader";
import { cn } from "./beui/utils";

export function Disclosure({ title, children, className, ...props }: Omit<ComponentProps<typeof Collapsible>, "title"> & { title: ReactNode }) {
  return <Collapsible {...props} className={cn("ui-disclosure", className)}>
    <CollapsibleTrigger render={<Button variant="ghost" pressScale={1} ripple={false} className="disclosure-trigger" />}>
      <span>{title}</span><CollapsibleIndicator />
    </CollapsibleTrigger>
    <CollapsibleContent contentClassName="disclosure-content">{children}</CollapsibleContent>
  </Collapsible>;
}
export function Menu({ trigger, children, className, side = "bottom", align = "end", open, onOpenChange }: {
  trigger: ReactElement<{ "aria-label"?: string; children?: ReactNode }>; children: ReactNode; className?: string;
  side?: "top" | "bottom"; align?: "start" | "center" | "end"; open?: boolean; onOpenChange?: (open: boolean) => void;
}) {
  return <Popover open={open} onOpenChange={onOpenChange} side={side} align={align} sideOffset={8} panelRadius={8} gooStrength={0} animated={false}>
    <PopoverTrigger>{trigger}</PopoverTrigger>
    <PopoverContent ariaLabel={trigger.props["aria-label"] ?? (typeof trigger.props.children === "string" ? trigger.props.children : "选项")} className={cn("ui-popover", className)}>{children}</PopoverContent>
  </Popover>;
}
export function Card({ className, ...props }: ComponentProps<typeof BeCard>) {
  return <BeCard role="article" {...props} className={cn("business-card border-solid rounded-[12px] p-[20px] gap-[12px]", className)} />;
}
const ContentScrollContext = createContext(false);
export function ContentScroll({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const nested = useContext(ContentScrollContext);
  if (!Children.toArray(children).length) return null;
  return <ContentScrollContext.Provider value={true}>
    <div className={cn(nested ? "content-scroll-nested" : "content-scroll", className)}
      role={nested ? undefined : "region"} aria-label={nested ? undefined : label} tabIndex={nested ? undefined : 0}>
      {children}
    </div>
  </ContentScrollContext.Provider>;
}
export function Alert({ className, children, variant = "destructive", ...props }: Omit<ComponentProps<typeof BeAlert>, "children"> & { children: ReactNode }) {
  return <BeAlert {...props} variant={variant} className={cn("ui-alert rounded-[8px] border-solid", className)} contentClassName="items-center gap-[10px] px-[12px] py-[10px]">
    <AlertIcon /><div className="alert-content">{children}</div>
  </BeAlert>;
}
export function Badge(props: ComponentProps<typeof AnimatedBadge>) {
  return <AnimatedBadge size="sm" showIcon={false} pulse={false} {...props} animated={false} className={cn("border-solid whitespace-nowrap", props.className)} />;
}
export function Loading({ children = "正在加载…" }: { children?: ReactNode }) {
  return <div className="loading-state"><Loader size={20} label="正在加载" /><span>{children}</span></div>;
}
