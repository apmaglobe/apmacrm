# Yekun suallar və seçilmiş cavablar

Versiya: 1.0 · 08.09.2026 · Qurulma üçün qüvvədə olan ilkin seçimlər.

İstifadəçi qalan cavabları əvvəlki qərarların məntiqinə uyğun seçməyi və paketi yekunlaşdırmağı tapşırdı. Aşağıdakı S qərarları həmin səlahiyyətlə assistent tərəfindən seçilib; istifadəçinin hər birini ayrıca söylədiyi iddia edilmir. D01–D56 birbaşa istifadəçi qərarlarıdır. Bu fayldakı seçimlər əvvəlki açıq sualları bağlayır. Əlavə müsahibə tələb olunmur; yalnız həqiqi hesab, fayl və domen məlumatları qurulma zamanı əldə edilir.

## Qalan əsas suallar — B06–B18

### S01 / B06 — Aylıq xidmət dövrün ortasında dayandırılanda haqq necə hesablanır?

İlkin versiyada günə görə avtomatik yenidən hesablama yoxdur. Başlamış dövrün razılaşdırılmış haqqı qalır: 1 000 AZN-dən pul alınmayıbsa alacaq 1 000 AZN, 300 AZN alınıbsa qalıq 700 AZN-dir. Dayandırılma sonrakı dövrlərin yaranmasını dayandırır. Admin razılaşmaya uyğun ləğv/düzəliş sənədini səbəblə daxil edə bilər; alınmış pul avtomatik qaytarılmır.

Bu, qeyri-müəyyən “sayılmır” cavabının təfsiri deyil, son delegasiya əsasında seçilmiş başlanğıcdır. Qayda `proration_policy=none` olaraq ayrıca saxlanır. Gələcək günə görə hesablama əvvəlki sənədlərə geriyə tətbiq olunmur.

### S02 / B07 — Balans hansı valyuta və hesablaşma səviyyəsində işləyir?

İlk versiyada AZN, iki onluq rəqəm; sadə alacaq, borc, faktiki daxilolma və çıxışlar. Avtomatik ƏDV, vergi bəyannaməsi, əməkhaqqı formulu, bank bağlantısı və məzənnə çevirməsi yoxdur. Çap edilə bilən hesablaşma çıxarışı və XLSX/CSV ixracı var; çıxarış rəsmi vergi fakturası kimi təqdim edilmir.

### S03 / B08 — Təsdiqdən sonra qiymət dəyişəndə əlavə təsdiq lazımdır?

Mövcud qiymət redaktə hüququ saxlanır: admin və ya ayrıca commercials.write hüquqlu qutu yaradanı/hazırkı cavabdehi. Təsdiqdən sonrakı dəyişiklikdə səbəb məcburidir, ayrıca təsdiq növbəsi yoxdur. İş qiymətləri dəyişir, total yenə işlərin cəmidir. Rəsmiləşmiş alacaq silinmir; qiymət fərqi mənbə versiyasına bağlı düzəliş sənədi ilə uyğunlaşdırılır.

Azalma artıq ayrılmış ödənişdən aşağı nəticə verirsə ödəniş bölgüsünün dəyişməsi tələb olunur və bunu admin edir. Digər redaktorun belə sorğusu aydın səbəblə rədd olunur; pul tarixçəsi kommersiya yazması ilə dəyişmir. Müqavilə şablonunun qiymət dəyişikliyi növbəti yaranmamış dövrə aiddir.

### S04 / B09 — Bir ödəniş bir neçə sifarişə bölünə və avans saxlanıla bilərmi?

Bəli, eyni agentlik, müştəri və valyuta daxilində. Bir pul qeydi və ona bağlı bölgülər olur; bölgülər pulun xalis mövcud məbləğini keçmir. Çox sifarişli bölgünü və əlaqəsiz avansı admin idarə edir. Qutu yaradanının dar hüququ yalnız öz qutusuna bağlı tək sifarişli ödənişi əhatə edir.

