# Qəbul meyarları — sübut matrisi

08.09.2026. Bu matris AC-01–76-nın hər bəndinə mövcud sübutu və sınağın sərhədini bağlayır; bütün alt-ssenarilərə universal «keçdi» statusu vermir. Faktiki suite nəticələri [test-results](test-results.md)-dədir. DB: `scripts/test-db.ts`; browser: `tests/e2e`; unit: `tests/unit`; performans/restore: `scripts`. İstifadəçinin yeni göstərişi ilə xəritə və email sonraya saxlanıb.

| AC | İcra edilmiş sübut / tətbiq olunan sərhəd | Məhdudiyyət |
|---|---|---|
| AC-01 | DB tenant, export owner/foreign deny; browser iki tenant/12 route | Cross-tenant Realtime üçün ayrıca paket payload yoxlaması yoxdur. |
| AC-02 | DB dəvət: uyğun təsdiqlənmiş email, retry, pending məlumatı bağlı | Email çatdırılması təxirə salınıb. |
| AC-03 | Browser login/MFA; Auth origin konfiqurasiyası | SMTP təsdiq/reset çatdırılması istifadəçi tərəfindən təxirə salınıb. |
| AC-04 | DB eskalasiya/profile payload/suspended; browser chat access ləğvi | Bütün membership channel dəyişmə variasiyaları ayrıca browser testi deyil. |
| AC-05 | DB commercial/finance sərhədi və export ləğvi; overview məbləğ RLS | Bütün rol kombinasiyalarının browser matrisinə iddia yoxdur. |
| AC-06 | DB cursor/filter/object read; browser board/list və 12 route | Hər mümkün filtr kombinasiyası ayrıca test deyil. |
| AC-07 | DB request retry; browser create | Paralel seriya üçün ayrıca stress assertion yoxdur. |
| AC-08 | DB natamam direct delivery, NULL təsdiq; browser confirm | Əsas invariant yoxlanıb. |
| AC-09 | DB mention giriş vermir, miqdar; bildiriş source dedupe | Hər bildiriş növünün browser delivery testi yoxdur. |
| AC-10 | DB eyni version paralel dəyişmə: bir uğur | Konflikt yoxlanıb. |
| AC-11 | DB mine/shared/team sərhədi; browser To Do | Departament-only qutu shared To Do-ya daxil deyil. |
| AC-12 | Browser eyni iş statusu; unit Bakı tarix sərhədi | Təqvimin bütün drag variasiyaları yoxdur. |
| AC-13 | İki browser sessiyası; 20 Realtime ölçməsi; offline/reconnect | Köhnə event ayrıca şəbəkə replay testi yoxdur. |
| AC-14 | DB 2500 import/retry/rollback/worker; browser CSV private upload/mapping/import; unit XLSX limit | İstifadəçinin real Excel faylı yoxdur. |
| AC-15 | DB telefon +/0 və AZ ad; unit parser/decimal/formula | Real fayl mapping yoxlanmayıb. |
| AC-16 | Koordinat/pin kodu və parser yoxlamaları | Map/Geoapify istifadəçi tərəfindən təxirə salınıb. |
| AC-17 | DB iki filial və tenant izolyasiyası | Sintetik məlumat. |
| AC-18 | DB artifact/current field hüququ; browser 2500+ CSV; unit formula | Hər modulun bütün export filtr variasiyası ayrıca test deyil. |
| AC-19 | DB Vault/owner retry; browser HMAC HTTP401/202/cron | Əsas durable ingress yoxlanıb. |
| AC-20 | CRM/Drive eyni resource_links, server source RLS; route smoke | Google fayl paylaşımı/API bağlantısı qurulmayıb; yalnız link. |
| AC-21 | DB confirm/deliver mənbə unikallığı, açıq iş qalır | Portfelin bütün keçid variasiyaları ayrıca browser testi deyil. |
| AC-22 | DB paralel fiziki capacity; browser rezervasiya/götür/qaytar | Əsas atomiklik yoxlanıb. |
| AC-23 | Browser mobil görüş/iştirakçılar/calendar/ICS | Online/offline bütün edit variasiyaları ayrıca test deyil. |
| AC-24 | DB1000−300=700, reconciliation/allocation/refund | Bütün xərc kateqoriyaları ayrıca browser testi deyil. |
| AC-25 | DB payment retry və paralel allocation | Əsas atomiklik yoxlanıb. |
| AC-26 | DB period source unikallığı və retry; browser generation | Yarımçıq worker recovery və failed repair yoxlanıb. |
| AC-27 | DB tarix/cohort/cash/RLS; browser tarix overview | Cari iş yükü tarixli lead kohortundan ayrı göstərilir. |
| AC-28 | Browser360/390px və1440/1920px | Planşet və bütün modulların bütün mobil axınları ayrıca yoxlanmayıb. |
| AC-29 | Browser real drag və select status, modal bağla | Tam klaviatura/a11y audit aparılmayıb. |
| AC-30 | 15 Auth istifadəçisi/2500müştəri/10kqutu/40kiş yük sınağı | Lokal; cloud WAN deyil. |
| AC-31 | LCP5, EventTiming36, Realtime20 və HTTP P95 | EventTiming formal field INP deyil; real cihaz/cloud P95 yoxdur. |
| AC-32 | Cloud şifrəli backup, ayrı restore, Vault/Storage, runtime agent | Mac bağlı olanda RPO təmin olunmur; production plan addımı qalır. |
| AC-33 | DB last admin və eskalasiya; Users idarəetmə UI | Bütün dynamic role/inherit/delete variasiyaları ayrıca browser testi deyil. |
| AC-34 | DB unrelated edit deny; browser creator edit | Əsas creator/owner sərhədi. |
| AC-35 | DB owner dəyişməsi və dar payment hüququ daşınmır | Cross-tenant referenslər DB guard ilə qorunur. |
| AC-36 | Browser catalog revision/archive; DB snapshot/tenant guard | Bütün kataloq variasiyaları ayrıca test deyil. |
| AC-37 | DB filtered board/object və To Do sərhədi; Overview department sum | İki departament canlı revocation üçün ayrıca tam browser ssenarisi yoxdur. |
| AC-38 | DB NULL/total/reconciliation və hidden work_prices; unit AZN | Qiymət cəmi işlərdən hesablanır. |
| AC-39 | Browser öz işinin statusu/To Do; DB unrelated edit | Bütün assignee endpoint variasiyaları ayrıca test deyil. |
| AC-40 | DB delivered açıq işi saxlayır | İş statusu müstəqildir. |
| AC-41 | DB child deadline; unit Bakı vaxtı | İki istiqamətli guard kodu var; ayrıca paralel deadline sınağı yoxdur. |
| AC-42 | DB commercials deny/read və paid reduction admin guard | Hər rol/individual yazma kombinasiyası ayrıca test deyil. |
| AC-43 | Lost səbəbli server/UI əmri | Ayrıca Lost/reopen browser testi yoxdur. |
| AC-44 | DB creator payment/owner deny; mobile creator payment replacement | Dar ödəniş hüququ yoxlanıb. |
| AC-45 | DB confirm/deliver bircharge;1000−300=700 | Təhvil real pul yaratmır. |
| AC-46 | Maliyyə document/category/server cəmləri; route smoke | Kateqoriya üzrə200−50 browser testi yoxdur. |
| AC-47 | Browser sales drag; DB recurring payment display | Hər iki qıfın bütün mobile mərhələləri ayrıca yoxlanmayıb. |
| AC-48 | DB recurring period/source; browser snapshot | Eyni CRM işləri To Do mənbəyidir. |
| AC-49 | DB billing anchoring; browser müqavilə yaratma/revision | Faktiki payment tarixi planı dəyişmir. |
| AC-50 | DB generation planlı tarixə bağlanır | 5/12/15 nümunəsinin ayrıca browser testi yoxdur. |
| AC-51 | DB odd-cent unpaid; browser aylıq generation | Məbləğ field RLS ayrıca yoxlanıb. |
| AC-52 | DB system source/owner payment deny | Source insana creator hüququ vermir. |
| AC-53 | DB display current stage və source idempotency | Bütün payment/status concurrency kombinasiyaları ayrıca sınaq deyil. |
| AC-54 | DB current work stage/To Do source; browser own status | Unpaid bütün iş-status kombinasiyaları ayrıca browser testi deyil. |
| AC-55 | DB1000.01 üçün500.00yetmir/500.01yetir | Integer qəpik müqayisəsi. |
| AC-56 | DB həddə çatanda qalıq500; Realtime iki sessiya ümumi axın | Payment-specific iki sessiya concurrency ayrıca ölçülməyib. |
| AC-57 | DB boş səbəb deny, səbəbli done/reopen | Açıq işlər qalır. |
| AC-58 | DB monthly union/future/reopen/redone | İki müqavilə overlap ayrıca tam browser testi deyil. |
| AC-59 | DB generation deadline/boundary; unit vaxt | 12sentyabr/12oktyabr ayrıca UI ssenarisi yoxdur. |
| AC-60 | DB object sərhədi/shared To Do/foreign tenant | Çox-departament canlı ləğv bütün alternativ əsaslar ayrıca browser testi deyil. |
| AC-61 | DB active tenant customer read; durable import/webhook | Map read əlavə finance/export hüququ deyil. |
| AC-62 | DB mine/shared/team; browser eyni iş statusu | Sifarişsiz task API yoxdur. |
| AC-63 | DB retry/failed plan atomic repair; browser snapshot/revision/repair | Hazır dövr dəyişmir; failed plan səbəblə eyni mənbədə bərpa olunur. |
| AC-64 | DB short month/leap anchoring | Tarix hesablaması yoxlanıb. |
| AC-65 | DB pause/resume charge saxlanır; browser stop | Tam ay haqqı saxlanır. |
| AC-66 | DB admin reconciliation/cash dəyişmir | Müsbət adjustment retry ayrıca bütün UI variasiyası deyil. |
| AC-67 | DB paralel allocation limit/refund | Başqa müştəri/currency DB guard; bütün browser variasiyaları yoxdur. |
| AC-68 | DB nonmember admin/removed deny; iki browser chat revocation | 15dəqiqə edit limitinin ayrıca sərhəd browser testi yoxdur. |
| AC-69 | DB physical/digital capacity; browser broken unit/checkout/return | Qaytarılmamış vahid məşğuldur. |
| AC-70 | DB artifact owner/foreign/field/revocation/expiry; browser download | CSV/XLSX bütün modul filtrləri ayrıca test deyil. |
| AC-71 | DB pending/suspended/bootstrapAAL2/retry; browser TOTP | SMTP/email/reset çatdırılması təxirə salınıb. |
| AC-72 | Ayrı cloud→local DB/StorageSHA256/Vault/RLS/worker replay restore | Mac mövcudluğu və koordinator snapshot limitləri runbook-da. |
| AC-73 | 12 route və əsas axınlar; productionbuild/preview | Production istifadəyə verilməyib; xəritə/email deferred, realExcel/logo yoxdur. |
| AC-74 | DB future cap/reopen/redone monthly contribution | Overlap bütün müxtəlif müqavilə variasiyaları ayrıca browser testi deyil. |
| AC-75 | DB rotation/retry; HTTP bad/validHMAC+cron | Rate overflow/timestamp bütün sərhəd HTTP variasiyaları ayrıca test deyil. |
| AC-76 | DB zero/NULL/reason/free recurring və refund cap; unit NULL/0 | Başlanğıc qalıqlar report siyasətində ayrıdır. |
