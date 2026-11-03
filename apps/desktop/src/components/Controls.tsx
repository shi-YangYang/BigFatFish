import type { ComponentPropsWithRef, HTMLAttributes } from "react";

type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: "secondary" | "primary" | "ghost" | "danger";
  size?: "regular" | "compact" | "icon";
};
/** Shared native semantics; form actions declare type="submit" at their call site. */
export function Button({
  variant = "secondary",
  size = "regular",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`ui-button ui-button-${variant} ui-button-${size} ${className}`}
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
