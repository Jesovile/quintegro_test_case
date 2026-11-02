# Checkout — implementation plan

Each slice is a vertical piece (data -> API -> UI) that works end to end and can be demoed.
After every slice: lint + typecheck + tests -> code-reviewer + security-reviewer ->
manual check -> demo to the stakeholder.

Основание: [requirements.md](requirements.md), [design.md](design.md). Мобильная вёрстка и базовая a11y (подписи, ошибки у полей, клавиатура) входят в каждый срез с UI.

Порядок важен: каждый срез опирается на предыдущий. Отрезать можно только Slice 9.

## Slice 1 — Основа: статусы, деньги, единое хранилище
- [x] Data / status model changes: новые статусы, цены в целых USD, миграция сида, `OrderStatus` на backend и frontend
- [x] Service + validation (domain layer): `container.ts`, `pricing.ts`, `DomainError`; удаление `submitOrder`, `calculateOrderSum`, `console.log` в `updateOrder`
- [x] API (resolver/route): `Order.totals`, `extensions.code`, `requireUser`; удаление `orderSum`, `submitOrder`, REST `POST /api/order/:orderId` и `/sum`
- [x] UI: `types/order.ts`, `lib/money.ts`, `lib/orderStatus.ts`; `OrderSum` читает `order.totals`; кнопка "Submit Order" убрана до Slice 3
- [x] Tests (test-writer): настройка тестового раннера и backend-линта; AC-6.3
- [x] Review + fixes
- Checkpoint to demo: `/order` показывает целые цены (`$1,300`) и итог с сервера; статусы новые; данные REST и GraphQL совпадают.

## Slice 2 — Сохранение состава заказа
- [x] Data / status model changes: нет
- [x] Service + validation (domain layer): `updateProductAmount` и удаление разрешены только в `created`, код `ORDER_NOT_EDITABLE`; удаление последней позиции оставляет пустой заказ; отсутствующий товар не ломает список
- [x] API (resolver/route): `updateProductAmount`, `deleteProductFromOrder: Order!`
- [x] UI: `OrderList` читает кэш Apollo, изменения идут на сервер; `state-views.tsx` заменяет повторы состояний; проп `loading` у `Button`
- [x] Tests (test-writer): AC-6.1, AC-6.2
- [x] Review + fixes
- Checkpoint to demo: после перезагрузки `/order` количество и удалённые позиции сохраняются, заказ `deliver` изменить нельзя.

## Slice 3 — Вход в чекаут и каркас мастера
- [x] Data / status model changes: `orderStateMachine.ts`, `IOrderRepository.transition`
- [x] Service + validation (domain layer): `checkoutService`: `startCheckout`, `exitCheckout`, `ORDER_EMPTY`, проверка владельца
- [x] API (resolver/route): `startCheckout`, `exitCheckout`
- [x] UI: кнопка "Checkout" / "Continue checkout", `RequireAuth`, `/checkout/:orderId/:step?`, `CheckoutController`, `CheckoutStepper`, `OrderSummary`, заглушки шагов
- [x] Tests (test-writer): AC-1.1, AC-1.2, AC-1.3, AC-1.6, AC-6.4, AC-7.1
- [x] Review + fixes
- Checkpoint to demo: запуск чекаута, заказ заморожен, мастер показывает шаги и сводку, выход возвращает заказ в `created`.

## Slice 4 — Шаг Доставка и Гео-мок
- [x] Data / status model changes: `contact`, `addressRef`
- [x] Service + validation (domain layer): `integrations/interfaces.ts`, мок `IGeoService`, `checkoutValidation.ts`, `saveDelivery`, `Order.delivery`
- [x] API (resolver/route): `saveDelivery`, поле `delivery`, `VALIDATION_FAILED` с полями
- [x] UI: `form-field.tsx`, `lib/usStates.ts`, `useDeliveryForm`, `DeliveryStep`; блокировка перехода вперёд и по URL
- [x] Tests (test-writer): AC-1.4, AC-1.5, AC-2.1 – AC-2.5; персональные данные не попадают в логи
- [x] Review + fixes
- Checkpoint to demo: нельзя пройти дальше с неверными данными, ZIP `00000` отклоняется, `99999` даёт "Повторить", после перезагрузки данные на месте.

## Slice 5 — Промокод в чекауте
- [x] Data / status model changes: нет, используется `OrderRecord.promo`
- [x] Service + validation (domain layer): `applyPromo`, `removePromo`, `PROMO_NOT_FOUND`, `PROMO_EXPIRED`; `pricing.ts` учитывает скидку; `transformToDTO` отдаёт `promo`
- [x] API (resolver/route): `applyPromo`, `removePromo`
- [x] UI: поле промокода на шаге Оплата, скидка в `OrderSummary`
- [x] Tests (test-writer): AC-3.8, AC-3.9; округление скидки
- [x] Review + fixes
- Checkpoint to demo: `SAVE10` уменьшает итог, снимается обратно, `SAVE5` даёт понятную ошибку.

