# ADR-0002: Монорепо Next.js + Supabase (Postgres/RLS)

Статус: предложено (2026-11-21)

## Решение

pnpm workspaces + Turborepo; `apps/web` (Next.js 16 App Router), `packages/*` (ui, i18n, content-schema, task-engine, physics, geometry, reports, payments), `supabase/` (миграции, pgTAP), `workers/` (pg-boss). Доступ к БД — через supabase-js с пользовательским JWT, чтобы RLS работал для каждого запроса; без ORM.

## Последствия

- Единый язык (TS), чистая логика тестируется отдельно, RLS — последняя линия защиты.
  − SQL-миграции пишутся вручную; сложные отчёты — через SQL-функции/views.

## Альтернативы

Отдельный backend (NestJS) — лишний слой для команды из 1–2 человек. Prisma/Drizzle — обход RLS через сервисное соединение повышает риск.
