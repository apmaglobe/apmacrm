import { Login } from "@/modules/users/login";
export default function Page() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL)
    return (
      <main className="auth">
        <div className="auth-card">
          <div className="brand">
            APMA<span>CRM</span>
          </div>
          <h1>Bağlantı hazırlanır</h1>
          <p>Supabase mühit dəyişənləri hələ təyin edilməyib.</p>
        </div>
      </main>
    );
  return <Login />;
}
