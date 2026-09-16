"use client";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { BrandLogo } from "@/components/brand-logo";
import { browserClient } from "@/lib/auth/browser";
type LoginContext = {has_active_membership:boolean;bootstrap_pending:boolean};
type Mode = "loading" | "login" | "register" | "reset" | "password" | "mfa" | "passwordMfa" | "setup" | "activate" | "account" | "pending";
export function Login() {
  const db = browserClient();
  const [mode, setMode] = useState<Mode>("loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [signed, setSigned] = useState(false);
  const [email, setEmail] = useState("");
  const [passwordChange, setPasswordChange] = useState(false);
  const resolve = useCallback(async (enter = false) => {
    const {data:{user}} = await db.auth.getUser();
    if (!user) {setSigned(false);setMode("login");return;}
    setSigned(true);setEmail(user.email??"");
    if(new URLSearchParams(window.location.search).get("recovery")==="1"){
      const factors=await db.auth.mfa.listFactors();
      if(factors.error)throw Error("PASSWORD_MFA_LOAD_FAILED");
      const verified=factors.data.totp.find(f=>f.status==="verified");
      setPasswordChange(true);
      setQr("");
      if(verified){setFactor(verified.id);setMode("passwordMfa");}
      else {setMode("setup");setMessage("Şifrəni yeniləmək üçün əvvəl Authenticator tətbiqini qoşun.");}
      return;
    }
    const {data,error}=await db.rpc("login_context");
    if(error)throw Error("LOGIN_CONTEXT_FAILED");
    const context=data as LoginContext;
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
    const params=new URLSearchParams(window.location.search);
    if(params.get("error")==="oauth"){
      setMessage("Google girişi tamamlanmadı. Google hesabının test istifadəçisi kimi əlavə edildiyini yoxlayın və yenidən sınayın.");
    }
    if(params.get("password")==="updated"){
      setMessage("Şifrə yeniləndi. Email və yeni şifrənizlə yenidən daxil olun.");
    }
    let timer:ReturnType<typeof setTimeout>;
    const {data}=db.auth.onAuthStateChange((event)=>{
      // Supabase emits this callback while holding its auth lock; resolve outside that lock.
      if(event==="INITIAL_SESSION")timer=setTimeout(()=>{void resolve().catch(()=>{setMode("login");setMessage("Hesabın vəziyyəti yüklənmədi. Yenidən daxil olun.");});},0);
      if(event==="PASSWORD_RECOVERY")void resolve().catch(()=>{setMode("login");setMessage("Şifrə bərpa sessiyası yoxlanmadı. Yeni keçid istəyin.");});
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
        if(!passwordChange)throw Error("PASSWORD_MFA_REQUIRED");
        const {error}=await db.auth.updateUser({password});if(error)throw error;
        await db.auth.signOut({scope:"local"});
        window.location.assign("/login?password=updated");return;
      }else if(mode==="mfa"||mode==="passwordMfa"){
        const {error}=await db.auth.mfa.challengeAndVerify({factorId:factor,code:String(form.get("code"))});
        if(error){setMessage("Təsdiq kodu qəbul edilmədi. Authenticator tətbiqindəki cari 6 rəqəmli kodu yazın.");return;}
        setQr("");
        if(mode==="passwordMfa"){setMode("password");return;}
        await resolve(true);
      }else{
        const {error}=await db.auth.signInWithPassword({email:inputEmail,password});if(error)throw error;
        await resolve(true);
      }
    }catch(error){
      const reason=error instanceof Error?error.message:"";
      if(/session missing|invalid.*token|expired/i.test(reason))setMessage("Bərpa keçidi etibarsızdır və ya müddəti bitib. Yeni keçid istəyin.");
      else if(/same|different from.*old/i.test(reason))setMessage("Yeni şifrə əvvəlki şifrədən fərqli olmalıdır.");
      else if(/password.*(least|short|length)|weak password/i.test(reason))setMessage("Yeni şifrə ən azı 6 simvol olmalıdır.");
      else if(reason==="PASSWORD_MFA_REQUIRED")setMessage("Şifrəni yeniləmək üçün əvvəl Authenticator kodunu təsdiqləyin.");
      else setMessage(reason?`Şifrə yenilənmədi: ${reason}`:"Şifrə yenilənmədi. Yeni bərpa keçidi istəyib bir dəfə açın.");
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
  async function linkGoogleIdentity(){
    setBusy(true);setMessage("");
    try{
      const {data,error}=await db.auth.linkIdentity({
        provider:"google",
        options:{redirectTo:`${window.location.origin}/auth/callback`,skipBrowserRedirect:true},
      });
      if(error||!data?.url)throw error??Error("GOOGLE_IDENTITY_URL_MISSING");
      window.location.assign(data.url);
    }catch{
      setMessage("Google hesabı bağlanmadı. Yenidən sınayın.");
      setBusy(false);
    }
  }
  async function enroll(){
    setBusy(true);setMessage("");
    try{
      const existing=await db.auth.mfa.listFactors();if(existing.error)throw existing.error;
      const verified=existing.data.totp.find(f=>f.status==="verified");
      if(verified){setFactor(verified.id);setQr("");setMode(passwordChange?"passwordMfa":"mfa");return;}
      // Only replace this account's unfinished enrollment; verified factors are preserved.
      for(const unfinished of existing.data.all.filter(f=>f.factor_type==="totp"&&f.status==="unverified")){
        const {error}=await db.auth.mfa.unenroll({factorId:unfinished.id});if(error)throw error;
      }
      const {data,error}=await db.auth.mfa.enroll({factorType:"totp",friendlyName:"APMA CRM"});
      if(error)throw error;setFactor(data.id);setQr(data.totp.qr_code);setMode(passwordChange?"passwordMfa":"mfa");
    }catch{setMessage("Authenticator hazırlana bilmədi. Yenidən sınayın.");}finally{setBusy(false);}
  }
  async function startPasswordChange(){
    setBusy(true);setMessage("");
    try{
      const factors=await db.auth.mfa.listFactors();
      if(factors.error)throw factors.error;
      const verified=factors.data.totp.find(f=>f.status==="verified");
      setPasswordChange(true);setQr("");
      if(verified){setFactor(verified.id);setMode("passwordMfa");}
      else {setMode("setup");setMessage("Şifrəni yeniləmək üçün əvvəl Authenticator tətbiqini qoşun.");}
    }catch{setMessage("Authenticator vəziyyəti yüklənmədi. Yenidən sınayın.");}
    finally{setBusy(false);}
  }
  const titles:Record<Mode,string>={loading:"Hesab yoxlanır…",login:"Xoş gəlmisiniz",register:"Hesab yaradın",reset:"Şifrəni bərpa edin",password:"Yeni şifrə",mfa:"İki mərhələli təsdiq",passwordMfa:"Şifrəni dəyişməni təsdiqləyin",setup:"Authenticator qoşun",activate:"Admin hesabınız hazırdır",account:"Girişiniz təsdiqlənib",pending:"Üzvlük təsdiqi gözlənilir"};
  const showForm=["login","register","reset","password","mfa","passwordMfa"].includes(mode);
  return <main className="auth"><div className="auth-card">
    <div className="brand"><BrandLogo /></div>
    <p className="eyebrow">AGENTLİYİN İŞ SAHƏSİ</p><h1>{titles[mode]}</h1>
    {signed&&<p className="helper">{email}</p>}
    {mode==="loading"&&<p role="status">Giriş vəziyyəti yoxlanır…</p>}
    {mode==="setup"&&<div className="stack"><p>Şifrə yeniləməsindən əvvəl telefonunuzdakı Authenticator tətbiqini qoşun. Bu tələb adi girişlərə tətbiq edilmir.</p><button className="primary" disabled={busy} onClick={enroll}>{busy?"Hazırlanır…":"Authenticator qur"}</button></div>}
    {mode==="activate"&&<div className="stack"><p>Təhlükəsizlik təsdiqi tamamlanıb. Agentliyin ilk admin hesabını aktivləşdirin.</p><button className="primary" disabled={busy} onClick={resume}>{busy?"Aktivləşdirilir…":"İlk admini aktivləşdir"}</button></div>}
    {mode==="account"&&<button className="primary" disabled={busy} onClick={resume}>CRM-ə daxil ol</button>}
    {mode==="pending"&&<div className="stack"><p>Hesabınıza giriş edilib. Agentliyin qoşulma və ya dəvət linkindən müraciət edin. Müraciət etmisinizsə, admin üzvlüyünüzü təsdiqlədikdən sonra iş sahəsi açılacaq.</p><button disabled={busy} onClick={resume}>Vəziyyəti yenilə</button></div>}
    {showForm&&<form key={mode} onSubmit={submit}>
      {(mode==="mfa"||mode==="passwordMfa")?<>
        {qr&&<><p>Authenticator tətbiqində bu QR kodunu skan edin.</p><Image unoptimized className="qr" src={qr} width={240} height={240} alt="Authenticator QR kodu"/></>}
        <p className="helper">Telefonunuzdakı Authenticator tətbiqindən cari 6 rəqəmli kodu daxil edin.{mode==="passwordMfa"?" Kod təsdiqləndikdən sonra yeni şifrəni seçəcəksiniz.":" Təsdiqdən sonra CRM avtomatik açılacaq."}</p>
        <label>Təsdiq kodu<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required/></label>
      </>:<>
        {mode!=="password"&&<label>Email<input name="email" type="email" autoComplete="email" required/></label>}
        {mode!=="reset"&&<label>Şifrə<input name="password" type="password" minLength={mode==="register"?10:mode==="password"?6:undefined} autoComplete={mode==="register"||mode==="password"?"new-password":"current-password"} required/></label>}
      </>}
      <button className="primary" disabled={busy}>{busy?"Gözləyin…":mode==="login"?"Daxil ol":"Davam et"}</button>
    </form>}
    {!signed&&(mode==="login"||mode==="register")&&<button type="button" className="oauth-button" disabled={busy} onClick={signInWithGoogle}><span className="google-mark" aria-hidden="true">G</span><span>Google ilə davam et</span></button>}
    {message&&<p role="status" className="notice">{message}</p>}
    {!signed&&mode!=="loading"&&<div className="auth-links"><button disabled={busy} onClick={()=>{setMessage("");setMode(mode==="register"?"login":"register");}}>{mode==="register"?"Girişə qayıt":"Qeydiyyat"}</button><button disabled={busy} onClick={()=>{setMessage("");setMode("reset");}}>Şifrəni unutdum</button></div>}
    {signed&&<div className="stack">
      {mode==="account"&&<button disabled={busy} onClick={linkGoogleIdentity}>{busy?"Gözləyin…":"Google hesabını bağla"}</button>}
      {(mode==="account"||mode==="pending")&&<button disabled={busy} onClick={()=>void startPasswordChange()}>Şifrəni yenilə</button>}
      {mode==="password"&&<button disabled={busy} onClick={()=>{setMessage("");void resolve();}}>Hesaba qayıt</button>}
      <button disabled={busy} onClick={async()=>{await db.auth.signOut({scope:"local"});setSigned(false);setMode("login");setQr("");setMessage("");}}>Çıxış</button>
    </div>}
  </div></main>;
}
