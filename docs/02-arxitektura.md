# Arxitektura, performans və büdcə

Versiya: 1.0 · 08.09.2026 · Qurulma üçün seçilmiş texniki başlanğıc; ölçülmüş tətbiq nəticəsi deyil.

## Quruluş

Next.js App Router + React + TypeScript, Vercel tətbiq/server yerləşdirməsi, Supabase Postgres/Auth/Realtime/Storage. Bir modul monolit və bir əsas Postgres schema; hər biznes qeydində organization_id. Dinamik rol/üzvlük bazada saxlanır. Əlavə Redis, mikroservis və ikinci maliyyə bazası ilkin tələb deyil.

UI üçün Tailwind/shadcn əsaslı yüngül komponentlər, form/server validasiyası üçün ortaq typed schema, server state üçün bir query-cache kitabxanası seçilir. Paketlərin konkret stabil versiyaları qurulma günü rəsmi sənədlə yoxlanıb lockfile-a yazılır; köhnə paket adları yaddaşdan quraşdırılmır. Excel parser və digər böyük paketlər yalnız lazım olan route/worker-də yüklənir.

Server komponentləri ilkin icazəli snapshot-u verir; interaktiv board/form client komponentlərindədir. Server mutations bazada əməliyyat/RPC qatına gedir; HTTP-dən bir neçə ayrı yazmanı “tranzaksiya” saymaq olmaz. Adi əməliyyatlar user session ilə RLS altında işləyir. Xüsusi worker/ingress servis hüququ dar server sərhədindədir.

## Region və bağlantı

Supabase Frankfurt və Vercel-də ona yaxın server regionu ilkin seçimdir. Faktiki layihə regionları, əlçatanlıq və istifadəçinin Bakı şəbəkəsində gecikmə ölçülür. Baza/server coğrafi yaxın saxlanır; bütün server əməliyyatlarını baza uzaqda qalmaqla təsadüfi edge regionlara yayma.

Supabase client/Data API və transaction RPC istifadə et. Birbaşa Postgres bağlantısı həqiqətən lazımdırsa serverless uyğun pooler, TLS və limitlər qurulma günü yoxlanır. Sonsuz connection pool yaratma. Node.js-in Next.js/Vercel tərəfindən dəstəklənən stabil runtime-ı və package manager versiyası layihədə sabitlənir.

## Büdcə