Artıq məbləğ müştərinin bölüşdürülməmiş avansıdır. Başqa dövrə admin açıq şəkildə ayırmadan 50% həddində nəzərə alınmır. Müştərinin ümumi avansı ayrı icazəli maliyyə məlumatıdır.

### S05 / B10 — Drive necə işləyəcək?

İlk versiyada qutulara əlavə olunan Google Drive və digər layihə/media linkləri vahid Drive ekranına düşür. Müştəri, sifariş, departament və material növü üzrə filtr olur. Google-da fayl yükləmə, avtomatik qovluq yaratma və icazə dəyişmə sonraya saxlanır. CRM və Google giriş hüquqları ayrı qalır.

### S06 / B11 — Meetlər üçün Google bağlantısı lazımdırmı?

İlk versiyada daxili görüş təqvimi, iştirakçılar, əyani məkan və ya əl ilə daxil edilən online link kifayətdir. İstəyə bağlı .ics endirmə olur. Avtomatik Google Meet linki, Calendar sinxronizasiyası və xarici şəxslərə avtomatik dəvət göndərilməsi sonrakı mərhələdir.

### S07 / B12 — Inbox-da nələr olacaq?

Daxili bildirişlər, şəxsi və qrup mesajlaşması olacaq. İlkin mesajlar mətn və linkdən ibarətdir; oxundu vəziyyəti, səhifələmə və söhbət daxilində axtarış var. Müəllif 15 dəqiqə ərzində öz mesajını redaktə edə və məzmununu silinmiş işarəsi ilə əvəz edə bilər; hadisə izi saxlanır.

Mesaj məzmununu yalnız söhbət iştirakçıları görür. Yeni qrup üzvü qoşulduğu vaxtdan sonrakı mesajları görür; çıxarılan üzv yeni məlumat ala bilmir. Admin sadəcə admin olduğu üçün bütün şəxsi yazışmaları oxumur. Qutu linkini mesaja əlavə etmək həmin qutuya giriş vermir. Fayl yükləmə, səsli/video zəng və geniş chat funksiyaları sonraya saxlanır.

### S08 / B13 — Tools yalnız istifadəçini göstərsin, yoxsa rezervasiya da olsun?

Hər ikisi olsun: hazırkı istifadəçi, götürmə/qaytarma jurnalı və gələcək tarix-saat rezervasiyası. Admin alətin adını, növünü, sayını/lisenziya tutumunu, aktiv/nasaz vəziyyətini idarə edir. Fiziki avadanlığın hər vahidi ayrıca qeyd edilir; rəqəmsal resursun tutumu paneldə seçilir.

Əməkdaş özü üçün boş intervalı rezervasiya edir və öz götürmə/qaytarmasını qeyd edir; admin bütün qeydləri idarə edir. Əlavə təsdiq növbəsi yoxdur. Tutum atomik yoxlanır. Vaxtı keçsə də qaytarılmamış fiziki avadanlıq mövcud hesab edilmir; konflikt göstərilir. Parol və giriş tokenləri Tools-da saxlanmır.

### S09 / B14 — Excel-dən hansı məlumatlar import olunur?

İlkin import yalnız müəssisə, əlaqə şəxsi və filial/məkan məlumatları üçündür. Sifariş, ödəniş və aylıq müqavilə tarixçəsinin kütləvi importu sonrakı əlavədir. Başlanğıc maliyyə qalıqları admin tərəfindən ayrıca tarixlə daxil edilir.

### S10 / B15 — İlk webhook hansı mənbə üçün hazırlanır?

Sayt forması və n8n kimi vasitələrin qoşula biləcəyi ümumi JSON webhook müqaviləsi qurulur. Bu, istifadəçinin hazırda həmin servisləri işlətdiyi iddiası deyil. Tenant üzrə ayrıca endpoint, serverdə mənbə uyğunlaşdırması, HMAC imzası, timestamp, xarici event ID-si və retry davranışı sənədləşdirilir.

Meta/WhatsApp üçün birbaşa adapterlər sonrakı əlavədir. Naməlum müəssisə lead kimi saxlanır; Excel bazasında səssiz yeni müəssisə açılmır. Admin sonradan uyğun müəssisəyə bağlayır.

