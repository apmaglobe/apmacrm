"use client";

import type { PanelProps } from "@/components/module-page";
import { dateTime } from "@/lib/domain";

export function Calls({ data, q }: PanelProps) {
  const calls = (data.sales_calls ?? []).filter((call) => {
    const needle = q.trim().toLocaleLowerCase("az");
    if (!needle) return true;
    return [call.phone, call.note, data.customers?.find((c) => c.id === call.customer_id)?.name]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("az").includes(needle));
  });
  const stats = (data.memberships ?? [])
    .filter((member) => member.status === "active")
    .map((member) => ({ member, calls: calls.filter((call) => call.caller_id === member.id) }))
    .sort((a, b) => b.calls.length - a.calls.length || String(a.member.name).localeCompare(String(b.member.name)));
  return <>
    <section className="surface">
      <div className="section-toolbar"><div><h2>Zəng nəticələri</h2><p className="helper">“Zəng et” telefonun yığma tətbiqini açır və cəhdi dərhal tarixçəyə yazır.</p></div><strong className="count">{calls.length} qeyd</strong></div>
      <div className="call-stats">
        {stats.map(({ member, calls: memberCalls }) => <article key={member.id} className="call-stat">
          <span className="avatar">{String(member.name ?? "?").slice(0, 1)}</span><div><strong>{member.name}</strong><p>{memberCalls.filter((call) => call.outcome === "called").length} zəng · {memberCalls.filter((call) => call.outcome === "meaningless").length} mənasız</p></div><b>{memberCalls.length}</b>
        </article>)}
        {!stats.length && <div className="empty">Aktiv əməkdaş yoxdur.</div>}
      </div>
    </section>
    <section className="surface">
      <div className="section-toolbar"><h2>Zəng tarixçəsi</h2></div>
      <div className="table-scroll"><table><thead><tr><th>Tarix</th><th>Müəssisə</th><th>Zəng edən</th><th>Nömrə</th><th>Nəticə</th><th>Qeyd</th></tr></thead><tbody>
        {calls.map((call) => <tr key={call.id}><td>{dateTime(String(call.created_at))}</td><td>{data.customers?.find((customer) => customer.id === call.customer_id)?.name ?? "Müəssisə"}</td><td>{data.memberships?.find((member) => member.id === call.caller_id)?.name ?? "—"}</td><td>{call.phone ?? "—"}</td><td><span className={call.outcome === "meaningless" ? "status-lost" : "status-called"}>{call.outcome === "meaningless" ? "Mənasız" : "Zəng edilib"}</span></td><td>{call.note ?? "—"}</td></tr>)}
        {!calls.length && <tr><td colSpan={6} className="empty">Hələ zəng qeydi yoxdur.</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
