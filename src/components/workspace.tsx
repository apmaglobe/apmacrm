"use client";
import {useTheme} from "./theme";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { Menu, Sun, Moon, LogOut, Bell, ChevronDown, ShieldCheck, Users } from "lucide-react";
import { browserClient } from "@/lib/auth/browser";
import { modules } from "@/lib/domain";
import { BrandLogo } from "@/components/brand-logo";
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function Workspace({
  children,
  organizations,
  members,
  org,
  userId,
  isAdmin = false,
}: {
  children: React.ReactNode;
  organizations: { id: string; name: string; logo_path?:string|null }[];
  members: { id: string; user_id: string; name: string }[];
  org: string;
  userId: string;
  isAdmin?: boolean;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15000, retry: 1, refetchOnWindowFocus: true },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <Frame org={org} organizations={organizations} members={members} userId={userId} isAdmin={isAdmin}>
        {children}
      </Frame>
    </QueryClientProvider>
  );
}
function Frame({
  children,
  organizations,
  members,
  org,
  userId,
  isAdmin = false,
}: {
  children: React.ReactNode;
  organizations: { id: string; name: string; logo_path?:string|null }[];
  members: { id: string; user_id: string; name: string }[];
  org: string;
  userId: string;
  isAdmin?: boolean;
}) {
  const {dark,toggle:toggleTheme}=useTheme();
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const path = usePathname(),
    router = useRouter(),
    cache = useQueryClient();
  const [open, setOpen] = useState(false),
    [live, setLive] = useState(false),
    [onlineOpen, setOnlineOpen] = useState(false),
    [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const onlineMembers = members.filter((member) => onlineUserIds.includes(member.user_id));
  useEffect(() => {
    const db = browserClient();
    const channel = db
      .channel(`member:${userId}`, { config: { private: true } })
      .on("broadcast", { event: "invalidate" }, async ({ payload }) => {
        await cache.cancelQueries({queryKey:["workspace",org]});
        if (payload?.access_changed) {
          cache.resetQueries();
          router.refresh();
        } else cache.invalidateQueries();
      })
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") {
          cache.invalidateQueries();
        }
      });
    const presence = db
      .channel(`presence:${org}`, { config: { private: true, presence: { key: userId } } })
      .on("presence", { event: "sync" }, () => {
        setOnlineUserIds(Object.keys(presence.presenceState()));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void presence.track({ active_at: new Date().toISOString() });
        if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") setOnlineUserIds([]);
      });
    const { data } = db.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        cache.clear();
        router.replace("/login");
      }
    });
    return () => {
      db.removeChannel(channel);
      db.removeChannel(presence);
      data.subscription.unsubscribe();
      cache.clear();
    };
  }, [cache, org, router, userId]);
  return (
    <div className={dark ? "app dark" : "app"}>
      <header className="topbar">
        <Link href="/workspace/crm" className="brand">
          <BrandLogo />
        </Link>
        <button className="org-switch" onClick={() => setOpen(!open)}>
          {organizations.find((x) => x.id === org)?.name}
          <ChevronDown size={14} />
        </button>
        <div className="top-actions">
          {isAdmin && <Link href={`/workspace/admin?org=${org}`} className="button admin-entry"><ShieldCheck size={18}/>Admin panel</Link>}
          <span
            className="connection-status"
            data-live={live}
            title={live ? "Canlı bağlantı" : "Canlı bağlantı bərpa olunur"}
          >
            <span className="connection-dot" aria-hidden="true" />
            {live ? "Canlı" : "Bağlanır…"}
          </span>
          <div className="online-presence-wrap">
            <button
              className="online-presence"
              type="button"
              onClick={() => setOnlineOpen((value) => !value)}
              aria-expanded={onlineOpen}
              aria-label={`Hazırda ${onlineMembers.length} əməkdaş onlayndır`}
            >
              <span className="online-dot" aria-hidden="true" />
              <Users size={16} />
              <span>{onlineMembers.length} onlayn</span>
            </button>
            {onlineOpen && <div className="online-popover" role="status">
              <strong>Hazırda onlayn</strong>
              {onlineMembers.length ? <ul>{onlineMembers.map((member) => <li key={member.id}><span className="avatar">{member.name.slice(0, 1).toUpperCase()}</span>{member.name}</li>)}</ul> : <p>Hazırda onlayn əməkdaş yoxdur.</p>}
            </div>}
          </div>
          <Link
            className="icon-button"
            href="/workspace/inbox"
            aria-label="Bildirişlər"
          >
            <Bell size={18} />
          </Link>
          <button
            className="icon-button"
            aria-label="Temanı dəyiş"
            disabled={!ready}
            onClick={toggleTheme}
            aria-pressed={dark}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="icon-button"
            aria-label="Çıxış"
            disabled={!ready}
            onClick={async () => {
              cache.clear();
              await browserClient().auth.signOut();
              router.replace("/login");
            }}
          >
            <LogOut size={18} />
          </button>
          <button
            className="icon-button mobile-toggle"
            aria-label="Menyu"
            disabled={!ready}
            aria-expanded={open}
            aria-controls="workspace-navigation"
            onClick={() => setOpen(!open)}
          >
            <Menu />
          </button>
        </div>
      </header>
      <nav
        className={"main-nav " + (open ? "open" : "")}
        aria-label="Əsas menyu"
        id="workspace-navigation"
      >
        {isAdmin && <Link className="mobile-admin-entry" href={`/workspace/admin?org=${org}`} onClick={()=>setOpen(false)}>Admin panel</Link>}
        {modules.map(([id, label]) => (
          <Link
            key={id}
            href={"/workspace/" + id + "?org=" + org}
            onClick={() => setOpen(false)}
            className={path.endsWith("/" + id) ? "active" : ""}
          >
            {label}
          </Link>
        ))}
        {open && organizations.length > 1 && (
          <div className="tenant-options">
            {organizations.map((o) => (
              <Link
                key={o.id}
                href={"/workspace/crm?org=" + o.id}
                onClick={() => {
                  cache.clear();
                  setOpen(false);
                }}
              >
                {o.name}
              </Link>
            ))}
          </div>
        )}
      </nav>
      <main className="workspace">{children}</main>
      <footer className="app-footer">
        <span>APMA CRM</span>
        <span>Asia/Baku · AZN</span>
      </footer>
    </div>
  );
}
