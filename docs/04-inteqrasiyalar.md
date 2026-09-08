# İnteqrasiyalar və məlumat axınları

Versiya: 1.0 · 08.09.2026 · V1 müqavilələri. Google/Meta kimi provayderlərə aid hazır olmayan imkanlar implementasiya olunmuş sayılmır.

## Əhatə

| Funksiya | V1 |
| --- | --- |
| Excel | Müəssisə/əlaqə/filial importu; icazəli modul ixracları |
| Xəritə | Leaflet + Geoapify tile, öz markerlərimiz, adminin əl ilə pin düzəlişi |
| Drive | Qutulardakı media/qovluq/linklərin vahid siyahısı |
| Gmail | Gmail-ə keçid; API bağlantısı yoxdur |
| Meetlər | Daxili təqvim, əl ilə online link/məkan, .ics endirmə |
| Auth email | Təsdiq, dəvət, şifrə sıfırlama üçün SMTP |
| Webhook | Yeni lead üçün tətbiqin öz HMAC JSON endpoint-i |
| GPT/Higgsfield | Tools resurs qeydi; API əməliyyatı yoxdur |
| Sonraya | Tam Google API, WhatsApp/Meta adapterləri, kütləvi geocoding |

## Excel import müqaviləsi

Yalnız admin; bütün əməkdaşların Map read hüququ import hüququ deyil. XLSX və UTF-8 CSV; initial limit 10 MB, 10 000 sətir, 100 sütun və hüceyrədə 4 000 simvol. Açılmış arxiv ölçüsü/memory limiti ayrıca qorunur. Formula və makrolar işlədilmir. Mənbə parserinin təhlükəsizlik/stabil versiyası qurulmada yoxlanır.

1. Fayl tenant-a aid private import sahəsinə yüklənir.
2. Vərəq/başlıq sətri və real nümunə göstərilir.
3. Sütunlar aşağıdakı sözlüyə uyğunlaşdırılır.
4. Dry run yeni/yenilənən/konfliktli/xətalı sətirləri göstərir.
5. Admin bu preview-ni tətbiq edir; fayl/mapping dəyişibsə preview etibarsızdır.
6. Worker 100–500 sətirlik uyğun partiyalarla işləyir; progress/error/result saxlanır.
7. Retry qalan hissəni davam etdirir; eyni sətir/mənbə qeydi təkrarlanmır.

| Sahə | İlkin qayda |
| --- | --- |
| external_id | Mövcud sabit müəssisə ID-si varsa üstün açar |
| customer_name | Yeni müəssisədə məcburi; boş sətir xəta |
| branch_name / location_external_id | Filialı müəssisədən ayırır |
| contact_name / phone / email | String; +994 və başlanğıc sıfırlar qorunur |
| address | Mətn ünvan; koordinat yoxdursa yenə saxlanır |
| latitude / longitude | WGS84 numeric, −90…90 və −180…180; qarışma preview-də xəta/xəbərdarlıq |
| category / note | İstəyə bağlı mətn; HTML/script render edilmir |

Sütunların real adları nümunə fayldan götürülür, bu sözlük istifadəçinin faylının faktiki schema-sı deyil. Eyni adlı filiallar kor-koranə birləşdirilmir; təkcə ad avtomatik match deyil. Source ID yoxdursa phone/name/address namizədləri preview-də adminə göstərilir. Default boş xana əvvəlki dəyəri silmir. Manual pin mənbə/vaxt ilə saxlanır, növbəti import onu səssiz overwrite etmir.

Import raw faylı/mapping/sətir hesabatı private, tətbiq edilmiş müəssisə məlumatı tenant komandasına görünəndir. Rollback öz job dəyişikliklərinə bağlanır; sonradan insanın redaktə etdiyi məlumatı silmir. Müvəqqəti raw fayl 7 gün sonra təmizlənə bilər, import/audit nəticəsi qalır. Sifariş/ödəniş/müqavilə kütləvi importu v1-dən kənardır.

## İxrac

Müəssisə/filial, CRM qutu və işlər, To Do, Balans, aylıq müqavilə/dövrlər, Tools, görüşlər, Portfel/Drive linkləri və profilin icazəli metadata-sı üzrə XLSX/CSV. Şəxsi chat üçün tenant-wide export yoxdur. Hər modul source read + ayrıca export permission yoxlayır. Adi üzvdə export default bağlıdır.

Filter, sütun, tarix/valyuta formatı preview-də görünür. Qutu və xidmət sətirləri XLSX-də ayrı vərəqlərdir; çox departament total-ı iki dəfə cəmləmir. commercials.read yoxdursa qiymət çıxmır; finance.read yoxdursa ümumi Balans çıxmır. Öz qutusunda dar payment write hüququ bütün maliyyəni export etməyə yetmir.

Mətnin =,+,-,@ və idarəedici prefikslərlə formula kimi işləməsinin qarşısı alınır, həqiqi rəqəm sütunları numeric qalır. Export job private-dir; yaradılma və endirmə zamanı cari tenant/field hüququ yenidən yoxlanır. Artifact 24 saat saxlanır, download üçün qısa ömürlü link/server keçidi; başqa üzvün artifact ID-sini bilmək giriş deyil. Böyük export fonda, hadisəsi auditdədir.

## Xəritə

