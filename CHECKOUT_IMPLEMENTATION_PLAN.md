# План реализации: Checkout + Статусная машина заказов

## Контекст

Текущее состояние:
- Хранилище: in-memory (нет БД)
- 3 статуса: `created → submited → finished`
- Нет платёжной интеграции
- Нет формы оформления заказа

---

## 1. Статусная машина заказов

### Статусы и переходы

```
New (в корзине)
  │
  ▼ [пользователь нажал "Оформить"]
Waiting Payment (форма и редирект в банк)
  │
  ├─ [банк вернул success webhook] ──▶ Payment Process
  │                                         │
  │                                         ├─ [мы получили подтверждение] ──▶ In Progress
  │                                         │                                        │
  │                                         │                                        ├─ [товар собран] ──▶ Delivery
  │                                         │                                        │                        │
  │                                         │                                        │                        └─ [доставлен] ──▶ Done
  │                                         │
  │                                         └─ [банк вернул failure] ──▶ Failed
  │
  ├─ [пользователь отменил] ──▶ Canceled by User
  └─ [банк timeout / не пришёл webhook] ──▶ Failed (по cron)
```

**Допустимые переходы** (enforced на бэкенде, фронт не доверять):

| From | To | Actor |
|------|-----|-------|
| New | Waiting Payment | User |
| New | Canceled by User | User |
| Waiting Payment | Payment Process | Bank webhook |
| Waiting Payment | Failed | Cron (timeout) |
| Waiting Payment | Canceled by User | User (до редиректа в банк) |
| Payment Process | In Progress | Bank webhook (final confirm) |
| Payment Process | Failed | Bank webhook (decline) |
| In Progress | Delivery | Manager/system |
| Delivery | Done | Manager/system |
| Any (кроме Done/Failed/Canceled) | Failed | System/Manager |
| Any (кроме Done/Failed) | Canceled by Company | Manager |

Переходы, которые **запрещены**: любой обратный переход, Done → что-либо.

---

## 2. Структура данных

### Расширить `OrderRecord`

```typescript
interface OrderRecord {
  orderId: string;
  userId: string;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;                    // NEW: для timeout-логики
  products: OrderProduct[];
  promo?: PromoEntity;

  // Checkout fields (заполняются при переходе New → Waiting Payment)
  checkoutData?: {
    address: string;
    phone: string;
    deliveryAt: string;                 // ISO date
    comment?: string;
  };

  // Payment tracking
  paymentId?: string;                   // ID транзакции в банке
  paymentAttempts: number;              // счётчик попыток, default 0
  paymentInitiatedAt?: number;          // когда ушли в банк (для timeout)
}
```

### Новые типы статусов

```typescript
type OrderStatus =
  | 'new'
  | 'waitingPayment'
  | 'paymentProcess'
  | 'inProgress'
  | 'delivery'
  | 'done'
  | 'failed'
  | 'canceledByUser'
  | 'canceledByCompany';
```

---

## 3. API — новые эндпоинты

### 3.1 Checkout (начало оформления)

```
POST /api/order/:orderId/checkout
Body: { address, phone, deliveryAt, comment? }
Auth: JWT required

Действия:
1. Валидация: заказ существует, принадлежит пользователю, статус = 'new'
2. Валидация полей формы
3. Сохранить checkoutData в заказ
4. Перевести статус: new → waitingPayment
5. Инициировать платёж в банке, получить paymentUrl + paymentId
6. Сохранить paymentId, paymentInitiatedAt = now()
7. Вернуть { paymentUrl }

Response: { paymentUrl: string }
```

### 3.2 Webhook от банка

```
POST /api/webhooks/payment
Body: { paymentId, status: 'success' | 'failure', signature }
Auth: HMAC signature от банка (не JWT)

Действия:
1. Верифицировать HMAC подпись
2. Найти заказ по paymentId
3. Идемпотентность: если уже обработан — вернуть 200
4. success → waitingPayment/paymentProcess → paymentProcess/inProgress
5. failure → failed
6. Логировать только paymentId, НЕ card данные
```

### 3.3 Return URL (редирект после банка)

