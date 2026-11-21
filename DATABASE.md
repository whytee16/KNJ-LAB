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

## 2. Идентичность и согласия

| Таблица                | Ключевые поля                                                                                                                                             | Примечания                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `profiles`             | `id` (=auth.users.id), `role app_role`, `display_name`, `locale`, `timezone`                                                                              | минимум ПДн                   |
| `parent_profiles`      | `profile_id`, `email` (из auth), `phone` nullable                                                                                                         |                               |
| `student_profiles`     | `profile_id`, `grade smallint check 7..11`, `curriculum_id`, `birth_year` nullable                                                                        | без ФИО полностью, фото, ИИН  |
| `parent_student_links` | `parent_id`, `student_id`, `status link_status`, `created_at`, `confirmed_at`                                                                             | UNIQUE(parent_id, student_id) |
| `consents`             | `subject_profile_id`, `given_by_profile_id`, `type` (pd_processing, offer, marketing, autorenew), `document_version`, `given_at`, `revoked_at`, `ip_hash` | append-only                   |
| `legal_documents`      | `type`, `version`, `locale`, `body_md`, `published_at`                                                                                                    | версии оферты/политик         |

## 3. Учебная программа

| Таблица                        | Ключевые поля                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `subjects`                     | `code` (algebra, geometry, physics…), `sort`                                                                                                                             |
| `subject_translations`         | `subject_id`, `locale`, `name`                                                                                                                                           |
| `curricula`                    | `code`, `academic_year`, `school_type`, `is_default`, `status`                                                                                                           |
| `curriculum_nodes`             | `curriculum_id`, `parent_id` (дерево), `kind` (quarter/section/topic), `subject_id`, `grade`, `quarter`, `topic_id` nullable, `sort`                                     |
| `curriculum_node_translations` | `node_id`, `locale`, `title`                                                                                                                                             |
| `topics`                       | `slug`, `subject_id`, `status`, `version`                                                                                                                                |
| `topic_translations`           | `topic_id`, `locale`, `title`, `summary`, `objectives jsonb`, `theory_md`, `examples jsonb`, `common_mistakes jsonb`, `translation_status`, `reviewed_by`, `reviewed_at` |
| `topic_formulas`               | `topic_id`, `formula_id`, `sort`                                                                                                                                         |

Индексы: `curriculum_nodes(curriculum_id, parent_id, sort)`, `(curriculum_id, grade, subject_id)`.

## 4. Справочник

`formulas` (`latex`, `variables jsonb` — символ, единица, описание-ключ, `subject_id`, `grades int4range`), `formula_translations` (`name`, `description`, `search_tsv`), `constants` (`symbol`, `value numeric`, `unit`, `source`), `units` (`symbol`, `si_base jsonb` — размерность для проверки единиц), `reference_tables` (+translations, `data jsonb`), `favorites` (`profile_id`, `entity_type`, `entity_id`, UNIQUE).
Поиск: `tsvector` по `simple`-конфигурации (ru/kk) + trigram (`pg_trgm`).

## 5. Задачи, тесты, тренажёр

| Таблица                      | Ключевые поля                                                                                                                                                                                                             | Примечания                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `task_templates`             | `topic_id`, `type task_type`, `difficulty`, `spec jsonb` (параметры, ограничения, формула ответа, единицы, допуск, округление, шаги решения), `version`, `status`, `source` (manual/imported), `author_id`, `reviewer_id` | spec валидируется Zod-схемой `content-schema`        |
| `task_template_translations` | `template_id`, `locale`, `statement_tpl`, `hints jsonb`, `solution_tpl`, `translation_status`                                                                                                                             |                                                      |
| `task_instances`             | `template_id`, `template_version`, `seed`, `params jsonb`, `expected jsonb`, `created_for`                                                                                                                                | `expected` недоступен ученику (RLS + отдельная view) |
| `media_assets`               | `storage_path`, `kind`, `alt_ru`, `alt_kk`, `uploaded_by`                                                                                                                                                                 |                                                      |
| `tests`                      | `scope` (topic/section/quarter/grade/subject), `scope_ref`, `mode` (practice/exam), `time_limit_s`, `difficulty_mix jsonb`, `status`, `is_free`                                                                           |                                                      |
| `test_items`                 | `test_id`, `template_id`, `sort`, `points`                                                                                                                                                                                |                                                      |
| `attempts`                   | `student_id`, `kind` (test/trainer/lab), `test_id` nullable, `topic_id`, `started_at`, `finished_at`, `score`, `max_score`                                                                                                |                                                      |
| `attempt_answers`            | `attempt_id`, `instance_id`, `answer jsonb`, `is_correct`, `partial numeric`, `time_ms`, `idempotency_key` UNIQUE, `created_at`                                                                                           | партиционирование по месяцам при росте               |
| `trainer_runs`               | `student_id`, `topic_id`, `target smallint default 100`, `solved`, `correct`, `status`                                                                                                                                    |                                                      |
| `content_reports`            | `reporter_id`, `instance_id`, `message`, `status`                                                                                                                                                                         | «сообщить об ошибке»                                 |

Индексы: `attempts(student_id, started_at desc)`, `attempt_answers(attempt_id)`, `task_templates(topic_id, difficulty, status)`.

## 6. Прогресс и геймификация

`topic_mastery` (`student_id`, `topic_id`, `accuracy_by_level jsonb`, `test_best`, `mastered_at`, PK(student_id, topic_id)), `activity_days` (`student_id`, `day date`, `seconds`, `tasks`), `xp_events` (`student_id`, `source`, `amount`, `ref`), `user_levels` (`student_id`, `xp`, `level`), `streaks` (`student_id`, `current`, `best`, `last_day`), `achievements` (`code`, `rule jsonb`, `xp`, `icon`), `achievement_translations`, `user_achievements` (`student_id`, `achievement_id`, `earned_at`, UNIQUE).

## 7. Лаборатории

`labs` (`code`, `subject_id`, `kind` (physics/geometry2d/geometry3d), `default_params jsonb`, `is_free_demo`, `status`), `lab_translations`, `lab_topics`, `lab_sessions` (`student_id`, `lab_id`, `params jsonb`, `answers jsonb`, `duration_s`).

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
