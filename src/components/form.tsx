"use client";
import { useState } from "react";
export function Form({
  children,
  onSave,
  label = "Saxla",
}: {
  children: React.ReactNode;
  onSave: (data: FormData) => Promise<void>;
  label?: string;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const data = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          await onSave(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Saxlanmadı");
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <button disabled={busy} className="primary">
        {busy ? "Saxlanır…" : label}
      </button>
    </form>
  );
}
export function Field({
  label,
  name,
  type = "text",
  value,
  required = false,
  readOnly = false,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  readOnly?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        aria-label={label}
        type={type}
        name={name}
        defaultValue={value}
        required={required}
        readOnly={readOnly}
      />
    </label>
  );
}
export function Select({
  label,
  name,
  options,
  value,
  required = false,
  empty = "Seçin",
}: {
  label: string;
  name: string;
  options: { id: string; name: string }[];
  value?: string;
  required?: boolean;
  empty?: string;
}) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        name={name}
        defaultValue={value ?? ""}
        required={required}
      >
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
