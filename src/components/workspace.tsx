"use client";
import {useTheme} from "./theme";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { Menu, Sun, Moon, LogOut, Bell, ChevronDown } from "lucide-react";
import { browserClient } from "@/lib/auth/browser";
import { modules } from "@/lib/domain";
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function Workspace({
  children,
  organizations,
  org,
  userId,
}: {
  children: React.ReactNode;
  organizations: { id: string; name: string; logo_path?:string|null }[];
  org: string;
  userId: string;
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
      <Frame org={org} organizations={organizations} userId={userId}>
        {children}
      </Frame>
    </QueryClientProvider>
  );
}
function Frame({
  children,
  organizations,
  org,
  userId,
}: {
  children: React.ReactNode;
  organizations: { id: string; name: string; logo_path?:string|null }[];
  org: string;
  userId: string;
}) {
  const {dark,toggle:toggleTheme}=useTheme();
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const path = usePathname(),
    router = useRouter(),
    cache = useQueryClient();
  const [open, setOpen] = useState(false),
    [live, setLive] = useState(false);
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
    const { data } = db.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        cache.clear();
        router.replace("/login");
      }
    });
    return () => {
      db.removeChannel(channel);
      data.subscription.unsubscribe();
      cache.clear();
    };
  }, [cache, org, router, userId]);
  return (
    <div className={dark ? "app dark" : "app"}>
      <header className="topbar">
        <Link href="/workspace/crm" className="brand">
          {organizations.find(x=>x.id===org)?.logo_path?<Image unoptimized src={`/api/media?org=${org}`} width={100} height={36} alt={organizations.find(x=>x.id===org)?.name??"APMA CRM"}/>:<>APMA<span>CRM</span></>}
        </Link>
        <button className="org-switch" onClick={() => setOpen(!open)}>
          {organizations.find((x) => x.id === org)?.name}
          <ChevronDown size={14} />
        </button>
        <div className="top-actions">
          <span
            className="connection-status"
            data-live={live}
            title={live ? "Canlı bağlantı" : "Canlı bağlantı bərpa olunur"}
          >
            <span className="connection-dot" aria-hidden="true" />
            {live ? "Canlı" : "Bağlanır…"}
          </span>
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
