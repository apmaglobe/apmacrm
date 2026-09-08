"use client";
import { useState } from "react";
import { Modal } from "@/components/dialog";
import { Form, Field, Select } from "@/components/form";
import { command } from "@/lib/db/api";
import { cents, money, localInput, utc } from "@/lib/domain";
import type { Item } from "@/lib/db/types";
export function PaymentActions({
  org,
  payment: p,
  documents,
  accounts,
  allocations,
  admin,
  refresh,
}: {
  org: string;
  payment: Item;
  documents: Item[];
  accounts: Item[];
  allocations: Item[];
  admin: boolean;
  refresh: () => Promise<void>;
}) {
  const [op, setOp] = useState("");
  const current = documents.filter(
    (d) =>
      allocations
        .filter((a) => a.payment_id === p.id && a.document_id === d.id)
        .reduce((n, a) => n + (a.amount ?? 0), 0) > 0,
  );
  const options = (admin ? documents : current)
    .filter((d) => d.kind !== "adjustment" && d.customer_id === p.customer_id)
    .map((d) => ({
      id: d.id,
      name:
        (d.counterparty || d.kind) +
        " · " +
        money(d.amount) +
        " · " +
        d.id.slice(0, 8),
    }));
  if (p.reversed_payment_id) return null;
  return (
    <>
      <div className="toolbar">
        <button onClick={() => setOp("payment.replace")}>Düzəlt</button>
        {admin && (
          <>
            <button onClick={() => setOp("payment.allocate")}>
              Avansı böl
            </button>
            <button onClick={() => setOp("payment.release")}>
              Bölgünü geri çevir
            </button>
            {p.direction === "in" && (
              <button onClick={() => setOp("payment.refund")}>Refund</button>
            )}
          </>
        )}
      </div>
      {op && (
        <Modal
          title={
            op === "payment.replace"
              ? "Ödənişi düzəlt"
              : op === "payment.allocate"
                ? "Avans bölgüsü"
                : op === "payment.release"
                  ? "Bölgünü geri çevir"
                  : "Pul qaytarma"
          }
          onClose={() => setOp("")}
        >
          <Form
            onSave={async (f) => {
              const amounts = f.getAll("allocation_amount");
              const splits = f
                .getAll("document_id")
                .flatMap((id, i) =>
                  id ? [{ document_id: id, amount: cents(amounts[i]) }] : [],
                );
              await command(
                org,
                "finance",
                op,
                {
                  ...(op === "payment.allocate" ? { id: p.id } : {}),
                  payment_id: p.id,
                  replace_id: p.id,
                  customer_id: p.customer_id,
                  account_id: f.get("account_id") || p.account_id,
                  direction: p.direction,
                  amount: cents(f.get("amount")),
                  payment_date: utc(f.get("payment_date")),
                  reason: f.get("reason"),
                  note: f.get("note"),
                  allocations: splits,
                },
                p.version,
              );
              await refresh();
              setOp("");
            }}
          >
            <p>
              {money(p.amount)} · {localInput(p.payment_date).replace("T", " ")}
            </p>
            {op === "payment.release" ? (
              <p>
                Bu ödənişin bütün aktiv bölgüləri əlaqəli reversal qeydləri ilə
                avansa qaytarılacaq. Faktiki pul dəyişməyəcək.
              </p>
            ) : (
              <>
                {op === "payment.replace" && (
                  <Select
                    name="account_id"
                    label="Hesab"
                    value={p.account_id}
                    options={accounts}
                    required
                  />
                )}
                {op !== "payment.allocate" && (
                  <>
                    <Field
                      name="amount"
                      label="Məbləğ (AZN)"
                      value={
                        op === "payment.replace"
                          ? (p.amount ?? 0) / 100
                          : undefined
                      }
                      required
                    />
                    <Field
                      name="payment_date"
                      label="Faktiki tarix"
                      type="datetime-local"
                      value={localInput(
                        op === "payment.replace"
                          ? p.payment_date
                          : new Date().toISOString(),
                      )}
                      required
                    />
                  </>
                )}
                {(op === "payment.replace" || op === "payment.allocate") &&
                  Array.from(
                    { length: admin ? Math.max(current.length, 3) : 1 },
                    (_, i) => (
                      <div className="form-grid" key={i}>
                        <Select
                          name="document_id"
                          label={`Bölgü ${i + 1}`}
                          options={options}
                          value={
                            op === "payment.replace"
                              ? current[i]?.id
                              : undefined
                          }
                          required={!admin}
                        />
                        <Field
                          name="allocation_amount"
                          label={`Bölgü ${i + 1} məbləği (AZN)`}
                          value={
                            op === "payment.replace" && current[i]
                              ? allocations
                                  .filter(
                                    (a) =>
                                      a.payment_id === p.id &&
                                      a.document_id === current[i].id,
                                  )
                                  .reduce((n, a) => n + (a.amount ?? 0), 0) /
                                100
                              : undefined
                          }
                          required={!admin}
                        />
                      </div>
                    ),
                  )}
              </>
            )}
            <Field name="reason" label="Dəyişikliyin səbəbi" required />
          </Form>
        </Modal>
      )}
    </>
  );
}
