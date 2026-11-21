# API — KNJ LAB

Версия 0.1. Внутренний API — **Server Actions** и **Route Handlers** Next.js. Публичного REST API на MVP нет. Все входные данные валидируются Zod; все ответы об ошибках — в едином формате.

## 1. Общие правила
- Каждое действие начинается с `authz.require(role, …)`; доступ к ученику — `authz.requireStudentAccess(studentId)` (сам ученик или родитель с `active` связью).
- Платный контент — `entitlements.assert(studentId, difficulty)`.
- Мутации с риском повторной отправки принимают `idempotencyKey` (UUID v4 от клиента).
- Rate limit (Redis): auth — 5/мин на IP+логин; submitAnswer — 60/мин на ученика; webhooks — без лимита, но с проверкой подписи.
- Ошибка: `{ ok: false, error: { code: 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'PAYWALL' | 'RATE_LIMITED' | 'CONFLICT' | 'INTERNAL', messageKey: string, fields?: Record<string,string> } }`. `messageKey` — ключ i18n, не текст.
- Успех: `{ ok: true, data }`.

## 2. Server Actions (по модулям)

### auth / accounts
| Действие | Роль | Описание |
|---|---|---|
| `registerParent({email, password, locale, consents})` | гость | создаёт родителя + записи `consents` |
| `createChild({displayName, grade, username, password})` | parent | создаёт ученика, связь `active`, согласие представителя |
| `inviteChild({code})` / `acceptInvite` | parent/student | привязка существующего аккаунта |
| `updateProfile({displayName, locale, grade})` | self | |
| `requestAccountDeletion({studentId})` | parent | очередь на анонимизацию |

### learning
| Действие | Роль | Описание |
|---|---|---|
| `getCurriculumTree({grade, subject})` | все | дерево текущей программы ученика |
| `getTopic({slug, locale})` | все | теория/формулы; платные секции — по entitlement |
| `startTrainer({topicId, difficulty})` | student | создаёт `trainer_runs` |
| `getNextTask({runId})` | student | генерирует `task_instances`, возвращает условие без ответа |
| `submitAnswer({instanceId, answer, timeMs, idempotencyKey})` | student | проверка на сервере → `{isCorrect, partial, explanationKey, solution}` |
| `startTest({testId})` / `finishTest({attemptId})` | student | таймер считается на сервере (`started_at + time_limit`) |
| `getResult({attemptId})` | student/parent | разбор и рекомендации |
| `reportContentError({instanceId, message})` | student | `content_reports` |
| `toggleFavorite({entityType, entityId})` | self | справочник |
| `saveLabSession({labId, params, answers, durationS})` | student | |

### parent
`listChildren()`, `getChildOverview({studentId, period})`, `listReports({studentId})`, `getReport({reportId})`.

### billing
| Действие | Роль | Описание |
|---|---|---|
| `listPlans({locale})` | все | только `is_active` |
| `createOrder({planId, studentId, offerConsent: true})` | parent | цена из БД; возвращает `redirectUrl` провайдера |
| `getOrderStatus({orderId})` | parent | для страницы возврата (ничего не активирует) |
| `requestRefund({paymentId, reason})` | parent | создаёт заявку |

### studio (content_manager / reviewer)
CRUD черновиков: `upsertTopicDraft`, `upsertTaskTemplateDraft`, `previewTemplate({templateId, seeds: number[]})` (прогон генератора + проверка ОДЗ), `submitForReview`, `publish` (reviewer), `upsertTranslation`, `approveTranslation` (reviewer), `uploadMedia`.

### admin
`listUsers`, `setRole` (аудит), `upsertCurriculum`, `moveCurriculumNode`, `upsertPlan`, `approveRefund`, `grantEntitlement` (ручная выдача, аудит, обязательная причина), `getMetrics({from, to})`.

## 3. Route Handlers
| Метод и путь | Назначение |
|---|---|
| `POST /api/webhooks/payments/[provider]` | приём уведомлений провайдера |
| `GET /api/health` | liveness/readiness (без деталей наружу) |
| `GET /api/reference/search?q=&subject=&grade=` | поиск по справочнику (кэшируемый) |

## 4. Контракт платёжного провайдера
```ts
interface PaymentProvider {
  code: string;                                   // 'freedompay' | 'cloudpayments' | ...
  createPayment(o: {orderId: string; amountKzt: number; description: string;
                    returnUrl: string; locale: 'ru'|'kk'}): Promise<{providerPaymentId: string; redirectUrl: string}>;
  verifyWebhook(req: {headers: Headers; rawBody: string}): Promise<VerifiedEvent | null>; // null → 401
  fetchStatus(providerPaymentId: string): Promise<PaymentStatus>;                         // reconciliation
  refund(providerPaymentId: string, amountKzt: number): Promise<{status: PaymentStatus}>;
}
type VerifiedEvent = { eventId: string; providerPaymentId: string; status: PaymentStatus; amountKzt: number; raw: unknown };
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
interface FiscalProvider { issueReceipt(p: {paymentId: string; amountKzt: number; item: string}): Promise<{fiscalId: string; url: string}> }
interface Mailer        { send(m: {to: string; template: string; locale: string; data: object}): Promise<void> }
interface TtsProvider   { synthesize(t: {text: string; locale: string; voice: string}): Promise<{audio: Uint8Array; mime: string}> }
```