07.09.2026 tarixində rəsmi qiymətlər üzrə:
- Supabase Pro: 25 USD-dən; bir Micro instansiyanı əhatə edən compute krediti. [Supabase pricing](https://supabase.com/pricing).
- Vercel Pro: 20 USD/ay ilkin plan; əlavə developer yerləri və istifadə ayrıdır. CRM-in 15 əməkdaşı 15 Vercel developer yeri deyil. [Vercel pricing](https://vercel.com/pricing).
- Baza hesabı 45 USD × 1,70 = 76,50 AZN. [AMB məzənnəsi](https://www.cbar.az/currency/rates).

100 AZN büdcəsində qalan təxminən 23,50 AZN əlavə istifadə, bank/vergi və xidmətlər üçün ehtiyatdır; bu xərclərin sıfır olduğu iddia edilmir. Mövcud SMTP və Geoapify Free kvotası ilkin seçimdir. Ödənişli geocoding, PITR, ikinci daimi production bazası, əlavə SaaS xidmətləri avtomatik alınmır. Platformaların xərc xəbərdarlığı/spend controls-u yoxlanır; bunlar universal sərt 100 AZN zəmanəti deyil.

Development lokal Supabase və anonim seed ilə; preview ayrıca test bazasına bağlanır. Preview-yə production service secret və real müştəri bazası bağlanmır. Əlavə bulud staging layihəsinin xərci hesab üzrə göstərilməlidir; lokal yoxlamalar onun yoxluğuna görə saxlanmır. Hazırda heç bir ödənişli resurs satın alınmayıb.

## Sürət hədəfləri

| Ölçü | Hədəf |
| --- | --- |
| Klik/sürükləmə vizual reaksiyası | P95 ≤100 ms |
| Adi qutu/iş saxlanmasının server təsdiqi | P95 ≤800 ms |
| Commit-dən başqa icazəli aktiv sessiyada görünməyə | P95 ≤1 saniyə |
| Tipik mobil qarşılıqlı əlaqə | INP ≤200 ms |
| Əsas səhifə yüklənməsi | LCP ≤2,5 saniyə |

P95 əməliyyatların 95%-nin həddi keçməməsidir. Bunlar test hədəfləridir, zəmanət/nəticə deyil. Test cihazı, Bakı şəbəkəsi, concurrency, soyuq/isti start və dataset yazılır. İnternet kəsilməsi, uzun import və üçüncü tərəf gecikməsi ayrıca ölçülür.

Optimistic UI lokal kartı dərhal hərəkət etdirir, “saxlanır” göstərir. Server hüquq/biznes qaydası/version yoxlayır; audit və outbox ilə atomik commit edir. Xətada rollback, konfliktdə canonical versiya göstərilir. Maliyyə yazmaları təsdiqsiz “ödənildi” kimi təqdim edilmir.

Private Realtime minimal ID/version/invalidation siqnalı verir; client icazəli snapshot-u yeniləyir. Sensitive qiymət/ödəniş payload-u geniş department channel-a çıxmır. İcazə ləğvi, logout və tenant dəyişməsi keş/abunələri təmizləyir; reconnect və focus zamanı revalidation var. Broadcast seçimi qurulma zamanı Supabase təlimatı ilə uyğunlaşdırılır. [Realtime](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes).

## Sorğu və UI

Tenant/departament/mərhələ/assignee filtrləri serverdə; Kanbanda sütun üzrə cursor, ilkin 30 kart. Sıralama üçün stabil rank + ID, paralel reorder üçün version/RPC. Qutu sayları və listlər çox-departament JOIN səbəbindən çoxalmır. Xəritədə cluster və bbox sorğusu; render üçün 2 500 ağır popup yüklənmir.

Qutu kartı minimal cavab alır; audit/rəylər/materiallar panel açılanda səhifələnir. Xəritə, təqvim, Excel və qrafik paketləri lazy-load olunur. N+1 sorğular aradan qaldırılır. İndekslər real query planı ilə seçilir; EXPLAIN nəticəsi üçün staging/local sintetik data istifadə edilir. Authenticated data public CDN cache-də saxlanmır; keş açarına tenant/member/permission version/filtr daxildir.

## Fon işləri

Supabase-də davamlı job/outbox cədvəlləri, Supabase Cron və müddətli worker ilkin seçimdir. Cron müddət çatmış dövrləri/bildirişləri/işləri tapır; qısa DB əməliyyatını RPC, partiyalı işi uyğun server worker/Edge Function icra edir. Mövcud runtime hədləri qurulmada yoxlanır; CPU ağır Excel parse uzun açıq brauzer sorğusuna bağlanmır.

Hər işdə tenant, type, dedupe key, attempts, lease/locked_until, run_after, result/error var. Worker dayansa lease bitəndə retry olunur; sonsuz retry əvəzinə adminə görünən failed vəziyyətə keçir. generation/retry eyni contract_period və template snapshot istifadə edir. Bir HTTP cavabından sonra RAM-da qalan promise kritik işin yeganə təminatı deyil. Ayrıca növbə xidməti xərcini ilkin arxitekturaya əlavə etmə.

## Kod quruluşu

```text
src/app/                   route və layout
src/modules/               crm, customers, tasks, finance, subscriptions,
                           inbox, tools, meetings, portfolio, resources, users, overview
src/lib/auth/              Supabase SSR, session və tenant context
src/lib/permissions/       server yoxlamaları və permission codes
src/lib/db/                typed RPC/client
src/lib/jobs/              job/outbox adapterləri
src/components/            ortaq UI
supabase/migrations/       bütün schema/RLS/function/index dəyişiklikləri
supabase/tests/            tenant/RLS/tranzaksiya testləri
tests/                     mənalı modul və istifadə axını testləri
docs/                      faktiki qurulma və runbook
```

Tenant ayrı məhsul moduludur, rol görünən adlarla yoxlanmır. Price/payment, work status və recurring display stage ayrı domen əməliyyatlarıdır. Təkrarlanan invariantlar bir bazada qorunur; frontend və backend-də fərqli biznes qaydaları saxlanmır.

## Domain və istismar

CRM üçün crm.<mövcud-domen> subdomeni. Dəqiq domen/DNS hədəfi real hesabdan alınır. Əsas sayt və poçt qeydləri yoxlanır; Vercel-in faktiki verdiyi dəyər istifadə olunur. Supabase custom domain add-on-u tələb deyil.

RPO 24 saat, RTO 8 iş saatı ilkin hədəfdir. Gündəlik baza backup-u və ayrıca Storage obyekt surəti; restore sınağı canlı istifadədən əvvəl. Baza backup-u Storage obyektlərini bərpa etmir. [Supabase backup](https://supabase.com/docs/guides/platform/backups). Secretlər təhlükəsiz env/secret store-da; .env.example yalnız ad/placeholder saxlayır.
