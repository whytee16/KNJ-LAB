# DATABASE — KNJ LAB

Версия 0.1 · предварительная схема. PostgreSQL 17, все изменения — только миграциями (`supabase/migrations`). Все таблицы в схеме `public` с включённым RLS; служебные — в `private`.

Соглашения: `id uuid primary key default gen_random_uuid()`, `created_at/updated_at timestamptz`, `locale` ∈ `('ru','kk')` (расширяемый enum `app_locale`), деньги — `amount_kzt integer` (тарифы в целых тенге; если провайдер оперирует тиынами — конвертация в адаптере).

## 1. Enums

```
app_role:        student | parent | content_manager | reviewer | admin | support
app_locale:      ru | kk            (en добавится миграцией)
difficulty:      easy | medium | sufficient | hard
content_status:  draft | in_review | published | archived
translation_status: draft | machine | in_review | approved
task_type:       single_choice | multi_choice | number | formula | cloze_word | cloze_formula | matching | ordering | geometry | physics_calc
payment_status:  created | pending | succeeded | failed | canceled | refunded | partially_refunded
link_status:     pending | active | revoked
```

## 2. Идентичность и согласия (реализовано, этап 2)

Миграция: `supabase/migrations/20261121120000_identity_and_access.sql`. Тесты: `supabase/tests/*.test.sql` (pgTAP).

| Таблица                | Ключевые поля                                                                                                               | Примечания                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `profiles`             | `id` (=auth.users.id), `role app_role`, `display_name` (1–60), `locale`, `timezone`                                         | клиент может менять только `display_name`, `locale`, `timezone` (column grants) |
| `student_profiles`     | `profile_id`, `username` UNIQUE (`^[a-z0-9][a-z0-9_.]{2,31}$`), `grade 7..11`                                               | без e-mail, телефона, фото, ИИН; класс меняет родитель                          |
| `parent_student_links` | PK(`parent_id`, `student_id`), `status active/revoked`, `revoked_at`                                                        | пишет только сервер                                                             |
| `legal_documents`      | `type` (pd_processing, child_pd_processing, offer, terms), `version`, `locale`, `title`, `body`, `is_draft`, `published_at` | читают все опубликованное; черновики только в dev-seed                          |
| `consents`             | `subject_profile_id`, `given_by_profile_id`, `type`, `document_version`, `given_at`, `revoked_at`, `ip_hash`                | пишет только сервер; IP хранится только как солёный хэш                         |
| `audit_logs`           | `actor_id`, `action`, `entity`, `entity_id`, `details`, `at`                                                                | append-only: триггер запрещает UPDATE/DELETE/TRUNCATE даже владельцу            |
| `private.rate_limits`  | `key`, `window_start`, `hits`                                                                                               | фиксированное окно; ключи — хэши                                                |

Функции:

- `private.handle_new_user()` — триггер на `auth.users`: **любой** новый аккаунт получает профиль с ролью `parent`. Метаданные роль не выдают (admin API GoTrue пишет `app_metadata` отдельным запросом после INSERT, а `user_metadata` — ввод клиента).
- `public.register_student(...)` — только `service_role`: в одной транзакции превращает свежий (< 10 мин), ничем не связанный аккаунт в ученика данного родителя, создаёт профиль ученика, связь и согласие законного представителя. Проверяет, что версия согласия опубликована.
- `public.write_audit(...)`, `public.rate_limit_hit(...)` — только `service_role`.
- `private.current_app_role()`, `private.is_admin()`, `private.is_parent_of(uuid)` — хелперы для RLS (`security definer`, фиксированный `search_path`); схема `private` не публикуется через PostgREST.
- Смена `profiles.role` автоматически пишется в `audit_logs`.

## 3. Учебная программа и темы (реализовано, этап 3)

Миграция: `supabase/migrations/20261122090000_content_core.sql`. Тесты: `supabase/tests/02_content_access.test.sql`.

