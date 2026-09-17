"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, Circle, Clock3, ListFilter, MessageSquare, Pencil, Plus, Trash2, Users } from "lucide-react";
import type { PanelProps } from "@/components/module-page";
import type { Item } from "@/lib/db/types";
import { command } from "@/lib/db/api";
import { dateTime, localInput, utc, workStatuses } from "@/lib/domain";
import { Modal } from "@/components/dialog";
import { Form, Field } from "@/components/form";
import { DateTimeField } from "@/components/date-time-field";

const statusMeta = { todo: { label: "Ediləcək", icon: Circle }, doing: { label: "İcrada", icon: Clock3 }, done: { label: "Bitdi", icon: Check } } as const;
type Status = keyof typeof statusMeta;

export function Tasks({ org, data, member, refresh, q }: PanelProps) {
  const [status, setStatus] = useState<"all" | Status>("all");
  const [selected, setSelected] = useState<Item | null>(null);
  const [editing, setEditing] = useState<Item | null | "new">(null);
  const [error, setError] = useState("");
  const tasks = data.internal_tasks ?? [];
  const assignments = data.internal_task_assignments ?? [];
  const updates = data.internal_task_updates ?? [];
  const role = data.roles?.find((item) => item.id === member?.role_id);
  const canCreate = !!member && (member.is_admin || member.overrides?.["tasks.write"] === "allow" || (member.overrides?.["tasks.write"] !== "deny" && role?.permissions?.includes("tasks.write")));
  const counts = useMemo(() => ({ all: tasks.length, todo: tasks.filter((item) => item.status === "todo").length, doing: tasks.filter((item) => item.status === "doing").length, done: tasks.filter((item) => item.status === "done").length }), [tasks]);
  const sorted = useMemo(() => [...tasks].sort((a, b) => {
    if (!a.due_at && !b.due_at) return 0;
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  }), [tasks]);
  const visible = status === "all" ? sorted : sorted.filter((item) => item.status === status);
  const memberAssignments = (taskId: string) => assignments.filter((item) => item.task_id === taskId).map((item) => data.memberships?.find((member) => member.id === item.member_id)).filter(Boolean) as Item[];
  const canManage = (task: Item) => member?.is_admin || task.created_by === member?.id;
  const canWork = (task: Item) => canManage(task) || assignments.some((assignment) => assignment.task_id === task.id && assignment.member_id === member?.id);
  async function run(operation: string, payload: Record<string, unknown>, version = 1) {
    setError("");
    try { await command(org, "tasks", operation, payload, version); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Task əməliyyatı alınmadı."); throw cause; }
  }
  return <section className="tasks-page">
    {error && <p role="alert" className="notice error">{error}</p>}
    <div className="tasks-toolbar surface">
      <div><strong>Daxili tasklar</strong><p className="helper">Müştəri sifarişlərindən ayrıdır; komandanın gündəlik və aylıq işləri üçün.</p></div>
      {canCreate && <button className="primary" onClick={() => setEditing("new")}><Plus size={17}/> Task əlavə et</button>}
    </div>
    <div className="task-filter" aria-label="Status filtri"><ListFilter size={16}/>{(["all", "todo", "doing", "done"] as const).map((item) => <button key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{item === "all" ? "Hamısı" : statusMeta[item].label}<span>{counts[item]}</span></button>)}</div>
    <div className="tasks-summary"><p><strong>{counts.todo + counts.doing}</strong> açıq task</p><p>Taskı təyin edilən əməkdaş statusu dəyişə və görülən işi yaza bilər.</p></div>
    <div className="tasks-list surface">
      {visible.map((task) => {
        const info = statusMeta[task.status as Status] ?? statusMeta.todo, Icon = info.icon, people = memberAssignments(task.id), overdue = task.status !== "done" && task.due_at && new Date(task.due_at) < new Date();
        return <article className="task-row" key={task.id}>
          <button className={'task-state '+task.status} aria-label="Taskı aç" onClick={() => setSelected(task)}><Icon size={18}/></button>
          <button className="task-content task-open" onClick={() => setSelected(task)}><div className="task-title-row"><h2>{task.title}</h2></div><div className="task-meta"><span><Users size={14}/>{people.map((person) => person.name).join(", ") || "Təyinat yoxdur"}</span><span className={overdue ? "overdue" : ""}><CalendarDays size={14}/>{dateTime(task.due_at)}</span></div></button>
          <label className="task-status-select"><span className="sr-only">{task.title} statusu</span><select value={task.status} disabled={!canWork(task)} onChange={(event) => run("task.status", { id: task.id, status: event.target.value }, task.version)}>{workStatuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        </article>;
      })}
      {!visible.length && <div className="empty">Daxili task yoxdur.{canCreate ? " İlk taskı əlavə edin." : " Task yaratmaq üçün uyğun səlahiyyət lazımdır."}</div>}
    </div>
    {editing && <TaskForm task={editing === "new" ? null : editing} members={data.memberships ?? []} assigned={editing === "new" ? [] : assignments.filter((item) => item.task_id === editing.id).map((item) => item.member_id)} onClose={() => setEditing(null)} onSave={async (form) => { const task = editing === "new" ? null : editing; await run("task.save", { ...(task ? { id: task.id } : {}), title: form.get("title"), description: form.get("description"), due_at: utc(form.get("due_at")), assignees: form.getAll("assignees") }, task?.version ?? 1); setEditing(null); }}/>} 
    {selected && <TaskDetail task={selected} people={memberAssignments(selected.id)} updates={updates.filter((item) => item.task_id === selected.id)} members={data.memberships ?? []} canManage={canManage(selected)} canWork={canWork(selected)} onClose={() => setSelected(null)} onEdit={() => { setSelected(null); setEditing(selected); }} onDelete={async () => { await run("task.archive", { id: selected.id }, selected.version); setSelected(null); }} onUpdate={async (body) => { await run("task.update.add", { id: selected.id, body }); }} />}
  </section>;
}

function TaskForm({ task, members, assigned, onClose, onSave }: { task: Item | null; members: Item[]; assigned: string[]; onClose: () => void; onSave: (form: FormData) => Promise<void> }) {
  return <Modal title={task ? "Taskı düzəlt" : "Daxili task əlavə et"} onClose={onClose}><Form onSave={onSave} label="Saxla"><Field name="title" label="Taskın adı" value={task?.title} required/><label>İzah və görüləcək işlər<textarea name="description" defaultValue={task?.description ?? ""} rows={5} placeholder="Məsələn: müştərilərə zəng edin, şəxsi səhifənin paylaşım planını yoxlayın…"/></label><DateTimeField name="due_at" label="Deadline" value={localInput(task?.due_at)}/><AssigneePicker members={members} assigned={assigned}/></Form></Modal>;
}

function AssigneePicker({ members, assigned }: { members: Item[]; assigned: string[] }) {
  return <fieldset className="assignee-picker"><legend>Cavabdehlər</legend><div className="assignee-options">{members.filter((member) => member.status === "active").map((member) => <label key={member.id} className="assignee-option"><input type="checkbox" name="assignees" value={member.id} defaultChecked={assigned.includes(member.id)}/>{member.name}</label>)}</div><small>Bir neçə nəfər seçə bilərsiniz.</small></fieldset>;
}

function TaskDetail({ task, people, updates, members, canManage, canWork, onClose, onEdit, onDelete, onUpdate }: { task: Item; people: Item[]; updates: Item[]; members: Item[]; canManage: boolean; canWork: boolean; onClose: () => void; onEdit: () => void; onDelete: () => Promise<void>; onUpdate: (body: string) => Promise<void> }) {
  return <Modal title="Daxili task" onClose={onClose} wide><div className="task-detail"><div className="section-toolbar"><div><h2>{task.title}</h2><p className="helper">{task.description || "İzah əlavə edilməyib."}</p></div>{canManage && <div className="toolbar"><button onClick={onEdit}><Pencil size={15}/>Düzəliş</button><button className="danger" onClick={onDelete}><Trash2 size={15}/>Sil</button></div>}</div><div className="task-detail-meta"><span><Users size={15}/>{people.map((person) => person.name).join(", ")}</span><span><CalendarDays size={15}/>{dateTime(task.due_at)}</span></div><h3><MessageSquare size={17}/> Görülən iş qeydləri</h3>{canWork && <Form label="Qeyd əlavə et" onSave={async (form) => onUpdate(String(form.get("body") ?? ""))}><label>Görülən iş<textarea name="body" rows={3} required placeholder="Nə edildi, nəticə nə oldu, növbəti addım nədir?"/></label></Form>}<div className="task-updates">{updates.map((update) => <article key={update.id}><strong>{members.find((member) => member.id === update.author_id)?.name || "Əməkdaş"}</strong><small>{dateTime(update.created_at)}</small><p>{update.body}</p></article>)}{!updates.length && <p className="empty">Hələ görülən iş qeydi yoxdur.</p>}</div></div></Modal>;
}
