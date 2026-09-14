"use client";
import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Export } from "./export";
import { Search, RefreshCw } from "lucide-react";
import { modules } from "@/lib/domain";
import type { Item, WorkspaceData } from "@/lib/db/types";
import { CRM } from "@/modules/crm/board";
import { Customers } from "@/modules/customers/customers";
import { Operations } from "@/modules/operations/panels";
import { Finance } from "@/modules/finance/panel";
import { AdminPanel } from "@/modules/users/admin-access";
import { Users } from "@/modules/users/panel";
import { Subscriptions } from "@/modules/subscriptions/panel";
import { Tasks } from "@/modules/tasks/panel";
export type PanelProps = {
  org: string;
  data: WorkspaceData;
  member: Item;
  refresh: () => Promise<void>;
  q: string;
  filters?: Record<string,string>;
  setFilters?: (filters:Record<string,string>)=>void;
};
export function ModulePage({ module, org, adminMode = false }: { module: string; org: string; adminMode?: boolean }) {
  const [q, setQ] = useState("");
  const [filters,setFilters]=useState<Record<string,string>>({});
  const cache = useQueryClient();
  const paged = !["crm","map","todo","tasks","overview"].includes(module);
  const query = useInfiniteQuery({
    initialPageParam: 0,
    queryKey: ["workspace", org, module, q, module === "overview" ? filters : null],
    queryFn: async ({pageParam}) => {
      const res = await fetch(
        `/api/data?org=${org}&module=${module}&q=${encodeURIComponent(q)}&offset=${paged?pageParam*200:0}&from=${filters.from??""}&to=${filters.to??""}`,
      );
      if (!res.ok)
        throw new Error("Məlumat yüklənmədi və ya girişiniz dəyişib.");
      return res.json() as Promise<{ data: WorkspaceData; member: Item; hasMore:boolean }>;
    },
    getNextPageParam: (last,pages) => paged && last.hasMore ? pages.length : undefined,
  });
  const merged:WorkspaceData={};
  for(const page of query.data?.pages??[]) for(const [table,rows] of Object.entries(page.data)) merged[table]=[...new Map([...(merged[table]??[]),...rows].map(r=>[r.id??JSON.stringify(r),r])).values()];
  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: ["workspace", org] });
  };
  const props: PanelProps = {
    org,
    data: merged,
    member: query.data?.pages[0]?.member as Item,
    refresh,
    q,
    filters, setFilters,
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">İŞ SAHƏSİ</p>
          <h1>{adminMode ? "Admin panel" : modules.find((m) => m[0] === module)?.[1]}</h1>
        </div>
        <div className="toolbar">
          <label className="search">
            <Search size={18} aria-hidden="true" />
            <input
              aria-label="Axtarış"
              placeholder="Axtarış…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <button aria-label="Yenilə" className="icon-button" onClick={refresh}>
            <RefreshCw size={17} />
          </button>
          {!adminMode && <Export org={org} module={module} q={q} filters={filters} />}
        </div>
      </div>
      {query.isPending ? (
        <div className="empty">Məlumat yüklənir…</div>
      ) : query.isError ? (
        <div role="alert" className="notice error">
          {query.error.message}
          <button onClick={() => query.refetch()}>Yenidən yoxla</button>
        </div>
      ) : adminMode ? (
        <AdminPanel {...props} />
      ) : module === "crm" ? (
        <CRM {...props} />
      ) : module === "map" ? (
        <Customers {...props} />
      ) : module === "finance" ? (
        <Finance {...props} />
      ) : module === "users" ? (
        <Users {...props} />
      ) : module === "subscriptions" ? (
        <Subscriptions {...props} />
      ) : module === "tasks" ? (
        <Tasks {...props} />
      ) : (
        <Operations {...props} module={module} />
      )}
      {query.hasNextPage&&<button disabled={query.isFetchingNextPage} onClick={()=>query.fetchNextPage()}>Daha çox qeyd göstər</button>}
    </>
  );
}