| Таблица                                                   | Ключевые поля                                                                                                                                      | Доступ                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `subjects` + `subject_translations`                       | `code` (algebra, geometry, physics), `sort`; `name` по языкам                                                                                      | справочные данные миграции; читают все             |
| `curricula` + `curriculum_translations`                   | `code`, `academic_year`, `is_default` (одна программа по умолчанию)                                                                                | читают все; пишут reviewer/admin с aal2            |
| `curriculum_sections` + `curriculum_section_translations` | `curriculum_id`, `subject_code`, `grade 7..11`, `quarter 1..4`, `sort`; `title` по языкам                                                          | читают все; пишут reviewer/admin с aal2            |
| `curriculum_topics`                                       | PK(`section_id`, `topic_id`), `sort`                                                                                                               | то же                                              |
| `topics`                                                  | `slug` (kebab-case, UNIQUE), `subject_code`, `created_by`                                                                                          | видна всем после публикации хотя бы на одном языке |
| `topic_contents`                                          | PK(`topic_id`, `locale`), `title`, `summary`, `objectives[]`, `theory` (Markdown + LaTeX), `mistakes[]`, `version`, `published_at`, `published_by` | читают все; пишет только `publish_topic()`         |
| `topic_drafts`                                            | те же поля + `status` (draft / in_review / approved), `is_machine_translation`, `review_note`, `submitted_at`, `reviewed_by`                       | только сотрудники; статус меняют только функции    |

Распределение тем по четвертям **не заполняется автоматически**: структуру вводит методист в студии (`/studio/curriculum`). Модель — фиксированные уровни «предмет + класс + четверть → раздел → темы» вместо произвольного дерева `curriculum_nodes` из первоначального плана: проще редактировать и проверять.

Рабочий процесс темы (по каждому языку отдельно): черновик → `submit_topic_draft()` → `publish_topic()` (копирует черновик в `topic_contents`, версия +1) или `request_topic_changes()` (возврат с замечанием). Любое изменение текста черновика триггером возвращает его в `draft`; опубликованная версия при этом не меняется, пока методист не опубликует новую. `unpublish_topic()` снимает язык с публикации.

## 4. Справочник (реализовано, этап 3)

| Таблица                | Ключевые поля                                                                                                    | Доступ                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `formulas`             | `code` UNIQUE, `subject_code`, `grade_from..grade_to`, `latex`, `status` (draft / in_review / published)         | опубликованные читают все; автор правит только черновик; методист — всегда |
| `formula_translations` | PK(`formula_id`, `locale`), `name`, `description`, `variables` jsonb `[{symbol, meaning, unit}]`; trigram-индекс | как у формулы                                                              |
| `favorites`            | PK(`profile_id`, `formula_id`)                                                                                   | только свои строки, только опубликованные формулы                          |

Статус формулы меняет `set_formula_status()`: автор может только отправить черновик на проверку, остальное — методист. Для формул выбрана модель «статус в строке» (в отличие от тем): справочные формулы редко меняются, а исправление опубликованной формулы выполняет методист.

Константы, единицы и таблицы справочника — следующие итерации (та же модель, что у формул).

## Роли сотрудников и второй фактор (этап 3)

- `private.is_staff()`, `private.can_review()`, `private.has_aal2()`; все записи сотрудников в политиках и функциях требуют `aal2` (TOTP подтверждён в текущей сессии).
- `set_user_role()` — только admin с aal2; нельзя менять свою роль и роли учеников.
- `find_user_by_email()` — только `service_role` (поиск пользователя в админке после проверки прав в приложении).

## 5. Задачи, тренажёр, тесты, пропуска (реализовано, этап 4)

Миграция: `supabase/migrations/20261123090000_practice.sql`. Тесты: `supabase/tests/03_practice_access.test.sql`.

| Таблица                | Ключевые поля                                                                                                                                                                       | Доступ                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `task_templates`       | `topic_id`, `type` (single_choice, multi_choice, number, formula, cloze_word, matching, ordering), `difficulty` (easy, medium, sufficient, hard), `spec` jsonb, `status`, `version` | опубликованные читают все; автор правит черновик, методист — всегда (aal2) |
| `task_template_texts`  | PK(`template_id`, `locale`), `texts` jsonb: statement с `{{param}}`, options, matches, accepted, hints, solution                                                                    | как у шаблона                                                              |
| `task_instances`       | `template_id` (**restrict**: шаблон с историей не удалить), `template_version`, `student_id`, `attempt_id`, `position`, `seed`, `locale`, `params`, `prompt`                        | ученик — свои, родитель — детей; пишет только сервер                       |
| `task_instance_keys`   | `instance_id`, `expected`, `solution`                                                                                                                                               | **нет прав ни у одной клиентской роли**                                    |
| `trainer_runs`         | `student_id`, `topic_id`, `difficulty`, `target` 100, `solved`, `correct`, `status` (одна активная серия на тему и уровень)                                                         | ученик/родитель читают                                                     |
| `tests` + `test_texts` | `scope` (topic, section, quarter, grade, subject) + ссылки, `mode` (practice, exam), `time_limit_s` (обязателен для exam), `counts` по уровням, `status`                            | как у шаблонов                                                             |
| `attempts`             | `kind` (trainer, test), `trainer_run_id` / `test_id`, `deadline_at`, `finished_at`, `score`, `max_score`                                                                            | ученик/родитель читают                                                     |
| `attempt_answers`      | `instance_id` UNIQUE (один ответ на задачу), `answer`, `status`, `score` 0..1, `time_ms`, `idempotency_key` UNIQUE                                                                  | ученик/родитель читают; пишет сервер                                       |
| `entitlements`         | `student_id`, `starts_at`, `ends_at`, `source` (manual сейчас, order с этапа 7), `granted_by`, `reason`, `revoked_at`                                                               | ученик/родитель/admin читают; выдача — функцией                            |
| `content_reports`      | `reporter_id`, `instance_id`, `template_id`, `message`, `status`                                                                                                                    | сотрудники читают и закрывают                                              |

