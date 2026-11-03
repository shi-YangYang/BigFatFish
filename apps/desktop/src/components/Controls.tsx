import type { ComponentPropsWithRef, HTMLAttributes } from "react";

import { Button as BeButton, type ButtonProps as BeButtonProps } from "./beui/button";
import { cn } from "./beui/utils";

type ButtonProps = Omit<BeButtonProps, "variant" | "size"> & {
  variant?: "secondary" | "primary" | "ghost" | "danger";
  size?: "regular" | "compact" | "icon";
};
/** Compatibility entry point; rendering and base variants come from beUI. */
export function Button({
  variant = "secondary",
  size = "regular",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <BeButton
      {...props}
      type={type}
      variant={variant === "danger" ? "outline" : variant}
      size={size === "regular" ? "md" : size === "compact" ? "sm" : "icon"}
      className={cn(
        `ui-button ui-button-${variant} ui-button-${size}`,
        variant === "danger" && "text-[#a13b32] bg-[#fff7f5] border-[#ecc9c3] hover:bg-[#fff0eb]",
        className,
      )}
    />
  );
}
export function Input({
  className = "",
  ...props
}: ComponentPropsWithRef<"input">) {
  return <input {...props} className={`ui-input ${className}`} />;
}
export function Select({
  className = "",
  ...props
}: ComponentPropsWithRef<"select">) {
  return <select {...props} className={`ui-select ${className}`} />;
}
export function Textarea({
  className = "",
  ...props
}: ComponentPropsWithRef<"textarea">) {
  return <textarea {...props} className={`ui-textarea ${className}`} />;
}
export function Checkbox({
  className = "",
  ...props
}: ComponentPropsWithRef<"input">) {
  return (
    <input {...props} type="checkbox" className={`ui-checkbox ${className}`} />
  );
}
/** Children remain inside the native label, including dynamic labels and help text. */
export function Field({
  className = "",
  ...props
}: ComponentPropsWithRef<"label">) {
  return <label {...props} className={`ui-field ${className}`} />;
}
export function ActionRow({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`ui-actions ${className}`} />;
}
export function FormGrid({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`ui-form-grid ${className}`} />;
}
