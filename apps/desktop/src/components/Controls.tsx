import {
  Children, createContext, isValidElement, useContext, useId, useRef, useState, useImperativeHandle,
  type ComponentPropsWithRef, type HTMLAttributes, type ReactNode,
} from "react";
import { Button as BeButton, type ButtonProps as BeButtonProps } from "./beui/button";
import { Input as BeInput } from "./beui/input";
import { Checkbox as BeCheckbox, type CheckboxProps } from "./beui/checkbox";
import { Select as BeSelect, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./beui/select";
import { Alert as BeAlert } from "./beui/alert";
import { Tooltip } from "./beui/tooltip";
import { cn } from "./beui/utils";
import { Loader } from "./beui/loader";

type ButtonProps = Omit<BeButtonProps, "variant" | "size"> & {
  variant?: "secondary" | "primary" | "ghost" | "danger";
  size?: "regular" | "compact" | "icon";
  busy?: boolean;
};
/** Product sizing/intent adapters; all base controls render beUI source. */
export function Button({ variant = "secondary", size = "regular", className = "", type = "button", title, busy, children, ...props }: ButtonProps) {
  const button = <BeButton pressScale={1} {...props} disabled={props.disabled || busy} aria-busy={busy || props['aria-busy']} type={type}
    variant={variant === "danger" ? "outline" : variant}
    size={size === "regular" ? "md" : size === "compact" ? "sm" : "icon"}
    className={cn(`ui-button ui-button-${variant} ui-button-${size}`,
      variant === "danger" && "text-[#a13b32] bg-[#fff7f5] border-[#ecc9c3] hover:bg-[#fff0eb]", className)}>{busy && <span aria-hidden="true"><Loader size={16} label="" /></span>}{busy && size === 'icon' ? null : children}</BeButton>;
  return title ? <Tooltip content={title}>{button}</Tooltip> : button;
}
const FieldContext = createContext<{ id: string; labelId: string; label: ReactNode } | null>(null);
export function Input({ className, value, defaultValue, onChange, ...props }: ComponentPropsWithRef<"input">) {
  const field = useContext(FieldContext);
  // File upload remains a native browser capability, with its actual ref/event.
  if (props.type === "file") return props.hidden
    ? <input {...props} onChange={onChange} className={className} />
    : <FilePicker {...props} onChange={onChange} className={className} />;
  return <BeInput {...props} id={props.id ?? field?.id}
    value={value === undefined ? undefined : String(value)}
    defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
    onChange={(_, event) => onChange?.(event)}
    className={cn("ui-input", className)}
    classNames={{ field: "h-[40px] rounded-[8px] border-solid bg-background", input: "border-0 p-0 px-[12px] text-[14px] font-[inherit]" }} />;
}
function FilePicker({ onChange, className, ...props }: ComponentPropsWithRef<"input">) {
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(props.ref, () => input.current!, []);
  const field = useContext(FieldContext);
  const [fileName, setFileName] = useState("");
  return <div className={cn("file-picker", className)}>
    <input {...props} id={undefined} ref={input} type="file" hidden onChange={(event) => {
      setFileName(event.target.files?.[0]?.name ?? "");
      onChange?.(event);
    }} />
    <Button id={props.id ?? field?.id} aria-labelledby={field?.labelId} disabled={props.disabled} onClick={() => input.current?.click()}>选择文件</Button>
    <span className="muted">{fileName || "未选择文件"}</span>
  </div>;
}
type SelectProps = Pick<ComponentPropsWithRef<"select">, "children" | "className" | "disabled" | "aria-label" | "aria-describedby" | "id" | "name" | "required"> & {
  value?: string | number;
  onValueChange?: (value: string) => void;
};
export function Select({ className, children, value, onValueChange, disabled, id, name, required, ...aria }: SelectProps) {
  const field = useContext(FieldContext);
  const autoId = useId();
  const [invalid, setInvalid] = useState(false);
  const baseId = id ?? field?.id ?? autoId;
  return <BeSelect id={baseId} value={value === undefined ? undefined : String(value)} onValueChange={(next) => { setInvalid(false); onValueChange?.(next); }} disabled={disabled} className={cn("ui-select", className)}>
    <SelectTrigger {...aria} aria-required={required} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${baseId}-error` : aria["aria-describedby"]} aria-labelledby={aria["aria-label"] ? undefined : field?.labelId} name={name} className="h-[40px] rounded-[8px] border-solid px-[12px] text-[14px]">
      <SelectValue placeholder="请选择" className="min-w-0 truncate text-left" />
    </SelectTrigger>
    {required && <input aria-hidden="true" tabIndex={-1} className="select-validation" value={value ?? ""} required disabled={disabled} onChange={() => {}} onInvalid={(event) => {
      event.preventDefault();
      const trigger = document.getElementById(`${baseId}-trigger`);
      setInvalid(true);
      trigger?.focus();
    }} />}
    <SelectContent className="max-h-[280px] overflow-y-auto border-solid">
      {Children.toArray(children).flatMap((child) => {
        if (!isValidElement<ComponentPropsWithRef<"option">>(child)) return [];
        return <SelectItem key={String(child.props.value)} value={String(child.props.value ?? "")} disabled={child.props.disabled} className="min-h-[36px] text-[14px]">{Children.toArray(child.props.children).join("")}</SelectItem>;
      })}
    </SelectContent>
    {invalid && <BeAlert id={`${baseId}-error`} variant="destructive" className="mt-[8px] rounded-[8px]" contentClassName="px-[12px] py-[8px]">请选择一项。</BeAlert>}
  </BeSelect>;
}
export function Textarea({ className = "", ...props }: ComponentPropsWithRef<"textarea">) {
  const field = useContext(FieldContext);
  return <textarea {...props} id={props.id ?? field?.id} className={`ui-textarea ${className}`} />;
}
export function Checkbox({ className, ...props }: CheckboxProps) {
  const field = useContext(FieldContext);
  return <BeCheckbox {...props} id={props.id ?? field?.id} label={props.label ?? field?.label} className={cn("ui-checkbox", className)} />;
}
/** Explicit association works with native inputs and beUI button-based controls. */
export function Field({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const id = useId();
  const nodes = Children.toArray(children);
  const isControl = (node: ReactNode) => isValidElement(node) && [Input, Select, Textarea, Checkbox].some((type) => node.type === type);
  const controls = nodes.filter(isControl);
  const label = nodes.filter((node) => !isControl(node));
  const checkbox = controls.some((node) => isValidElement(node) && node.type === Checkbox);
  const select = controls.some((node) => isValidElement(node) && node.type === Select);
  const context = { id, labelId: `${id}-label`, label };
  return <div {...props} className={`ui-field ${className}`}>
    {!checkbox && <label id={context.labelId} htmlFor={select ? `${id}-trigger` : id}>{label}</label>}
    <FieldContext.Provider value={context}>{controls}</FieldContext.Provider>
  </div>;
}
export function ActionRow({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`ui-actions ${className}`} />;
}
export function FormGrid({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`ui-form-grid ${className}`} />;
}