## Slice 6 — Оплата и банковский мок
- [x] Data / status model changes: `payment`
- [x] Service + validation (domain layer): мок `IBankGateway`, `payOrder`, ключ идемпотентности, `TOTAL_CHANGED`, `PAYMENT_*`
- [x] API (resolver/route): `payOrder`
- [x] UI: `ICardTokenizer` и мок, `usePaymentForm`, `PaymentStep`, новый итог при `TOTAL_CHANGED`
- [x] Tests (test-writer): AC-1.7, AC-3.1 – AC-3.7; одно списание при повторе и двух вкладках
- [x] Review + fixes
- Checkpoint to demo: тестовая карта переводит заказ в `paid`, отказ и таймаут обрабатываются, повтор не списывает дважды.

## Slice 7 — Обработка и страница успеха
- [x] Data / status model changes: `fulfillment`
- [x] Service + validation (domain layer): мок `IFulfillmentService`, `processingService.ts` (воркер), `retryProcessing`
- [x] API (resolver/route): `retryProcessing`, `processingFailed`
- [x] UI: `ProcessingStep` с опросом, `CheckoutSuccess` с кнопкой к каталогу (`/`)
- [x] Tests (test-writer): AC-4.1 – AC-4.5, AC-7.2; обработка не зависит от закрытой вкладки
- [x] Review + fixes
- Checkpoint to demo: полный путь от `/order` до страницы успеха, заказ в History со статусом `deliver`; сбой обработки можно повторить.

## Slice 8 — Отмена заказа
- [x] Data / status model changes: `cancelRequested`, `payment.refunded`
- [x] Service + validation (domain layer): `cancelOrder`, `refund`, `ORDER_NOT_CANCELLABLE`, `REFUND_FAILED`; воркер пропускает отменяемые заказы; возврат при оплате уже отменённого заказа
- [x] API (resolver/route): `cancelOrder`
- [x] UI: `CancelOrderDialog` в мастере и в History, экран отменённого заказа
- [x] Tests (test-writer): AC-5.1 – AC-5.6, AC-7.3; гонка отмены и завершения обработки
- [x] Review + fixes
- Checkpoint to demo: отмена в `checkout` без возврата, в `paid` и `processing` — с возвратом, в `deliver` недоступна.

## Slice 9 — Расширенная a11y (можно отрезать)
- [ ] Data / status model changes: нет
- [ ] Service + validation (domain layer): нет
- [ ] API (resolver/route): нет
- [ ] UI: перенос фокуса между шагами, `aria-live` для статусов, проверка скринридером
- [ ] Tests (test-writer): клавиатурный проход мастера
- [ ] Review + fixes
- Checkpoint to demo: весь чекаут проходится с клавиатуры, смена шага и статуса озвучивается.

## Final
- [ ] e2e scenarios (e2e-tester): основной, альтернативные и прерванные сценарии из `requirements.md`, включая мобильную ширину 360 px
- [ ] Polish (cut first if time is short)

## Follow-ups
- Изменение заказа во время чекаута: решение заказчика, вне v1.
- Каталог и создание нового заказа: вне v1, после успеха вкладка Current пуста.
- Статус после `deliver` и трекинг: вне v1.
- Реальные банк, Гео и служба обработки: подключаются по контрактам из `requirements.md`.
- Переход на центы: правило `CLAUDE.md` о минорных единицах не применяется по решению заказчика, вернуться при появлении дробных цен.
- Пароли в открытом виде, секрет по умолчанию, токен в `localStorage`, `/reset/orders` без авторизации: проблемы вне фичи, нужны отдельные задачи.
- `backend/.env` в git: проверить содержимое, при необходимости сменить секрет и убрать файл из репозитория.
- Счётчик в `CurrentOrder.tsx`: заглушка, не связан с заказом.
- Находки ревью Slice 1, принято решение не исправлять сейчас:
  - `PreviouslyOrdered` дублирует доменные типы: не влияет на чекаут, правится вместе с компонентом.
  - Swagger не описывает `totals`: REST не основной API.
  - `noCheck: true` в `tsconfig`: `npm run build` не проверяет типы, тесты попадают в `dist`; проверка идёт через `npm run typecheck`.
  - Резолвер `promo` сравнивает текст ошибки: заменить типизированной причиной в Slice 5.
  - `jwt.verify` приводится к типу без проверки: сейчас безвредно.
  - Ограничить скидку 0..100 в `pricing.ts`: в Slice 5, при привязке промокода.
  - Разбор токена дублируется в REST и GraphQL: REST не расширяется.
  - Вкладки `/order` без навигации стрелками: в Slice 9.
  - Мёртвая ссылка в `PreviouslyOrdered`: в Polish.
  - Запрос `promo` без авторизации, вход без лимита попыток: нужен rate limit.
  - В логах ошибок нет сообщения и стека: нужен структурированный логгер.
  - Интроспекция GraphQL в production, `/graphql` недоступен в первые миллисекунды, неверный комментарий в `errorTestMiddleware`: мелочи.