### S11 / B16 — Excel ixracını kim edə bilər?

Admin və ayrıca modul üzrə export icazəsi verilən əməkdaşlar. Adi əməkdaşlarda ilkin ixrac hüququ bağlıdır. İxrac yalnız görə bildiyi qeydləri və icazəli sahələri verir; commercials.read bağlıdırsa qiymət, finance.read bağlıdırsa ümumi Balans məlumatı çıxmır. Admin hüququ da başqa tenantı açmır.

### S12 / B17 — Bildirişlər hansı kanalla gəlsin?

İlk versiyada CRM daxilində Realtime bildirişləri. Təyinat, mention, aidiyyəti mərhələ/deadline dəyişikliyi, rezervasiya və görüş hadisələri göstərilir. Deadline üçün 24 saat və 2 saat əvvəl xatırlatma, gecikən işlər üzrə adminə gündə bir xülasə verilir; təkrar hadisələr çoxalmır.

İş bildirişləri üçün email/push sonraya saxlanır. Qeydiyyat, dəvət və şifrə sıfırlama emailləri isə ilk versiyanın giriş axınına daxildir.

### S13 / B18 — Hansı ardıcıllıqla istifadəyə verilir?

M1–M3-dən sonra giriş/icazələr, Map/import, CRM, To Do və əsas bildirişlər ilə pilot hazırlana bilər. Sonra Tools, Meetlər, profillər, Portfel, Drive/Gmail keçidi, Balans, aylıq dövrlər, Inbox və Overview tamamlanır. Yekun v1 bütün 12 menyu bölməsini əhatə edir; pilot tam məhsulun əvəzi deyil.

Qurulma tapşırığı M1-də dayanmaq əmri vermirsə agent mərhələlərlə M6-ya qədər davam edir. İstifadəçinin ayrıca qurulma əmri verilməyən bu planlaşdırma söhbətində tətbiq yaradılmır.

## Digər açıq qeydlər üçün seçilmiş qaydalar

### S14 — Qeydiyyat, rollar və işdən ayrılma necə idarə edilir?

Agentliyə aid dəvət/qoşulma linki; dəvətsiz gələn şəxs həmin agentliyin qoşulma səhifəsindən pending müraciət yaradır. Agentliklərin açıq kataloqu yoxdur. Email təsdiqi məcburidir. İlk admin etibarlı bootstrap əməliyyatı ilə seçilir; özünü qeydiyyatdan keçirən şəxs admin ola bilməz.

Dinamik rol şablonu üzərində fərdi allow/deny üstün gəlir, inherit rolu götürür. Sistem admini ayrıca səlahiyyətdir. Admin üçün TOTP əlavə giriş təsdiqi, əməkdaş üçün könüllü TOTP seçilir. Offboarding üzvlüyü dayandırır, sessiya/abunələri bağlayır; işlər və şablonlar adminə yenidən təyinat siyahısında göstərilir, tarixçə silinmir. Başqa agentlikdə üzvlük bundan təsirlənmir.

### S15 — Müəssisə bazasının yazma və dublikat qaydası nədir?

Import, mövcud məlumat düzəlişi və pin dəqiqləşdirməsi admindədir. Yeni müəssisə yalnız Excel importundan yaranır. İlkin format XLSX/UTF-8 CSV; maksimum 10 MB, 10 000 sətir, 100 sütun, hüceyrədə 4 000 simvol; limit xətası izahlıdır və panel konfiqurasiyası ilə dəyişdirilə bilər.

Önbaxış, sütun uyğunlaşdırması, sətir xəta hesabatı və bərpa olunan partiyalar var. Sabit source ID əsas açardır; təkcə adla birləşdirmə yoxdur. Mübahisəli qeydlər admin seçiminə qalır; boş xana mövcud dəyəri silmir. Filiallar qorunur. Fayldakı formula/makro işlədilmir. Kütləvi müştəri birləşdirmə aləti v1-də yoxdur.

### S16 — User profilində nə görünür?

