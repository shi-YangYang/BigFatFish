// beUI source adaptation; see NOTICE.txt and LICENSE.
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReducedMotion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "./utils";

type Variant = "pill" | "underline" | "segment";
/** Whether trigger icons show on every tab or only on the selected one. */
type IconDisplay = "always" | "selected";

type Ctx = {
  value: string;
  setValue: (v: string) => void;
  variant: Variant;
  icons: IconDisplay;
  /**
   * The one tab Tab reaches: the selected tab, or the first enabled one when
   * nothing enabled is selected. `null` until the triggers have registered,
   * when every enabled tab stays reachable.
   */
  tabStop: string | null;
  registerTab: (value: string, disabled: boolean) => void;
  unregisterTab: (value: string) => void;
  /** Values with a mounted panel, so triggers only point at panels that exist. */
  panels: ReadonlySet<string>;
  registerPanel: (value: string) => void;
  unregisterPanel: (value: string) => void;
  tabId: (value: string) => string;
  panelId: (value: string) => string;
};

const TabsCtx = createContext<Ctx | null>(null);

function useTabs() {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error("Tabs.* must be used inside <Tabs>");
  return ctx;
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  variant = "pill",
  icons = "always",
  children,
  className,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  variant?: Variant;
  /**
   * With "selected", a trigger's icon shows only on the selected tab
   * and hides when another is chosen. Defaults to "always".
   */
  icons?: IconDisplay;
  children: ReactNode;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const controlled = value !== undefined;
  const current = controlled ? value : internal;
  const setValue = useCallback(
    (v: string) => {
      if (!controlled) setInternal(v);
      onValueChange?.(v);
    },
    [controlled, onValueChange],
  );
  const [tabs, setTabs] = useState<Map<string, boolean>>(new Map());
  const registerTab = useCallback((tab: string, disabled: boolean) => {
    setTabs((map) => (map.get(tab) === disabled ? map : new Map(map).set(tab, disabled)));
  }, []);
  const unregisterTab = useCallback((tab: string) => {
    setTabs((map) => {
      if (!map.has(tab)) return map;
      const next = new Map(map);
      next.delete(tab);
      return next;
    });
  }, []);
  const [panels, setPanels] = useState<ReadonlySet<string>>(new Set());
  const registerPanel = useCallback((panel: string) => {
    setPanels((set) => (set.has(panel) ? set : new Set(set).add(panel)));
  }, []);
  const unregisterPanel = useCallback((panel: string) => {
    setPanels((set) => {
      if (!set.has(panel)) return set;
      const next = new Set(set);
      next.delete(panel);
      return next;
    });
  }, []);
  // Resolved during render so the list has exactly one tab stop in the same
  // commit that changes the selection or the tabs.
  let tabStop: string | null = null;
  if (tabs.size > 0) {
    const enabled = Array.from(tabs).filter(([, disabled]) => !disabled);
    tabStop = enabled.some(([tab]) => tab === current) ? current : (enabled[0]?.[0] ?? "");
  }
  const baseId = useId();
  const tabId = useCallback((tab: string) => `${baseId}-tab-${encodeURIComponent(tab)}`, [baseId]);
  const panelId = useCallback((tab: string) => `${baseId}-panel-${encodeURIComponent(tab)}`, [baseId]);
  const contextValue = useMemo(
    () => ({
      value: current,
      setValue,
      variant,
      icons,
      tabStop,
      registerTab,
      unregisterTab,
      panels,
      registerPanel,
      unregisterPanel,
      tabId,
      panelId,
    }),
    [current, icons, setValue, variant, tabStop, registerTab, unregisterTab, panels, registerPanel, unregisterPanel, tabId, panelId],
  );
  return (
    <TabsCtx.Provider value={contextValue}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  );
}

const listClasses: Record<Variant, string> = {
  pill: "inline-flex items-center gap-1 rounded-full bg-card p-1",
  underline: "inline-flex items-center gap-1 border-b border-border",
  segment: "inline-flex items-center gap-0 rounded-lg bg-card p-0.5",
};

