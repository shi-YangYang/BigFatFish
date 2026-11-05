import { Button } from "./Controls";
import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Tabs as BeTabs, TabsList, TabsTrigger, TabsContent } from "./beui/tabs";
import { Drawer as BeDrawer } from "./beui/drawer";
import fishGirl from "../assets/fish-girl.png";
export { fishGirl };
export function FishAvatar({
  className = "",
  alt = "大肥鱼娘",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img className={`fish-portrait ${className}`} src={fishGirl} alt={alt} />
  );
}
export function Icon({
  name,
}: {
  name: "chat" | "fish" | "link" | "settings" | "menu" | "close" | "plus" | "history";
}) {
  const paths = {
    chat: "M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Z",
    fish: "M4 12c4-7 10-7 14 0-4 7-10 7-14 0Zm14 0 4-4v8l-4-4ZM8 11h.01",
    link: "m9 15 6-6M7 14l-2 2a3 3 0 0 0 4 4l4-4m-2-8 4-4a3 3 0 0 1 4 4l-2 2",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
    menu: "M4 6h16M4 12h16M4 18h16",
    close: "m6 6 12 12M6 18 18 6",
    plus: "M12 5v14M5 12h14",
    history: "M3 11a9 9 0 1 1 2.7 7M3 4v7h7m2-5v6l4 2",
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  children,
}: {
  items: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  children: ReactNode;
}) {
  return <BeTabs value={value} onValueChange={(next) => onChange(next as T)} variant="pill">
    <TabsList aria-label={label} className="section-tabs rounded-[8px] p-0" wrapperClassName="section-tabs-wrap">
      {items.map((item) => <TabsTrigger value={item} key={item} className="h-[40px] min-w-[76px] px-[16px] text-[14px]">{item}</TabsTrigger>)}
    </TabsList>
    {items.map((item) => <TabsContent key={item} value={item} className="mt-0">{value === item ? children : null}</TabsContent>)}
  </BeTabs>;
}
export function Drawer({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return createPortal(<BeDrawer open animated={false} onOpenChange={(open) => { if (!open) close(); }} ariaLabel={title} className="drawer border-solid">
    <div className="drawer-heading">
      <h2>{title}</h2>
      <Button type="button" size="icon" aria-label="关闭" title="关闭" onClick={close}><Icon name="close" /></Button>
    </div>
    <div className="drawer-body">{children}</div>
  </BeDrawer>, document.body);
}
