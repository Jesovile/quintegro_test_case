# Checkout — design

Основание: [requirements.md](requirements.md), правила из `CLAUDE.md`. Новых зависимостей нет.

## Данные и статусная машина

`backend/src/types/entities.ts`:

```ts
type OrderStatus = 'created' | 'checkout' | 'paid' | 'processing' | 'deliver' | 'cancelled';

interface OrderRecord {
  orderId: string; userId: string; status: OrderStatus; createAt: number;
  products: { id: string; amount: number; price: number }[]; // price — целые USD
  promo?: PromoEntity;
  contact?: { fullName: string; email: string; phone: string };
  addressRef?: string;
  payment?: { idempotencyKey: string; paymentId?: string; totalUsd?: number; refunded?: boolean };
  fulfillment?: { jobId: string; failed: boolean };
  cancelRequested?: boolean;
}
```

Переходы — одна таблица в `services/orderStateMachine.ts`:

| Из | В | Кто вызывает |
|---|---|---|
| `created` | `checkout` | `startCheckout` |
| `checkout` | `created` | `exitCheckout` |
| `checkout` | `paid` | `payOrder` |
| `paid` | `processing` | `ProcessingWorker` |
| `processing` | `deliver` | `ProcessingWorker` |
| `checkout`, `paid`, `processing` | `cancelled` | `cancelOrder` |

Гонки закрываются методом репозитория `IOrderRepository.transition(orderId, from, patch): OrderRecord | null`: он проверяет статус и применяет изменения одной синхронной операцией.

- **Отмена с возвратом:** сначала `cancelRequested = true`, затем `refund`, затем `cancelled`. Воркер пропускает заказы с этим флагом, поэтому заказ не уйдёт в `deliver` во время возврата. При сбое возврата флаг снимается.
- **Оплата:** `idempotencyKey` создаётся при первой попытке и меняется только после отказа банка, поэтому повторы и вторая вкладка дают одно списание.
- **Отмена во время списания:** если банк подтвердил оплату, а заказ уже `cancelled`, сервис сразу делает `refund`.
- **Миграция сида:** `submited -> processing`, `finished -> deliver`, цены `1300`, `900`, `200`, `600`.

## GraphQL API

Основной API. Деньги — `Int`, валюта отдаётся явно.

```graphql
enum OrderStatus { created checkout paid processing deliver cancelled }
enum Currency { USD }

type OrderTotals { subtotal: Int!  discount: Int!  total: Int!  currency: Currency! }
type UsAddress { line1: String!  line2: String  city: String!  state: String!  zip: String! }
type Delivery { fullName: String!  email: String!  phone: String!  address: UsAddress! }

# дополнение к существующему типу Order; поле OrderItem.price становится Int!
extend type Order {
  totals: OrderTotals!
  delivery: Delivery          # адрес запрашивается у Гео-сервиса только при выборе этого поля
  deliverySaved: Boolean!     # контакты и адрес сохранены; открывает шаг Payment без запроса к Гео-сервису
  processingFailed: Boolean!
}

input UsAddressInput { line1: String!  line2: String  city: String!  state: String!  zip: String! }
input DeliveryInput { fullName: String!  email: String!  phone: String!  address: UsAddressInput! }
input PayOrderInput { cardToken: String!  expectedTotal: Int! }

type User { id: ID!  name: String! }
extend type Query { me: User! }   # имя для предзаполнения формы доставки

extend type Mutation {
  updateProductAmount(orderId: ID!, productId: ID!, amount: Int!): Order!
  startCheckout(orderId: ID!): Order!
  exitCheckout(orderId: ID!): Order!
  saveDelivery(orderId: ID!, input: DeliveryInput!): Order!
  applyPromo(orderId: ID!, code: String!): Order!
  removePromo(orderId: ID!): Order!
  payOrder(orderId: ID!, input: PayOrderInput!): Order!
  retryProcessing(orderId: ID!): Order!
  cancelOrder(orderId: ID!): Order!
}
```

- Удаляются: `orderSum`, `submitOrder`, `ProductInput`. `deleteProductFromOrder` становится `Order!` и получает проверку статуса. Удаление последней позиции оставляет пустой заказ вместо `null`.
- Все мутации чекаута идемпотентны: если заказ уже в целевом статусе, возвращается заказ.
- Ошибки: коды из `requirements.md` в `extensions.code`; для `VALIDATION_FAILED` также `extensions.fields: [{ field, message }]`.

