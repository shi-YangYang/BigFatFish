import { Button } from "./components/Controls";
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api, errorText, isWeb, webRequest } from "./api";
import { Chat } from "./components/Chat";
import { Setup } from "./components/Setup";
import { MyFish, Connections, Settings } from "./components/Workspaces";
import { Permissions } from "./components/Channels";
import { DouyinApprovals, type ActivityOverview } from "./components/Douyin";
import { Drawer, FishAvatar, Icon, fishGirl } from "./components/UI";
import type { ModelConfig } from "../../runtime/src/ai/types";
export default function App() {
  const [page, setPage] = useState("聊天"),
    [settingsTab, setSettingsTab] = useState("模型"),
    [error, setError] = useState("");
  const [connected, setConnected] = useState(false),
    [initialized, setInitialized] = useState(false),
    [firstRun, setFirstRun] = useState(false),
    [loading, setLoading] = useState(true);
  const [models, setModels] = useState<(ModelConfig & { hasKey: boolean })[]>(
      [],
    ),
    [drawer, setDrawer] = useState(false),
    [menu, setMenu] = useState(false),
    [approvalCount, setApprovalCount] = useState(0),
    [activity, setActivity] = useState<ActivityOverview>();
  const live = useRef(false);
  const fail = useCallback((e: unknown) => setError(errorText(e)), []);
  const reload = useCallback(async () => {
    setModels(await api("/v1/models"));
  }, []);
  const connect = useCallback(async () => {
    try {
      await (isWeb ? api("/v1/status") : invoke("runtime_status"));
      if (live.current) {
        setConnected(true);
        setInitialized(true);
        setError("");
      }
      await reload().catch(fail);
      return true;
    } catch (e) {
      if (live.current) {
        setConnected(false);
        fail(e);
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
      const ready = await connect();
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
        return;
      }
      try {
        const [a, q, d] = await Promise.all([
          api<ActivityOverview>("/v1/activities"),
          api<{ status: string }[]>("/v1/permissions/approvals"),
          api<{ status: string }[]>("/v1/douyin/approvals"),
        ]);
        if (active) {
          setActivity(a);
          setApprovalCount(
            [...q, ...d].filter((v) => v.status === "pending").length,
          );
        }
      } catch (e) {
        if (active) fail(e);
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [initialized, fail]);
  function navigate(next: string) {
    setPage(next);
    setMenu(false);
    setError("");
  }
  const addModel = () => {
    setSettingsTab("模型");
    navigate("设置");
  };
  const menuContents = (
    <>
      <div className="brand">
        <FishAvatar />
        <div>
          <strong>BigFatFish</strong>
          <span>你的大肥鱼</span>
        </div>
      </div>
      <nav className="primary-nav" aria-label="主导航">
        {(["聊天", "我的鱼", "连接"] as const).map((item, i) => (
          <Button
            type="button"
            className={page === item ? "active" : ""}
            aria-current={page === item ? "page" : undefined}
            key={item}
            onClick={() => navigate(item)}
          >
            {i === 1 ? (
              <FishAvatar className="nav-portrait" alt="" />
            ) : (
              <Icon name={i === 0 ? "chat" : "link"} />
            )}
            {item}
          </Button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <Button
          type="button"
          className={page === "设置" ? "active" : ""}
          onClick={() => navigate("设置")}
        >
          <Icon name="settings" />
          设置
        </Button>
        <span className="sidebar-note">慢慢聊，一起成长。</span>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <aside className="app-sidebar">{menuContents}</aside>
      <div className="app-workspace">
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
          <h1>{page}</h1>
          <div className="topbar-actions">
            {approvalCount > 0 && (
              <Button
                type="button"
                className="approval-button"
                size="compact"
                onClick={() => setDrawer(true)}
              >
                待审批 <b>{approvalCount}</b>
              </Button>
            )}
            <details className="runtime-menu">
              <summary>
                <span className={`status-dot ${connected ? "online" : ""}`} />
                {connected
                  ? activity?.paused
                    ? "活动已暂停"
                    : "已连接"
                  : "未连接"}
              </summary>
              <div className="runtime-popover">
                <Button type="button" onClick={() => void connect()}>
                  重新连接
                </Button>
                {activity && (
                  <Button
                    type="button"
                    onClick={() =>
                      void api("/v1/activities/pause", "POST", {
                        paused: !activity.paused,
                      })
                        .then(() =>
                          setActivity({
                            ...activity,
                            paused: !activity.paused,
                          }),
                        )
                        .catch(fail)
                    }
                  >
                    {activity.paused ? "恢复活动" : "暂停活动"}
                  </Button>
                )}
                <Button type="button" onClick={() => setDrawer(true)}>
                  审批与记录
                </Button>
                {isWeb && (
                  <Button
                    type="button"
                    onClick={() =>
                      void webRequest("/auth/logout", "POST").catch(fail)
                    }
                  >
                    退出登录
                  </Button>
                )}
              </div>
            </details>
          </div>
        </header>
        {error && (
          <div className="app-error" role="alert">
            <span>{error}</span>
            <Button type="button" size="compact" onClick={() => setError("")}>
              关闭
            </Button>
          </div>
        )}
        {initialized && !connected && (
          <div className="connection-banner" role="status">
            连接已断开，当前内容与草稿已保留。
            <Button type="button" size="compact" onClick={() => void connect()}>
              重新连接
            </Button>
          </div>
        )}
        <main
          className={`workspace-main ${page === "聊天" ? "chat-page" : ""}`}
        >
          {loading ? (
            <div className="empty-state">正在连接…</div>
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
      {drawer && (
        <Drawer title="审批与记录" close={() => setDrawer(false)}>
          <ApprovalContents />
        </Drawer>
      )}
    </div>
  );
}

function ApprovalContents() {
  const [error, setError] = useState("");
  const fail = useCallback((e: unknown) => setError(errorText(e)), []);
  return (
    <>
      {error && (
        <div className="error approval-error" role="alert">
          <span>{error}</span>
          <Button type="button" size="compact" onClick={() => setError("")}>
            关闭提示
          </Button>
        </div>
      )}
      <Permissions fail={fail} approvalsOnly />
      <DouyinApprovals fail={fail} />
    </>
  );
}