Komandanın adı, bacarıqları, üzvlük tarixi və aktiv/passiv statusu bütün həmin agentliyə görünür. İş fəaliyyəti yalnız baxanın görmək hüququ olduğu CRM/To Do hadisələrindən hesablanır; bağlı qutuların adları, sayları və maliyyəsi profil vasitəsilə açılmır. Admin agentlik əməliyyat tarixçəsini görür, şəxsi chat qaydası S07-dədir. İş vaxtı izləmə, ekran izləmə və avtomatik əməkhaqqı yoxdur.

### S17 — Lead-də və təsdiqdə hansı sahələr məcburidir?

Əl ilə qutu yaradanda mövcud müəssisə və departamenti seçilmiş ən azı bir xidmət/iş tələb olunur. Başlıq boşdursa seriya görünür. Ümumi cavabdeh yaradan olur; iş cavabdehi ilkin olaraq yaradanla doldurulur və dəyişdirilə bilir. Qiymət və tarixlər lead-də boş qala bilər.

Webhook qəbulunda external_event_id və ən azı əlaqə üçün telefon/email və ya ad+mesaj tələb edilir. Müəssisə bazada yoxdursa intake məlumatı saxlanır. Təsdiq və sonrakı mərhələlərdə müəssisə əlaqəsi, ən azı bir aktiv iş, hər işin departamenti, aktiv cavabdehi, məlum qiyməti və deadline-ı, ümumi deadline məcburidir. Mənbə natamam lead-i saxlaya bilər, təsdiq şərtlərini keçə bilməz.

### S18 — Seriya və deadline-ların dəqiq davranışı nədir?

Seriya CRM-YYYY-000001 şəklində agentlik üzrə serverdə ayrılır; il dəyişəndə illik sıra yenilənir, tam seriya unikaldır. Qutunun adı seriyanı əvəz etmir.

Tarix+saat Asia/Baku ilə daxil edilir, UTC saxlanır. Lead-də tarix boş qala bilər; təsdiqdə hər iş və qutu üçün məcburidir. Keçmiş tarix açıq gecikmə xəbərdarlığı və tarix dəyişikliyində səbəblə saxlanıla bilər. İş tarixi parent tarixini keçmir; parent qısaldılarkən də eyni yoxlama aparılır. Aylıq standart ümumi saat 23:59-dur.

### S19 — Geri mərhələlər, Lost və yenidən açılma necə işləyir?

Qutu redaktorları öz qıfında irəli/geri keçə bilər; təsdiq, deadline, qiymət, Lost səbəbi və Dövri Bitdi səbəbi qaydaları hər yolda işləyir. İlk təsdiq/təhvil faktları hadisə tarixçəsində qalır. Təhvildən və ya Lost-dan geri açılmada səbəb məcburidir. Təkrar təsdiq eyni alacağı ikinci dəfə yaratmır.

Lost maliyyə ləğvi deyil; mövcud alacaq qalır. Maliyyə ləğvini admin ayrıca səbəbli düzəlişlə edir. Satış Portfeli yenidən icraya alınanda eyni kartda qaralamaya keçir; Lost olanda görünən Portfeldən arxivlənir. Yenidən təhvil eyni kartı tamamlayır. Təhvil linki və müştəri təsdiqi istəyə bağlıdır.

### S20 — Lost səbəbləri hansılardır?

İlkin siyahı: büdcə uyğun deyil, ehtiyac yoxdur, vaxt uyğun deyil, başqa təchizatçı seçildi, əlaqə alınmadı, digər. Admin siyahını idarə edir; istifadə olunmuş səbəbi arxivləşdirə bilər. Səbəb seçimi məcburi, mətn qeydi və yenidən əlaqə tarixi istəyə bağlıdır. Yenidən əlaqə işi yaradılarsa eyni CRM qutusuna bağlı olur.

### S21 — Tapşırıq statusları və avtomatik ardıcıllıq necədir?

