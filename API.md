# API — KNJ LAB

Версия 0.1. Внутренний API — **Server Actions** и **Route Handlers** Next.js. Публичного REST API на MVP нет. Все входные данные валидируются Zod; все ответы об ошибках — в едином формате.

## 1. Общие правила

- Каждое действие начинается с `authz.require(role, …)`; доступ к ученику — `authz.requireStudentAccess(studentId)` (сам ученик или родитель с `active` связью).
- Платный контент — `entitlements.assert(studentId, difficulty)`.
- Мутации с риском повторной отправки принимают `idempotencyKey` (UUID v4 от клиента).
- Rate limit (Postgres, `rate_limit_hit`, [ADR-0005](docs/adr/0005-rate-limiting-in-postgres.md)): лимиты auth — в таблице ниже; submitAnswer — 60/мин на ученика (этап 4); webhooks — без лимита, но с проверкой подписи.
- Ошибка: `{ ok: false, error: { code: 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'PAYWALL' | 'RATE_LIMITED' | 'CONFLICT' | 'INTERNAL', messageKey: string, fields?: Record<string,string> } }`. `messageKey` — ключ i18n, не текст.
- Успех: `{ ok: true, data }`.

## 2. Server Actions (по модулям)

### auth / accounts (реализовано, этап 2)

Все действия — Server Actions (`apps/web/src/features/auth/actions.ts`, `features/parent/actions.ts`), формы работают через `useActionState`, ответ — `FormState` с ключами i18n.

| Действие                                                       | Роль           | Описание                                                                                                   | Лимит                          |
| -------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `signIn(identifier, password, next)`                           | гость          | e-mail родителя или логин ученика; общий текст ошибки; редирект на `next` (только тот же язык) или кабинет | 10 / 10 мин на IP и на аккаунт |
| `registerParent(displayName, email, password, consent)`        | гость          | только при `REGISTRATION_ENABLED` и опубликованной политике; письмо подтверждения; согласие в `consents`   | 5 / час на IP                  |
| `requestPasswordReset(email)`                                  | гость          | одинаковый ответ для существующих и несуществующих адресов; ученикам письма не отправляются                | 3 / час на IP и на адрес       |
| `updatePassword(password, confirm)`                            | любой вошедший | после ссылки восстановления                                                                                |                                |
| `acceptPolicy(consent, next)`                                  | parent         | согласие с актуальной версией политики                                                                     |                                |
| `signOut()`                                                    | любой          |                                                                                                            |                                |
| `rememberLocale(locale)`                                       | любой вошедший | сохраняет язык интерфейса в профиле                                                                        |                                |
| `createChild(displayName, username, grade, password, consent)` | parent         | `auth.admin.createUser` → `register_student`; при ошибке созданный логин удаляется; не больше 10 детей     | 10 / сутки на родителя         |
| `setChildPassword(studentId, password, confirm)`               | parent         | только своему ребёнку (`assertParentOf`)                                                                   | 20 / час на родителя           |
| `deleteChild(studentId, confirmUsername)`                      | parent         | удаляет аккаунт ребёнка со всеми данными после ввода логина                                                |                                |

Не реализовано (позже): `inviteChild` (привязка второго родителя), отзыв согласия, изменение профиля.

### learning

| Действие                                                     | Роль           | Описание                                                               |
| ------------------------------------------------------------ | -------------- | ---------------------------------------------------------------------- |
| `getCurriculumTree({grade, subject})`                        | все            | дерево текущей программы ученика                                       |
| `getTopic({slug, locale})`                                   | все            | теория/формулы; платные секции — по entitlement                        |
| `startTrainer({topicId, difficulty})`                        | student        | создаёт `trainer_runs`                                                 |
| `getNextTask({runId})`                                       | student        | генерирует `task_instances`, возвращает условие без ответа             |
| `submitAnswer({instanceId, answer, timeMs, idempotencyKey})` | student        | проверка на сервере → `{isCorrect, partial, explanationKey, solution}` |
| `startTest({testId})` / `finishTest({attemptId})`            | student        | таймер считается на сервере (`started_at + time_limit`)                |
| `getResult({attemptId})`                                     | student/parent | разбор и рекомендации                                                  |
| `reportContentError({instanceId, message})`                  | student        | `content_reports`                                                      |
| `toggleFavorite({entityType, entityId})`                     | self           | справочник                                                             |
| `saveLabSession({labId, params, answers, durationS})`        | student        |                                                                        |

### parent

`listChildren()`, `getChildOverview({studentId, period})`, `listReports({studentId})`, `getReport({reportId})`.

### billing