```
GET /api/order/:orderId/payment-return?status=success|failure
Auth: JWT required

Действия:
1. Не менять статус здесь — статус уже поменял webhook
2. Вернуть актуальный статус заказа
3. Фронт сам решает что показать по статусу

Почему не менять здесь: пользователь может не вернуться,
а webhook всегда придёт. Return URL — только для UX.
```

### 3.4 Отмена заказа

```
POST /api/order/:orderId/cancel
Auth: JWT required

Допустимо только в статусах: new, waitingPayment
После waitingPayment — только Canceled by Company (менеджером)
```

---

## 4. Защита банковских данных (PCI DSS)

**Ключевое правило: данные карты НИКОГДА не должны проходить через наш сервер.**

### Рекомендуемый подход: Hosted Payment Page / iframe банка

```
Фронт                   Наш бэкенд              Банк
  │                          │                     │
  │── POST /checkout ────────▶                     │
  │                          │── создать сессию ──▶│
  │                          │◀─ paymentUrl ───────│
  │◀── { paymentUrl } ───────│                     │
  │                          │                     │
  │── redirect ─────────────────────────────────▶  │
  │   (пользователь вводит карту прямо на          │
  │    странице/iframe банка)                      │
  │◀── redirect back ───────────────────────────── │
  │                          │◀── webhook ─────────│
```

**Что это даёт:**
- Наш сервер никогда не видит номер карты, CVV, срок
- PCI DSS compliance: scope значительно сужается
- Ответственность за шифрование данных карты — на банке

### Защита webhook-эндпоинта

```typescript
// Верификация HMAC подписи банка
function verifyBankWebhook(body: string, signature: string): boolean {
  const expected = hmac('sha256', BANK_WEBHOOK_SECRET, body);
  // Используем timingSafeEqual чтобы избежать timing attack
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}
```

- Endpoint принимает только с IP банка (whitelist)
- Rate limit на webhook endpoint
- Логировать: paymentId, статус, timestamp — но НЕ тело запроса целиком

---

## 5. Защита персональных данных (PII)

### Что является PII в нашем контексте

- Имя пользователя
- Телефон
- Адрес доставки
- Комментарий (может содержать PII)

### Меры защиты

**5.1 Передача данных**
- HTTPS везде (Nginx TLS termination)
- checkoutData никогда не логировать полностью

**5.2 Хранение**
- При реализации БД: address и phone шифровать at rest (AES-256)
- Или хранить в отдельной таблице с ограниченным доступом
- Не хранить PII в логах и error messages

**5.3 Доступ**
- Только владелец заказа может видеть свои checkoutData
- Менеджеры — только через отдельный admin API с аудит-логом

**5.4 Логирование (что запрещено)**

```typescript
// НЕЛЬЗЯ:
logger.info('Checkout data:', req.body); // содержит телефон/адрес

// МОЖНО:
logger.info('Checkout initiated', { orderId, userId, status: 'waitingPayment' });
```

**5.5 Срок хранения**
- PII (address, phone) — хранить только пока заказ активен + N дней по регуляции
- После Done/Failed/Canceled: обезличивать через cron (address → null)

---

## 6. Сохранность статусов при сбоях

### 6.1 Проблема: потеря статуса при падении сервиса

Текущий in-memory стор теряет все данные при перезапуске.
Для продакшена необходимо персистентное хранилище.

**Минимальный план для продакшена:**
```
In-memory → PostgreSQL / MongoDB
Каждый переход статуса → атомарная запись в БД с updatedAt
```

### 6.2 Идемпотентность переходов

```typescript
async function transitionOrderStatus(
  orderId: string,
  expectedCurrentStatus: OrderStatus,
  newStatus: OrderStatus
): Promise<boolean> {
  // Атомарный UPDATE с проверкой текущего статуса
  // (оптимистичная блокировка)
  const result = await db.order.updateOne(
    { orderId, status: expectedCurrentStatus },   // WHERE
    { status: newStatus, updatedAt: Date.now() }  // SET
  );
  return result.modifiedCount === 1;
  // Если 0 — статус уже изменён (параллельный запрос или webhook)
}
```

### 6.3 Сценарий: webhook пришёл, но бэкенд упал в середине обработки

