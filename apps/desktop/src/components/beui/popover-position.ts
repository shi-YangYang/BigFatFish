// beUI source adaptation; see NOTICE.txt and LICENSE.
"use client";

import {
  type MutableRefObject,
  useCallback,
  useLayoutEffect,
  useState,
} from "react";

export type PortalLayout = {
  trigger: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  content: {
    width: number;
    height: number;
    naturalHeight: number;
  };
  viewport: { left: number; top: number; width: number; height: number };
};

export const POPOVER_GUTTER = 8;

/** Resolve the panel, not the trigger, against the visible viewport. */
export function placePopover(
  { trigger, content, viewport }: PortalLayout,
  side: "top" | "bottom",
  align: "start" | "center" | "end",
  gap: number,
) {
  const left = viewport.left + POPOVER_GUTTER;
  const top = viewport.top + POPOVER_GUTTER;
  const right = viewport.left + viewport.width - POPOVER_GUTTER;
  const bottom = viewport.top + viewport.height - POPOVER_GUTTER;
  const above = Math.max(0, trigger.top - gap - top);
  const below = Math.max(0, bottom - trigger.top - trigger.height - gap);
  const requestedSpace = side === "top" ? above : below;
  const otherSpace = side === "top" ? below : above;
  const resolvedSide = content.naturalHeight > requestedSpace && otherSpace > requestedSpace
    ? side === "top" ? "bottom" : "top"
    : side;
  const maxHeight = Math.min(Math.max(0, bottom - top), resolvedSide === "top" ? above : below);
  const width = Math.min(content.width, Math.max(0, right - left));
  const height = Math.min(content.height, maxHeight);
  const preferredLeft = trigger.left + (align === "start" ? 0 : align === "end" ? trigger.width - width : (trigger.width - width) / 2);
  const preferredTop = resolvedSide === "top" ? trigger.top - gap - height : trigger.top + trigger.height + gap;
  return {
    x: Math.max(left, Math.min(preferredLeft, right - width)) - trigger.left,
    y: Math.max(top, Math.min(preferredTop, bottom - height)) - trigger.top,
    width,
    height,
    maxHeight,
    side: resolvedSide,
  };
}

function sameLayout(a: PortalLayout | null, b: PortalLayout) {
  return (
    a?.trigger.left === b.trigger.left &&
    a.trigger.top === b.trigger.top &&
    a.trigger.width === b.trigger.width &&
    a.trigger.height === b.trigger.height &&
    a.content.width === b.content.width &&
    a.content.height === b.content.height &&
    a.content.naturalHeight === b.content.naturalHeight &&
    a.viewport.left === b.viewport.left &&
    a.viewport.top === b.viewport.top &&
    a.viewport.width === b.viewport.width &&
    a.viewport.height === b.viewport.height
  );
}

/** Measures a trigger and portalled panel in viewport coordinates. */
export function usePopoverPortalPosition<
  TriggerElement extends HTMLElement,
  ContentElement extends HTMLElement,
>(
  triggerRef: MutableRefObject<TriggerElement | null>,
  contentRef: MutableRefObject<ContentElement | null>,
  active: boolean,
) {
  const [layout, setLayout] = useState<PortalLayout | null>(null);

  const update = useCallback(() => {
    const trigger = triggerRef.current;
    const content = contentRef.current;
    if (!trigger || !content) return;

    const rect = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const next: PortalLayout = {
      trigger: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
      content: {
        width: content.offsetWidth,
        height: content.offsetHeight,
        naturalHeight: Math.max(content.offsetHeight, content.scrollHeight),
      },
      viewport: {
        left: viewport?.offsetLeft ?? 0,
        top: viewport?.offsetTop ?? 0,
        width: viewport?.width ?? document.documentElement.clientWidth,
        height: viewport?.height ?? document.documentElement.clientHeight,
      },
    };
    setLayout((current) => (sameLayout(current, next) ? current : next));
  }, [contentRef, triggerRef]);

  useLayoutEffect(() => {
    update();
    if (!active) return;

    const trigger = triggerRef.current;
    const content = contentRef.current;
    const observer = new ResizeObserver(update);
    if (trigger) observer.observe(trigger);
    if (content) observer.observe(content);

    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [active, contentRef, triggerRef, update]);

  return layout;
}
