"use client";
import { useEffect, useState } from "react";
import { browserClient } from "@/lib/auth/browser";
export function Login() {
  const db = browserClient();
  const [mode, setMode] = useState("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [signed, setSigned] = useState(false);
  useEffect(() => {
    const {data}=db.auth.onAuthStateChange((_event,session)=>setSigned(!!session));
    return ()=>data.subscription.unsubscribe();
  }, [db]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    try {
      if (mode === "register") {
        const { error } = await db.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: location.origin + "/auth/callback" },
        });
        if (error) throw error;
        setMessage("Email ünvanınıza göndərilən təsdiq keçidini açın.");
      } else if (mode === "reset") {
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + "/auth/callback",
        });
        if (error) throw error;
        setMessage("Ünvan uyğun olarsa, şifrə yeniləmə keçidi göndəriləcək.");
      } else if (mode === "password") {
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        setMessage("Şifrə yeniləndi.");
      } else if (mode === "mfa") {
        const { error } = await db.auth.mfa.challengeAndVerify({
          factorId: factor,
          code: String(form.get("code")),
        });
        if (error) throw error;
        setSigned(true);
        setMode("login");
        setQr("");
        setMessage(
          "İki mərhələli təsdiq tamamlandı. İş sahəsinə daxil ola bilərsiniz.",
        );
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setSigned(true);
        const { data } = await db.auth.mfa.listFactors();
        if (data?.totp.length) {
          setFactor(data.totp[0].id);
          setMode("mfa");
        } else window.location.assign("/workspace/crm");
      }
    } catch {
      setMessage(
        "Əməliyyat alınmadı. Məlumatları və email təsdiqini yoxlayın.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function enroll() {
    setBusy(true);
    try {
      const existing = await db.auth.mfa.listFactors();
      const verified = existing.data?.totp.find((f) => f.status === "verified");
      if (verified) {
        setFactor(verified.id);
        setMode("mfa");
        return;
      }
      const { data, error } = await db.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "APMA CRM",
      });
      if (error) throw error;
      setFactor(data.id);
      setQr(data.totp.qr_code);
      setMode("mfa");
    } catch {
      setMessage("TOTP hazırlana bilmədi. Yenidən daxil olun.");
    } finally {
      setBusy(false);
    }
  }
  async function bootstrap() {
    setBusy(true);
    const { error } = await db.rpc("claim_bootstrap");
    setBusy(false);
    if (error)
      setMessage(
        "Aktivləşmə üçün təyin olunmuş admin emaili, email təsdiqi və TOTP lazımdır.",
      );
    else window.location.assign("/workspace/crm");
  }
  return (
    <main className="auth">
      <div className="auth-card">
        <div className="brand">
          APMA<span>CRM</span>
        </div>
        <p className="eyebrow">AGENTLİYİN İŞ SAHƏSİ</p>
        <h1>
          {mode === "register"
            ? "Hesab yaradın"
            : mode === "reset"
              ? "Şifrəni bərpa edin"
              : mode === "mfa"
                ? "İki mərhələli təsdiq"
                : mode === "password"
                  ? "Yeni şifrə"
                  : "Xoş gəlmisiniz"}
        </h1>
        <form key={mode} onSubmit={submit}>
          {mode === "mfa" ? (
            <>
              {qr && (
                <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
              )}
              <label>
                Təsdiq kodu
                <input
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                />
              </label>
            </>
          ) : (
            <>
              {mode !== "password" && (
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                  />
                </label>
              )}
              {mode !== "reset" && (
                <label>
                  Şifrə
                  <input
                    name="password"
                    type="password"
                    minLength={mode === "login" ? 8 : 10}
                    required
                    autoComplete={
                      mode === "register" ? "new-password" : "current-password"
                    }
                  />
                </label>
              )}
            </>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Gözləyin…" : mode === "login" ? "Daxil ol" : "Davam et"}
          </button>
        </form>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        <div className="auth-links">
          <button
            onClick={() => setMode(mode === "register" ? "login" : "register")}
          >
            {mode === "register" ? "Girişə qayıt" : "Qeydiyyat"}
          </button>
          <button onClick={() => setMode("reset")}>Şifrəni unutdum</button>
        </div>
        {signed && (
          <div className="stack">
            <button onClick={enroll} disabled={busy}>
              TOTP qur / təsdiqlə
            </button>
            <button onClick={bootstrap} disabled={busy}>
              İlk admini aktivləşdir
            </button>
            <button onClick={() => setMode("password")}>Şifrəni yenilə</button>
            <button
              disabled={busy || mode === "mfa"}
              onClick={() => {
                window.location.assign("/workspace/crm");
              }}
            >
              İş sahəsinə keç
            </button>
            <button
              onClick={async () => {
                await db.auth.signOut();
                setSigned(false);
                setMessage("Hesabdan çıxıldı.");
              }}
            >
              Çıxış
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