```
Решение: два этапа с персистентностью между ними

1. Получить webhook → записать в БД "webhook received, paymentId=X"
2. Вернуть банку 200 (он не будет повторять)
3. Асинхронно обработать: найти заказ, перевести статус
4. Если бэкенд упал после шага 2 — при рестарте найти
   необработанные webhooks и доработать
```

### 6.4 Cron: заказы зависшие в Waiting Payment

```
Каждые N минут:
  SELECT * FROM orders 
  WHERE status = 'waitingPayment' 
    AND paymentInitiatedAt < now() - PAYMENT_TIMEOUT

  → перевести в Failed
  → уведомить пользователя (email/push)
```

### 6.5 Дублирование запросов (двойной клик "Оформить")

```typescript
// На фронте: дизейблить кнопку сразу после нажатия

// На бэкенде: idempotency key
POST /api/order/:orderId/checkout
Headers: Idempotency-Key: <uuid-from-client>

// Если запрос с тем же key уже выполнялся → вернуть тот же результат
// Хранить в Redis/кеше: idempotency_key → response, TTL 24h
```

---

## 7. Corner Cases

### 7.1 Пустая корзина при оформлении
- **Сценарий**: пользователь удалил все товары, нажал "Оформить"
- **Защита**: валидация `products.length > 0` перед checkout
- **Ответ**: `400 Bad Request: Cart is empty`

### 7.2 Товар кончился между "добавил в корзину" и "оформил"
- **Сценарий**: товар показывался доступным, но к моменту checkout его нет
- **Защита**: при checkout проверять наличие товара (когда будет реальный склад)
- **Ответ**: `409 Conflict: Product X is out of stock`, вернуть какие товары недоступны

### 7.3 Цена изменилась между корзиной и checkout
- **Сценарий**: товар был по одной цене, менеджер поменял цену
- **Защита**: фиксировать цену в момент добавления в корзину (`price` в `OrderProduct` уже есть)
- **Не пересчитывать цену при checkout** — использовать зафиксированную

### 7.4 Промокод истёк между применением и checkout
- **Сценарий**: промокод SAVE5 (expired) применён, пользователь нажал "Оформить"
- **Защита**: перепроверить валидность промокода при checkout
- **Ответ**: `400 Bad Request: Promo code has expired`, предложить продолжить без скидки

### 7.5 JWT истёк в процессе долгого оформления
- **Сценарий**: пользователь 25 минут заполнял форму, токен 24h — маловероятно, но возможно при "оставил вкладку"
- **Защита**: на фронте: до submit проверить exp токена, refresh если нужно
- **UX**: перед потерей формы предупредить "Сессия истекает, сохраните данные"

### 7.6 Пользователь не вернулся после редиректа в банк
- **Сценарий**: закрыл вкладку после оплаты, не вернулся на return URL
- **Защита**: webhook от банка придёт независимо — статус обновится
- **UX**: при следующем открытии корзины показать актуальный статус (polling на странице заказов)

### 7.7 Банк вернул неизвестный статус в webhook
- **Сценарий**: банк прислал `status: 'pending'` или незнакомый код
- **Защита**: whitelist известных статусов; неизвестный → логировать, оставить `waitingPayment`, поднять алёрт
- **Не переводить в Failed** автоматически — пусть решит человек

### 7.8 Дублирующий webhook от банка
- **Сценарий**: банк послал webhook дважды (retry при timeout нашего 200)
- **Защита**: идемпотентность по `paymentId`: если заказ уже в `inProgress` — вернуть 200, не трогать статус

### 7.9 Параллельный checkout одного заказа с двух устройств
- **Сценарий**: пользователь открыл два браузера, нажал "Оформить" одновременно
- **Защита**: атомарный UPDATE с проверкой статуса (optimistic locking) — второй запрос получит `409`
- **UX**: "Этот заказ уже оформляется. Обновите страницу."

### 7.10 Попытка оплатить чужой заказ
- **Сценарий**: подбор orderId в URL
- **Защита**: на бэкенде всегда проверять `order.userId === req.userId` (уже есть в коде, важно не забыть на новых эндпоинтах)

### 7.11 Replay attack на webhook
- **Сценарий**: злоумышленник перехватил и повторяет валидный webhook
- **Защита**: 
  - Проверять timestamp в webhook (`abs(now - webhook.timestamp) < 5min`)
  - Хранить использованные nonce/requestId 24h и отклонять повторы