Функции и триггеры:

- `private.task_instance_guard` — триггер: задачу можно выдать только по опубликованному шаблону, а платный уровень — только при действующем пропуске (`private.has_entitlement`). Работает даже для service role.
- `grant_entitlement(student, days, reason)` / `revoke_entitlement(id)` — только admin с aal2; новый пропуск продолжает действующий; аудит.
- `set_task_template_status`, `set_test_status` — тот же процесс, что у формул (автор отправляет, методист публикует).
- `record_trainer_answer(run, correct)` — атомарное обновление счётчиков серии (только service role).
- Любое изменение шаблона или его текстов увеличивает `version`; выданные задачи хранят свою версию.

## 6. Прогресс и геймификация

`topic_mastery` (`student_id`, `topic_id`, `accuracy_by_level jsonb`, `test_best`, `mastered_at`, PK(student_id, topic_id)), `activity_days` (`student_id`, `day date`, `seconds`, `tasks`), `xp_events` (`student_id`, `source`, `amount`, `ref`), `user_levels` (`student_id`, `xp`, `level`), `streaks` (`student_id`, `current`, `best`, `last_day`), `achievements` (`code`, `rule jsonb`, `xp`, `icon`), `achievement_translations`, `user_achievements` (`student_id`, `achievement_id`, `earned_at`, UNIQUE).

## 7. Лаборатории

Миграция `20261124090000_labs.sql` (этап 5a, [ADR-0008](docs/adr/0008-labs-models-in-code.md)).

| Таблица            | Ключевые поля                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `labs`             | `code` (= код модели в `packages/physics`), `subject_code`, `kind` (physics/geometry2d/geometry3d), `grade_from`, `default_params`, `is_free_demo`, `status`, `sort` |
| `lab_translations` | PK(`lab_id`, `locale`), `title`, `goal`, `steps text[]` (≤ 12), `hints text[]` (≤ 10), `translation_status`                                                          |
| `lab_topics`       | PK(`lab_id`, `topic_id`) — лаборатория показывается на странице темы                                                                                                 |
| `lab_tasks`        | PK(`lab_id`, `template_id`), `position`; шаблон — `on delete restrict`                                                                                               |
| `lab_sessions`     | `student_id`, `lab_id`, `params`, `answers` (`{correct, total}`), `duration_s`, `attempt_id`, `started_at`, `updated_at`                                             |

- Строки `labs` добавляются только миграциями: у клиентов нет `insert`/`delete`, а `code` не изменяется.
- Вопросы — попытки `attempts.kind = 'lab'` (`attempts.lab_id`), задачи выдаёт и проверяет движок этапа 4.
- `private.lab_use_guard()` (триггер на `lab_sessions` и `attempts`): лаборатория опубликована, пользователь — ученик, а для лаборатории не из демо нужен активный пропуск, даже под service role.
- `set_lab_status(lab, status)`: отправляет на проверку сотрудник с aal2, публикует reviewer/admin с aal2; для публикации нужны название и цель на русском.
- RLS: опубликованное читают все, черновики — сотрудники; править черновики могут сотрудники с aal2, любые — reviewer/admin. `lab_sessions` читают сам ученик и его родитель, пишет только сервер.

### Происхождение контента (этап 5b)

