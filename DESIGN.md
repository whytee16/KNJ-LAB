---
name: KNJ LAB
version: 1.0 (вариант A «Текущий, доведённый»)
source_of_truth: DESIGN_SYSTEM.md, packages/ui/src/styles/tokens.css
colors:
  light:
    bg: '#FAF6EF'
    surface: '#FFFFFF'
    surface-muted: '#F2ECE2'
    border: '#E4DCCF'
    text: '#1C1A17'
    text-muted: '#5E574D'
    accent: '#A84508'
    accent-hover: '#8F3A06'
    accent-contrast: '#FFFFFF'
    success: '#186A3B'
    danger: '#B53628'
    warning: '#8A5A12'
    info: '#2B6CB0'
    subject-algebra: '#4A4AC4'
    subject-geometry: '#0B6B61'
    subject-physics: '#A8380A'
  dark:
    bg: '#14120F'
    surface: '#1D1A16'
    surface-muted: '#26221D'
    border: '#3A342C'
    text: '#F3EEE6'
    text-muted: '#B3AA9C'
    accent: '#FF8A3D'
    accent-hover: '#FFA366'
    accent-contrast: '#14120F'
    success: '#4CC47F'
    danger: '#FF6B5C'
    warning: '#F0B44C'
    info: '#6AA8F0'
    subject-algebra: '#8F8FF0'
    subject-geometry: '#3CC2B1'
    subject-physics: '#FF8A4C'
typography:
  family: Inter Variable (самохостинг, кириллица и казахские буквы)
  display:
    { size: 32px → 48px, weight: 700, line-height: 1.08, tracking: -0.025em, class: type-display }
  h1: { size: 28px → 36px, weight: 700, line-height: 1.12, tracking: -0.02em, class: type-h1 }
  h2: { size: 22px → 28px, weight: 700, line-height: 1.2, tracking: -0.015em, class: type-h2 }
  h3: { size: 18px → 22px, weight: 600 }
  body: { size: 16px, line-height: 1.5 }
  small: 14px
  caption: 12px
rounded: { sm: 6px, md: 10px, lg: 16px, full: 9999px }
spacing: [4, 8, 12, 16, 24, 32, 48, 64]
elevation:
  card: '0 1px 2px rgb(28 26 23 / 0.04)'
  dark: только границы
components:
  button:
    {
      radius: md,
      height: 44px,
      weight: 600,
      variants: [primary, secondary, ghost],
      press: translateY(1px),
    }
  card: { radius: lg, border: 1px border, background: surface, shadow: card }
  badge: { radius: full, tint: 10 % цвета тона }
  subject-tile:
    { radius: lg, tint: 9 % цвета предмета, border: 25 % цвета предмета, text: цвет предмета }
  progress: { height: 8px, track: surface-muted, bar: цвет предмета или accent }
  feedback: { tint: 10 % success/danger, icon + text, aria-live: polite }
---

# KNJ LAB — DESIGN.md

Краткое описание визуального языка для людей и ИИ-агентов, в формате сборника awesome-design-md. Главный документ — [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). При расхождении прав DESIGN_SYSTEM.md, а значения токенов берутся из `packages/ui/src/styles/tokens.css`.

## Overview

Тёплая «бумажная» учебная среда для 7–11 классов: кремовый фон, тёмный текст, один терракотовый акцент. Серьёзно, спокойно, без мультяшности. Утверждённый владельцем вариант A (ноябрь 2026): прежняя палитра, наведён порядок в иерархии, линиях и формах.

## Colors

- Акцент `accent` — только для главного действия и фокуса. На одном экране одна primary-кнопка, остальные secondary или ghost.
- Цвета предметов (алгебра, геометрия, физика) — для меток, плиток и полос прогресса. Никогда для статусов «верно / неверно».
- Статусы `success / danger / warning / info` одинаковы во всех модулях, включая лаборатории. Статус всегда дублируется иконкой и текстом.
- Тонировки: 9–10 % цвета на `surface`. Все текстовые цвета проходят WCAG AA 4.5:1 на `bg`, `surface-muted` и этих тонировках.

## Typography

- Inter Variable, без внешних CDN.
- Заголовки страниц — классы `type-display` (главная), `type-h1` (страница), `type-h2` (подзаголовок страницы). Жирность 700, трекинг отрицательный, `text-wrap: balance`.
- Текст 16 px, вторичный 14 px, ничего мельче 12 px. Подписи в обычном регистре, без капслока.

## Layout

- Контейнер до 1200 px, поля 16 / 24 / 32 px.
- Первый экран главной: слева заголовок, подзаголовок, две кнопки (одна primary). Справа три плитки предметов.
- Кабинет: приветствие, плитки предметов класса, затем три колонки (тренажёры с прогрессом, лаборатории, результаты).

## Elevation

Разделение тонкими границами `border`. Тень карточки одна и очень лёгкая. В тёмной теме только границы. Больших мягких теней нет.

## Shapes

Радиусы 6 / 10 / 16 px и полностью круглые бейджи. Кнопки и поля — 10 px, карточки и плитки — 16 px.

## Components

- `Button` (`@knj/ui`): primary, secondary, ghost. Высота ≥ 44 px, при нажатии сдвиг на 1 px.
- `Card`: поверхность, граница, лёгкая тень.
- `Badge`: тон предмета или акцента на 10 % тонировке.
- `SubjectTile`: плитка предмета с линейной иконкой. Ссылка или блок.
- `Progress`: полоса 8 px с `role="progressbar"`.
- Блок проверки ответа в тренажёре: тонировка success или danger, значок ✓ / ✗ / ≈ и текст, `aria-live="polite"`.
- Лаборатории — по [GAME_TEMPLATE.md](GAME_TEMPLATE.md). Их стиль утверждён и меняется только с согласия владельца.

## Do's and Don'ts

Делать:

- использовать токены и классы шкалы, а не сырые цвета и размеры;
- одно главное действие на экран;
- проверять обе темы и ширину 390 px.

Не делать:

- градиенты, неон, фиолетовые акценты, эмодзи-иконки, капслок-надзаголовки;
- цвет предмета вместо статуса;
- подражать фирменному стилю чужих брендов. Из сборника берутся только формат и приёмы.

## Responsive

Брейкпоинты 640 / 768 / 1024 / 1280. Ниже 768 px всё в одну колонку. Сенсорные цели ≥ 44 px. Горизонтальной прокрутки страницы нет.

## Iteration Guide

1. Новый экран собирать из компонентов `@knj/ui` и классов `type-*`.
2. Новый цвет или размер — сначала в `tokens.css` и DESIGN_SYSTEM.md с проверкой контраста, потом в коде.
3. После изменений: `pnpm lint && pnpm typecheck && pnpm test` и e2e с axe.
