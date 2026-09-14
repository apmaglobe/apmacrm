"use client";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { browserClient } from "@/lib/auth/browser";
type LoginContext = {has_active_membership:boolean;requires_mfa:boolean;bootstrap_pending:boolean};
type Mode = "loading" | "login" | "register" | "reset" | "password" | "mfa" | "setup" | "activate" | "account" | "pending";
export function Login() {
  const db = browserClient();
  const [mode, setMode] = useState<Mode>("loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [signed, setSigned] = useState(false);
  const [email, setEmail] = useState("");
  const resolve = useCallback(async (enter = false) => {
    const {data:{user}} = await db.auth.getUser();
    if (!user) {setSigned(false);setMode("login");return;}
    setSigned(true);setEmail(user.email??"");
    if(new URLSearchParams(window.location.search).get("recovery")==="1"){
      setMode("password");return;
    }
    const [{data,error},assurance,factors] = await Promise.all([
      db.rpc("login_context"),db.auth.mfa.getAuthenticatorAssuranceLevel(),db.auth.mfa.listFactors(),
    ]);
    if(error||assurance.error||factors.error)throw Error("LOGIN_CONTEXT_FAILED");
    const context=data as LoginContext;
    const verified=factors.data.totp.find(f=>f.status==="verified");
    if(assurance.data.currentLevel!=="aal2" && (verified||context.requires_mfa||context.bootstrap_pending)){
      setQr("");setFactor(verified?.id??"");setMode(verified?"mfa":"setup");return;
    }
    if(context.bootstrap_pending){
      setMode("activate");
      if(!enter)return;
      const claimed=await db.rpc("claim_bootstrap");
      if(claimed.error)throw Error("BOOTSTRAP_FAILED");
      window.location.assign("/workspace/crm");return;
    }
    if(context.has_active_membership){
      setMode("account");
      if(enter)window.location.assign("/workspace/crm");
    }else setMode("pending");
  },[db]);
  useEffect(() => {
    if(new URLSearchParams(window.location.search).get("error")==="oauth"){
      setMessage("Google girişi tamamlanmadı. Google hesabının test istifadəçisi kimi əlavə edildiyini yoxlayın və yenidən sınayın.");
    }
    let timer:ReturnType<typeof setTimeout>;
    const {data}=db.auth.onAuthStateChange((event)=>{
      // Supabase emits this callback while holding its auth lock; resolve outside that lock.
      if(event==="INITIAL_SESSION")timer=setTimeout(()=>{void resolve().catch(()=>{setMode("login");setMessage("Hesabın vəziyyəti yüklənmədi. Yenidən daxil olun.");});},0);
      if(event==="PASSWORD_RECOVERY"){setSigned(true);setMode("password");}
      if(event==="SIGNED_OUT"){setSigned(false);setMode("login");setQr("");}
    });
    return ()=>{clearTimeout(timer);data.subscription.unsubscribe();};
  }, [db,resolve]);
  async function resume(){
    setBusy(true);setMessage("");
    try{await resolve(true);}catch{setMessage("Hesab aktivləşdirilə bilmədi. Yenidən sınayın.");}finally{setBusy(false);}
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setMessage("");
    const form = new FormData(e.currentTarget);
    const inputEmail=String(form.get("email")??"");
    const password=String(form.get("password")??"");
    try {
      if(mode==="register"){
        const {error}=await db.auth.signUp({email:inputEmail,password,options:{emailRedirectTo:location.origin+"/auth/callback"}});
        if(error)throw error;setMessage("Email ünvanınıza göndərilən təsdiq keçidini açın.");
      }else if(mode==="reset"){
        const {error}=await db.auth.resetPasswordForEmail(inputEmail,{redirectTo:location.origin+"/auth/callback?flow=recovery"});
        if(error)throw error;setMessage("Ünvan uyğun olarsa, şifrə yeniləmə keçidi göndəriləcək.");
      }else if(mode==="password"){
        const {error}=await db.auth.updateUser({password});if(error)throw error;window.history.replaceState({},"","/login");setMessage("Şifrə yeniləndi.");
      }else if(mode==="mfa"){
        const {error}=await db.auth.mfa.challengeAndVerify({factorId:factor,code:String(form.get("code"))});
        if(error){setMessage("Təsdiq kodu qəbul edilmədi. Authenticator tətbiqindəki cari 6 rəqəmli kodu yazın.");return;}
        setQr("");await resolve(true);
      }else{
        const {error}=await db.auth.signInWithPassword({email:inputEmail,password});if(error)throw error;
        await resolve(true);
      }
    }catch(error){
      const reason=error instanceof Error?error.message:"";
      if(/session missing|invalid.*token|expired/i.test(reason))setMessage("Bərpa keçidi etibarsızdır və ya müddəti bitib. Yeni keçid istəyin.");
      else if(/password.*(least|short|length)|weak password/i.test(reason))setMessage("Yeni şifrə ən azı 10 simvol olmalıdır.");
      else setMessage("Şifrə yenilənmədi. Yeni bərpa keçidi istəyib bir dəfə açın.");
    }
    finally{setBusy(false);}
  }
  async function signInWithGoogle(){
    setBusy(true);setMessage("");
    try{
      const {data,error}=await db.auth.signInWithOAuth({
        provider:"google",
        options:{redirectTo:`${window.location.origin}/auth/callback`,skipBrowserRedirect:true},
      });
      if(error||!data.url)throw error??Error("GOOGLE_OAUTH_URL_MISSING");
      window.location.assign(data.url);
    }catch{
      setMessage("Google ilə giriş başlatılmadı. Bir az sonra yenidən sınayın.");
      setBusy(false);
    }
  }
  async function enroll(){
    setBusy(true);setMessage("");
    try{
      const existing=await db.auth.mfa.listFactors();if(existing.error)throw existing.error;
      const verified=existing.data.totp.find(f=>f.status==="verified");
      if(verified){setFactor(verified.id);setQr("");setMode("mfa");return;}
      // Only replace this account's unfinished enrollment; verified factors are preserved.
      for(const unfinished of existing.data.all.filter(f=>f.factor_type==="totp"&&f.status==="unverified")){
        const {error}=await db.auth.mfa.unenroll({factorId:unfinished.id});if(error)throw error;
      }
      const {data,error}=await db.auth.mfa.enroll({factorType:"totp",friendlyName:"APMA CRM"});
      if(error)throw error;setFactor(data.id);setQr(data.totp.qr_code);setMode("mfa");
    }catch{setMessage("Authenticator hazırlana bilmədi. Yenidən sınayın.");}finally{setBusy(false);}
  }
  const titles:Record<Mode,string>={loading:"Hesab yoxlanır…",login:"Xoş gəlmisiniz",register:"Hesab yaradın",reset:"Şifrəni bərpa edin",password:"Yeni şifrə",mfa:"İki mərhələli təsdiq",setup:"Admin hesabını qoruyun",activate:"Admin hesabınız hazırdır",account:"Girişiniz təsdiqlənib",pending:"Üzvlük təsdiqi gözlənilir"};
  const showForm=["login","register","reset","password","mfa"].includes(mode);
  return <main className="auth"><div className="auth-card">
    <div className="brand">APMA<span>CRM</span></div>
    <p className="eyebrow">AGENTLİYİN İŞ SAHƏSİ</p><h1>{titles[mode]}</h1>
    {signed&&<p className="helper">{email}</p>}
    {mode==="loading"&&<p role="status">Giriş vəziyyəti yoxlanır…</p>}
    {mode==="setup"&&<div className="stack"><p>İlk giriş üçün telefonunuzdakı Authenticator tətbiqini qoşun. Kodu təsdiqlədikdən sonra admin hesabınız aktivləşəcək və CRM açılacaq.</p><button className="primary" disabled={busy} onClick={enroll}>{busy?"Hazırlanır…":"Authenticator qur"}</button></div>}
    {mode==="activate"&&<div className="stack"><p>Təhlükəsizlik təsdiqi tamamlanıb. Agentliyin ilk admin hesabını aktivləşdirin.</p><button className="primary" disabled={busy} onClick={resume}>{busy?"Aktivləşdirilir…":"İlk admini aktivləşdir"}</button></div>}
    {mode==="account"&&<button className="primary" disabled={busy} onClick={resume}>CRM-ə daxil ol</button>}
    {mode==="pending"&&<div className="stack"><p>Hesabınıza giriş edilib. Agentliyin qoşulma və ya dəvət linkindən müraciət edin. Müraciət etmisinizsə, admin üzvlüyünüzü təsdiqlədikdən sonra iş sahəsi açılacaq.</p><button disabled={busy} onClick={resume}>Vəziyyəti yenilə</button></div>}
    {showForm&&<form key={mode} onSubmit={submit}>
      {mode==="mfa"?<>
        {qr&&<><p>Authenticator tətbiqində bu QR kodunu skan edin.</p><Image unoptimized className="qr" src={qr} width={240} height={240} alt="Authenticator QR kodu"/></>}
        <p className="helper">Telefonunuzdakı Authenticator tətbiqindən cari 6 rəqəmli kodu daxil edin. Təsdiqdən sonra CRM avtomatik açılacaq.</p>
        <label>Təsdiq kodu<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required/></label>
      </>:<>
        {mode!=="password"&&<label>Email<input name="email" type="email" autoComplete="email" required/></label>}
        {mode!=="reset"&&<label>Şifrə<input name="password" type="password" minLength={mode==="register"||mode==="password"?10:undefined} autoComplete={mode==="register"||mode==="password"?"new-password":"current-password"} required/></label>}
      </>}
      <button className="primary" disabled={busy}>{busy?"Gözləyin…":mode==="login"?"Daxil ol":"Davam et"}</button>
    </form>}
    {!signed&&(mode==="login"||mode==="register")&&<button type="button" className="oauth-button" disabled={busy} onClick={signInWithGoogle}><span className="google-mark" aria-hidden="true">G</span><span>Google ilə davam et</span></button>}
    {message&&<p role="status" className="notice">{message}</p>}
    {!signed&&mode!=="loading"&&<div className="auth-links"><button disabled={busy} onClick={()=>{setMessage("");setMode(mode==="register"?"login":"register");}}>{mode==="register"?"Girişə qayıt":"Qeydiyyat"}</button><button disabled={busy} onClick={()=>{setMessage("");setMode("reset");}}>Şifrəni unutdum</button></div>}
    {signed&&<div className="stack">
      {(mode==="account"||mode==="pending")&&<button disabled={busy} onClick={()=>{setMessage("");setMode("password");}}>Şifrəni yenilə</button>}
      {mode==="password"&&<button disabled={busy} onClick={()=>{setMessage("");void resolve();}}>Hesaba qayıt</button>}
      <button disabled={busy} onClick={async()=>{await db.auth.signOut({scope:"local"});setSigned(false);setMode("login");setQr("");setMessage("");}}>Çıxış</button>
    </div>}
  </div></main>;
}