REST: `POST /api/order/:orderId` и `POST /api/order/:orderId/sum` удаляются вместе со Swagger-описанием. Остальные маршруты работают через те же сервисы и подчиняются тем же проверкам.

## Backend

| Файл | Ответственность |
|---|---|
| `src/container.ts` | Единственное место сборки репозиториев, сервисов и реализаций интеграций. REST и GraphQL получают одни экземпляры |
| `services/orderService.ts` | Чтение, DTO, изменение состава только в `created`. Товар, отсутствующий в каталоге, не ломает список |
| `services/checkoutService.ts` | Правила чекаута: переходы, доставка, промокод, отмена, владелец заказа |
| `services/paymentService.ts` | Оплата: сумма только с сервера, проверка `expectedTotal` (`TOTAL_CHANGED`), наличие адреса, попытки оплаты, сверка с банком и возвраты (см. ниже) |
| `services/pricing.ts` | Чистая функция расчёта `subtotal`, `discount`, `total` по данным заказа |
| `services/checkoutValidation.ts` | Правила полей, справочник штатов США |
| `services/orderStateMachine.ts` | Таблица разрешённых переходов |
| `services/processingService.ts` | Фоновый воркер (запускается в `App.listen`) раз в секунду берёт заказы в `paid` и `processing`, запускает и проверяет `IFulfillmentService`; работает на сервере, поэтому не зависит от открытой вкладки. Заказ завершает только текущее задание. Недоступность службы откладывает шаг до следующего прохода. Здесь же `retryProcessing` |
| `errors/domainError.ts` | `DomainError(code, fields?)` — типизированные ошибки сервисов |
| `graphql/errors.ts` | Одно место преобразования `DomainError` в `ApolloError`; прочие ошибки становятся `INTERNAL` без деталей |
| `graphql/resolvers.ts` | Только разбор входа, `requireUser(context)`, вызов сервиса. Типы аргументов вместо `any` |
| `integrations/interfaces.ts` | `IGeoService`, `IBankGateway`, `IFulfillmentService`, `withTimeout` |
| `integrations/mock/*` | Моки: асинхронные, с задержкой и сбоями |

`console.log` в `updateOrder` удаляется.

**Попытка оплаты.** `payment` без `paymentId` — попытка в процессе: ключ идемпотентности и сумма записываются до списания одним синхронным шагом, поэтому параллельные запросы делят ключ.
- Пока попытка не завершена, заказ заморожен: выход из чекаута, промокод и доставка сначала вызывают `PaymentService.settlePendingPayment`. Банк подтвердил списание этой суммы, без возврата: заказ становится `paid`, правка отклоняется (`ORDER_NOT_EDITABLE`). Отказ, возврат или банк ничего не получал: попытка снимается, правка проходит.
- Если правка записывается в момент, когда другой запрос начал оплату, она отклоняется (`PAYMENT_IN_PROGRESS`).
- Списание засчитывается только для текущей попытки. Списание по снятой попытке (заказ изменён, отменён или вышел из чекаута) возвращается: клиент получает `PAYMENT_REFUNDED`, а если возврат не подтвердился, `REFUND_FAILED`, и платёж сохраняется в `refundsPending` для повтора.
- Повтор после отказа или возврата идёт с новым ключом; повтор после потерянного ответа — с тем же.

**Гео-сервис в `saveDelivery`:** повтор с теми же контактами и адресом не вызывает проверку адреса; при замене адреса старый удаляется, при неудачной записи удаляется новый. Таймаут и недоступность дают `GEO_UNAVAILABLE`, любая другая ошибка остаётся `INTERNAL`. Если адрес по `addressRef` пропал, чтение доставки даёт `ADDRESS_NOT_FOUND`; в Slice 6 оплата должна проверять, что адрес на месте.

**Сценарии моков:**

| Значение | Результат |
|---|---|
| Карта `4111 1111 1111 1111` | успех |
| Карта `4000 0000 0000 0002` | отказ банка |
| Карта `4000 0000 0000 0119` | таймаут |
| ZIP `00000` | адрес отклонён |
| ZIP `99999` | Гео-сервис недоступен |
| Адрес, в котором `line1` содержит `FAIL` | сбой обработки |

## Frontend

**Маршруты:** `/checkout/:orderId/:step?`, где `step` — `delivery`, `payment`, `processing`, `success`. Закрыты новым `RequireAuth`, который при отсутствии токена ведёт на `/login` с возвратом.

