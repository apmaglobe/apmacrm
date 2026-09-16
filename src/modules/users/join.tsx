"use client";
import { useState } from "react";
import Link from "next/link";
import { browserClient } from "@/lib/auth/browser";
import { Form, Field } from "@/components/form";
import { BrandLogo } from "@/components/brand-logo";
export function JoinForm({
  token,
  invitation = false,
}: {
  token: string;
  invitation?: boolean;
}) {
  const [done, setDone] = useState(false);
  return (
    <main className="auth">
      <div className="auth-card">
        <div className="brand"><BrandLogo /></div>
        <h1>Agentliyə qoşulun</h1>
        {done ? (
          <p className="notice">
            Müraciətiniz göndərildi. Adminin təsdiqini gözləyin.
          </p>
        ) : (
          <Form
            label="Qoşulma müraciəti"
            onSave={async (f) => {
              const { error } = await browserClient().rpc(
                invitation ? "invite_accept" : "join_organization",
                {
                  ...(invitation ? { token } : { join_token: token }),
                  display_name: String(f.get("name")),
                },
              );
              if (error)
                throw new Error(
                  "Əvvəl emailinizi təsdiqləyib hesabınıza daxil olun. Qoşulma keçidini də yoxlayın.",
                );
              setDone(true);
            }}
          >
            <Field name="name" label="Ad və soyad" required />
          </Form>
        )}
        <Link className="button" href="/login">
          Qeydiyyat / giriş
        </Link>
      </div>
    </main>
  );
}
