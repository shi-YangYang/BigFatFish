import { Notifications, notifyError, clearNotifications } from './components/Notifications';
import { Alert, Loading } from "./components/Surfaces";
import { BounceSidebar } from "./components/beui/bounce-sidebar";
import { Button } from "./components/Controls";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api, isWeb } from "./api/client";
import { Chat } from "./features/chat/Chat";
import { Setup } from "./features/settings/Setup";
import { MyFish } from "./features/fish/MyFish";
import { Connections } from "./features/connections/Connections";
import { Settings } from "./features/settings/Settings";
import { Drawer, FishAvatar, Icon, fishGirl } from "./components/UI";
import type { ModelConfig } from "../../runtime/src/ai/types";
export default function App() {
  const [page, setPage] = useState("聊天"),
    [settingsTab, setSettingsTab] = useState("模型");
  const [connected, setConnected] = useState(false),
    [initialized, setInitialized] = useState(false),
    [firstRun, setFirstRun] = useState(false),
    [loading, setLoading] = useState(true);
  const [models, setModels] = useState<(ModelConfig & { hasKey: boolean })[]>(
      [],
    ),
    [menu, setMenu] = useState(false);
  const live = useRef(false);
  const fail = notifyError;
  const reload = useCallback(async () => {
    setModels(await api("/v1/models"));
  }, []);
  const connect = useCallback(async (silent = false) => {
    try {
      await (isWeb ? api("/v1/status") : invoke("runtime_status"));
      if (live.current) {
        setConnected(true);
        setInitialized(true);
        clearNotifications();
      }
      await reload().catch(fail);
      return true;
    } catch (e) {
      if (live.current) {
        setConnected(false);
        if (!silent) fail(e);
      }
      return false;
    }
  }, [reload, fail]);
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = fishGirl;
  }, []);
  useEffect(() => {
    live.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = async (count: number) => {
      const ready = await connect(count > 0);
      if (live.current && !ready && count < 20)
        timer = setTimeout(() => void attempt(count + 1), 500);
    };
    void (
      isWeb
        ? Promise.resolve({ complete: true })
        : invoke<{ complete: boolean }>("desktop_settings")
    )
      .then((s) => {
        if (!live.current) return;
        setFirstRun(!s.complete);
        if (s.complete) void attempt(0);
        setLoading(false);
      })
      .catch((e) => {
        if (live.current) {
          fail(e);
          setLoading(false);
        }
      });
    return () => {
      live.current = false;
      if (timer) clearTimeout(timer);
    };
  }, [connect, fail]);
  useEffect(() => {
    if (!initialized) return;
    let active = true;
    const poll = async () => {
      try {
        await api("/v1/status");
        if (active) setConnected(true);
      } catch {
        if (active) setConnected(false);
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [initialized]);
  function navigate(next: string) {
    setPage(next);
    setMenu(false);
    clearNotifications();
  }
  const addModel = () => {
    setSettingsTab("模型");
    navigate("设置");
  };
  const menuContents = (
    <>
      <div className="brand" title="BigFatFish">
        <FishAvatar />
        <div>
          <strong>BigFatFish</strong>
          <span>你的大肥鱼</span>
        </div>
      </div>
      <BounceSidebar className="primary-nav" ariaLabel="主导航"
        value={page} onValueChange={navigate} listClassName="m-0 p-0 gap-[8px]"
        itemClassName="rail-item" indicatorClassName="hidden"
        items={[{ id: "聊天", label: "聊天", icon: <Icon name="chat" /> },
          { id: "我的鱼", label: "我的鱼", icon: <FishAvatar className="nav-portrait" alt="" /> },
          { id: "连接", label: "连接", icon: <Icon name="link" /> }]} />
      <div className="sidebar-bottom">
        <Button
          type="button"
          className={page === "设置" ? "active" : ""}
          onClick={() => navigate("设置")}
        >
          <Icon name="settings" />
          <span>设置</span>
        </Button>
      </div>
    </>
  );
  const renderHeader = (content: ReactNode) => (
    <header className="topbar">
      <Button
        type="button"
        className="mobile-menu"
        size="icon"
        aria-label="打开导航"
        onClick={() => setMenu(true)}
      >
        <Icon name="menu" />
      </Button>
      {content}
    </header>
  );
  const chatVisible = initialized && !loading && !firstRun && page === "聊天";
  return (
    <div className="app-shell">
      <aside className="app-sidebar">{menuContents}</aside>
      <div className="app-workspace">
        {!chatVisible && renderHeader(<h1 className="page-title">{page}</h1>)}
        <Notifications />
        {initialized && !connected && (
          <Alert variant="warning" className="connection-banner" role="status">
            服务连接已断开，当前内容与草稿已保留。
            <Button type="button" size="compact" onClick={() => void connect()}>
              重新连接
            </Button>
          </Alert>
        )}
        <main
          className={`workspace-main ${page === "聊天" ? "chat-page" : ""}`}
        >
          {loading ? (
            <Loading>正在连接…</Loading>
          ) : firstRun ? (
            <div className="content-page settings-page">
              <Setup
                fail={fail}
                done={() => {
                  setFirstRun(false);
                  addModel();
                  void connect();
                }}
              />
            </div>
          ) : (
            <>
              {initialized && (
                <div className="chat-mount" hidden={page !== "聊天"}>
                  <Chat
                    models={models}
                    fail={fail}
                    configureModel={addModel}
                    connected={connected}
                    active={page === "聊天"}
                    renderHeader={renderHeader}
                  />
                </div>
              )}
              {page !== "聊天" && (
                <div
                  className={`content-page ${page === "设置" ? "settings-page" : ""}`}
                >
                  {page === "我的鱼" ? (
                    <MyFish fail={fail} />
                  ) : page === "连接" ? (
                    <Connections fail={fail} />
                  ) : (
                    <Settings
                      models={models}
                      reload={reload}
                      fail={fail}
                      done={() => void connect()}
                      tab={settingsTab}
                      setTab={setSettingsTab}
                    />
                  )}
                </div>
              )}
              {page === "聊天" && !initialized && (
                <div className="empty-state">
                  <FishAvatar />
                  <h2>暂时无法连接你的鱼</h2>
                  <Button type="button" onClick={() => void connect()}>
                    重新连接
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setSettingsTab("通用");
                      navigate("设置");
                    }}
                  >
                    打开运行设置
                  </Button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
      {menu && (
        <Drawer title="导航" close={() => setMenu(false)}>
          <div className="mobile-navigation">{menuContents}</div>
        </Drawer>
      )}
    </div>
  );
}
