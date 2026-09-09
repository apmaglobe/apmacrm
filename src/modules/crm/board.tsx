"use client";
import { CustomerSelect } from "@/components/customer-select";
import { PaymentActions } from "@/modules/finance/payment-actions";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { allowed } from "@/lib/auth/permissions";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Plus, Columns3, List, Clock, ArrowUpRight, SlidersHorizontal, ChevronDown } from "lucide-react";
import {
  salesStages,
  recurringStages,
  money,
  dateTime,
  utc,
  cents,
  localInput,
  workStatuses,
} from "@/lib/domain";
import { command } from "@/lib/db/api";
import type { Item, WorkspaceData } from "@/lib/db/types";
import type { PanelProps } from "@/components/module-page";
import { Modal } from "@/components/dialog";
import { Form, Field, Select } from "@/components/form";
export function CRM(props: PanelProps) {
  const { org, data, member, refresh } = props;
  const params=useSearchParams();
  const [pipeline, setPipeline] = useState("sales"),
    [view, setView] = useState("board"),
    [create, setCreate] = useState(false),
    [initialWorkCount, setInitialWorkCount] = useState(1),
    [selected, setSelected] = useState<string | null>(()=>params.get("deal")),
    [move, setMove] = useState<{ deal: Item; stage: string } | null>(null),
    [pending, setPending] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  const filters=props.filters??{};
  const board = useInfiniteQuery({
    queryKey: ["workspace", org, "board", pipeline, props.q,filters],
    initialPageParam: {} as Record<string,{time:string;id:string}|null>,
    queryFn: async ({ pageParam }) => {
      const r = await fetch(
        `/api/data?org=${org}&module=crm&board=1&pipeline=${pipeline}&q=${encodeURIComponent(props.q)}&filters=${encodeURIComponent(JSON.stringify(filters))}&cursors=${encodeURIComponent(JSON.stringify(pageParam))}`,
      );
      if (!r.ok) throw new Error("Qutular yüklənmədi");
      return r.json() as Promise<{
        rows: Item[];
        counts: Record<string, number>;
        next: Record<string,{time:string;id:string}|null>;
      }>;
    },
    getNextPageParam: (last) => Object.values(last.next).some(Boolean)?last.next:undefined,
  });
  const deals = [
    ...new Map(
      (board.data?.pages.flatMap((p) => p.rows) ?? []).map((d) => [d.id, d]),
    ).values(),
  ];
  const counts = board.data?.pages[0]?.counts ?? {};
  const stages = (pipeline === "sales" ? salesStages : recurringStages).map(([code,label])=>[code,data.pipeline_stages?.find(s=>s.code===code)?.label??label] as const);
  async function transition(
    deal: Item,
    stage: string,
    extra: Record<string, unknown> = {},
  ) {
    setError("");
    setPending((p) => ({ ...p, [deal.id]: stage }));
    try {
      await command(
        org,
        "crm",
        "deal.stage",
        { deal_id: deal.id, stage, ...extra },
        deal.version,
      );
      await refresh();
      setMove(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saxlanmadı");
      await refresh();
    } finally {
      setPending((p) => {
        const n = { ...p };
        delete n[deal.id];
        return n;
      });
    }
  }
  function requestMove(deal: Item, stage: string) {
    if (stage === "recurring_unpaid") {
      setError("Ödəniş xəbərdarlığı faktiki ödəniş bölgüsünə görə hesablanır.");
      return;
    }
    if (
      stage === "lost" ||
      stage === "recurring_done" ||
      ["delivered", "lost", "recurring_done"].includes(deal.stage)
    )
      setMove({ deal, stage });
    else transition(deal, stage);
  }
  const card = (d: Item) => (
    <article
      key={d.id}
      className={"deal-card " + (pending[d.id] ? "saving" : "")}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", d.id)}
    >
      <button
        className="card-main"
        disabled={!!pending[d.id]}
        onClick={() => setSelected(d.id)}
      >
        <span className="serial">{d.serial}</span>
        <h3>{d.title || d.serial}</h3>
        <p>
          {d.customer_name ?? data.customers?.find((c) => c.id === d.customer_id)?.name ??
            (d.customer_id ? "Müəssisə" : "Müəssisə seçilməyib")}
        </p>
        <strong>
          {d.commercial ? money(d.commercial.total) : "Qiymət məhduddur"}
        </strong>
      </button>
      <div className="card-bottom">
        <span
          className={
            d.due_at && new Date(d.due_at) < new Date() ? "overdue" : ""
          }
        >
          <Clock size={13} />
          {d.due_at ? dateTime(d.due_at) : "Deadline yoxdur"}
        </span>
        <span
          className="avatar"
          title={data.memberships?.find((m) => m.id === d.accountable_id)?.name}
        >
          {data.memberships
            ?.find((m) => m.id === d.accountable_id)
            ?.name?.slice(0, 1) ?? "?"}
        </span>
      </div>
      <select
        aria-label={`${d.serial} mərhələsi`}
        value={d.stage}
        onChange={(e) => requestMove(d, e.target.value)}
        disabled={!!pending[d.id]}
      >
        {stages
          .filter((s) => s[0] !== "recurring_unpaid")
          .map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
      </select>
      {pending[d.id] && <span className="save-label">Saxlanır…</span>}
    </article>
  );
  return (
    <>
      <div className="section-toolbar">
        <div className="segmented">
          <button
            className={pipeline === "sales" ? "selected" : ""}
            onClick={() => (setPipeline("sales"),props.setFilters?.({...filters,pipeline:"sales"}))}
          >
            Yeni müştəri
          </button>
          <button
            className={pipeline === "recurring" ? "selected" : ""}
            onClick={() => (setPipeline("recurring"),props.setFilters?.({...filters,pipeline:"recurring"}))}
          >
            Dövri
          </button>
        </div>
        <div className="toolbar">
          <div className="segmented">
            <button
              aria-label="Kanban"
              className={view === "board" ? "selected" : ""}
              onClick={() => setView("board")}
            >
              <Columns3 size={17} />
            </button>
            <button
              aria-label="Siyahı"
              className={view === "list" ? "selected" : ""}
              onClick={() => setView("list")}
            >
              <List size={17} />
            </button>
          </div>
          {pipeline === "sales" && (
            <button className="primary" onClick={() => {setInitialWorkCount(1);setCreate(true);}}>
              <Plus size={17} />
              Yeni qutu
            </button>
          )}
        </div>
      </div>
      <details className="crm-filters">
        <summary>
          <span className="filter-icon"><SlidersHorizontal size={18} aria-hidden="true" /></span>
          <span>Qutu filtrləri</span>
          <span className="filter-hint">Departament, cavabdeh və tarix</span>
          <ChevronDown className="filter-chevron" size={18} aria-hidden="true" />
        </summary>
        <form className="form-grid" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);props.setFilters?.({...Object.fromEntries([...f.entries()].map(([k,v])=>[k,String(v)])),pipeline});}}>
      <Select name="department_id" label="Departament filtri" value={filters.department_id} options={data.departments??[]}/>
      <Select name="accountable_id" label="Cavabdeh filtri" value={filters.accountable_id} options={data.memberships??[]}/>
      <Select name="participant_id" label="İştirakçı filtri" value={filters.participant_id} options={data.memberships??[]}/>
      <CustomerSelect org={org} label="Müəssisə filtri" value={filters.customer_id}/>
      <Field name="due_from" label="Deadline başlanğıcı" type="date" value={filters.due_from}/><Field name="due_to" label="Deadline sonu" type="date" value={filters.due_to}/>
      <Select name="stage" label="Mərhələ filtri" value={filters.stage} options={stages.map(([id,name])=>({id,name}))}/>
      <Select name="archived" label="Arxiv filtri" value={filters.archived??"false"} options={[{id:"false",name:"Aktiv qutular"},{id:"true",name:"Arxivdəki qutular"}]}/>
      <label className="check"><input name="overdue" value="true" type="checkbox" defaultChecked={filters.overdue==="true"}/>Yalnız gecikənlər</label>
      <button className="primary">Filtrləri tətbiq et</button></form></details>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {view === "board" ? (
        <div className="board">
          {stages.map(([code, label]) => {
            const rows = deals.filter(
              (d) => (pending[d.id] ?? d.display_stage ?? d.stage) === code,
            );
            return (
              <section
                className="column"
                key={code}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const d = deals.find(
                    (d) => d.id === e.dataTransfer.getData("text/plain"),
                  );
                  if (d) requestMove(d, code);
                }}
              >
                <div className="column-heading">
                  <span className={"dot " + code} style={{backgroundColor:data.pipeline_stages?.find(s=>s.code===code)?.color}} />
                  <h2>{label}</h2>
                  <span className="count">{counts[code] ?? rows.length}</span>
                </div>
                <div className="column-cards">
                  {rows.map(card)}
                  {rows.length === 0 && (
                    <div className="column-empty">Bu mərhələdə qutu yoxdur</div>
                  )}
                  {(counts[code] ?? 0) > rows.length && (
                    <button
                      disabled={board.isFetchingNextPage}
                      onClick={() => board.fetchNextPage()}
                    >
                      Daha çox göstər
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="card-grid">
          {deals.map(card)}
          {!deals.length && <div className="empty">Qutu tapılmadı.</div>}
        </div>
      )}
      {view === "list" && board.hasNextPage && (
        <button onClick={() => board.fetchNextPage()}>Daha çox göstər</button>
      )}
      {board.isError && (
        <p role="alert">Qutular yüklənmədi. Yenidən yoxlayın.</p>
      )}
      {create && (
        <Modal title="Yeni qutu" onClose={() => setCreate(false)}>
          <Form
            label="Qutunu yarat"
            onSave={async (f) => {
              const result = await command(org, "crm", "deal.create", {
                title: f.get("title"),
                customer_id: f.get("customer_id"),
                due_at: utc(f.get("due_at")),
                accountable_id: f.get("accountable_id"),
                mediator_id: f.get("mediator_id"),
                works: Array.from({length:initialWorkCount},(_,index)=>({
                  quantity: Number(f.get(`quantity_${index}`)||1),
                  name: f.get(`work_name_${index}`),
                  catalog_id: f.get(`catalog_id_${index}`) || null,
                  department_id: f.get(`department_id_${index}`),
                  assignee_id: f.get(`assignee_id_${index}`) || member.id,
                  amount: cents(f.get(`amount_${index}`)),
                  due_at: utc(f.get(`work_due_at_${index}`)),
                })),
              });
              setCreate(false);
              await refresh();
              setSelected(result.id);
            }}
          >
            <Field name="title" label="Qutu adı" required />
            <CustomerSelect org={org} label="Müəssisə" required allowCreate={member.is_admin}/>
            <p className="helper">
              Siyahıda yoxdursa admin bu formadan yeni müəssisəni bazaya əlavə edə bilər.
              Siyahını axtarışla daralda bilərsiniz.
            </p>
            <Select
              name="accountable_id"
              label="Qutunun cavabdehi"
              options={data.memberships?.filter((m) => m.status === "active") ?? []}
              value={member.id}
              required
            />
            <Select
              name="mediator_id"
              label="Vasitəçi (satış əlaqələndiricisi)"
              options={data.memberships?.filter((m) => m.status === "active") ?? []}
            />
            <p className="helper">Vasitəçi qutunu, tarixçəni və ortaq To Do-nu görür; iş və ödənişləri dəyişə bilmir.</p>
            <h3>İşlər</h3>
            <p className="helper">Hər işi ayrıca əməkdaşa təyin edin. Təyin edilən iş həmin əməkdaşın To Do siyahısında görünəcək.</p>
            {Array.from({length:initialWorkCount},(_,index)=><fieldset key={index}><legend>İş {index+1}</legend>
              <Field name={`work_name_${index}`} label={index===0?"İş / xidmət":`İş / xidmət ${index+1}`} required />
              <Field name={`quantity_${index}`} label={index===0?"Miqdar":`Miqdar ${index+1}`} type="number" value={1} required/>
              <p className="helper">Qiymət bütün iş sətrinin məbləğidir; miqdara avtomatik vurulmur.</p>
              <Select name={`catalog_id_${index}`} label={index===0?"Xidmət kataloqu (istəyə görə)":`Xidmət kataloqu ${index+1} (istəyə görə)`} options={data.service_catalog?.filter((c) => !c.archived) ?? []}/>
              <Select name={`department_id_${index}`} label={index===0?"Departament":`Departament ${index+1}`} options={data.departments ?? []} required/>
              <Select name={`assignee_id_${index}`} label={index===0?"İşin cavabdehi":`İşin cavabdehi ${index+1}`} options={data.memberships?.filter((m) => m.status === "active") ?? []} value={member.id}/>
              <Field name={`amount_${index}`} label={index===0?"İşin qiyməti (AZN)":`İşin qiyməti ${index+1} (AZN)`}/>
              <Field name={`work_due_at_${index}`} label={index===0?"İşin deadline-ı":`İşin deadline-ı ${index+1}`} type="datetime-local"/>
            </fieldset>)}
            <button type="button" onClick={()=>setInitialWorkCount(count=>count+1)}><Plus size={16}/>İş əlavə et</button>
            {initialWorkCount>1&&<button type="button" onClick={()=>setInitialWorkCount(count=>count-1)}>Son işi sil</button>}
            <Field name="due_at" label="Ümumi deadline" type="datetime-local" />
          </Form>
        </Modal>
      )}
      {selected && (
        <DealDetail
          {...props}
          id={selected}
          onClose={() => setSelected(null)}
        />
      )}
      {move && (
        <Modal title="Mərhələ dəyişikliyi" onClose={() => setMove(null)}>
          <Form
            onSave={async (f) =>
              transition(move.deal, move.stage, {
                reason: f.get("reason"),
                loss_reason_id: f.get("loss_reason_id") || null,
              })
            }
          >
            {move.stage === "lost" && (
              <Select
                name="loss_reason_id"
                label="İtirilmə səbəbi"
                options={data.loss_reasons ?? []}
                required
              />
            )}
            <label>
              {move.stage === "lost"
                ? "Əlavə qeyd"
                : "Dəyişiklik / açıq iş səbəbi"}
              <textarea name="reason" required={move.stage !== "lost"} />
            </label>
          </Form>
        </Modal>
      )}
    </>
  );
}
export function DealDetail({
  id,
  onClose,
  ...props
}: PanelProps & { id: string; onClose: () => void }) {
  const { org, data: refs, member, refresh } = props;
  const [tab, setTab] = useState("works"),
    [edit, setEdit] = useState<Item | null | undefined>(undefined),
    [parentEdit, setParentEdit] = useState(false),
    [linkEdit,setLinkEdit] = useState<Item|null>(null),
    [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["workspace", org, "deal", id],
    queryFn: async () => {
      const r = await fetch(`/api/data?org=${org}&module=crm&id=${id}`);
      if (!r.ok) throw new Error("Qutu yüklənmədi");
      return r.json() as Promise<{
        data: WorkspaceData & { commercial?: { total: number | null } };
      }>;
    },
  });
  const data = query.isError ? undefined : query.data?.data;
  const d = data?.deals?.[0];
  const canEdit =
    !!d &&
    (member.is_admin || [d.created_by, d.accountable_id].includes(member.id));
  const canPrice = canEdit && allowed(member,refs.roles?.find(r=>r.id===member.role_id)?.permissions??[],"commercials.write");
  const save = async (
    operation: string,
    payload: Record<string, unknown>,
    domain = "crm",
  ) => {
    if (!d) return;
    await command(
      org,
      domain,
      operation,
      { deal_id: id, ...payload },
      d.version,
    );
    await refresh();
  };
  const works = data?.work_items ?? [];
  return (
    <Modal title={d?.title || d?.serial || "Qutu"} wide onClose={onClose}>
      {!d ? (
        <div className="empty">
          {query.isError ? "Qutuya giriş yoxdur." : "Yüklənir…"}
        </div>
      ) : (
        <>
          <div className="detail-summary">
            <div>
              <span className="serial">{d.serial}</span>
              <h2>
                {data?.customers?.find((c) => c.id === d.customer_id)?.name ?? refs.customers?.find((c) => c.id === d.customer_id)?.name ??
                  "Müəssisə seçilməyib"}
              </h2>
              <p>
                <Clock size={14} />
                {dateTime(d.due_at)}
              </p>
            </div>
            <div>
              <strong className="detail-price">
                {data?.commercial
                  ? money(data.commercial.total)
                  : "Qiymət məhduddur"}
              </strong>
              {canEdit && (
                <button onClick={() => setParentEdit(true)}>
                  Qutunu düzəlt <ArrowUpRight size={15} />
                </button>
              )}
            </div>
          </div>
          <div className="tabs">
            {[
              ["works", "İşlər"],
              ["comments", "Rəylər"],
              ["links", "Materiallar"],
              ["payments", "Ödəniş"],
              ["history", "Tarixçə"],
              ["participants", "İştirakçılar"],
            ].map(([t, l]) => (
              <button
                className={tab === t ? "active" : ""}
                key={t}
                onClick={() => setTab(t)}
              >
                {l}
              </button>
            ))}
          </div>
          {error && <p className="notice error">{error}</p>}
          {tab === "works" && (
            <>
              <div className="section-toolbar">
                <h3>
                  İşlər və tapşırıqlar{" "}
                  <span className="count">{works.length}</span>
                </h3>
                {canEdit && (
                  <button onClick={() => setEdit(null)}>
                    <Plus size={16} />
                    İş əlavə et
                  </button>
                )}
              </div>
              <div className="stack">
                {works.map((w) => (
                  <div className="work-row" key={w.id}>
                    <div>
                      <span className="eyebrow">
                        {
                          refs.departments?.find(
                            (x) => x.id === w.department_id,
                          )?.name
                        }{" "}
                        · {w.kind === "task" ? "Alt tapşırıq" : "Xidmət"}
                      </span>
                      <h3>{w.name}{w.archived?" · Arxivdə":""}</h3>
                      {w.description&&<p>{w.description}</p>}
                      <p>
                        {
                          refs.memberships?.find((m) => m.id === w.assignee_id)
                            ?.name
                        }{" "}
                        · {dateTime(w.due_at)}
                      </p>
                    </div>
                    <div>
                      <strong>
                        {w.kind === "service" &&
                          money(
                            data?.work_prices?.find((p) => p.work_id === w.id)
                              ?.amount,
                          )}
                      </strong>
                      <select
                        aria-label={w.name + " statusu"}
                        value={w.status}
                        disabled={!canEdit && w.assignee_id !== member.id}
                        onChange={async (e) => {
                          try {
                            await save("work.status", {
                              id: w.id,
                              status: e.target.value,
                            });
                          } catch (err) {
                            setError(String(err));
                          }
                        }}
                      >
                        {workStatuses.map(([s, l]) => (
                          <option key={s} value={s}>
                            {l}
                          </option>
                        ))}
                      </select>
                      {canEdit && (
                        <button onClick={() => setEdit(w)}>Düzəliş</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "comments" && (
            <>
              <div className="messages">
                {data?.deal_comments?.map((c) => (
                  <div className="comment" key={c.id}>
                    <strong>
                      {refs.memberships?.find((m) => m.id === c.actor_id)
                        ?.name ?? "Əməkdaş"}
                    </strong>
                    <small>{dateTime(c.created_at)}</small>
                    <p>{c.body}</p>
                    <small>{c.mentions?.map(id=>"@"+(refs.memberships?.find(m=>m.id===id)?.name??"Əməkdaş")).join(" · ")}</small>
                  </div>
                ))}
              </div>
              <Form
                label="Rəy əlavə et"
                onSave={async (f) =>
                  save("comment.add", { body: f.get("body"),mentions:f.getAll("mentions") })
                }
              >
                <label>
                  Rəy
                  <textarea name="body" maxLength={4000} required />
                </label>
                <details><summary>Əməkdaşın adını qeyd et</summary>{refs.memberships?.filter(m=>m.status==='active').map(m=><label className="check" key={m.id}><input type="checkbox" name="mentions" value={m.id}/>{m.name}</label>)}<p className="helper">Yalnız bu qutuya artıq girişi olan əməkdaşa bildiriş göndərilir. Bu seçim yeni giriş hüququ vermir.</p></details>
              </Form>
            </>
          )}
          {tab === "links" && (
            <>
              <div className="stack">
                {data?.resource_links?.filter(l=>!l.archived).map((l) => (
                  <div className="work-row" key={l.id}><a
                    className="resource-row"
                    key={l.id}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {l.title}
                    <ArrowUpRight size={16} />
                  </a>{canEdit&&<button onClick={()=>setLinkEdit(l)}>Düzəliş</button>}</div>
                ))}
              </div>
              {canEdit && (
                <Form
                  label="Link əlavə et"
                  onSave={async (f) =>
                    save(
                      "link.save",
                      { title: f.get("title"), url: f.get("url"),category:f.get("category") },
                      "operations",
                    )
                  }
                >
                  <Field name="title" label="Material adı" required />
                  <Field name="category" label="Kateqoriya"/>
                  <Field name="url" label="HTTPS keçid" type="url" required />
                </Form>
              )}
            </>
          )}
          {tab === "payments" && (
            <>
              <div className="stack">
                {data?.financial_documents?.map((f) => (
                  <div className="work-row" key={f.id}>
                    <span>
                      {f.kind === "charge" ? "İlkin alacaq" : "Düzəliş"}
                    </span>
                    <strong>{money(f.amount)}</strong>
                  </div>
                ))}
              </div>
              {data?.payments
                ?.filter((p) =>
                  data.payment_allocations?.some(
                    (a) =>
                      a.payment_id === p.id &&
                      data.financial_documents?.some(
                        (doc) => doc.id === a.document_id,
                      ),
                  ),
                )
                .map((p) => (
                  <div className="work-row" key={p.id}>
                    <div>
                      {money(p.amount)} · {dateTime(p.payment_date)}
                    </div>
                    {(member.is_admin || d.created_by === member.id) &&
                      !data.payments.some(
                        (x) => x.reversed_payment_id === p.id,
                      ) && (
                        <PaymentActions
                          org={org}
                          payment={p}
                          documents={data.financial_documents ?? []}
                          accounts={refs.account_options ?? []}
                          allocations={data.payment_allocations ?? []}
                          admin={member.is_admin}
                          refresh={refresh}
                        />
                      )}
                  </div>
                ))}
              {(member.is_admin || d.created_by === member.id) &&
              data?.financial_documents?.some(
                (doc) => doc.kind === "charge",
              ) ? (
                <Form
                  label="Ödənişi qeydə al"
                  onSave={async (f) => {
                    const amount = cents(f.get("amount"));
                    const doc = data?.financial_documents?.find(
                      (x) => x.kind === "charge",
                    );
                    if (!doc) throw new Error("Əvvəl qutunu təsdiqləyin.");
                    await command(
                      org,
                      "finance",
                      "payment.create",
                      {
                        customer_id: d.customer_id,
                        account_id: f.get("account_id"),
                        amount,
                        payment_date: utc(f.get("payment_date")),
                        allocations: [{ document_id: doc.id, amount }],
                      },
                      d.version,
                    );
                    await refresh();
                  }}
                >
                  <Select
                    name="account_id"
                    label="Kassa / bank"
                    options={refs.account_options ?? []}
                    required
                  />
                  <Field name="amount" label="Məbləğ (AZN)" required />
                  <Field
                    name="payment_date"
                    label="Faktiki ödəniş tarixi"
                    type="datetime-local"
                    value={localInput(new Date().toISOString())}
                    required
                  />
                </Form>
              ) : (
                <p className="notice">Ödəniş yazmaq hüququnuz yoxdur.</p>
              )}
            </>
          )}
          {tab === "participants" && (
            <div className="stack">
              {refs.memberships
                ?.filter((m) => m.status === "active")
                .map((m) => (
                  <label className="check" key={m.id}>
                    <input
                      type="checkbox"
                      checked={
                        data?.deal_members?.some((p) => p.member_id === m.id) ??
                        false
                      }
                      disabled={!canEdit}
                      onChange={async (e) => {
                        try {
                          await save("participant.set", {
                            member_id: m.id,
                            enabled: e.target.checked,
                          });
                        } catch (err) {
                          setError(String(err));
                        }
                      }}
                    />
                    {m.name}
                  </label>
                ))}
            </div>
          )}
          {tab === "history" && (
            <div className="timeline">
              {data?.audit_events?.map((a) => (
                <div key={a.id}>
                  <strong>{a.action}</strong>
                  <p>{a.reason}</p>
                  <small>{dateTime(a.created_at)}</small>
                </div>
              ))}
            </div>
          )}
          {linkEdit&&<Modal title="Materialı düzəlt" onClose={()=>setLinkEdit(null)}><Form onSave={async f=>{await command(org,"operations","link.save",{id:linkEdit.id,deal_id:id,title:f.get("title"),url:f.get("url"),category:f.get("category"),archived:f.get("archived")==="on"},linkEdit.version);await refresh();setLinkEdit(null);}}><Field name="title" label="Material adı" value={linkEdit.title} required/><Field name="url" label="HTTPS keçid" type="url" value={linkEdit.url} required/><Field name="category" label="Kateqoriya" value={linkEdit.category}/><label className="check"><input type="checkbox" name="archived"/>Arxivləşdir</label></Form></Modal>}
          {parentEdit && (
            <Modal title="Qutu məlumatı" onClose={() => setParentEdit(false)}>
              <Form
                onSave={async (f) => {
                  await save("deal.update", {
                    title: f.get("title"),
                    ...(!d.first_confirmed_at?{customer_id:f.get("customer_id")}:{}),
                    archived:f.get("archived")==="on",
                    accountable_id: f.get("accountable_id"),
                    mediator_id: f.get("mediator_id"),
                    due_at: utc(f.get("due_at")),
                    zero_reason: f.get("zero_reason"),
                    reason: f.get("reason"),
                  });
                  setParentEdit(false);
                }}
              >
                <Field name="title" label="Ad" value={d.title} />
                {!d.first_confirmed_at&&<CustomerSelect org={org} label="Müəssisə" value={d.customer_id} required/>}
                <label className="check"><input name="archived" type="checkbox" defaultChecked={d.archived}/>Arxivləşdir</label>
                <Select
                  name="accountable_id"
                  label="Ümumi cavabdeh"
                  value={d.accountable_id}
                  options={
                    refs.memberships?.filter((m) => m.status === "active") ?? []
                  }
                  required
                />
                <Select
                  name="mediator_id"
                  label="Vasitəçi (satış əlaqələndiricisi)"
                  value={d.mediator_id}
                  options={refs.memberships?.filter((m) => m.status === "active") ?? []}
                />
                <Field
                  name="due_at"
                  label="Ümumi deadline"
                  type="datetime-local"
                  value={localInput(d.due_at)}
                />
                <Field
                  name="zero_reason"
                  label="Sıfır qiymətin səbəbi (tətbiq edilirsə)"
                  value={d.zero_reason}
                />
                <Field name="reason" label="Dəyişiklik səbəbi" />
              </Form>
            </Modal>
          )}
          {edit !== undefined && (
            <Modal
              title={edit ? "İşi düzəlt" : "İş əlavə et"}
              onClose={() => setEdit(undefined)}
            >
              <Form
                onSave={async (f) => {
                  await save("work.save", {
                    ...(edit ? { id: edit.id } : {}),
                    name: f.get("name"),
                    description:f.get("description"),
                    ...(edit&&(canPrice||edit.kind==="task")?{archived:f.get("archived")==="on"}:{}),
                    kind: f.get("kind") || edit?.kind || "service",
                    department_id: f.get("department_id"),
                    assignee_id: f.get("assignee_id"),
                    due_at: utc(f.get("due_at")),
                    quantity:Number(f.get("quantity")||1),
                    ...(canPrice && (f.get("kind") || edit?.kind || "service") === "service"
                      ? { amount: cents(f.get("amount")) }
                      : {}),
                    catalog_id: f.get("catalog_id") || undefined,
                    parent_service_id: f.get("parent_service_id") || undefined,
                    reason: f.get("reason"),
                    reconcile: f.get("reconcile") === "on",
                  });
                  setEdit(undefined);
                }}
              >
                <Field name="name" label="İş adı" value={edit?.name} required />
                <Field name="description" label="İşin təsviri" value={edit?.description}/>
                <Field name="quantity" label="Miqdar" type="number" value={edit?.quantity??1} required/>
                <p className="helper">Qiymət bütün sətrin məbləğidir.</p>
                {edit&&(canPrice||edit.kind==="task")&&<label className="check"><input name="archived" type="checkbox" defaultChecked={edit.archived}/>İşi arxivləşdir</label>}
                {!edit && (
                  <>
                    <Select
                      name="catalog_id"
                      label="Xidmət kataloqu (istəyə görə)"
                      options={
                        refs.service_catalog?.filter((c) => !c.archived) ?? []
                      }
                    />
                    <Select
                      name="parent_service_id"
                      label="Alt tapşırığın aid olduğu xidmət"
                      options={works.filter(
                        (w) => w.kind === "service" && !w.archived,
                      )}
                    />
                  </>
                )}
                {!edit && (
                  <Select
                    name="kind"
                    label="Növ"
                    value="service"
                    options={[
                      { id: "service", name: "Qiymətli xidmət" },
                      { id: "task", name: "Alt tapşırıq" },
                    ]}
                  />
                )}
                <Select
                  name="department_id"
                  label="Departament"
                  options={refs.departments ?? []}
                  value={edit?.department_id}
                  required
                />
                <Select
                  name="assignee_id"
                  label="İş cavabdehi"
                  options={
                    refs.memberships?.filter((m) => m.status === "active") ?? []
                  }
                  value={edit?.assignee_id ?? member.id}
                />
                {canPrice&&<Field
                  name="amount"
                  label="Xidmət qiyməti (AZN)"
                  value={
                    edit &&
                    data?.work_prices?.find((p) => p.work_id === edit.id)
                      ?.amount != null
                      ? String(
                          data.work_prices.find((p) => p.work_id === edit.id)!
                            .amount! / 100,
                        )
                      : undefined
                  }
                />}
                <Field
                  name="due_at"
                  label="İş deadline-ı"
                  type="datetime-local"
                  value={localInput(edit?.due_at)}
                />
                <Field name="reason" label="Dəyişiklik səbəbi" />
                {member.is_admin && (
                  <label className="check">
                    <input type="checkbox" name="reconcile" />
                    Artıq ödəniş bölgüsünü avansa qaytar
                  </label>
                )}
              </Form>
            </Modal>
          )}
        </>
      )}
    </Modal>
  );
}
