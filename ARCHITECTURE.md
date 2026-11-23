# ARCHITECTURE — KNJ LAB

Версия 0.1 · Этап 0. Решения обоснованы в [docs/adr](docs/adr/).

## 1. Обзор

```
[Браузер / смартфон]
        │ HTTPS (TLS 1.2+)
[CDN/WAF — опционально, только статика, без кэша ПДн]
        │
[Облако в РК · Docker Compose (MVP) → Kubernetes (рост)]
  ├─ web: Next.js (App Router, RSC, Server Actions, Route Handlers)  ← бизнес-логика
  ├─ supabase: Postgres 17 + RLS · GoTrue (Auth) · PostgREST · Storage (S3) · Kong
  ├─ worker: pg-boss (очереди и cron на Postgres)
  ├─ (redis — при росте: кэш каталога; rate limiting на MVP в Postgres, ADR-0005)
  ├─ observability: GlitchTip/Sentry self-hosted, Uptime Kuma, логи без ПДн
  └─ backups: WAL-G → S3-совместимое хранилище в РК (+ ежедневный restore-тест)
[Внешние] платёжный провайдер (redirect + webhook) · онлайн-касса/ОФД · e-mail · TTS (тексты контента, без ПДн)
```

### Принципы

1. **ПДн в РК** — БД, хранилище и серверный код, обрабатывающий ПДн, размещены в Казахстане ([ADR-0001](docs/adr/0001-kz-data-residency.md)). Vercel допускается только для превью без реальных данных.
2. **Защита в три слоя**: middleware (сессия) → серверный `authz` (роль + entitlement) → RLS в Postgres.
3. **Сервер — источник истины**: проверка ответов, доступ к платному контенту, статус подписки. Клиент не получает правильные ответы до отправки и не получает платный контент без entitlement.
4. **Контент отделён от кода**: всё учебное — в БД, версионируется, имеет языковые редакции и статус проверки.
5. **Чистая логика в пакетах** (task-engine, physics, geometry, reports) — без React и БД, 100 % unit-тестируемая.
6. **Провайдеры за интерфейсами**: платежи, касса, e-mail, TTS, хранилище.
7. **Без монолитных файлов**: модуль = папка с публичным `index.ts`; файл > 400 строк — повод разделить.

## 2. Стек

| Слой           | Выбор                                                                        | Почему / альтернатива                                                                        |
| -------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| UI             | Next.js 16, React 19, TypeScript strict                                      | SSR/RSC для SEO и слабых телефонов                                                           |
| Стили          | Tailwind CSS v4 + shadcn/ui (адаптирован под токены)                         | быстрые доступные компоненты (Radix)                                                         |
| i18n           | next-intl                                                                    | типизированные ключи, ICU, локаль в URL                                                      |
| Валидация      | Zod                                                                          | единые схемы клиент/сервер/контент                                                           |
| Auth           | Supabase GoTrue (self-hosted)                                                | e-mail+пароль, magic link; дети — логин без e-mail через родителя                            |
| БД             | PostgreSQL 17 + RLS, SQL-миграции Supabase CLI                               | без ORM, чтобы RLS был единственной моделью доступа; типы — `supabase gen types`             |
| Хранилище      | Supabase Storage (S3-backend в РК)                                           | иллюстрации, аудио                                                                           |
| Формулы        | KaTeX (рендер), MathLive (ввод), @cortex-js/compute-engine (эквивалентность) | MIT                                                                                          |
| Графики        | Recharts                                                                     | MIT                                                                                          |
| 2D геометрия   | собственный SVG-движок + JSXGraph                                            | GeoGebra — только с лицензией ([ADR-0003](docs/adr/0003-geometry-libs-licensing.md))         |
| 3D             | three + @react-three/fiber + @react-three/drei                               | MIT                                                                                          |
| Физика         | собственные модели в `packages/physics` (аналитика + фиксированный шаг)      | контролируемая корректность                                                                  |
| Фоновые задачи | pg-boss                                                                      | без отдельного брокера                                                                       |
| Rate limiting  | Postgres-функция `rate_limit_hit`                                            | без отдельной инфраструктуры на MVP ([ADR-0005](docs/adr/0005-rate-limiting-in-postgres.md)) |
| Тесты          | Vitest, Playwright, pgTAP, @axe-core/playwright, k6                          |                                                                                              |
| Монорепо       | pnpm workspaces + Turborepo                                                  | кэш сборок, изоляция пакетов                                                                 |
| CI             | GitHub Actions                                                               | lint, typecheck, unit, pgTAP, e2e, gitleaks                                                  |

## 3. Структура репозитория

```
apps/
  web/
    app/[locale]/
      (marketing)/        главная, тарифы, FAQ, legal
      (auth)/             login, register, reset
      app/                кабинет ученика: learn, trainer, tests, results, labs, progress
      parent/             кабинет родителя
      studio/             контент-менеджер и методист
      admin/              администратор
      reference/          справочник
      ent/                резерв (feature flag)
    app/api/
      webhooks/payments/[provider]/route.ts
      health/route.ts
    src/
      server/             authz, entitlements, payments, repositories, rate-limit, audit
      features/<module>/  UI-модули (компоненты + server actions модуля)
      lib/                supabase clients, env (Zod), logger
packages/
  ui/                     токены, базовые компоненты, GameLayout*
  i18n/                   messages/ru.json, kk.json, проверка полноты, глоссарий
  content-schema/         Zod-схемы: Topic, TaskTemplate, Test, Lab, Formula
  task-engine/            генерация по seed, проверяющие (number, units, formula, choice, match, order, cloze)
  physics/                модели лабораторий (LabModel); mechanics/ — решатели (chain, equilibrium, supported body); scenarios/ — сценарии-данные (ADR-0010)
  geometry/               планиметрия, стереометрия, сечения
  reports/                агрегаты прогресса, mastery, тексты отчётов
  payments/               интерфейс PaymentProvider + адаптеры
supabase/
  migrations/             только через миграции
  tests/                  pgTAP (RLS)
  seed/                   dev-данные (не попадают в production)
workers/                  pg-boss: reports, subscription-expiry, emails, tts
infra/                    docker-compose, конфиги, скрипты бэкапа (без секретов)
docs/adr/
```

