"use client";
import { CustomerSelect } from "@/components/customer-select";
import { PaymentActions } from "./payment-actions";
import { useState } from "react";
import { Plus, Wallet, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { PanelProps } from "@/components/module-page";
import { Modal } from "@/components/dialog";
import { Form, Field, Select } from "@/components/form";
import { money, cents, utc, localInput, dateTime } from "@/lib/domain";
import { command } from "@/lib/db/api";
export function Finance({ org, data, member, refresh }: PanelProps) {
  const [add, setAdd] = useState("");
  const role = data.roles?.find((r) => r.id === member.role_id);
  const permitted =
    member.is_admin ||
    member.overrides?.["finance.read"] === "allow" ||
    (member.overrides?.["finance.read"] !== "deny" &&
      role?.permissions?.includes("finance.read"));
  if (!permitted)
    return (
      <div className="empty">
        <Wallet size={34} />
        <h2>Balansa giriş məhduddur</h2>
        <p>
          Agentliyin maliyyəsini görmək üçün admin finance.read icazəsini
          açmalıdır. Öz qutunuzda ödəniş hüququnuz ayrıca saxlanır.
        </p>
      </div>
    );
  const docs = data.financial_documents ?? [],
    alloc = data.payment_allocations ?? [],
    payments = data.payments ?? [];
  const stats = data.stats?.[0]?.finance;
  return (
    <>
      <div className="stats-grid">
        {[
          ["Qalıq alacaq", stats?.receivable],
          ["Qalıq borc", stats?.payable],
          ["Xalis pul hərəkəti", stats?.cash_net],
          ["Kassa / bank qalığı", stats?.cash_balance],
        ].map(([label, n]) => (
          <div className="stat" key={label}>
            <span>{label}</span>
            <strong>{money(n as number | undefined)}</strong>
          </div>
        ))}
      </div>
      <div className="section-toolbar">
        <h2>Hesablaşmalar</h2>
        {member.is_admin && (
          <div className="toolbar">
            <button onClick={() => setAdd("account")}>Kassa / bank</button>
            <button onClick={() => setAdd("document")}>
              Borc / başlanğıc qalıq
            </button>
            <button className="primary" onClick={() => setAdd("payment")}>
              <Plus size={17} />
              Pul əməliyyatı
            </button>
          </div>
        )}
      </div>
      <div className="surface table-scroll">
        <table>
          <thead>
            <tr>
              <th>Mənbə</th>
              <th>Müştəri / qarşı tərəf</th>
              <th>Məbləğ</th>
              <th>Ayrılmış pul</th>
              <th>Tarix</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.kind === "charge"
                    ? "Alacaq"
                    : d.kind === "adjustment"
                      ? "Düzəliş"
                      : d.kind === "payable"
                        ? "Öhdəlik"
                        : "Başlanğıc qalıq"}
                </td>
                <td>
                  {data.customers?.find((c) => c.id === d.customer_id)?.name ??
                    d.counterparty ??
                    "—"}
                </td>
                <td>{money(d.amount)}</td>
                <td>
                  {money(
                    alloc
                      .filter((a) => a.document_id === d.id)
                      .reduce((s, a) => s + (a.amount ?? 0), 0),
                  )}
                </td>
                <td>{d.due_date ?? dateTime(d.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="surface">
        <h2>Pul hərəkəti</h2>
        {payments.map((p) => (
          <div className="work-row" key={p.id}>
            <div>
              {p.direction === "in" ? (
                <ArrowDownLeft size={20} />
              ) : (
                <ArrowUpRight size={20} />
              )}
              <strong>{money(p.amount)}</strong>
              <p>
                {dateTime(p.payment_date)} ·{" "}
                {
                  data.financial_accounts?.find((a) => a.id === p.account_id)
                    ?.name
                }
              </p>
            </div>
            {member.is_admin &&
              !payments.some((x) => x.reversed_payment_id === p.id) && (
                <PaymentActions
                  org={org}
                  payment={p}
                  documents={docs}
                  accounts={data.financial_accounts ?? []}
                  allocations={alloc}
                  admin
                  refresh={refresh}
                />
              )}
            <span>
              {p.reversed_payment_id ? "Reversal" : p.note || p.direction}
            </span>
          </div>
        ))}
      </section>
      {add && (
        <Modal
          title={
            add === "account"
              ? "Maliyyə hesabı"
              : add === "document"
                ? "Öhdəlik / başlanğıc qalıq"
                : "Pul əməliyyatı"
          }
          onClose={() => setAdd("")}
        >
          <Form
            onSave={async (f) => {
              if (add === "account")
                await command(org, "finance", "account.save", {
                  name: f.get("name"),
                  kind: f.get("kind"),
                  opening_amount: cents(f.get("opening_amount")) ?? 0,
                  as_of: f.get("as_of"),
                });
              else if (add === "document")
                await command(org, "finance", "document.create", {
                  kind: f.get("kind"),
                  customer_id: f.get("customer_id") || null,
                  counterparty: f.get("counterparty"),
                  category: f.get("category") || null,
                  amount: cents(f.get("amount")),
                  due_date: f.get("due_date"),
                  reason: f.get("reason"),
                });
              else {
                const amount = cents(f.get("amount"));
                const allocations = f.getAll("document_id").flatMap((id, i) =>
                  id
                    ? [
                        {
                          document_id: id,
                          amount: cents(f.getAll("allocation_amount")[i]),
                        },
                      ]
                    : [],
                );
                await command(org, "finance", "payment.create", {
                  customer_id: f.get("customer_id") || null,
                  account_id: f.get("account_id"),
                  direction: f.get("direction"),
                  amount,
                  payment_date: utc(f.get("payment_date")),
                  note: f.get("note"),
                  allocations,
                });
              }
              await refresh();
              setAdd("");
            }}
          >
            {add === "account" ? (
              <>
                <Field name="name" label="Hesab adı" required />
                <Select
                  name="kind"
                  label="Növ"
                  options={[
                    { id: "cash", name: "Kassa" },
                    { id: "bank", name: "Bank" },
                  ]}
                  required
                />
                <Field
                  name="opening_amount"
                  label="Başlanğıc məbləğ (AZN)"
                  value="0"
                />
                <Field
                  name="as_of"
                  label="Başlanğıc tarixi"
                  type="date"
                  required
                />
              </>
            ) : add === "document" ? (
              <>
                <Select
                  name="kind"
                  label="Sənəd növü"
                  options={[
                    { id: "payable", name: "Agentliyin borcu" },
                    { id: "opening_receivable", name: "Başlanğıc alacaq" },
                    { id: "opening_payable", name: "Başlanğıc borc" },
                  ]}
                  required
                />
                <CustomerSelect org={org} label="Müştəri (alacaq üçün)" />
                <Field name="counterparty" label="Qarşı tərəf" />
                <Select
                  name="category"
                  label="Borc kateqoriyası"
                  options={[
                    { id: "freelancer", name: "Freelancer" },
                    { id: "supplier", name: "Təchizatçı" },
                    { id: "salary", name: "Əməkdaş haqqı" },
                    { id: "office", name: "Ofis xərci" },
                  ]}
                />
                <Field name="amount" label="Məbləğ (AZN)" required />
                <Field name="due_date" label="Son tarix" type="date" required />
                <Field name="reason" label="Səbəb / mənbə" required />
              </>
            ) : (
              <>
                <CustomerSelect org={org} label="Müştəri" />
                <Select
                  name="account_id"
                  label="Hesab"
                  options={data.financial_accounts ?? []}
                  required
                />
                <Select
                  name="direction"
                  label="İstiqamət"
                  value="in"
                  options={[
                    { id: "in", name: "Daxilolma" },
                    { id: "out", name: "Çıxış" },
                  ]}
                />
                <Field name="amount" label="Faktiki məbləğ (AZN)" required />
                <Field
                  name="payment_date"
                  label="Faktiki tarix"
                  type="datetime-local"
                  value={localInput(new Date().toISOString())}
                  required
                />
                {[0, 1, 2].map((i) => (
                  <div className="form-grid" key={i}>
                    <Select
                      name="document_id"
                      label={`Bölgü ${i + 1}`}
                      options={docs
                        .filter((d) => d.kind !== "adjustment")
                        .map((d) => ({
                          id: d.id,
                          name:
                            (data.customers?.find((c) => c.id === d.customer_id)
                              ?.name ??
                              d.counterparty ??
                              d.kind) +
                            " · " +
                            money(d.amount),
                        }))}
                    />
                    <Field
                      name="allocation_amount"
                      label="Ayrılan məbləğ (AZN)"
                    />
                  </div>
                ))}
                <p className="helper">
                  Ayrılmayan məbləğ müştəri avansı kimi qalır.
                </p>
                <Field name="note" label="Qeyd" />
              </>
            )}
          </Form>
        </Modal>
      )}
    </>
  );
}
