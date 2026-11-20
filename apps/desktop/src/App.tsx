import { Notifications, notifyError, clearNotifications } from './components/Notifications';
import { EmptyState } from "./components/PageLayout";
import { Alert, Loading } from "./components/Surfaces";
import { WorkspaceHeader, WorkspaceNavigation } from "./components/WorkspaceChrome";
import { Button } from "./components/Controls";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api } from "./api/client";
import { Chat } from "./features/chat/Chat";
import { Models, type ModelTask } from "./features/settings/Models";
import { Setup } from "./features/settings/Setup";
import { MyFish } from "./features/fish/MyFish";
import { Connections } from "./features/connections/Connections";
import { Settings } from "./features/settings/Settings";
import { Drawer, FishAvatar, fishGirl } from "./components/UI";
import type { ModelConfig } from "../../runtime/src/ai/types";
export default function App() {
  const [page, setPage] = useState("聊天"),
    [settingsTab, setSettingsTab] = useState("模型与声音");
  const [connected, setConnected] = useState(false),
    [initialized, setInitialized] = useState(false),
    [firstRun, setFirstRun] = useState(false),
    [loading, setLoading] = useState(true);
  const [models, setModels] = useState<(ModelConfig & { hasKey: boolean })[]>(
      [],
    ),
    [menu, setMenu] = useState(false);
  const [modelTask, setModelTask] = useState<ModelTask>();
  const [planIntent, setPlanIntent] = useState<{platform: "bilibili" | "douyin"; id: number}>();
  const nextPlanId = useRef(0);
  const live = useRef(false);
  const fail = notifyError;
  const reload = useCallback(async () => {
    setModels(await api("/v1/models"));
  }, []);
  const connect = useCallback(async (silent = false) => {
    try {
      await invoke("runtime_status");
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
    void invoke<{ complete: boolean }>("desktop_settings")
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
  function openChatModel(complete?: ModelTask["complete"], conversationOnly = false) {
    setModelTask({ purpose: "chat", conversationOnly, complete: async id => {
      await complete?.(id); setModelTask(undefined); navigate("聊天");
    } });
  }
  function openSoundModel(purpose: "asr" | "tts") {
    setModelTask({ purpose, complete: () => setModelTask(undefined) });
  }
  function openPlan(platform: "bilibili" | "douyin") {
    setPlanIntent({ platform, id: ++nextPlanId.current }); navigate("我的鱼");
  }
  const menuContents = <WorkspaceNavigation page={page} navigate={navigate} />;
  const renderHeader = (content: ReactNode) => (
    <WorkspaceHeader chat={page === "聊天" && !firstRun} openMenu={() => setMenu(true)}>{content}</WorkspaceHeader>
  );
  const chatVisible = initialized && !loading && !firstRun && page === "聊天";
  return (
    <div className={firstRun ? "app-shell first-run-shell" : "app-shell"}>
      {!firstRun && <aside className="app-sidebar">{menuContents}</aside>}
      <div className="app-workspace">
        {!chatVisible && renderHeader(<h1 className="page-title">{firstRun ? "首次设置" : page}</h1>)}
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
          className={`workspace-main ${page === "聊天" && !firstRun ? "chat-page" : ""}`}
        >
          {loading ? (
            <Loading>正在连接…</Loading>
          ) : firstRun ? (
            <div className="content-page settings-page">
              <Setup
                fail={fail}
                done={() => {
                  setFirstRun(false);
                  navigate("聊天");
                  openChatModel();
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
                    configureModel={openChatModel}
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
                    <MyFish fail={fail} onChat={() => navigate("聊天")} planIntent={planIntent} onPlanHandled={id => setPlanIntent(value => value?.id === id ? undefined : value)} />
                  ) : page === "连接" ? (
                    <Connections fail={fail} onPlan={openPlan} />
                  ) : (
                    <Settings
                      openSoundModel={openSoundModel}
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
                <EmptyState className="workspace-unavailable" icon={<FishAvatar alt="" />} title="暂时无法连接你的鱼">
                  <Button variant="primary" type="button" onClick={() => void connect()}>
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
                </EmptyState>
              )}
            </>
          )}
        </main>
      </div>
      {modelTask && <Models models={models} reload={reload} fail={fail} direct={modelTask} dismiss={() => setModelTask(undefined)} />}
      {menu && !firstRun && (
        <Drawer title="导航" close={() => setMenu(false)}>
          <div className="mobile-navigation">{menuContents}</div>
        </Drawer>
      )}
    </div>
  );
}
