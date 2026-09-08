# Faktiki resurs xəritəsi

08.09.2026. Secretlər bu sənəddə saxlanmır. Cari buraxılış vəziyyəti implementation-status.md-dədir.

| Resurs | Faktiki hədəf |
|---|---|
| Supabase təşkilatı | apmaglobe — `mxpdnlyaiddizgeuwbwx` |
| Production baza | apma-crm — `clysniomfmmxwiozfizt`, Frankfurt, Free |
| Preview baza | apma-crm-preview — `obtlqejryfvcqfsjxeda`, Frankfurt, Free |
| Vercel komanda | APMAGLOBE / apmaglobe — `team_Jce1EdJI8YIHwHAFgUxunCqq` |
| Vercel layihə | apma-crm — `prj_vphfySBR5nYCPMfL2xf08Y20dbPW` |
| Son yoxlanmış preview | https://apma-10cmh78v9-apmaglobe.vercel.app — preview-7 READY; 24 migration, Vercel protection |
| Planlaşdırılmış əsas alias | `apma-crm.vercel.app`; **hələ aktiv production təhvili deyil** |
| Vercel runtime | Node 24.x; Next.js 16.3.4; server regionu fra1 |
| Lokal | Colima apma-crm; API 54321, DB 54322, Mailpit 54324, Next 3000 |
| Lokal restore | apmacrm_restore; API 55321, DB 55322; cron bağlı |

Preview və production NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY və SUPABASE_SECRET_KEY dəyişənləri ayrı bazalara bağlıdır. Server secret Vercel-də sensitive-dir. `.env.local` lokal bazanı saxlayır; onu production ilə əvəz etməyin.

İlk admin üçün `apmaglobe@gmail.com` bootstrap allowlist-dədir. Auth hesabının yaradılması və TOTP istifadəçi tərəfindən təhlükəsiz tamamlanmalıdır. Adi Auth metadata-sı admin hüququ vermir.

## Təxirə salınanlar

İstifadəçi xəritə/Geoapify və sonra email/SMTP/DNS işini təxirə salıb. Resend-də mövcud `auth.apma.store` domeninin Failed vəziyyəti aşkarlanıb; 3 tələb olunan DNS qeydi docs/email-dns.md-dədir. Cloudflare sessiyası bərpa olunsa da qeydlər yazılmayıb. CRM domeni Vercel olaraq qalır. Real Excel və logo hələ təqdim edilməyib.

## Xərc

Hazırda yeni Supabase layihələri Free-dir, Vercel komandası Hobby-dir. Ödənişli plan aktivləşdirilməyib. Vercel Hobby şəxsi/kommersiya olmayan istifadə üçündür; CRM-in kommersiya istifadəsi üçün Pro hesab addımı qalır.

08.09.2026-da baxılmış rəsmi qiymətlər: Vercel Pro 20 USD/ay platform fee, bir deploy developer yeri daxil; əlavə istifadə/vergi; Supabase Pro 25 USD/ay və compute. Pro-dakı ikinci aktiv Micro layihə əlavə compute yarada bilər; hesab üzrə aktiv layihələr və developer yerləri satınalmadan əvvəl yenidən yoxlanmalıdır. 100 AZN zəmanətli limit deyil. CRM-in 15 əməkdaşı 15 Vercel developer yeri demək deyil.

Mənbələr: [Hobby qaydası](https://vercel.com/docs/plans/hobby), [Vercel Pro](https://vercel.com/docs/plans/pro-plan), [Supabase qiyməti](https://supabase.com/pricing), [compute](https://supabase.com/docs/guides/platform/compute-and-disk).

Supabase Free-də leaked-password protection yoxdur; preview advisor bunu WARN göstərir. Funksiya [Pro tələb edir](https://supabase.com/docs/guides/auth/password-security). Bu funksiya üçün ayrıca ödənişli plan alınmayıb.

Gündəlik şifrəli DB/Storage/Vault backup-u bu Mac-də ayrıca Application Support kataloqunda LaunchAgent ilə qurulub; əlavə cloud ödənişi yaradılmayıb. Mac/Docker/hesab girişi tələb olunur. Restore və açar saxlama təlimatı runbook-dadır.