Миграция `20261125090000_content_origin.sql`: поле `content_origin` (`human` / `ai_draft` / `ai_reviewed`) в `topic_drafts`, `lab_translations`, `task_templates`. Публикация `ai_draft` запрещена триггерами (`topic_contents`, `task_templates`, `labs`). Пометку снимает только `mark_content_reviewed(kind, id, locale)` (reviewer/admin с aal2, пишется в аудит); прямое изменение поля отклоняется. В той же миграции регистрируется лаборатория `projectile`; `20261126090000_inclined_plane_lab.sql` регистрирует `inclined-plane`, `20261127090000_pendulum_labs.sql` — `math-pendulum` и `spring-pendulum`.

## 8. Монетизация

| Таблица             | Ключевые поля                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plans`             | `code` (pass_15d, pass_1m, pass_1y), `duration_days`, `amount_kzt`, `is_active`, `features jsonb`                                                         |
| `plan_translations` | `plan_id`, `locale`, `name`, `description`                                                                                                                |
| `orders`            | `parent_id`, `student_id`, `plan_id`, `amount_kzt` (снимок цены), `status`, `offer_consent_id`                                                            |
| `payments`          | `order_id`, `provider`, `provider_payment_id`, `status payment_status`, `amount_kzt`, `raw_last jsonb` — UNIQUE(provider, provider_payment_id)            |
| `payment_events`    | `provider`, `event_id`, `payload jsonb`, `signature_valid`, `processed_at`, `error` — UNIQUE(provider, event_id)                                          |
| `entitlements`      | `student_id`, `starts_at`, `ends_at`, `source_order_id`, `revoked_at` — EXCLUDE пересечения не нужен: новый пропуск начинается с `max(now, last ends_at)` |
| `refunds`           | `payment_id`, `amount_kzt`, `reason`, `requested_by`, `approved_by`, `status`                                                                             |
| `receipts`          | `payment_id`, `provider`, `fiscal_id`, `url`, `status`                                                                                                    |

Карточные данные **не хранятся**.

## 9. Отчёты, уведомления, аудит

`parent_reports` (`parent_id`, `student_id`, `period_start`, `period_end`, `locale`, `data jsonb`, `sent_at`), `notifications` (`profile_id`, `type`, `payload`, `read_at`), `audit_logs` (`actor_id`, `action`, `entity`, `entity_id`, `diff jsonb`, `ip_hash`, `at`) — append-only (REVOKE UPDATE/DELETE), `tts_assets` (`entity`, `entity_id`, `locale`, `voice`, `provider`, `storage_path`, `text_hash`), `feature_flags`.

## 10. ЕНТ (этап 9, отдельно)

`ent_subjects`, `ent_combinations`, `ent_item_bank` (+translations, `source`, `verified`), `ent_exam_sets` (`version`, `structure jsonb`), `ent_schedule` (интервал 14 дней), `ent_attempts`, `ent_answers`.

## 11. RLS — базовая матрица

| Таблица                 | student                                        | parent                               | content_manager | reviewer     | admin                     |
| ----------------------- | ---------------------------------------------- | ------------------------------------ | --------------- | ------------ | ------------------------- |
| profiles                | свой R/U                                       | свой R/U; дети R (ограниченные поля) | —               | —            | всё                       |
| student_profiles        | свой R                                         | связанные (active) R                 | —               | —            | всё                       |
| опубликованный контент  | R (free или entitlement — проверка на сервере) | R                                    | R/W draft       | R/W, publish | всё                       |
| task_instances.expected | —                                              | —                                    | —               | R            | R                         |
| attempts / answers      | свои R/I                                       | детей R                              | —               | агрегаты     | всё                       |
| orders / payments       | —                                              | свои R, orders I                     | —               | —            | всё                       |
| entitlements            | свои R                                         | детей R                              | —               | —            | всё                       |
| payment_events          | —                                              | —                                    | —               | —            | R (запись — service role) |
| audit_logs              | —                                              | —                                    | —               | —            | R                         |

Хелперы (`security definer`, `search_path` зафиксирован): `auth_role()`, `is_parent_of(student uuid)`, `has_entitlement(student uuid)`. Каждая политика покрывается pgTAP-тестом (`supabase/tests`).

## 12. Хранение файлов

Бакеты: `content-public` (иллюстрации опубликованного контента, публичное чтение), `content-draft` (только studio), `tts` (публичное чтение по подписанным URL), `reports` (PDF, позже; доступ только владельцу). Пользовательских загрузок от учеников на MVP нет.

## 13. Удаление и хранение данных

Удаление аккаунта ребёнка по запросу родителя → анонимизация `attempts` (для статистики контента) и удаление профиля; платежи хранятся по требованиям бухучёта. Сроки хранения утверждает юрист.