export function TabsList({
  children,
  className,
  wrapperClassName,
  onKeyDown,
  ...props
}: {
  wrapperClassName?: string;
} & HTMLAttributes<HTMLDivElement>) {
  const { variant, value } = useTabs();
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const viewportId = useId();
  const [edges, setEdges] = useState({ overflow: false, left: false, right: false });

  const measure = useCallback(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    if (!root || !viewport) return;
    // Overlay controls do not reduce the viewport or change its scroll range.
    const overflow = viewport.scrollWidth > root.clientWidth + 1;
    const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const rtl = getComputedStyle(viewport).direction === "rtl";
    // Modern browsers expose negative scrollLeft in RTL. Clamp rubber-banding.
    const fromLeft = Math.max(0, Math.min(max, rtl ? max + viewport.scrollLeft : viewport.scrollLeft));
    const next = { overflow, left: fromLeft > 1, right: fromLeft < max - 1 };
    setEdges((previous) => previous.overflow === next.overflow && previous.left === next.left && previous.right === next.right ? previous : next);
  }, []);

  const reveal = useCallback((tab: HTMLElement | null) => {
    const viewport = viewportRef.current;
    if (!viewport || !tab) return;
    const frame = viewport.getBoundingClientRect();
    const item = tab.getBoundingClientRect();
    const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const rtl = getComputedStyle(viewport).direction === "rtl";
    const fromLeft = Math.max(0, Math.min(max, rtl ? max + viewport.scrollLeft : viewport.scrollLeft));
    // Keep the selected/focused label clear of the arrows over the faded edges.
    const left = frame.left + (fromLeft > 1 ? 36 : 0);
    const right = frame.right - (fromLeft < max - 1 ? 36 : 0);
    const delta = item.left < left ? item.left - left : item.right > right ? item.right - right : 0;
    // Scroll only this viewport; scrollIntoView can also move the whole page.
    if (delta) viewport.scrollBy({ left: delta, behavior: reduce ? "instant" : "smooth" });
  }, [reduce]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    const list = listRef.current;
    if (!root || !viewport || !list) return;
    const update = () => {
      measure();
      reveal(list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]'));
    };
    const observer = new ResizeObserver(update);
    observer.observe(root);
    observer.observe(viewport);
    observer.observe(list);
    viewport.addEventListener("scroll", measure, { passive: true });
    update();
    return () => {
      observer.disconnect();
      viewport.removeEventListener("scroll", measure);
    };
  }, [measure, reveal]);

  useLayoutEffect(() => {
    // Children may change without a resize; controlled selection must also reveal.
    void children;
    void value;
    void edges.overflow;
    measure();
    reveal(listRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? null);
  }, [children, value, edges.overflow, measure, reveal]);

  // Arrow keys move along the list and select as focus arrives, wrapping at
  // the ends; Home and End jump to the first and last enabled tab.
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const list = listRef.current;
    if (!list || !(event.target instanceof HTMLElement)) return;
    const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]')).filter(
      (tab) => !tab.disabled && tab.closest('[role="tablist"]') === list,
    );
    const at = tabs.indexOf(event.target as HTMLButtonElement);
    if (at < 0) return;
    const rtl = getComputedStyle(list).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    const next =
      event.key === forward
        ? tabs[(at + 1) % tabs.length]
        : event.key === back
          ? tabs[(at - 1 + tabs.length) % tabs.length]
          : event.key === "Home"
            ? tabs[0]
            : event.key === "End"
              ? tabs[tabs.length - 1]
              : null;
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.click();
  };

  const scroll = (direction: number) => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollBy({ left: direction * viewport.clientWidth * 0.8, behavior: reduce ? "instant" : "smooth" });
  };
  const controlClass = "absolute inset-y-0 z-20 inline-flex w-9 items-center justify-center text-foreground transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-0";
  const surfaceClass = variant === "pill" ? "rounded-full bg-card" : variant === "segment" ? "rounded-lg bg-card" : "";

  return (
    <div ref={rootRef} className={cn("relative isolate flex w-full max-w-full min-w-0 items-center", edges.overflow && surfaceClass, wrapperClassName)}>
      {edges.overflow && (
        <button type="button" aria-label="向左滚动分类" aria-controls={viewportId} disabled={!edges.left} onClick={() => scroll(-1)} className={cn(controlClass, "left-0 rounded-l-full")}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
      )}
      <div
        ref={viewportRef}
        id={viewportId}
        className={cn("w-full min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", edges.overflow && "[border-radius:inherit]")}
        style={edges.overflow ? {
          maskImage: `linear-gradient(to right, ${edges.left ? "transparent, black 40px" : "black, black 0px"}, ${edges.right ? "black calc(100% - 40px), transparent" : "black 100%"})`,
        } : undefined}
        onFocusCapture={(event) => {
          if (event.target instanceof HTMLElement && event.target.getAttribute("role") === "tab") reveal(event.target);
        }}
      >
        <div {...props} ref={listRef} role="tablist" onKeyDown={onListKeyDown} className={cn(listClasses[variant], "w-max", className)}>
          {children}
        </div>
      </div>
      {edges.overflow && edges.left && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 rounded-l-[inherit] backdrop-blur-[2px] [mask-image:linear-gradient(to_right,black,transparent)]" />
      )}
      {edges.overflow && edges.right && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 rounded-r-[inherit] backdrop-blur-[2px] [mask-image:linear-gradient(to_left,black,transparent)]" />
      )}
      {edges.overflow && (
        <button type="button" aria-label="向右滚动分类" aria-controls={viewportId} disabled={!edges.right} onClick={() => scroll(1)} className={cn(controlClass, "right-0 rounded-r-full")}>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Keep selected icons visible without waiting for an animation frame. */
function TriggerIcon({ icon, active }: { icon: ReactNode; active: boolean }) {
  const { icons } = useTabs();
  if (icons === "selected" && !active) return null;
  return <span aria-hidden="true" className="mr-1.5 inline-flex shrink-0 items-center">{icon}</span>;
}

export function TabsTrigger({
  value,
  icon,
  children,
  className,
  indicatorClassName,
  onClick,
  ...props
}: {
  value: string;
  /** An icon before the label, such as a Lucide icon element. */
  icon?: ReactNode;
  indicatorClassName?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value">) {
  const {
    value: current,
    setValue,
    variant,
    tabStop,
    registerTab,
    unregisterTab,
    panels,
    tabId,
    panelId,
  } = useTabs();
  const active = current === value;
  const disabled = Boolean(props.disabled);
  useLayoutEffect(() => {
    registerTab(value, disabled);
  }, [registerTab, value, disabled]);
  useLayoutEffect(() => () => unregisterTab(value), [unregisterTab, value]);
  const a11y = {
    id: tabId(value),
    "aria-controls": panels.has(value) ? panelId(value) : undefined,
    tabIndex: !disabled && (tabStop === null || tabStop === value) ? 0 : -1,
  };
  const content = icon ? (
    <>
      <TriggerIcon icon={icon} active={active} />
      {children}
    </>
  ) : (
    children
  );
  if (variant === "underline") {
    return (
      <button
        // Consumer ids and wiring win, e.g. several tabs sharing one panel.
        {...a11y}
        {...props}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) setValue(value);
        }}
        className={cn(
          "relative isolate px-3 pb-2.5 pt-1 -mb-px text-sm font-medium transition-colors min-h-[44px] inline-flex items-center whitespace-nowrap shrink-0",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        {content}
        {active ? (
        <span
          className={cn(
            "absolute bottom-0 left-0 right-0 h-px bg-primary",
            indicatorClassName,
          )}
        />
        ) : null}
      </button>
    );
  }

  const radius = variant === "pill" ? "rounded-full" : "rounded-md";
  return (
    <div className="shrink-0 relative">
      {active && <span data-tabs-indicator="" className={cn("absolute inset-0 bg-primary", radius, indicatorClassName)} />}
      <button
        // Consumer ids and wiring win, e.g. several tabs sharing one panel.
        {...a11y}
        {...props}
        type="button"
        role="tab"
        aria-selected={active}
        data-tabs-value={value}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) setValue(value);
        }}
        className={cn(
          "relative z-10 inline-flex items-center justify-center whitespace-nowrap bg-transparent px-3.5 py-1.5 text-sm font-medium outline-none",
          active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          radius,
          className,
        )}
      >
        {content}
      </button>
    </div>
  );
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { value: current, registerPanel, unregisterPanel, tabId, panelId } = useTabs();
  const active = current === value;
  useLayoutEffect(() => {
    registerPanel(value);
    return () => unregisterPanel(value);
  }, [registerPanel, unregisterPanel, value]);
  // Content must be visible on commit, even when a native WebView pauses frames.
  // Keep the same element mounted across selection changes to preserve form state.
  return (
    <div
      id={panelId(value)}
      role="tabpanel"
      aria-labelledby={tabId(value)}
      hidden={!active}
      tabIndex={active ? 0 : undefined}
      className={cn("mt-4 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring rounded-md", className)}
    >
      {children}
    </div>
  );
}