Bir iş/alt tapşırıqda bir cavabdeh; əlavə iştirakçılar qutuda qeyd olunur. Statuslar Ediləcək, İcrada, Bitdi. CRM qutusunun mərhələsi ayrıca qalır. Təqvim deadline-ları göstərir; istəyə bağlı planlaşdırılmış start/end intervalı əlavə olunur. İlkin iş həftəsi bazar ertəsi–cümə, 09:00–18:00 göstərim ayarıdır; bu saatdan kənar işi bloklamır.

Aylıq müqavilə şablonu avtomatikdir. Birdəfəlik xidmət üçün kataloqda istəyə bağlı alt tapşırıq şablonu admin tərəfindən əlavə oluna bilər; olmaması işi yaratmağa mane deyil. Montaj bitmədən dizayn başlaya bilməz kimi məcburi asılılıq və parent statusunun avtomatik tamamlanması v1-də yoxdur.

### S22 — Müqavilə uzanması, dayandırılması və qiymət dəyişməsi necədir?

Son tarixsiz aktiv müqavilə dayandırılana qədər aylıq davam edir. Son tarixli müqavilə həmin tarixdə bitir; uzatma adminin açıq əməliyyatıdır. Pause/stop sonrakı dövrləri dayandırır; mövcud işlər avtomatik tamamlanmır və silinmir. Başlamış dövrün haqqı S01 üzrə qalır.

Dövrlər başlanğıcında yaradılır; gələcək ayların hamısı əvvəlcədən borclandırılmır. İlk aylıq xidmətin haqqı ilk xidmət dövründə yaranır; ilkin satış təsdiqi eyni dövrü ikinci dəfə borclandırmır. Müqavilədə ayrıca birdəfəlik iş varsa onun məbləği satış təsdiqində ayrıca mənbə ilə yaranır.

Şablon/aylıq qiymət dəyişikliyi sonrakı yaranmamış dövrə tətbiq olunur. Yenidən başlatma növbəti ilkin ödəniş günündən olur; boşluq üçün səssiz borc/qutu yaradılmır. Müqavilə tarixçəsi generation-un hər dövrdə qüvvədə olan qaydanı tanımasına imkan verir. Cari dövrün ayrıca qiymət düzəlişi S03-ə tabedir.

### S23 — Sıfır qiymət, ödəniş düzəlişi və geri qaytarma necədir?

Sıfır qiymətli iş mümkündür, mənfi iş qiyməti yoxdur. Cəmi sıfır sifariş/dövr üçün açıq “ödəniş tələb olunmur” səbəbi yazılır. NULL qiymət sıfır sayılmır. Xalis alacaq sıfırdırsa 50%-ə bölmə aparılmır və Ödəniş olunmayıb xəbərdarlığı yoxdur.

Ödəniş qəbzi/linki istəyə bağlı, keçmiş ödəniş düzəlişinin səbəbi məcburidir. Admin və tək sifarişin yaradanı əvvəlki dar hüquqları ilə düzəliş edə bilər; köhnə qeyd reversal/əvəzləmə əlaqəsi ilə saxlanır. Çox sifarişli ödənişə çevrildikdən sonra idarə adminə məxsusdur. Həqiqi refund/avans bölgüsü admindədir; bankdan pul göndərən avtomatika yoxdur. Qaytarma məbləği qaytarıla bilən xalis məbləği keçmir.

### S24 — Xərc, hesablar və başlanğıc qalıqlar necədir?

Admin sifarişsiz xərcləri və agentliyin freelancer/təchizatçı/əməkdaş/ofis borclarını idarə edir. Qarşı tərəf, kateqoriya, məbləğ, tarix, bağlı qutu (varsa), kassa/bank hesabı, üsul, qeyd və ödəniş bölgüsü saxlanır. Hesablar paneldən idarə olunur; bank bağlantısı yoxdur.

Admin seçilmiş başlanğıc tarixə aid qalıq alacaq/borcları “başlanğıc qalığı” kimi daxil edir. Bunlar cari satış və pul daxilolması statistikasına yeni əməliyyat kimi əlavə edilmir. Məbləği həm başlanğıc qalıqda, həm import/sifarişdə iki dəfə yazmağa qarşı mənbə və uyğunlaşdırma yoxlanır.

