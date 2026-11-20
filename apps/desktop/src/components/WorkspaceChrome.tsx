import type { ReactNode } from "react";
import { BounceSidebar } from "./beui/bounce-sidebar";
import { Button } from "./Controls";
import { Icon, FishAvatar } from "./UI";

export function WorkspaceNavigation({ page, navigate }: { page: string; navigate: (page: string) => void }) {
  return (
    <>
      <div className="brand" title="BigFatFish">
        <FishAvatar />
        <div>
          <strong>BigFatFish</strong>
        </div>
      </div>
      <BounceSidebar className="primary-nav" ariaLabel="主导航"
        value={page} onValueChange={navigate} listClassName="m-0 p-0 gap-[8px]"
        itemClassName="rail-item" indicatorClassName="hidden"
        items={[{ id: "聊天", label: "聊天", icon: <Icon name="chat" /> },
          { id: "我的鱼", label: "我的鱼", icon: <Icon name="fish" /> },
          { id: "连接", label: "连接", icon: <Icon name="link" /> }]} />
      <div className="sidebar-bottom">
        <Button
          type="button"
          className={page === "设置" ? "active" : ""}
          aria-current={page === "设置" ? "page" : undefined}
          onClick={() => navigate("设置")}
        >
          <Icon name="settings" />
          <span>设置</span>
        </Button>
      </div>
    </>
  );
}

export function WorkspaceHeader({ chat, children, openMenu }: { chat: boolean; children: ReactNode; openMenu: () => void }) {
  return (
    <header className={`topbar ${chat ? "chat-topbar" : ""}`}>
      <Button
        type="button"
        className="mobile-menu"
        size="icon"
        aria-label="打开导航"
        onClick={openMenu}
      >
        <Icon name="menu" />
      </Button>
      {children}
    </header>
  );
}