| Действие                                               | Роль   | Описание                                        |
| ------------------------------------------------------ | ------ | ----------------------------------------------- |
| `listPlans({locale})`                                  | все    | только `is_active`                              |
| `createOrder({planId, studentId, offerConsent: true})` | parent | цена из БД; возвращает `redirectUrl` провайдера |
| `getOrderStatus({orderId})`                            | parent | для страницы возврата (ничего не активирует)    |
| `requestRefund({paymentId, reason})`                   | parent | создаёт заявку                                  |

### studio (реализовано, этап 3)

Server Actions в `apps/web/src/features/studio/*`. Каждое действие проверяет роль и `aal2` в приложении (`actingStaff()`), затем работает от имени пользователя, поэтому RLS и SQL-функции проверяют то же самое ещё раз.

| Действие                                                                                    | Роль             | Описание                                                                 |
| ------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| `createTopic(slug, subject, title)`                                                         | staff            | тема + черновик RU                                                       |
| `saveTopicDraft(topicId, contentLocale, …)`                                                 | staff            | сохраняет черновик; сообщает об ошибках LaTeX                            |
| `runTopicWorkflow(intent = submit / publish / requestChanges / unpublish)`                  | staff / reviewer | переходы статуса; публикация и отправка запрещены при ошибках в формулах |
| `createFormula`, `saveFormula`, `setFormulaStatus`, `deleteFormula`                         | staff / reviewer | формулы справочника; LaTeX и обозначения проверяются до сохранения       |
| `addSection`, `renameSection`, `moveSection`, `deleteSection`, `attachTopic`, `detachTopic` | reviewer, admin  | редактор КТП                                                             |
| `findUser(email)`, `changeRole(userId, role)`                                               | admin            | роли сотрудников; аудит                                                  |

### security (этап 3)

`startEnrollment()` (QR-код и секрет TOTP), `confirmEnrollment(factorId, code)`, `verifyMfa(code)` — лимит 10 попыток за 10 минут на пользователя.

### public content (этап 3)

`toggleFavorite(formulaId)` — любой вошедший пользователь. Чтение тем, каталога и справочника — Server Components от имени посетителя (RLS отдаёт только опубликованное).

### admin (позже)

Платежи, тарифы, аналитика — этапы 6–7.

## 3. Route Handlers

| Метод и путь                                   | Назначение                              |
| ---------------------------------------------- | --------------------------------------- |
| `POST /api/webhooks/payments/[provider]`       | приём уведомлений провайдера            |
| `GET /api/health`                              | liveness/readiness (без деталей наружу) |
| `GET /api/reference/search?q=&subject=&grade=` | поиск по справочнику (кэшируемый)       |

## 4. Контракт платёжного провайдера

```ts
interface PaymentProvider {
  code: string; // 'freedompay' | 'cloudpayments' | ...
  createPayment(o: {
    orderId: string;
    amountKzt: number;
    description: string;
    returnUrl: string;
    locale: 'ru' | 'kk';
  }): Promise<{ providerPaymentId: string; redirectUrl: string }>;
  verifyWebhook(req: { headers: Headers; rawBody: string }): Promise<VerifiedEvent | null>; // null → 401
  fetchStatus(providerPaymentId: string): Promise<PaymentStatus>; // reconciliation
  refund(providerPaymentId: string, amountKzt: number): Promise<{ status: PaymentStatus }>;
}
type VerifiedEvent = {
  eventId: string;
  providerPaymentId: string;
  status: PaymentStatus;
  amountKzt: number;
  raw: unknown;
};
```

Обработка webhook:

1. Сырой body → `verifyWebhook`; неверная подпись → 401 + лог (без payload ПДн).
2. `INSERT payment_events … ON CONFLICT DO NOTHING`; если дубликат → 200.
3. Сверка суммы и заказа; расхождение → статус `failed` + алерт.
4. Транзакция: обновить `payments`, при `succeeded` — создать `entitlements` (`starts_at = greatest(now(), max(ends_at))`), записать `audit_logs`.
5. Поставить задачу «выпустить чек» в очередь. Ответ 200.

Тестовая среда: адаптер `sandbox` провайдера (реальный sandbox, не имитация в коде) + локальный `fake` адаптер **только** для unit/e2e, недоступный в production (проверка `NODE_ENV` и feature flag при старте).

## 5. Интерфейсы прочих провайдеров

```ts
interface FiscalProvider {
  issueReceipt(p: {
    paymentId: string;
    amountKzt: number;
    item: string;
  }): Promise<{ fiscalId: string; url: string }>;
}
interface Mailer {
  send(m: { to: string; template: string; locale: string; data: object }): Promise<void>;
}
interface TtsProvider {
  synthesize(t: {
    text: string;
    locale: string;
    voice: string;
  }): Promise<{ audio: Uint8Array; mime: string }>;
}
```
