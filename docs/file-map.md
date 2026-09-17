# Fayl xəritəsi

Məqsəd: kodu tapmaq üçün hər dəfə grep/explore mərhələsindən keçməyə ehtiyacı azaltmaq (token qənaəti). Yeni fayl əlavə olunanda və ya köçürüləndə bu faylı yeniləyin.

## Səhifə modulları
`src/app/workspace/[module]/page.tsx` → `src/components/module-page.tsx` modul adına görə aşağıdakı komponentlərdən birini render edir:

| Modul (`?org=` yanındakı seqment) | Fayl(lar) |
|---|---|
| `crm` | `src/modules/crm/board.tsx` — Sales/Recurring Kanban, qutu (deal_card) və iş (work_item) |
| `map` | `src/modules/customers/customers.tsx`, `map-view.tsx`, `import.ts` — müəssisə siyahısı, xəritə, Excel import |
| `todo`, `tools`, `meetings`, `drive`, `portfolio`, `inbox`, `overview` | hamısı **`src/modules/operations/panels.tsx`** (+ `overview.tsx`) daxilindədir; component daxilində `module === "..."` şərti ilə seçilir. Inbox/söhbət də bu fayldadır (`function Inbox(...)`, təxminən sətir 748+). |
| `finance` (Balans) | `src/modules/finance/panel.tsx`, `payment-actions.tsx` |
| `subscriptions` (Aylıq müqavilə) | `src/modules/subscriptions/panel.tsx` |
| `tasks` (Daxili Tasklar) | `src/modules/tasks/panel.tsx` |
| `marketing` (Marketing plan) | `src/modules/marketing/panel.tsx` |
| `calls` (Zənglər) | `src/modules/calls/panel.tsx` |
| `users` (Users/Komanda) | `src/modules/users/panel.tsx`, `add-member.tsx`, `admin-access.tsx` (Admin panel), `settings.tsx`, `webhooks.tsx`, `activity.tsx`, `join.tsx`, `login.tsx` |

## Ümumi komponentlər (`src/components`)
- `workspace.tsx` — topbar, əsas nav (modul linkləri), realtime `invalidate`/`presence` kanalları, online əməkdaş siyahısı, Inbox oxunmamış mesaj nöqtəsi.
- `module-page.tsx` — hər modul üçün data fetch (`useQuery` → `/api/data`) və `refresh()` (cache invalidation) wrapper-i.
- `form.tsx` — generic `Form`/`Field`/`Select`; `Form` uğurlu save-dən sonra formu reset edir.
- `dialog.tsx` — `Modal` (Radix Dialog əsaslı).
- `date-time-field.tsx` — Bazar ertəsi-başlanğıclı deadline/saat seçici (native `datetime-local`-in OS-ə görə dəyişən həftə sırası problemini əvəz edir).
- `export.tsx`, `customer-select.tsx`, `pwa-register.tsx`, `theme.tsx`, `brand-logo.tsx`.

## Backend giriş nöqtələri
- `src/app/api/data/route.ts` — bütün modulların GET sorğusu; `tables` map-i modul→cədvəl adları, sonra modul-spesifik filtr/pagination bloklar.
- `src/app/api/command/route.ts` — POST əməliyyatlar; `{domain, operation, payload, expected_version, request_id}` alır, `${domain}_command` Postgres RPC-sinə yönləndirir. Domainlər: `identity, crm, import, finance, operations, subscription, export, map, tasks, lifecycle, marketing`.
- `src/lib/domain.ts` — əsas nav modul siyahısı (`modules` array), status/pul/tarix formatlaşdırma helper-ləri (`dateTime`, `utc`, `localInput`, `workStatuses`...).
- `src/lib/db/api.ts` — client tərəfdən `command()` helper (idempotency `request_id` daxil).
- `src/lib/db/types.ts`, `database.types.ts` — generic `Item` tipi və Supabase generated tipləri.

## Supabase migrations
Hər domain-in RPC-si (`private.<domain>_command`) öz mövzusuna aid migration-dadır; ən son versiya axtarılan domain üçün tarixə görə **son** faylda olur (məs. `tasks_command` → `20260914135858_internal_team_tasks.sql`; `operations_command`/mesajlaşma → `20260907212207_operations.sql` və sonrakı fix migration-larında yenilənib). Konkret funksiyanı tapmaq üçün: `grep -rn "function private.<domain>_command" supabase/migrations` (yalnız son tərifi əsas götürün, `create or replace` təkrarlana bilər).
