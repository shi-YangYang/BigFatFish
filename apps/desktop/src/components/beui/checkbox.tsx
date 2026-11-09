// beUI source adaptation; see NOTICE.txt and LICENSE.
"use client";

import { useId, type ReactNode } from "react";
import { cn } from "./utils";

const CHECK_PATH = "M5 13l4 4L19 7";
const INDETERMINATE_PATH = "M6 12h12";

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  indeterminate?: boolean;
  label?: ReactNode;
  /** Supporting text under the label, announced as the description rather than the name. */
  description?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
  /** Associates an external message (e.g. a form error) with the control. */
  "aria-describedby"?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  indeterminate,
  label,
  description,
  className,
  id: idProp,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: CheckboxProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const showMark = checked || indeterminate;
  const path = indeterminate ? INDETERMINATE_PATH : CHECK_PATH;
  const descriptionId = description ? `${id}-description` : undefined;
  // The wrapping <label> would fold the description into the name, so name from the label text alone.
  const labelId = label && !ariaLabel ? `${id}-label` : undefined;
  const describedBy =
    [ariaDescribedBy, descriptionId].filter(Boolean).join(" ") || undefined;

  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex gap-3",
        description ? "items-start" : "items-center",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className,
      )}
    >
      <button
        id={id}
        type="button"
        role="checkbox"
        aria-checked={indeterminate ? "mixed" : checked}
        aria-label={ariaLabel}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => !disabled && onCheckedChange(!checked)}
        data-state={
          indeterminate ? "indeterminate" : checked ? "checked" : "unchecked"
        }
        className={cn(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-60",
          showMark
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/50 bg-background hover:border-muted-foreground",
        )}
      >
        {/* Selection must remain visible when a background WebView pauses animation frames. */}
        {showMark ? (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <title>{indeterminate ? "Partially selected" : "Selected"}</title>
            <path d={path} />
          </svg>
        ) : null}
      </button>
      {label || description ? (
        <span className={cn("flex min-w-0 flex-col gap-0.5 select-none", disabled && "opacity-60")}>
          {label ? (
            <span
              id={labelId}
              // Geist sits low in a 20px line; a 16px line lifts the text onto the control.
              className={cn("text-sm text-foreground", description && "leading-4")}
            >
              {label}
            </span>
          ) : null}
          {description ? (
            <span id={descriptionId} className="text-xs text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
      ) : null}
    </label>
  );
}
