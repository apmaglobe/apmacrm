# Qurulma təhvili və real resurs konfiqurasiyası

Versiya: 1.0 · 08.09.2026 · Biznes qərarları tamamdır; aşağıdakılar real mühitdən alınacaq faktlardır.

## Tapşırığın başlanğıcı

Repo və AGENTS.md, README, docs/01–07 oxunur. Lokal inkişaf mühiti və alətlər yoxlanır. Mövcud Supabase/Vercel bağlantıları varsa read-only inventory ilə düzgün tenant/project aşkar edilir; fərziyyə ilə başqa layihəyə yazılmır. İstifadəçi qurulma tapşırığı verməyincə bu sənədin özü resurs yaratma əmri deyil.

| Məlumat | İndi məlum olan | Qurulmada hərəkət |
| --- | --- | --- |
| Repo və Git | Bu qovluq; faktiki Git statusu yoxlanacaq | Mövcud işi qoru; lazım olsa codex/ branch, migration/lockfile |
| Supabase | Backend seçilib, konkret project ref paketdə yoxdur | Bağlı alətlə project/org/region/planı təsdiqlə, resource-map-ə yalnız qeyri-secret metadata yaz |
| Vercel | Hosting/server platforması seçilib | Project/org, env scope və uyğun runtime/regionu yoxla |
| Domen | Mövcuddur, adı/provayderi paketdə yoxdur | crm.<domen>; mövcud sayt/email/DNS qeydlərini oxu, dəqiq Vercel target-i istifadə et |
| Logo | İstifadəçi qurulmada əlavə edəcək | Olmasa dəyişdirilən mətn nişanı ilə davam et |
| Excel | Təxminən 2 500 müəssisə; text və koordinat qarışıq | Real sütun/filial/source ID nümunəsini oxu; real məlumatı repoya çıxarma |
| SMTP | Mövcud hostinq namizəddir, parametrlər məlum deyil | Təhlükəsiz env ilə konfiqurasiya et, test email/reset/invite yoxla |
| Xəritə | Leaflet + Geoapify seçilib | Real browser key/origin/quota/attribution; key yoxdursa lokal mock/konfiqurasiya statusunu dürüst göstər |
| Komanda | 15 üzv; konkret email/adlar yoxdur | İlk admin və pilot üzvlərini real təyinatla yarat; anonim seed başqa şeydir |
| Tools | Resurs növləri məlumdur, faktiki vahid/tutum məlum deyil | Admin paneldə real siyahı; seed avadanlığı faktiki inventar sayma |
| Backup | Gündəlik DB + ayrı Storage surəti hədəfi | İcra yeri, məsul admin, encryption/restore əmrini runbook-a yaz; hostinq imkanlarını ölç |

Bu faktları uydurmaq olmaz. Məlumat bağlı alətlə əldə edilə bilmirsə yalnız zəruri fakt soruşulur və müstəqil lokal iş davam edir. Bu, bitmiş biznes suallarını yenidən açmaq deyil.

## Env sərhədləri

Aşağıdakılar tətbiqin seçilmiş adlandırma sxemidir; provider-in verdiyi hər şey eyni adla gələcək iddiası deyil. .env.example yalnız placeholder izahı saxlayır.

| Env adı | Yerləşmə / qayda |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | İctimai layihə URL-i, faktiki project-dən |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Client publishable key; RLS təhlükəsizliyi əvəz etmir |
| SUPABASE_SECRET_KEY | Yalnız server/worker tələb edirsə, brauzerə çıxmır; mövcud key modelinə uyğunlaşdır |
| DATABASE_URL | Yalnız migration/direct DB ehtiyacı; pooler/direct fərqi alətə görə seçilir |
| NEXT_PUBLIC_APP_URL | Lokal/preview/production origin ayrı |
| NEXT_PUBLIC_GEOAPIFY_KEY | Xəritə client key-si, origin/quota ilə məhdud |
| CRM_CRON_SECRET | Yalnız qorunan worker trigger tələb edirsə; scheduler/secret store |
| Webhook signing secret-ləri | Tenant endpoint üzrə qorunan server secret store; public URL/body-də deyil |
| SMTP secret-ləri | Supabase Auth/uyğun secret store, repoda deyil |

Preview production key-ləri və real production database ilə default bağlanmır. Service secret ilə test edən UI tenant/RLS-in işlədiyini sübut etmir. Bütün mühitlərin URL, ref, region və statusu docs/resource-map.md-də qeyri-secret şəkildə yazılır.

## İlkin lokal nəticə

README-də package manager və faktiki install/dev/build/lint/typecheck/test əmrləri. SQL migrations boş bazada təkrarlana bilir; iki tenantlı anonim seed var. Auth düzgün trusted admin bootstrap edir; istifadəçi metadata-sı admini təyin etmir. Core flows source-of-truth DB-yə bağlanır, yalnız fake localStorage demo deyil.

## Deploy və canlı istifadəyə hazırlıq

Vercel/Supabase əlçatanlığı və verilmiş qurulma səlahiyyəti daxilində preview hazırla. Production migration/DNS/pull request əməliyyatı üçün mövcud səlahiyyəti yoxla; eyni verilmiş icazəni təkrar istəmə. Bu planlaşdırma paketinin tərtibi öz-özünə satınalma/production deploy deyil.

Deployment uğuru faktiki URL/status/logla təsdiqlənir. DNS yalnız real hədəf və yoxlanmış mövcud qeydlərlə. SMTP redirect-ləri, Geoapify attribution/key, işlər üçün Cron/worker, private Storage, error monitoring və spend xəbərdarlığı qurulur. Performans və backup hədəfləri ölçülür; provider limitinə zidd gizli əlavə xərc yaradılmır.

## Backup və bərpa runbook-u

RPO 24 saat/RTO 8 iş saatı hədəfidir. Supabase gündəlik baza backup-u; Storage obyektlərinin ayrıca snapshot/surəti və manifesti. Backup secret-lərini tətbiqin adi client-i oxuya bilməz. Fayl saxlanma yeri və mümkün əlavə xərci resource-map-də göstər.

İzolyasiya olunmuş bərpa sınağı: DB → Storage obyektləri → env/rol secret ayarları → auth/RLS → source/payment reconciliation → read-only axınlar → worker/ingress-in kontrollu yenidən aktivləşməsi. Restore zamanı job retry/event replay iki dəfə alacaq yaratmamalıdır. Müddət, bərpa olunan snapshot vaxtı və real itki pəncərəsi qeyd edilir.

## Qurulma sonunda yaradılacaq sübutlar

| Fayl / nəticə | İçərik |
| --- | --- |
| docs/resource-map.md | Real qeyri-secret project/org/region/env/deploy metadata |
| docs/runbook.md | Worker, deploy/rollback, SMTP, backup/restore və nasazlıq həlli |
| docs/implementation-status.md | M1–M6, AC coverage və faktiki tamamlanma/konfiqurasiya vəziyyəti |
| docs/test-results.md | İşlədilmiş əmrlər, tarix, nəticə; uydurulmuş test yoxdur |
| .env.example | Secret olmayan dəyişən sxemi |
| README.md | Faktiki yerli işə salma və texniki əmrlər |
| Faktiki deployment | Yalnız həqiqətən yaradılıb yoxlanmış URL |

Son nəticə istifadəçiyə işləyən axın, yoxlama və qalan real məhdudiyyətlərlə verilir. Account key yoxdursa modulun əlçatan lokal hissəsi və bağlı canlı bağlantı ayrı göstərilir; bu halda bütün v1 tam production hazır sayılmır.