- Находки ревью Slice 2, по решению отложены (срез закоммичен вместе со Slice 1 в `5e99064`):
  - Заказ, изменённый в другой вкладке, остаётся редактируемым в UI до перезагрузки: перечитывать заказы при `ORDER_NOT_EDITABLE` (расходится с AC-6.1).
  - Быстрая правка двух позиций: старый ответ может затереть кэш; блокировать весь заказ на время мутации.
  - Клик по корзине сразу после ввода количества не срабатывает с первого раза.
  - Ошибка удаления остаётся на экране после успешной правки количества.
  - `disabled` на время запроса сбрасывает фокус клавиатуры.
  - Количество вне 1..10 молча приводится к диапазону; правка отсутствующего `productId` отвечает успехом.
  - REST 409 без `code`, маппинг ошибки в контроллере.
  - Подсказки "Did you mean" в ошибках валидации GraphQL.
- Находки ревью Slice 3, по решению отложены:
  - UI-часть AC-1.3, AC-6.4, AC-7.1 не покрыта автотестами: нужна testing-library; проверено вручную в браузере.
  - Ключ токена `auth_token` используется напрямую в `UserProfile.tsx` мимо `lib/auth.ts`.
  - Без токена REST отвечает 403, а не 401.
- Находки ревью Slice 4, по решению отложены:
  - Правила полей доставки и список штатов продублированы во frontend и backend; типы `DeliveryInput` и `Delivery` объявлены в сервисах, а не в `types/entities.ts`.
  - Сервер принимает телефон с посторонними символами вокруг цифр; хранятся только цифры.
  - Сценарии "Гео-сервис недоступен при загрузке шага" и "адрес пропал" проверены тестами backend, в браузере не воспроизводились: мок не умеет отказывать на чтении.
- Находки ревью Slice 5, по решению отложены:
  - Заменить применённый промокод можно только через "Remove", хотя сервер поддерживает замену напрямую.
  - Нет подсказки о регистре: `save10` даёт "does not exist".
- Для Slice 6 (из ревью Slice 4 и 5): сумму к списанию брать только из серверного расчёта, промокод и наличие адреса в Гео-сервисе проверять заново в момент оплаты.
- Остаточные риски Slice 6 (мок банка отвечает мгновенно, реальный банк может иначе):
  - Попытка, о которой банк ничего не знает, снимается при правке заказа. Если её списание всё же дойдёт до банка позже, а запрос оплаты к тому моменту уже оборвался, возврата не будет: нужна сверка с банком по `paymentId` в фоне.
  - Платежи из `refundsPending` пока никто не возвращает повторно: нужна фоновая задача (связано с Slice 8).
  - UI оплаты (блокировка кнопки, "Try again", обновление итога при `TOTAL_CHANGED`) проверен вручную, компонентных тестов нет.
- Находки ревью Slice 7, по решению отложены:
  - Воркер обходит заказы последовательно: при недоступной службе каждый заказ задерживает проход до таймаута (5 с).
  - Нет ограничения числа и частоты повторов обработки на заказ.
  - Мок службы обработки хранит задания в памяти без очистки; после перезапуска неизвестное задание считается сбоем.
  - Блокировка параллельных повторов (`retrying`) живёт в памяти процесса: при нескольких экземплярах backend нужен признак в хранилище.
- Решения Slice 8:
  - В контракт `IFulfillmentService` добавлен `cancel(jobId)`: без него отмену в `processing` (AC-5.2) нельзя сделать так, чтобы отменённый заказ не ушёл в доставку.
  - Код отложенного возврата при оплате переименован в `REFUND_PENDING`; `REFUND_FAILED` означает неудачную отмену (AC-5.3).
- Остаточные риски Slice 8:
  - Неожиданная ошибка банка при возврате считается отказом (`REFUND_FAILED`), хотя деньги могли вернуться: сверка с банком выполняется только при таймауте или недоступности.
  - Если задание обработки не удалось остановить после позднего старта, это только логируется: нужна ручная проверка.
  - Блокировка параллельных отмен (`inFlight`) живёт в памяти процесса, как и в обработке.
  - UI диалога отмены (Esc, фокус, закрытие только после отмены) проверен вручную, компонентных тестов нет.
