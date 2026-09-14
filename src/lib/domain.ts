export const modules = [
  ["crm", "CRM"],
  ["map", "Map"],
  ["tools", "Tools"],
  ["finance", "Balans"],
  ["inbox", "Inbox"],
  ["overview", "Overview"],
  ["portfolio", "Portfel"],
  ["drive", "Drive"],
  ["subscriptions", "Aylıq Abonentlər"],
  ["meetings", "Meetlər"],
  ["users", "Userlər"],
  ["todo", "To Do"],
  ["tasks", "Tasklar"],
] as const;
export const salesStages = [
  ["to_call", "Zəng ediləcək"],
  ["called", "Zəng edilib"],
  ["proposal_sent", "Təklif göndərildi"],
  ["met", "Görüşülüb"],
  ["confirmed", "Sifariş təsdiqlənib"],
  ["in_progress", "İcradadır"],
  ["delivered", "Təhvil verilib"],
  ["lost", "Deal Lost"],
] as const;
export const recurringStages = [
  ["recurring_unpaid", "Ödəniş olunmayıb"],
  ["recurring_todo", "İcra olunacaq"],
  ["recurring_doing", "İcrada"],
  ["recurring_done", "Bitdi"],
] as const;
export const workStatuses = [
  ["todo", "Ediləcək"],
  ["doing", "İcrada"],
  ["done", "Bitdi"],
] as const;
export function money(cents: number | null | undefined) {
  return cents == null
    ? "Qiymət tamamlanmayıb"
    : new Intl.NumberFormat("az-AZ", {
        style: "currency",
        currency: "AZN",
      }).format(cents / 100);
}
export function cents(input: FormDataEntryValue | null) {
  const s = String(input ?? "")
    .trim()
    .replace(",", ".");
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s))
    throw new Error("Məbləği iki onluq rəqəmə qədər yazın.");
  const [a, b = ""] = s.split(".");
  const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!Number.isSafeInteger(n)) throw new Error("Məbləğ çox böyükdür.");
  return n;
}
export function utc(input: FormDataEntryValue | null) {
  return input ? new Date(String(input) + "+04:00").toISOString() : null;
}
export function localInput(iso?: string | null) {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 4 * 3600000)
    .toISOString()
    .slice(0, 16);
}
export function dateTime(iso?: string | null) {
  return iso
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
        timeZone: "Asia/Baku",
      }).format(new Date(iso)).replaceAll("/", ".").replace(",", "")
    : "Tarix seçilməyib";
}
export const errorLabels: Record<string, string> = {
  ACCESS_DENIED: "Bu əməliyyata girişiniz yoxdur.",
  ADMIN_REQUIRED: "Bu əməliyyat admin üçündür.",
  VERSION_CONFLICT:
    "Məlumat başqa sessiyada dəyişib. Yenilənmiş məlumatı yoxlayıb yenidən cəhd edin.",
  CONFIRMATION_FIELDS_REQUIRED:
    "Təsdiq üçün müştəri, iş qiymətləri və deadline-ları tamamlayın.",
  WORK_FIELDS_REQUIRED: "Hər işin cavabdehi və deadline-ı olmalıdır.",
  CHILD_DEADLINE_EXCEEDS_PARENT:
    "İşin vaxtı qutunun ümumi deadline-ını keçə bilməz.",
  COMMERCIAL_WRITE_REQUIRED: "Qiymət dəyişmək hüququnuz yoxdur.",
  PRICE_CHANGE_REASON_REQUIRED: "Qiymət dəyişikliyinin səbəbini yazın.",
  DEADLINE_REASON_REQUIRED: "Tarix dəyişikliyinin səbəbini yazın.",
  LOSS_REASON_REQUIRED: "İtirilmə səbəbini seçin.",
  REOPEN_REASON_REQUIRED: "Yenidən açılma səbəbini yazın.",
  OPEN_WORK_REASON_REQUIRED:
    "Açıq işlər qaldığı üçün Bitdi səbəbi tələb olunur.",
  ZERO_REASON_REQUIRED: "Sıfır qiymətin səbəbini yazın.",
  INACTIVE_ASSIGNEE: "Cavabdeh aktiv əməkdaş olmalıdır.",
  CUSTOMER_NOT_FOUND: "Müəssisə bazada tapılmadı.",
  INVALID_COORDINATES: "Koordinatlar düzgün deyil.",
  LAST_ADMIN: "Son aktiv admin dayandırıla bilməz.",
  ADMIN_RECONCILIATION_REQUIRED:
    "Azalma ödəniş bölgüsünə toxunur. Admin uyğunlaşdırması lazımdır.",
};