### S25 — Aylıq Portfel müddəti və təkrar icra necə hesablanır?

Şirkət üzrə bir davam edən xidmət xülasəsi saxlanır. Bitdi dövrləri unikal mənbə ilə xülasəyə daxil olur; xidmət günləri intervalların birləşməsindən hesablanır. Üst-üstə düşən günlər bir dəfə sayılır, fasilə və gələcək günlər sayılmır. Erkən Bitdi olduqda hesablanan son gün bu günlə məhdudlaşır. Xidmət dövrün ortasında dayandırılıbsa müddət faktiki xidmətin son günü ilə də məhdudlaşır; cari dövrün tam haqqının qalması dayandırılmadan sonrakı günləri xidmət saymır. Başlanğıc, son göstərilmiş xidmət günü, ümumi xidmət günləri və dövr tarixçəsi görünür.

Yenidən icraya alınmış dövr müddət cəmindən müvəqqəti çıxır; yenidən Bitdi eyni mənbəni bərpa edir. Ödəniş sütunundan Bitdi görünüşünə dönüş yeni tamamlama deyil. Açıq işlərin səbəbi saxlanır. Hər baxanın xülasəsi yalnız icazəli mənbə dövrlərindən hesablanır.

### S26 — Menyu, departament və kataloq nə qədər dinamikdir?

İstifadəçinin 12 bölməsi və Aylıq Abonentlər/Meetlər alt bölmələri qalır. Yazılışlar Overview, Development, Portfel kimi normallaşdırılır. Məhsul və Tək çəkiliş kateqoriyaları avtomatik aylıq hesablanma demək deyil; billing_interval ayrıca sahədir.

Admin departament, xidmət, rol, bacarıq, itirilmə səbəbi, alət və maliyyə hesablarını idarə edir. V1-də əsas qıfların semantik mərhələ kodları sabitdir; görünən başlıq/rəng idarə edilə bilər, əsas mərhələni silmək və ümumi workflow builder yoxdur.

### S27 — Xəritədə koordinatı olmayan müəssisə necə tamamlanır?

İlkin seçim Leaflet və Geoapify raster tile qatıdır. İstifadəçi markerləri öz müəssisə koordinatlarından gəlir; müəssisələrin ad/telefonları tile təminatçısına ötürülmür. Koordinatı olmayanlar siyahıda qalır, admin əl ilə pin qoyur. Kütləvi avtomatik geocoding v1-də yoxdur.