## 4. Ключевые потоки

### 4.1 Запрос платной задачи

1. RSC страницы тренажёра вызывает `getNextTask(topicId, level)`.
2. `authz.requireStudent()` → `entitlements.hasAccess(studentId, level)` (easy всегда true).
3. `task-engine.generate(template, seed)` → в клиент уходит условие без ответа; `task_instances` хранит параметры и ожидаемый ответ.
4. Ответ отправляется Server Action `submitAnswer({instanceId, answer, idempotencyKey})` → проверка → запись `attempt_answers` (UNIQUE по ключу) → обновление mastery/XP в транзакции → в клиент: верно/неверно, объяснение, решение.

### 4.2 Оплата

1. Родитель выбирает план → `createOrder(planId, studentId)` (цена берётся из БД, не из клиента).
2. Адаптер провайдера создаёт платёж → redirect на страницу провайдера.
3. Возврат пользователя на `/parent/billing/return` **ничего не активирует** — только показывает статус.
4. Webhook `POST /api/webhooks/payments/{provider}` → проверка подписи → запись в `payment_events` (UNIQUE `provider, event_id`) → транзакция: `payments.status`, создание/продление `entitlements` → чек через кассу (очередь) → `audit_logs`.
5. Если webhook не пришёл — worker опрашивает статус платежа у провайдера (reconciliation) каждые 5 минут в течение 24 ч.

### 4.3 Отчёт родителю

pg-boss cron (ежедневно 03:00 Asia/Almaty) выбирает детей, у которых прошло ≥ 14 дней с последнего отчёта → `packages/reports` агрегирует → `parent_reports` → e-mail на языке родителя.

### 4.4 Истечение доступа

Доступ вычисляется по `entitlements.ends_at > now()` при каждом запросе — истечение не зависит от cron. Cron только отправляет напоминания (за 3 дня и в день окончания).

## 5. Модель контента

- Структура: учебная программа (`curricula`) → предмет + класс + четверть → раздел → темы. Распределение вводит методист; одна тема может стоять в нескольких программах.
- Темы: опубликованные тексты (`topic_contents`) отделены от черновиков (`topic_drafts`) по каждому языку. Ученики читают только опубликованное; правка черновика не меняет опубликованную версию до повторной публикации ([ADR-0006](docs/adr/0006-topic-drafts-and-publishing.md)).
- Fallback языка — явный: нет казахской версии → русская с пометкой; ключи переводов пользователю не показываются.
- Теория — Markdown + LaTeX (`src/lib/content/markdown.ts`): без «сырого» HTML, санитизация, затем KaTeX на сервере.
- Валидация контента — общие Zod-схемы `packages/content-schema` (те же лимиты, что в БД).
- Шаблоны задач (`task_templates.spec`) — этап 4.

## 6. Масштабирование

- MVP: 1 VM (8 vCPU/16 GB) для web+worker, отдельная VM/managed Postgres; ~5 000 одновременных при кэше каталога.
- Рост: горизонтально web (stateless), read-replica Postgres для аналитики, партиционирование `attempt_answers`/`audit_logs` по месяцам, материализованные агрегаты прогресса.
- Статика и бандлы лабораторий — CDN (без ПДн).

## 7. Окружения

| Окружение  | Где                        | Данные                          |
| ---------- | -------------------------- | ------------------------------- |
| local      | Docker (Supabase CLI)      | seed                            |
| preview    | Vercel/любой (опционально) | только синтетические            |
| staging    | облако РК                  | синтетические, sandbox платежей |
| production | облако РК                  | реальные                        |

Секреты — только переменные окружения / секрет-хранилище облака. Шаблон — [.env.example](.env.example).

## Внешние сервисы

| Назначение  | Кандидаты                                                     | Примечание                                          |
| ----------- | ------------------------------------------------------------- | --------------------------------------------------- |
| Облако РК   | PS Cloud, QazCloud, Hoster.kz                                 | нужны VM, S3-хранилище, бэкапы; выбрать по SLA/цене |
| Платежи     | Freedom Pay (PayBox), CloudPayments KZ, Halyk ePay, Kaspi Pay | договор ИП; начать с sandbox одного                 |
| Касса / ОФД | через провайдера или Webkassa / ReKassa                       | уточнить у бухгалтера                               |
| E-mail      | SMTP/транзакционный сервис (Unisender, Mailgun и др.)         | только e-mail родителя                              |
| SMS (опц.)  | Mobizon.kz                                                    |                                                     |
| TTS         | ElevenLabs (RU), Yandex SpeechKit, ISSAI KazakhTTS (KK)       | этап 9; только тексты контента                      |
| Мониторинг  | GlitchTip / Sentry self-hosted, Uptime Kuma                   | в РК                                                |
| Аналитика   | PostHog self-hosted / Umami                                   | без ПДн                                             |
| Код         | GitHub + Actions                                              |                                                     |