### 7.12 Пользователь пытается отменить заказ в Payment Process
- **Сценарий**: деньги уже списаны (или в процессе), пользователь нажимает "Отмена"
- **Защита**: статус `paymentProcess` и выше — отмена запрещена через UI
- **Если нужен возврат**: только через менеджера и API возврата банка

### 7.13 Телефон / адрес в неверном формате
- **Сценарий**: пользователь вводит "мой адрес" вместо нормального адреса
- **Защита**: валидация на фронте + на бэкенде
  - phone: regex `/^\+?[0-9]{10,15}$/`
  - address: минимальная длина, обязательные поля (улица, дом, город)
  - deliveryAt: должна быть в будущем (>= tomorrow)

### 7.14 Дата доставки в прошлом
- **Сценарий**: пользователь выбрал вчерашний день
- **Защита**: `deliveryAt >= today + 1 day`; на фронте — datepicker с минимальной датой

### 7.15 XSS через поле comment
- **Сценарий**: `<script>alert(1)</script>` в комментарии
- **Защита**: 
  - Экранировать при выводе на фронте (React делает это по умолчанию)
  - Санитизировать на бэкенде (strip HTML теги)
  - Не хранить и не отдавать raw HTML

### 7.16 Потеря статуса при `errorTestMiddleware` (каждый 5-й запрос → 500)
- **Сценарий**: checkout запрос упал на 500 после того как checkoutData записана, но до инициации платежа
- **Защита**: transactional подход — либо всё (save + initPayment), либо откатить status обратно в 'new'
- **Минимум**: не менять статус до получения `paymentUrl` от банка

### 7.17 Зависший заказ в `paymentProcess` если банк не прислал финальный webhook
- **Сценарий**: первый webhook пришёл (pending), финальный так и не пришёл
- **Защита**: cron + ручная обработка менеджером; таймаут для `paymentProcess` тоже нужен

### 7.18 Массовая отмена заказов (Canceled by Company без уведомления)
- **Сценарий**: менеджер отменяет 100 заказов скриптом
- **Защита**: rate limit на endpoint отмены; аудит-лог с `managerId + reason`; уведомление пользователю

---

## 8. Порядок реализации (этапы)

### Этап 1: Фундамент
1. Расширить статусную машину (9 статусов) с защитой переходов
2. Добавить `checkoutData` и `paymentId` в модель заказа
3. `POST /api/order/:orderId/checkout` (без реального банка — mock)
4. Checkout форма на фронте (адрес, телефон, дата, комментарий)
5. Страница "Мои заказы" с polling статусов

### Этап 2: Платёж (mock → реальный банк)
1. Mock payment endpoint (симулирует банк: success/failure)
2. Webhook-обработчик с idempotency
3. Return URL handler
4. HMAC верификация webhook

### Этап 3: Устойчивость
1. Оптимистичная блокировка при переходах статусов
2. Cron для timeout'ов (waitingPayment → failed)
3. Idempotency key на checkout endpoint
4. Обработка дублирующих webhook'ов

### Этап 4: Защита данных
1. Шифрование PII в хранилище (при переходе на БД)
2. Очистка PII после завершения заказа
3. Аудит-лог для admin-операций

### Этап 5: UX и нотификации
1. Отмена заказа пользователем (до paymentProcess)
2. Email/push нотификации при изменении статуса
3. Страница статуса заказа с live-обновлением

---

## 9. Открытые вопросы для уточнения

1. **Какой банк/платёжный провайдер?** (Stripe, ЮKassa, Сбер, CloudPayments...) — от этого зависит формат webhook и redirect
2. **Нужен ли возврат средств** (refund) при Canceled by Company после оплаты?
3. **Как менеджер меняет статусы** — отдельный admin-интерфейс или тот же фронт?
4. **Уведомления** — email, SMS, push? Своя рассылка или внешний сервис?
5. **Переход к реальной БД** — в скоупе этого таска или in-memory достаточно?
6. **Максимальное время ожидания** для `waitingPayment` (15 мин? 24 часа?) — от этого зависит cron-логика
