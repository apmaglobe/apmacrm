"use client";
import {CustomerSelect} from "@/components/customer-select";
import { useState } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import {
  Plus,
  ArrowUpRight,
  CalendarDays,
  Camera,
  MessageCircle,
  CheckCircle2,
} from "lucide-react";
import type { PanelProps } from "@/components/module-page";
import type { Item, WorkspaceData } from "@/lib/db/types";
import { Form, Field, Select } from "@/components/form";
import { Modal } from "@/components/dialog";
import { command } from "@/lib/db/api";
import { dateTime, utc, localInput, workStatuses } from "@/lib/domain";
import { Overview } from "./overview";
import { DealDetail } from "@/modules/crm/board";
export function Operations(props: PanelProps & { module: string }) {
  const { module, data, member, org, refresh } = props;
  const [add, setAdd] = useState(false),
    [selected, setSelected] = useState<Item | null>(null),
    [deal, setDeal] = useState<string | null>(null),
    [error, setError] = useState(""),
    [scope, setScope] = useState("mine"),
    [unit, setUnit] = useState<Item | null>(null);
  const todo = useInfiniteQuery({
    initialPageParam: 0,
    queryKey: ["workspace", org, "todo", scope, props.q],
    enabled: module === "todo",
    queryFn: async ({ pageParam }) => {
      const r = await fetch(
        `/api/data?org=${org}&module=todo&scope=${scope}&offset=${pageParam * 200}&q=${encodeURIComponent(props.q)}`,
      );
      if (!r.ok) throw new Error("İşlər yüklənmədi");
      return r.json() as Promise<{ data: WorkspaceData }>;
    },
    getNextPageParam: (last, pages) =>
      last.data.work_items?.length === 200 ? pages.length : undefined,
  });
  async function action(op: string, payload: Record<string, unknown>, v = 1) {
    try {
      setError("");
      await command(org, "operations", op, payload, v);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }
  const works =
    todo.data?.pages.flatMap((p) => p.data.work_items ?? []) ??
    data.work_items ??
    [];
  const deals =
    todo.data?.pages.flatMap((p) => p.data.deal_cards ?? []) ??
    data.deal_cards ??
    [];
  if (module === "inbox") return <Inbox {...props} />;
  return (
    <>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {module === "todo" && (
        <>
          <div className="section-toolbar">
            <div className="segmented">
              {[
                ["mine", "Mənim işlərim"],
                ["shared", "Ortaq sifarişlər"],
                ...(member.is_admin ? [["team", "Komanda"]] : []),
              ].map(([v, l]) => (
                <button
                  className={scope === v ? "selected" : ""}
                  key={v}
                  onClick={() => {setScope(v);props.setFilters?.({...props.filters,scope:v});}}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="helper">İşlər CRM qutularından yaranır.</p>
          </div>
          <div className="surface">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>İş</th>
                    <th>Qutu</th>
                    <th>Cavabdeh</th>
                    <th>Deadline</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {works.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <strong>{w.name}</strong>
                      </td>
                      <td>
                        <button onClick={() => setDeal(w.deal_id)}>
                          {deals.find((d) => d.id === w.deal_id)?.serial ??
                            "Qutunu aç"}
                        </button>
                      </td>
                      <td>
                        {
                          data.memberships?.find((m) => m.id === w.assignee_id)
                            ?.name
                        }
                      </td>
                      <td
                        className={
                          w.status !== "done" &&
                          w.due_at &&
                          new Date(w.due_at) < new Date()
                            ? "overdue"
                            : ""
                        }
                      >
                        {dateTime(w.due_at)}
                      </td>
                      <td>
                        <select
                          aria-label={w.name + " statusu"}
                          value={w.status}
                          disabled={
                            w.assignee_id !== member.id && !member.is_admin
                          }
                          onChange={async (e) => {
                            const status = e.target.value;
                            try {
                              const r = await fetch(
                                `/api/data?org=${org}&module=crm&id=${w.deal_id}`,
                              );
                              if (!r.ok)
                                throw new Error("Qutuya giriş yoxdur.");
                              const parent = (await r.json()).data.deals[0];
                              if (!parent)
                                throw new Error("Qutuya giriş yoxdur.");
                              await command(
                                org,
                                "crm",
                                "work.status",
                                {
                                  deal_id: w.deal_id,
                                  id: w.id,
                                  status,
                                },
                                parent.version,
                              );
                              await refresh();
                            } catch (e) {
                              setError(String(e));
                            }
                          }}
                        >
                          {workStatuses.map(([s, l]) => (
                            <option key={s} value={s}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!works.length && (
                <div className="empty">Bu görünüşdə iş yoxdur.</div>
              )}
            </div>
          </div>
          {todo.hasNextPage && (
            <button
              disabled={todo.isFetchingNextPage}
              onClick={() => todo.fetchNextPage()}
            >
              Daha çox iş göstər
            </button>
          )}
          <Calendar
            items={works.map((w) => ({
              id: w.id,
              title: w.name,
              date: w.due_at,
            }))}
          />
        </>
      )}
      {module === "tools" && (
        <>
          <div className="section-toolbar">
            <p className="muted">Avadanlıq və rəqəmsal resurslar</p>
            {member.is_admin && (
              <button className="primary" onClick={() => setAdd(true)}>
                <Plus size={17} />
                Alət əlavə et
              </button>
            )}
          </div>
          <div className="card-grid">
            {data.tools?.map((t) => (
              <article className="surface tool-card" key={t.id}>
                <Camera size={26} />
                <h2>{t.name}</h2>
                <p>
                  {t.kind === "physical"
                    ? "Fiziki avadanlıq"
                    : "Rəqəmsal resurs"}{" "}
                  · Tutum: {t.capacity}
                </p>
                <span className="badge">{t.state}</span>
                {data.tool_units
                  ?.filter((u) => u.tool_id === t.id)
                  .map((u) => (
                    <div className="work-row" key={u.unit_number}>
                      <span>
                        Vahid {u.unit_number} · {u.state}
                      </span>
                      {member.is_admin && (
                        <button onClick={() => setUnit(u)}>
                          Vahidi düzəlt
                        </button>
                      )}
                    </div>
                  ))}
                <button
                  className="primary"
                  disabled={t.state !== "active"}
                  onClick={() => setSelected(t)}
                >
                  Rezervasiya et
                </button>
              </article>
            ))}
          </div>
          <section className="surface">
            <h2>Rezervasiya və istifadə tarixçəsi</h2>
            {data.tool_reservations?.map((r) => (
              <div className="work-row" key={r.id}>
                <div>
                  <h3>
                    {data.tools?.find((t) => t.id === r.tool_id)?.name}
                    {r.unit_number ? " · Vahid " + r.unit_number : ""}
                  </h3>
                  <p>
                    {dateTime(r.starts_at)} — {dateTime(r.ends_at)}
                  </p>
                  <small>
                    {data.memberships?.find((m) => m.id === r.member_id)?.name}{" "}
                    ·{" "}
                    {r.cancelled
                      ? "Ləğv edilib"
                      : r.returned_at
                        ? "Qaytarılıb"
                        : r.checked_out_at
                          ? "İstifadədə"
                          : "Rezervasiya"}
                  </small>
                </div>
                {(member.is_admin || r.member_id === member.id) &&
                  !r.cancelled &&
                  !r.returned_at && (
                    <div className="toolbar">
                      {r.checked_out_at ? (
                        <button
                          onClick={() =>
                            action("tool.return", { id: r.id }, r.version)
                          }
                        >
                          Qaytar
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() =>
                              action("tool.checkout", { id: r.id }, r.version)
                            }
                          >
                            Götür
                          </button>
                          <button
                            onClick={() =>
                              action("tool.cancel", { id: r.id }, r.version)
                            }
                          >
                            Ləğv et
                          </button>
                        </>
                      )}
                    </div>
                  )}
              </div>
            ))}
          </section>
        </>
      )}
      {module === "meetings" && (
        <>
          <div className="section-toolbar">
            <div className="muted">Əyani və online görüşlər</div>
            <button className="primary" onClick={() => setAdd(true)}>
              <Plus size={17} />
              Görüş yarat
            </button>
          </div>
          <div className="card-grid">
            {data.meetings?.map((m) => (
              <article className="surface" key={m.id}>
                <span className="badge">
                  {m.kind === "online" ? "Online" : "Əyani"}
                </span>
                <h2>{m.title}</h2>{m.cancelled&&<span className="badge">Ləğv edilib</span>}
                <p>
                  {dateTime(m.starts_at)} — {dateTime(m.ends_at)}
                </p>
                <p>{m.location}</p>
                {m.url && (
                  <a href={m.url} target="_blank" rel="noopener noreferrer">
                    Görüşə keç <ArrowUpRight size={14} />
                  </a>
                )}
                <p>{m.agenda}</p>
                <p>{m.outcome}</p>
                <div className="toolbar">
                  <a
                    href={`/api/meeting-ics?org=${org}&id=${m.id}`}
                    className="button"
                  >
                    Təqvimə endir
                  </a>
                  {(member.is_admin || m.created_by === member.id) && (
                    <button onClick={() => setSelected(m)}>Düzəliş</button>
                  )}
                </div>
              </article>
            ))}
          </div>
          <Calendar
            items={
              data.meetings?.map((m) => ({
                id: m.id,
                title: m.title,
                date: m.starts_at,
              })) ?? []
            }
          />
        </>
      )}
      {module === "drive" && (
        <>
          <div className="section-toolbar">
            <p className="muted">Qutulara bağlı material və layihə linkləri</p>
            <a
              className="button"
              href="https://mail.google.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Gmail <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="surface">
            {data.resource_links
              ?.filter((l) => !l.archived)
              .map((l) => (
                <div className="work-row" key={l.id}>
                  <div>
                    <a href={l.url} target="_blank" rel="noopener noreferrer">
                      <h3>
                        {l.title} <ArrowUpRight size={15} />
                      </h3>
                    </a>
                    <p>{l.category || "Material"}</p>
                  </div>
                  <button onClick={() => setDeal(l.deal_id)}>Qutunu aç</button>
                </div>
              ))}
            {!data.resource_links?.length && (
              <div className="empty">
                Qutunun Materiallar bölməsindən ilk linki əlavə edin.
              </div>
            )}
          </div>
          <p className="helper">
            Google faylının giriş hüququ Google hesabınızdan asılıdır.
          </p>
        </>
      )}
      {module === "portfolio" && (
        <>
          <h2>Aylıq xidmət</h2>
          <div className="card-grid">
            {data.monthly_portfolio?.map((p) => (
              <article className="surface" key={p.id}>
                <h2>{p.name}</h2>
                <strong>{p.service_days} xidmət günü</strong>
                <p>
                  Bitmiş dövrlər üzrə unikal günlər; gələcək günlər daxil deyil.
                </p>
                {p.periods.map((period) => (
                  <button
                    key={period.id}
                    onClick={() => setDeal(period.deal_id)}
                  >
                    {period.start} — {period.end}
                  </button>
                ))}
              </article>
            ))}
          </div>
          <h2>Birdəfəlik layihələr</h2>
          <div className="card-grid">
            {data.portfolio_items
              ?.filter((p) => p.status !== "archived")
              .map((p) => {
                const d = data.deal_cards?.find((d) => d.id === p.deal_id);
                return (
                  <article className="portfolio-card" key={p.id}>
                    <div className="portfolio-cover">
                      <CheckCircle2 size={38} />
                      <span>
                        {p.status === "completed"
                          ? "Təhvil verilib"
                          : "Qaralama"}
                      </span>
                    </div>
                    <div>
                      <h2>{d?.title || d?.serial || "Sifariş"}</h2>
                      <p>
                        {
                          data.customers?.find((c) => c.id === d?.customer_id)
                            ?.name
                        }
                      </p>
                      <button onClick={() => setDeal(p.deal_id)}>
                        İşə bax <ArrowUpRight size={15} />
                      </button>
                    </div>
                  </article>
                );
              })}
          </div>
        </>
      )}
      {module === "overview" && <Overview {...props} />}
      {unit && (
        <Modal title="Alət vahidi" onClose={() => setUnit(null)}>
          <Form
            onSave={async (f) => {
              await command(
                org,
                "operations",
                "tool.unit",
                {
                  tool_id: unit.tool_id,
                  unit_number: unit.unit_number,
                  state: f.get("state"),
                  reason: f.get("reason"),
                },
                unit.version,
              );
              await refresh();
              setUnit(null);
            }}
          >
            <Select
              name="state"
              label="Vahidin vəziyyəti"
              value={unit.state}
              options={[
                { id: "active", name: "İşlək" },
                { id: "broken", name: "Xarab" },
                { id: "inactive", name: "İstifadədən çıxarılıb" },
              ]}
            />
            <Field name="reason" label="Səbəb" required />
          </Form>
        </Modal>
      )}
      {add && (
        <Modal
          title={module === "tools" ? "Alət əlavə et" : "Görüş yarat"}
          onClose={() => setAdd(false)}
        >
          {module === "tools" ? (
            <Form
              onSave={async (f) => {
                await command(org, "operations", "tool.save", {
                  name: f.get("name"),
                  kind: f.get("kind"),
                  capacity: Number(f.get("capacity")),
                });
                setAdd(false);
                await refresh();
              }}
            >
              <Field name="name" label="Alətin adı" required />
              <Select
                name="kind"
                label="Növ"
                options={[
                  { id: "physical", name: "Fiziki" },
                  { id: "digital", name: "Rəqəmsal" },
                ]}
                required
              />
              <Field
                name="capacity"
                label="Vahid / tutum"
                type="number"
                value={1}
                required
              />
            </Form>
          ) : (
            <MeetingForm {...props} onDone={() => setAdd(false)} />
          )}
        </Modal>
      )}
      {selected && (
        <Modal
          title={module === "tools" ? selected.name : "Görüşü düzəlt"}
          onClose={() => setSelected(null)}
        >
          {module === "tools" ? (
            <Form
              label="Rezervasiya et"
              onSave={async (f) => {
                await command(org, "operations", "tool.reserve", {
                  tool_id: selected.id,
                  starts_at: utc(f.get("starts_at")),
                  ends_at: utc(f.get("ends_at")),
                  quantity: Number(f.get("quantity") || 1),
                  unit_number:
                    selected.kind === "physical"
                      ? Number(f.get("unit_number"))
                      : null,
                });
                await refresh();
                setSelected(null);
              }}
            >
              <Field
                name="starts_at"
                label="Başlanğıc"
                type="datetime-local"
                required
              />
              <Field
                name="ends_at"
                label="Son"
                type="datetime-local"
                required
              />
              {selected.kind === "physical" ? (
                <Field
                  name="unit_number"
                  label={`Vahid nömrəsi (1–${selected.capacity})`}
                  type="number"
                  value={1}
                  required
                />
              ) : (
                <Field
                  name="quantity"
                  label="Tutum sayı"
                  type="number"
                  value={1}
                  required
                />
              )}
            </Form>
          ) : (
            <MeetingForm
              {...props}
              meeting={selected}
              onDone={() => setSelected(null)}
            />
          )}
        </Modal>
      )}
      {deal && (
        <DealDetail {...props} id={deal} onClose={() => setDeal(null)} />
      )}
    </>
  );
}
function MeetingForm({
  org,
  data,
  refresh,
  meeting,
  onDone,
}: PanelProps & { meeting?: Item; onDone: () => void }) {
  return (
    <Form
      onSave={async (f) => {
        await command(
          org,
          "operations",
          "meeting.save",
          {
            ...(meeting ? { id: meeting.id } : {}),
            title: f.get("title"),
            kind: f.get("kind"),
            customer_id:f.get("customer_id")||null,deal_id:f.get("deal_id")||null,cancelled:f.get("cancelled")==="on",
            location: f.get("location"),
            url: f.get("url"),
            starts_at: utc(f.get("starts_at")),
            ends_at: utc(f.get("ends_at")),
            agenda: f.get("agenda"),
            outcome: f.get("outcome"),
            participants: f.getAll("participants"),
          },
          meeting?.version ?? 1,
        );
        await refresh();
        onDone();
      }}
    >
      <Field name="title" label="Mövzu" value={meeting?.title} required />
      <CustomerSelect org={org} label="Müştəri (istəyə bağlı)" value={meeting?.customer_id}/>
      <CustomerSelect org={org} entity="deals" label="Qutu (istəyə bağlı)" value={meeting?.deal_id}/>
      {meeting&&<label className="check"><input type="checkbox" name="cancelled" defaultChecked={meeting.cancelled}/>Görüşü ləğv et</label>}
      <Select
        name="kind"
        label="Görüş növü"
        value={meeting?.kind ?? "online"}
        options={[
          { id: "online", name: "Online" },
          { id: "in_person", name: "Əyani" },
        ]}
        required
      />
      <Field
        name="starts_at"
        label="Başlanğıc"
        type="datetime-local"
        value={localInput(meeting?.starts_at)}
        required
      />
      <Field
        name="ends_at"
        label="Son"
        type="datetime-local"
        value={localInput(meeting?.ends_at)}
        required
      />
      <Field name="location" label="Məkan" value={meeting?.location} />
      <Field
        name="url"
        label="Online HTTPS link"
        type="url"
        value={meeting?.url}
      />
      <fieldset>
        <legend>İştirakçılar</legend>
        {data.memberships
          ?.filter((m) => m.status === "active")
          .map((m) => (
            <label className="check" key={m.id}>
              <input
                name="participants"
                type="checkbox"
                value={m.id}
                defaultChecked={data.meeting_participants?.some(
                  (p) => p.meeting_id === meeting?.id && p.member_id === m.id,
                )}
              />
              {m.name}
            </label>
          ))}
      </fieldset>
      <label>
        Gündəlik
        <textarea name="agenda" defaultValue={meeting?.agenda} />
      </label>
      <label>
        Nəticə
        <textarea name="outcome" defaultValue={meeting?.outcome} />
      </label>
    </Form>
  );
}
function Calendar({
  items,
}: {
  items: { id: string; title: string; date: string }[];
}) {
  const today = new Date(),
    [month, setMonth] = useState(today.toISOString().slice(0, 7));
  const [year, mo] = month.split("-").map(Number);
  const days = new Date(year, mo, 0).getDate();
  return (
    <section className="surface calendar">
      <div className="section-toolbar">
        <h2>
          <CalendarDays size={19} />
          Təqvim
        </h2>
        <input
          aria-label="Təqvim ayı"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>
      <div className="calendar-grid">
        {["B.e.", "Ç.a.", "Ç.", "C.a.", "C.", "Ş.", "B."].map((d) => (
          <strong key={d}>{d}</strong>
        ))}
        {Array.from(
          { length: (new Date(year, mo - 1, 1).getDay() + 6) % 7 },
          (_, i) => (
            <div key={"empty" + i} />
          ),
        )}
        {Array.from({ length: days }, (_, i) => {
          const day = month + "-" + String(i + 1).padStart(2, "0");
          return (
            <div className="calendar-day" key={day}>
              <strong>{i + 1}</strong>
              {items
                .filter((x) => localInput(x.date).startsWith(day))
                .map((x) => (
                  <span key={x.id}>{x.title}</span>
                ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
function Inbox({ org, data, member, refresh }: PanelProps) {
  const [chat, setChat] = useState<string | null>(null),
    [add, setAdd] = useState(false),
    [edit, setEdit] = useState<Item | null>(null),
    [manage, setManage] = useState(false),
    [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["workspace", org, "chat", chat],
    enabled: !!chat,
    queryFn: async () => {
      const r = await fetch(`/api/data?org=${org}&module=inbox&id=${chat}`);
      if (!r.ok) throw new Error("Söhbət yüklənmədi");
      return r.json() as Promise<{ data: WorkspaceData }>;
    },
  });
  return (
    <>
      <div className="inbox-layout">
        <aside className="surface">
          <div className="section-toolbar">
            <h2>Söhbətlər</h2>
            <button aria-label="Söhbət yarat" onClick={() => setAdd(true)}>
              <Plus size={17} />
            </button>
          </div>
          {data.conversations?.map((c) => (
            <button
              key={c.id}
              className={"chat-row " + (c.id === chat ? "active" : "")}
              onClick={async () => {
                setChat(c.id);
                await command(org, "operations", "conversation.read", {
                  conversation_id: c.id,
                });
                await refresh();
              }}
            >
              <MessageCircle size={18} />
              {c.title}
            </button>
          ))}
          <h2>Bildirişlər</h2>
          {data.notifications?.map((n) => (
            <button
              className={"notification " + (n.read_at ? "read" : "")}
              key={n.id}
              onClick={async () => {
                await command(org, "operations", "notification.read", {
                  id: n.id,
                });
                await refresh();
              }}
            >
              <span>{n.label}</span>
              <small>{dateTime(n.created_at)}</small>
            </button>
          ))}
        </aside>
        <section className="surface chat-panel">
          {chat ? (
            <>
              <h2>{data.conversations?.find((c) => c.id === chat)?.title}</h2>
              {data.conversations?.find((c) => c.id === chat)?.created_by ===
                member.id && (
                <button onClick={() => setManage(true)}>
                  İştirakçıları idarə et
                </button>
              )}
              <label>
                Mesajlarda axtarış
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              {query.isError && <p role="alert">Söhbətə giriş yoxdur.</p>}
              <div className="messages">
                {(query.isError ? [] : query.data?.data.messages)
                  ?.filter(
                    (m) =>
                      m.deleted ||
                      m.body
                        .toLocaleLowerCase()
                        .includes(search.toLocaleLowerCase()),
                  )
                  .slice()
                  .reverse()
                  .map((m) => (
                    <div
                      className={
                        "bubble " + (m.author_id === member.id ? "own" : "")
                      }
                      key={m.id}
                    >
                      <small>
                        {
                          data.memberships?.find((u) => u.id === m.author_id)
                            ?.name
                        }{" "}
                        · {dateTime(m.created_at)}
                      </small>
                      <p>{m.deleted ? "Mesaj silinib" : m.body}</p>
                      {m.author_id === member.id && !m.deleted && (
                        <button onClick={() => setEdit(m)}>Düzəliş</button>
                      )}
                    </div>
                  ))}
              </div>
              <Form
                label="Göndər"
                onSave={async (f) => {
                  await command(org, "operations", "message.send", {
                    conversation_id: chat,
                    body: f.get("body"),
                  });
                  await refresh();
                }}
              >
                <label>
                  Mesaj
                  <textarea name="body" required maxLength={4000} />
                </label>
              </Form>
            </>
          ) : (
            <div className="empty">
              <MessageCircle size={32} />
              <h2>Söhbət seçin</h2>
              <p>Mesajlar yalnız söhbət iştirakçılarına görünür.</p>
            </div>
          )}
        </section>
      </div>
      {add && (
        <Modal title="Yeni söhbət" onClose={() => setAdd(false)}>
          <Form
            onSave={async (f) => {
              const r = await command(
                org,
                "operations",
                "conversation.create",
                { title: f.get("title"), members: f.getAll("members") },
              );
              await refresh();
              setChat(r.id);
              setAdd(false);
            }}
          >
            <Field name="title" label="Söhbət adı" required />
            <fieldset>
              <legend>İştirakçılar</legend>
              {data.memberships
                ?.filter((m) => m.status === "active" && m.id !== member.id)
                .map((m) => (
                  <label key={m.id} className="check">
                    <input type="checkbox" name="members" value={m.id} />
                    {m.name}
                  </label>
                ))}
            </fieldset>
          </Form>
        </Modal>
      )}
      {manage && chat && (
        <Modal title="Söhbət iştirakçıları" onClose={() => setManage(false)}>
          <Form
            onSave={async (f) => {
              const conversation = data.conversations?.find(
                (c) => c.id === chat,
              );
              if (!conversation) throw new Error("Söhbətə giriş yoxdur");
              await command(
                org,
                "operations",
                "conversation.member",
                {
                  conversation_id: chat,
                  member_id: f.get("member_id"),
                  enabled: f.get("enabled") === "add",
                },
                conversation.version,
              );
              await refresh();
              setManage(false);
            }}
          >
            <Select
              name="member_id"
              label="Əməkdaş"
              options={
                data.memberships?.filter(
                  (m) => m.status === "active" && m.id !== member.id,
                ) ?? []
              }
              required
            />
            <Select
              name="enabled"
              label="Əməliyyat"
              value="add"
              options={[
                { id: "add", name: "Əlavə et" },
                { id: "remove", name: "Çıxar" },
              ]}
            />
          </Form>
        </Modal>
      )}
      {edit && (
        <Modal title="Mesajı düzəlt" onClose={() => setEdit(null)}>
          <Form
            onSave={async (f) => {
              await command(
                org,
                "operations",
                "message.edit",
                {
                  id: edit.id,
                  conversation_id: edit.conversation_id,
                  body: f.get("body"),
                  deleted: f.get("deleted") === "on",
                },
                edit.version,
              );
              await refresh();
              setEdit(null);
            }}
          >
            <label>
              Mesaj
              <textarea name="body" defaultValue={edit.body} />
            </label>
            <label className="check">
              <input type="checkbox" name="deleted" />
              Məzmunu silinmiş işarəsi ilə əvəz et
            </label>
            <p className="helper">Düzəliş ilk 15 dəqiqə ərzində mümkündür.</p>
          </Form>
        </Modal>
      )}
    </>
  );
}