**Контроллер:** `pages/CheckoutPage.tsx` рендерит `components/checkout/CheckoutController.tsx`. Только он знает о шагах: загружает заказ, вычисляет самый дальний доступный шаг по статусу и наличию контактов, делает redirect при недоступном URL и выбирает шаг. Шаги получают `order` и колбэки и друг о друге не знают.

| Статус заказа | Что показывает контроллер |
|---|---|
| `created` | redirect на `/order` |
| `checkout` | `delivery`; `payment`, если доставка сохранена |
| `paid`, `processing` | `processing` с опросом `order` раз в 2 с |
| `deliver` | `success` |
| `cancelled` | сообщение об отмене и ссылка на `/order` |

Ошибки опроса не прерывают шаг: случайный 500 ожидаем, ошибка показывается только после нескольких неудач подряд.

**Компоненты `components/checkout/`:** `CheckoutStepper` (`<nav>` со ссылками), `OrderSummary`, `DeliveryStep`, `PaymentStep`, `ProcessingStep`, `CheckoutSuccess`, `CancelOrderDialog` на нативном `<dialog>`: закрытие по Esc из коробки, новая зависимость не нужна.

**Формы:** библиотеки в проекте нет, поэтому по одному хуку на форму: `useDeliveryForm`, `usePaymentForm`. Валидация при отправке, подсветка неверных полей, отметка обязательных. Кнопка заранее не отключается. Серверный `VALIDATION_FAILED` раскладывается по полям.

**Общие компоненты и модули:**

| Модуль | Назначение |
|---|---|
| `components/ui/state-views.tsx` | `LoadingState`, `ErrorState` с повтором, `EmptyState`; ими же заменяются повторы в `OrderList` |
| `components/ui/form-field.tsx` | Подпись, связанная с полем, признак обязательности, текст ошибки |
| `components/ui/button.tsx` | Новый проп `loading` |
| `types/order.ts` | Доменные типы вместо локальных в `OrderList` |
| `lib/money.ts` | `formatUsd`; заменяет `toFixed(2)` в `OrderListItem` и `OrderSum` |
| `lib/orderStatus.ts` | Подписи статусов, `isCurrentOrder`, `canCancel` |
| `lib/usStates.ts` | Справочник штатов |
| `lib/graphqlErrors.ts` | Получение кода ошибки и текста для пользователя |
| `integrations/cardTokenizer.ts` | `ICardTokenizer` и мок |

`graphql/*`: документы типизируются через `TypedDocumentNode`, кодогенерации в проекте нет.

**Данные карты:** мок `ICardTokenizer` работает в браузере и по номеру тестовой карты возвращает непрозрачный токен, поэтому карта не покидает браузер. Реальный провайдер заменит только эту реализацию. Обновлено в `requirements.md`: `tokenizeCard` перенесён из `IBankGateway`.

**Изменения в `/order`:**

- `OrderList`: вкладка Current включает `checkout`, History — остальные статусы. Заказ читается из кэша Apollo, локальная копия `orders` убирается.
- Изменение количества сейчас только локальное — оно начинает ходить на сервер, иначе чекаут покажет другой состав. Удаление уже идёт на сервер из `OrderListItem`.
- Кнопка "Submit Order" заменяется на "Checkout" или "Continue checkout"; она запускает `startCheckout` и открывает мастер. Перенос кнопки из `OrderListItem` на уровень заказа снимает проп `onSubmitOrder`.
- `OrderSum` показывает `order.totals` вместо запроса `orderSum`.
- В History у `paid` и `processing` появляется отмена.

Адаптивность: одна колонка до `md`, сводка заказа под формой; на десктопе сводка справа. `apollo/client.ts`: `typePolicies` с `keyFields: ['orderId']`, логирование ошибок остаётся без `variables`, чтобы персональные данные не попадали в консоль.

## Отклонения от правил

**Деньги.** `CLAUDE.md` требует целых минорных единиц и валюты, заказчик подтвердил целые доллары; отклонение согласовано. Значения целые, плавающей точки нет, валюта передаётся явно. Расчёты и форматирование собраны в `pricing.ts` и `money.ts`, поэтому переход на центы затронет их, сид и контракт `Int`-полей.

## Что не проверяется автоматически

В проекте нет тестового раннера, а в backend нет линтера. `/slice-check` требует lint, typecheck и тесты, поэтому настройка раннера входит в первый срез плана.
