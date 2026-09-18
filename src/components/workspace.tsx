"use client";
import {useTheme} from "./theme";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Menu, Sun, Moon, LogOut, Bell, ChevronDown, ShieldCheck, Users } from "lucide-react";
import { browserClient } from "@/lib/auth/browser";
import { modules, navGroups } from "@/lib/domain";
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
    [onlineUserIds, setOnlineUserIds] = useState<string[]>([]),
    [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);
  const onlineMembers = members.filter((member) => onlineUserIds.includes(member.user_id));
  const memberId = members.find((member) => member.user_id === userId)?.id;
  const unread = useQuery({
    queryKey: ["workspace", org, "inbox-unread"],
    enabled: !!memberId,
    staleTime: 15000,
    queryFn: async () => {
      if (!memberId) return false;
      const db = browserClient();
      const [memberships, conversations] = await Promise.all([
        db
          .from("conversation_members")
          .select("conversation_id,read_at")
          .eq("organization_id", org)
          .eq("member_id", memberId)
          .is("removed_at", null),
        db.from("conversations").select("id,archived").eq("organization_id", org),
      ]);
      const activeIds = new Set(
        (conversations.data ?? []).filter((c) => !c.archived).map((c) => c.id),
      );
      const rows = (memberships.data ?? []).filter((row) => activeIds.has(row.conversation_id));
      const ids = rows.map((row) => row.conversation_id);
      if (!ids.length) return false;
      const messages = await db
        .from("messages")
        .select("conversation_id,author_id,created_at")
        .eq("organization_id", org)
        .in("conversation_id", ids)
        .order("created_at", { ascending: false })
        .limit(300);
      return rows.some((row) => {
        const latest = messages.data?.find((message) => message.conversation_id === row.conversation_id);
        return !!latest && latest.author_id !== memberId && (!row.read_at || new Date(latest.created_at) > new Date(row.read_at));
      });
    },
  });
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
            {unread.data && <span className="nav-dot" aria-label="Oxunmamış mesaj var" />}
          </button>
        </div>
      </header>
      <nav
        ref={navRef}
        className={"main-nav " + (open ? "open" : "")}
        aria-label="Əsas menyu"
        id="workspace-navigation"
      >
        {isAdmin && <Link className="mobile-admin-entry" href={`/workspace/admin?org=${org}`} onClick={()=>setOpen(false)}>Admin panel</Link>}
        {navGroups.map(([groupLabel, ids]) => {
          const items = modules.filter((m) => (ids as readonly string[]).includes(m[0]));
          if (items.length === 1) {
            const [id, label] = items[0];
            return (
              <Link
                key={id}
                href={"/workspace/" + id + "?org=" + org}
                onClick={() => setOpen(false)}
                className={path.endsWith("/" + id) ? "active" : ""}
              >
                {label}
                {id === "inbox" && unread.data && <span className="nav-dot" aria-label="Oxunmamış mesaj var" />}
              </Link>
            );
          }
          const groupActive = items.some(([id]) => path.endsWith("/" + id));
          const groupUnread = items.some(([id]) => id === "inbox" && unread.data);
          return (
            <div className="nav-group" key={groupLabel}>
              <button
                type="button"
                className={"nav-group-trigger " + (groupActive ? "active" : "")}
                aria-expanded={openGroup === groupLabel}
                onClick={() => setOpenGroup(openGroup === groupLabel ? null : groupLabel)}
              >
                {groupLabel}
                <ChevronDown size={13} />
                {groupUnread && <span className="nav-dot" aria-label="Oxunmamış mesaj var" />}
              </button>
              {openGroup === groupLabel && (
                <div className="nav-group-menu">
                  {items.map(([id, label]) => (
                    <Link
                      key={id}
                      href={"/workspace/" + id + "?org=" + org}
                      onClick={() => { setOpen(false); setOpenGroup(null); }}
                      className={path.endsWith("/" + id) ? "active" : ""}
                    >
                      {label}
                      {id === "inbox" && unread.data && <span className="nav-dot" aria-label="Oxunmamış mesaj var" />}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
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