Geoapify Free planı 3 000 kredit/gün göstərir və attribution ilə kommersiya istifadəsinə icazə verir; hədlər limitsiz trafik zəmanəti deyil. Kvota, real Bakı xəritə keyfiyyəti və hesab şərtləri qurulmada yoxlanır. Qat konfiqurasiyası dəyişdirilə bilir. [Geoapify qiymət və istifadə şərtləri](https://www.geoapify.com/pricing/).

### S28 — Server, sürət və büdcə üçün seçim nədir?

Next.js/React/TypeScript, Supabase Postgres/Auth/Realtime/Storage və Vercel. Tək modul monolit, tək əsas baza, istifadəçinin agentliyini ayıran RLS. Əlavə Redis və ayrıca mikroservis ilkin tələb deyil. Supabase Frankfurt və ona yaxın Vercel server regionu ilkin seçimdir; regionların faktiki əlçatanlığı və Bakı gecikməsi yoxlanır.

İlkin istehsal planı Supabase Pro bir Micro layihə + Vercel Pro minimal developer yeri. 07.09.2026 səhifələrində baza qiymətlər 25 və 20 USD-dir; 45 USD × 1,70 ≈ 76,50 AZN. Bank/vergi, əlavə istifadə, SMTP və əlavə layihələr daxil deyil. 100 AZN daxilində ödənişsiz kvota və mövcud SMTP-dən başlamaq seçilir. Platforma xərci zəmanət deyil, qurulmada hesab üzrə yenidən yoxlanır. [Supabase](https://supabase.com/pricing), [Vercel](https://vercel.com/pricing), [Məzənnə](https://www.cbar.az/currency/rates).

### S29 — Backup, bərpa və saxlanma qaydası nədir?

İlkin bərpa hədəfi maksimum 24 saat məlumat itkisi və 8 iş saatında bərpadır; bunlar testlə ölçüləcək hədəflərdir. Supabase Pro-nun gündəlik baza backup-u ilə yanaşı Storage obyektlərinin ayrıca surəti planlaşdırılır; baza backup-u Storage fayllarını ehtiva etmir. [Backup sənədi](https://supabase.com/docs/guides/platform/backups).

Canlı istifadədən əvvəl bərpa sınağı, məsul admin və backup icra yeri yazılır. Mövcud hostinqin imkanları yoxlanmadan ona iş yüklənmir. İlk versiyada biznes/audit/maliyyə tarixçəsinin avtomatik daimi silinməsi yoxdur; arxiv/bərpa var. Müvəqqəti import faylları 7 gün, ixrac faylları 24 saat saxlanır; silmə özəl fayl sahəsi ilə məhduddur. Provider texniki log retention-u tətbiqin auditindən ayrıdır.

### S30 — Görünüş və brend necə olsun?

Azərbaycan dili, AZN, Asia/Baku; müvəqqəti ad APMA CRM, paneldən dəyişdirilə bilər. Logo gələndə dəyişdirilən yer ayrılır. Açıq tema, neytral fon, bir vurğu rəngi; sadə tünd tema keçidi. Desktop menyu mərkəzdə, mobil menyu paneldə; ağır animasiya və böyük videolu fon yoxdur. Telefon üçün sürükləməyə alternativ mərhələ seçimi, tam ekran qutu paneli və 44 px toxunma hədəfi.

### S31 — Gələcək SaaS və müştəri kabineti necə planlaşdırılır?

Agentlik izolyasiyası və bir istifadəçinin bir neçə agentliyə üzvlüyü başlanğıcdan var. V1 daxili komanda məhsuludur; müştəri kabineti, ictimai Portfel, SaaS ödəniş paketləri, self-service satış və agentliklər üçün xüsusi domenlər sonrakı mərhələdədir. İlk tenant etibarlı bootstrap ilə, əlavə tenantlar ayrıca səlahiyyətli idarəetmə ilə açılır. “Admin” adlı adi rol platforma admini yaratmır.

### S32 — Real hesab və fayllar çatışmayanda nə edilir?

Domenin adı/DNS şirkəti, Excel sütunları, logo, Supabase/Vercel project ID-ləri, SMTP rekvizitləri və Geoapify açarı real mənbədən alınır; uydurulmur. Mövcud bağlı alətlər read-only yoxlanır, secretlər chat/repo/loga yazılmır. Bunlar əlavə biznes müsahibəsi deyil, qurulmanın konfiqurasiyasıdır. Lokal baza və anonim seed ilə müstəqil iş davam edir; qurulmamış bağlantı tamamlanmış göstərilmir.

### S33 — Performans və pilot necə yoxlanır?

İlkin ölçmə ssenarisi 15 paralel əməkdaş, 2 500 müəssisə, sintetik 10 000 qutu/40 000 iş və hadisə tarixçəsidir; qutu/iş həcmləri istifadəçinin real rəqəmləri deyil. Kanban səhifəsi sütun üzrə 30 qeyd ilə başlayır, server filtri və cursor pagination işləyir. Xəritə, təqvim və qrafiklər yalnız lazım olan səhifədə yüklənir.

Vizual reaksiya P95 ≤100 ms, adi yazma təsdiqi P95 ≤800 ms, digər icazəli sessiyada commit-dən görünməyə P95 ≤1 saniyə hədəflənir. Şəbəkə/cihaz/test həcmi hesabatda yazılır; ölçülməyən sürət nəticə kimi göstərilmir. Pilot üçün admin və ən azı iki departament əməkdaşı seçilir; ad və təhvil tarixi uydurulmur.