Leaflet raster xəritə və Geoapify qat konfiqurasiyası. Tile sorğusu görünən ərazi üçündür; müştəri ad/telefonları provayderə göndərilmir. Public browser map key server secret deyil, allowed-origin/rate/quota ayarları ilə məhdudlaşdırılır. Geoapify və xəritə məlumatı attribution-u görünür.

Geoapify Free 3 000 kredit/gün göstərir, attribution şərti ilə kommersiya istifadəsinə icazə verir. Kredit tile/istifadəçi sayı ilə eyni vahid deyil; real trafik ölçülür. [Rəsmi qiymət və FAQ](https://www.geoapify.com/pricing/).

Koordinatsız müəssisə siyahıda qalır, admin pin qoyur. Kütləvi geocoding və 2 500 ünvanın avtomatik xaricə ötürülməsi yoxdur. Kvota/key/provayder problemi olarsa xəritə aydın xəta göstərir, müəssisə siyahısı işləyir. Qat adapteri sonradan dəyişdirilə bilir.

## Drive, Gmail və Meet

Resource link qutuda yaranır; Drive ekranı eyni məlumatı sorğulayır. Link müəllifi, başlıq, tip və mənbə qutu saxlanır. Qutu redaktoru material linkini idarə edir; linkin görünüşü source read-dən gəlir. HTTPS URL scheme/uzunluq validation, təhlükəsiz yeni tab; server automatic URL preview/fetch etmir.

Google hesabında faylı görmək CRM icazəsindən ayrıca asılıdır. CRM link əlavə etməklə faylı ictimailəşdirmir. Google refresh token və OAuth bağlantısı v1-də tələb deyil. Drive real media backup-u və sahiblik Google tərəfində qalır.

Gmail yalnız keçiddir. Auth SMTP Gmail API-si deyil. Meetlərdə start/end/timezone, lokal qeyd və istifadəçinin verdiyi online link var; .ics UTC/timezone, event UID və yenilənmə versiyasını qoruyur. Tətbiq xarici şəxslərə avtomatik dəvət göndərmir.

## Auth emailləri

Supabase Auth üçün email təsdiqi, dəvət və reset password. Production custom SMTP mövcud hostinqdən və ya uyğun email provayderindən konfiqurasiya edilir; faktiki SMTP məlumatı yoxlanmadan işləyir deyilmir. Supabase default SMTP production email planı deyil. [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

SPF/DKIM/DMARC, göndərən domen, origin/redirect allowlist və real test ünvanı yoxlanır. Reset cavabı emailin sistemdə olub-olmadığını ifşa etmir; link one-time/expiry davranışı və rate limit test edilir. Preview və production redirect URL-ləri ayrıdır. Secretlər yalnız təhlükəsiz hesab/env kanalından alınır.

## Ümumi lead webhook — tətbiqin öz schema-sı

Endpoint: POST /api/webhooks/leads/{endpoint_id}. endpoint_id real qurulmada server tərəfindən ayrılır; URL-də secret yoxdur. Tenant və intake departament/default admin serverin endpoint konfiqurasiyasından alınır. Bu schema Meta/Google/n8n-in öz API formatı kimi təqdim edilmir; göndərən vasitə ona uyğunlaşdırır.

Headers:
- Content-Type: application/json
- X-CRM-Timestamp: Unix saniyə
- X-CRM-Signature: raw body üzərində HMAC-SHA256 hex; imzalanan mətn timestamp + "." + raw_body
- Secret tenant endpointinə aid serverdədir; timing-safe müqayisə, 5 dəqiqə timestamp pəncərəsi və rotation dəstəyi.

Nümunə yalnız sintetikdir:
```json
{
  "external_event_id": "demo-form-0001",
  "customer_external_id": "optional-existing-id",
  "company_name": "Nümunə müəssisə",
  "contact_name": "Nümunə əlaqə",
  "phone": "+994000000000",
  "email": "contact@example.com",
  "message": "Çəkiliş barədə müraciət",
  "source_label": "website"
}
```

external_event_id və ən azı phone/email və ya ad+mesaj məcburidir. Body limiti 256 KB; sahə whitelist-i, kontakt formatı, rate limit (ilkin endpoint üzrə 60/dəqiqə) və tenant quota var. Payload ilə organization/role/creator/owner/price/confirmed stage yazmaq mümkün deyil.

Qəbul: signature/schema yoxlaması → davamlı webhook_events qeydi → 202 → worker lead yaradır → audit/notification. 400 validation, 401 auth, 409 eyni event ID ilə fərqli payload, 429 Retry-After ilə limit. Qəbul qeydi yazılmadan uğur qaytarma.

Dedupe açarı tenant+endpoint+external_event_id-dir. Retry yeni timestamp ilə imzalanır və eyni biznes event ID-sini saxlayır. Hadisə artıq varsa yeni lead/assignment/notification yaranmır. Müştəri source ID uyğunluğu tenant daxilində yoxlanır; adla təkcə avtomatik merge yoxdur. Naməlum müəssisə lead intake-də qalır, Excel importundan sonra bağlanır.

Webhook default owner admin paneldə seçilmiş aktiv admindir. Default deaktivdirsə davamlı lead qəbul qeydi itmir, visible assignment/configuration error yaranır; təsadüfi üzv təyin edilmir. İnsan sonra owner dəyişibsə retry onu adminə qaytarmır.
