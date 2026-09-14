"use client";

import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { CalendarDays, Check, Circle, Clock3, ExternalLink, ListFilter, Users } from "lucide-react";
import type { PanelProps } from "@/components/module-page";
import type { Item, WorkspaceData } from "@/lib/db/types";
import { command } from "@/lib/db/api";
import { dateTime, workStatuses } from "@/lib/domain";

const statusMeta = {
  todo: { label: "Ediləcək", icon: Circle },
  doing: { label: "İcrada", icon: Clock3 },
  done: { label: "Bitdi", icon: Check },
} as const;

type Scope = "mine" | "shared" | "team";

export function Tasks(props: PanelProps) {
  const { org, data, member, refresh, q } = props;
  const [scope, setScope] = useState<Scope>("mine");
  const [status, setStatus] = useState<"all" | keyof typeof statusMeta>("all");
  const [error, setError] = useState("");
  const tasks = useInfiniteQuery({
    initialPageParam: 0,
    queryKey: ["workspace", org, "tasks", scope, q],
    queryFn: async ({ pageParam }) => {
      const response = await fetch(`/api/data?org=${org}&module=tasks&scope=${scope}&offset=${pageParam * 200}&q=${encodeURIComponent(q)}`);
      if (!response.ok) throw new Error("Tasklar yüklənmədi.");
      return response.json() as Promise<{ data: WorkspaceData }>;
    },
    getNextPageParam: (last, pages) => last.data.work_items?.length === 200 ? pages.length : undefined,
  });
  const workItems = tasks.data?.pages.flatMap((page) => page.data.work_items ?? []) ?? data.work_items ?? [];
  const deals = tasks.data?.pages.flatMap((page) => page.data.deal_cards ?? []) ?? data.deal_cards ?? [];
  const visible = useMemo(() => status === "all" ? workItems : workItems.filter((item) => item.status === status), [status, workItems]);
  const counts = useMemo(() => ({
    all: workItems.length,
    todo: workItems.filter((item) => item.status === "todo").length,
    doing: workItems.filter((item) => item.status === "doing").length,
    done: workItems.filter((item) => item.status === "done").length,
  }), [workItems]);

  async function changeStatus(item: Item, nextStatus: string) {
    setError("");
    try {
      const response = await fetch(`/api/data?org=${org}&module=crm&id=${item.deal_id}`);
      if (!response.ok) throw new Error("Sifarişə girişiniz yoxdur.");
      const parent = ((await response.json()) as { data: WorkspaceData }).data.deals?.[0];
      if (!parent) throw new Error("Sifariş tapılmadı.");
      await command(org, "crm", "work.status", { deal_id: item.deal_id, id: item.id, status: nextStatus }, parent.version);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Task yenilənmədi.");
    }
  }

  return <section className="tasks-page">
    {error && <p role="alert" className="notice error">{error}</p>}
    <div className="tasks-toolbar surface">
      <div className="task-scope" aria-label="Task görünüşü">
        <button className={scope === "mine" ? "selected" : ""} onClick={() => setScope("mine")}>Mənim tasklarım</button>
        <button className={scope === "shared" ? "selected" : ""} onClick={() => setScope("shared")}><Users size={15}/> Sifarişlər</button>
        {member?.is_admin && <button className={scope === "team" ? "selected" : ""} onClick={() => setScope("team")}>Komanda</button>}
      </div>
      <div className="task-filter" aria-label="Status filtri">
        <ListFilter size={16}/>
        {(["all", "todo", "doing", "done"] as const).map((item) => <button key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>
          {item === "all" ? "Hamısı" : statusMeta[item].label}<span>{counts[item]}</span>
        </button>)}
      </div>
    </div>
    <div className="tasks-summary">
      <p><strong>{counts.todo + counts.doing}</strong> açıq task</p>
      <p>Tasklar yalnız CRM qutusunun içində yaradılır və buradakı status dəyişiklikləri dərhal həmin qutuya yazılır.</p>
    </div>
    <div className="tasks-list surface">
      {visible.map((item) => {
        const statusInfo = statusMeta[item.status as keyof typeof statusMeta] ?? statusMeta.todo;
        const Icon = statusInfo.icon;
        const deal = deals.find((row) => row.id === item.deal_id);
        const assignee = data.memberships?.find((row) => row.id === item.assignee_id);
        const overdue = item.status !== "done" && item.due_at && new Date(item.due_at) < new Date();
        const writable = item.assignee_id === member?.id || member?.is_admin;
        return <article className="task-row" key={item.id}>
          <div className={'task-state ' + item.status}><Icon size={18}/></div>
          <div className="task-content">
            <div className="task-title-row"><h2>{item.name}</h2>{item.kind === "task" && <span className="task-kind">Alt task</span>}</div>
            <div className="task-meta">
              <a href={`/workspace/crm?org=${org}&deal=${item.deal_id}`} title="CRM qutusunu aç">{deal?.title || deal?.serial || "CRM qutusu"}<ExternalLink size={13}/></a>
              <span>{assignee?.name || "Cavabdeh təyin edilməyib"}</span>
              <span className={overdue ? "overdue" : ""}><CalendarDays size={14}/>{dateTime(item.due_at)}</span>
            </div>
          </div>
          <label className="task-status-select">
            <span className="sr-only">{item.name} statusu</span>
            <select value={item.status} disabled={!writable} onChange={(event) => changeStatus(item, event.target.value)}>
              {workStatuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
        </article>;
      })}
      {!visible.length && <div className="empty">Bu filtrdə task yoxdur. Taskları CRM qutusunun içində əlavə edib əməkdaşa təyin edin.</div>}
    </div>
    {tasks.hasNextPage && <button className="button" disabled={tasks.isFetchingNextPage} onClick={() => tasks.fetchNextPage()}>{tasks.isFetchingNextPage ? "Yüklənir…" : "Daha çox task göstər"}</button>}
  </section>;
}
