# Codex üçün yekun qurulma promptu

Versiya: 1.0 · 08.09.2026 · Bu prompt qurulma tapşırığında istifadə edilir. Təkcə faylın mövcudluğu indiki planlaşdırma söhbətində qurulma əmri deyil.

Bütün repo sənədlərini və ya CRM-v1.0-tam-paket.md faylını yanında ver. M1-də dayanan ilkin şablonu bu prompt əvəz edir.

```text
APMA CRM-in v1.0 versiyasını bu paketə əsasən qurmağa başla və tamamla.

MƏQSƏD
Supabase backend və Vercel üzərində rəqəmsal agentlik CRM-i yarat.
M1–M6 mərhələlərini ardıcıllıqla icra et; istifadəçi ayrıca bir mərhələ ilə
məhdudlaşdırmayıbsa M1, statik demo və ya yalnız UI nəticəsi ilə dayanma.
V1 bütün 12 menyu bölməsinin razılaşdırılmış əsas axınlarını əhatə edir.
M7 gələcək funksiyalardır və bu qurulmanın hissəsi deyil.

ƏVVƏL OXU
AGENTS.md, README.md və docs/01-texniki-tapsiriq.md,
docs/02-arxitektura.md, docs/03-data-ve-icazeler.md,
docs/04-inteqrasiyalar.md, docs/05-merheleler-ve-qebul.md,
docs/06-suallar-ve-qerarlar.md, docs/07-yekun-suallar-ve-cavablar.md,
docs/08-qurulma-tehvil.md.
Tək birləşdirilmiş md təqdim edilibsə eyni adlı bölmələr həmin fayldadır.
Əvvəl mövcud kod/repo/Git/alət konfiqurasiyasını yoxla və istifadəçi işini qoru.
planning-v0.11-original.zip arxivdir; aktiv qayda kimi götürmə.

QƏRARLAR
D01–D56 istifadəçinin birbaşa qərarlarıdır. D57 ilə qalan sualları assistent
seçib yekunlaşdırmaq səlahiyyəti alıb; S01–S33 v1 üçün qüvvədə olan seçimlərdir.
B01–B18/Q01–Q72 müsahibəsini yenidən başlatma.
Yeni istifadəçi göstərişi varsa üstün tut; həqiqi yeni biznes ziddiyyətini aydınlaşdır,
rutin texniki detallar üçün işi saxlayıb təkrar təsdiq istəmə.

MƏHDUDİYYƏTLƏR
15 əməkdaş, təxminən 2 500 müəssisə; əlavə aylıq infrastruktur hədəfi 100 AZN-dək.
Next.js/React/TypeScript modul monolit, Supabase Postgres/Auth/Realtime/Storage, Vercel.
Region baza/server yaxınlığına görə seçilsin, Bakı şəbəkəsində sürət ölçülsün.
Versiya/runtime/plan məlumatını qurulma günü rəsmi mənbələrlə yoxla və lockfile saxla.
Mövcud hostinq/domen/SMTP-dən istifadə imkanını faktiki hesabdan yoxla.
Project ID, DNS target, token və deployment URL uydurma. Secretləri chat/repo/loga çıxarma.
Logo faylı varsa istifadə et, yoxdursa dəyişdirilə bilən APMA CRM mətn nişanı qur.

MƏCBURİ BİZNES VƏ MƏLUMAT QAYDALARI
- Mərkəzdə desktop menyu, tam mobil işlək axınlar, Kanban/list və daxili sütun scroll-u.
- Yeni müştəri qıfı 8 sales mərhələsi; Dövri qıfı 3 work mərhələsi və unpaid görünüşü.
- Bir neçə tenantın schema/RLS/object/field izolyasiyasını başlanğıcdan qur.
- Dinamik rol + fərdi icazə; rol adına/user-editable metadata-ya etibar etmə.
- Çox departament üzvlüyü; ayrı qutu təyinatı bütöv departamenti açmır.
- Creator, overall accountable və iş assignee-si ayrıdır.
  Qutu/overall owner redaktoru admin, creator, cari overall accountable-dır.
  İş assignee-si yalnız öz statusunu dəyişir.
- Manual ilkin owner creator, webhook ilkin owner seçilmiş active admin.
  Recurring system source saxlanır, yaradan hüquqları hələlik adminə məxsusdur.
- Map bazasını bütün agentlik görür; müəssisə yalnız admin Excel importundan yaranır.
  Unknown webhook müştərisi intake-də qalır, saxta Map qeydi yaradılmır.
- To Do eyni CRM iş/task qeydlərindən yaranır. Default öz işləri, ayrıca ortaq sifariş baxışı,
  admin komanda görünüşü; sərbəst sifarişsiz task və ikinci status kopyası yoxdur.
- Total aktiv iş qiymətlərinin cəmidir; manual total/endirim yoxdur. NULL və 0 ayrıdır.
  Təsdiqdə müəssisə, iş/department/active assignee/qiymət/datetime və parent deadline məcburidir.
- Child deadline parent-i keçmir; parent qısaltma/child uzatma paralel də yoxlanır.
- Commercials.write ayrıca hüquqdur; təsdiqdən sonrakı qiymət reason və financial delta ilədir.
  Payment allocation-a təsir edən azalma yalnız admin reconciliation edir.
- Finance.read seçilmiş üzvə bütün tenant Balansını açır, default bağlıdır.
  Creator Balans bağlı olsa da öz qutusunun tək payment-ni daxil/düzəldə bilər;
  overall owner hüququ payment yazma demək deyil.
  Multi-order allocation, avans, refund, sifarişsiz xərc adminə aiddir.
- Birdəfəlik təsdiq bir alacaq, təhvil eyni qalığı göstərir. Aylıq mənbə contract_period-dir.
  Status dəyişməsi faktiki pul və ya ikinci əsas alacaq yaratmır.
- Aylıq şablon hər dövrə yeni işlər/nisbi tarixlərlə avtomatik tətbiq olunur;
  period/template snapshot, unique mənbə və retry qorunur.
- Billing günü müqavilə üzrədir; gün yoxdursa last-day, növbəti ay ilkin günə dönüş.
  First period planlaşdırılmış ödəniş tarixindədir, real cash gecikməsi təqvimi sürüşdürmür.
  İlkin aylıq parent deadline period_end-dən əvvəlki yerli gün 23:59-dur.
- proration_policy=none: başlamış dövrün haqqı stop ilə dəyişmir; sonrakı dövrlər yaranmır.
  Admin səbəblə ayrıca adjustment edə bilər; keçmiş maliyyə tarixçəsi silinmir.
- Ödənişin due günü bitib dövrün 50%-dən azı ödənibsə unpaid görünür; work davam edir.
  Həddə çatanda current work stage-ə qayıdır, qalan borc qalır.
  Sıfır xalis alacaq payment_required=false, NULL hazır qiymət deyil.
- Delivered/Bitdi açıq işləri tamamlamır və To Do-dan çıxarmır.
  Dövri Bitdi açıq işlə yalnız səbəb + həmin anın açıq ID snapshot-u ilədir.
  Payment display dönüşü yeni completion/Portfolio hadisəsi deyil.
- Lost səbəbli, reopen səbəbli; maliyyə cancellation ayrıca admin əməliyyatıdır.
- Sales Portfel bir qutu/bir kart, monthly Portfel şirkət üzrə unikal xidmət intervallarıdır.
  Overlap/future/pause günləri şişmir; reopen contribution-u inaktiv edir.
- Inbox private/group text chat yalnız söhbət üzvlərinədir; admin statusu privacy bypass deyil.
- Tools capacity/checkout/rezervasiya konflikti atomikdir, qaytarılmamış vahid boş deyil.
- Drive/Gmail linkləri, daxili Meet təqvimi və in-app iş bildirişləri v1-dir.
  Auth email/reset/invite üçün custom SMTP real yoxlanır. Sonrakı API-ləri hazır göstərmə.

İCRA
Modulları kiçik şaquli axınlarla qur: migration/RLS → transactional əməliyyat → UI → test.
Maliyyə qiymətlərini, status/audit/outbox yazmalarını, allocation və period generation-u
bir-birindən ayrılmış HTTP yazmaları ilə yarımçıq saxlamamağa diqqət et.
SQL migrations boş test bazasından təkrarlana bilsin. Anonim iki tenant seed yarat.
DB job/outbox/lease/retry, qısa worker və Cron ilə davamlı fon işləri qur.
İcazəli private Realtime + optimistic rollback + version conflict + reconnect revalidation olsun.
Authenticated qiymət/chat/payment məlumatını public cache-də saxlamama.

İŞİN DAVAM ETMƏSİ
Əlçatan hesablar və verilmiş səlahiyyət daxilində konfiqurasiya/deploy işlərini konkret nəticəyə çatdır.
Production/DNS/xərc əməliyyatlarını mövcud göstərişə uyğun apar; verilmiş icazəni təkrar soruşma.
Real logo/Excel/key/project məlumatı yoxdursa uyğun lokal seed ilə müstəqil işi davam etdir.
Təkcə çatışmayan real konfiqurasiyanı dəqiq qeyd et; saxta bağlı inteqrasiya və fake uğur yaratma.
Mərhələ bitdikcə status sənədini yenilə, qalan v1 mərhələsinə davam et.

YOXLAMA
docs/05-merheleler-ve-qebul.md AC-01–76 üzrə modul üçün uyğun mənalı yoxlamaları icra et.
İki tenant RLS və yanlış composite əlaqələr, role spoofing, revoked access,
creator/owner/assignee fərqi, dar payment hüququ, price/finance field sızması,
deadline/price/allocation paralelliyi, idempotency/retry, short month/stop/resume,
chat privacy, Tools capacity, Excel xətaları/export və mobile əsas axınları yoxla.
Mövcud build/lint/typecheck/test əmrlərini həqiqətən işlət və nəticəni yaz.
Sürət hədəflərini real cihaz/şəbəkə/dataset ilə ölç; ölçülməmiş rəqəmi nəticə kimi vermə.
Canlıdan əvvəl baza və ayrıca Storage backup/restore sınağı apar.

NƏTİCƏ
İşlək v1, migrations, lockfile, təhlükəsiz .env.example, faktiki start/test əmrləri,
docs/resource-map.md, docs/runbook.md, docs/implementation-status.md və docs/test-results.md.
Həqiqi deploy varsa yoxlanmış URL, yoxdursa dəqiq qalan konfiqurasiya/əməliyyat.
Hesabatda nə işləyir, hansı testlər icra olunub və hansı real məhdudiyyət qalır yaz.
Tək M1-i və ya statik UI-ni bütün CRM hazırdır kimi təqdim etmə.
```
