# KNJ LAB

**Тренируйся. Понимай. Решай.** — двуязычная (RU/KK) цифровая лаборатория алгебры, геометрии и физики для учеников 7–11 классов Казахстана, с кабинетом родителя и будущим модулем подготовки к ЕНТ.

> Статус: **Этап 1 — фундамент.** Монорепо, CI, дизайн-токены, RU/KK, главная страница. Регистрация, контент и оплата — следующие этапы ([ROADMAP.md](ROADMAP.md)).

## Быстрый старт

Требования: Node.js ≥ 22, pnpm 10 (`corepack enable`). Для локальной БД (с этапа 2) — Docker.

```bash
pnpm install
cp .env.example .env.local   # значения по умолчанию подходят для локального запуска
pnpm dev                     # http://localhost:3000 → /ru
```

| Команда                        | Что делает                            |
| ------------------------------ | ------------------------------------- |
| `pnpm lint` / `pnpm typecheck` | ESLint и TypeScript во всех пакетах   |
| `pnpm test`                    | unit-тесты (Vitest)                   |
| `pnpm i18n:check`              | полнота словарей RU/KK                |
| `pnpm build`                   | production-сборка                     |
| `pnpm test:e2e`                | Playwright: RU/KK × 390/768/1440, axe |
| `pnpm db:start`                | локальный Supabase (Docker)           |
| `pnpm format`                  | Prettier                              |

## Структура

```
apps/web            Next.js (App Router): маршруты /ru, /kk, главная, 404, /api/health
packages/ui         дизайн-токены и базовые компоненты
packages/i18n       локали, словари ru/kk, проверка полноты
supabase/           конфигурация локального стека, миграции и pgTAP (с этапа 2)
docs/adr/           архитектурные решения
```

## Документы

| Документ                             | Содержание                                               |
| ------------------------------------ | -------------------------------------------------------- |
| [PRD.md](PRD.md)                     | Требования к продукту, роли, сценарии, MVP               |
| [ARCHITECTURE.md](ARCHITECTURE.md)   | Архитектура, стек, структура репозитория, инфраструктура |
| [DATABASE.md](DATABASE.md)           | Схема БД, RLS, индексы                                   |
| [API.md](API.md)                     | Серверные действия, Route Handlers, webhook-контракт     |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Токены, типографика, компоненты, состояния               |
| [GAME_TEMPLATE.md](GAME_TEMPLATE.md) | Единый шаблон лабораторий и мини-игр                     |
| [I18N.md](I18N.md)                   | Локализация RU/KK (EN позже), процесс перевода           |
| [ROADMAP.md](ROADMAP.md)             | Этапы разработки, план тестирования, риски               |
| [SECURITY.md](SECURITY.md)           | Безопасность, ПДн несовершеннолетних, платежи            |
| [CONTRIBUTING.md](CONTRIBUTING.md)   | Правила разработки                                       |
| [AGENTS.md](AGENTS.md)               | Инструкции для AI-агентов                                |
| [docs/adr/](docs/adr/)               | Архитектурные решения (ADR)                              |

## Ключевые решения

- Персональные данные хранятся и обрабатываются **в Казахстане** ([ADR-0001](docs/adr/0001-kz-data-residency.md)).
- Монорепо: Next.js + self-hosted Supabase (Postgres + RLS) ([ADR-0002](docs/adr/0002-monorepo-nextjs-supabase.md)).
- Геометрия/графики без GeoGebra/Desmos до получения коммерческой лицензии ([ADR-0003](docs/adr/0003-geometry-libs-licensing.md)).
- Тарифы MVP — фиксированные сроки без автосписания ([ADR-0004](docs/adr/0004-fixed-term-passes.md)).
