import { expect, test } from '@playwright/test'
import { gql, orderState, resetOrders, saveDeliveryApi, settle, signIn, startCheckoutApi, VALID_DELIVERY } from './helpers'

// Runs on its own backend (see playwright.fail-cancel.config.ts). A failed fulfillment job keeps the order in
// `processing` indefinitely, so cancelling a paid order from History is deterministic (a normal job finishes in 5 s
// and would race the cancellation).

test.beforeEach(async ({ request }) => {
  await resetOrders(request)
})

test('cancel a paid (processing) order from History: refund, status Cancelled, persists (AC-5.2, AC-7.3)', async ({ page, request }) => {
  const token = await signIn(page, request)
  await startCheckoutApi(request, token)
  await saveDeliveryApi(request, token, 'order-2', { ...VALID_DELIVERY, address: { ...VALID_DELIVERY.address, line1: 'FAIL 1 Main St' } })
  const total = (await orderState(request, token)).totals.total
  const paid = await gql(request, token,
    'mutation($id: ID!, $i: PayOrderInput!){ payOrder(orderId:$id, input:$i){ status } }',
    { id: 'order-2', i: { cardToken: 'tok_approve_e2e', expectedTotal: total } })
  expect(paid.errors).toBeUndefined()
  await expect.poll(async () => (await orderState(request, token)).processingFailed, { timeout: 90_000, intervals: [2000] }).toBe(true)

  await page.goto('/runtime/order')
  await settle(page, async () => { await expect(page.getByRole('tab', { name: /^History/ })).toBeVisible({ timeout: 8000 }) })
  await page.getByRole('tab', { name: /^History/ }).click()
  await expect(page.getByRole('heading', { name: /Order #order-2 - Processing/ })).toBeVisible()

  await page.getByRole('button', { name: 'Cancel order #order-2' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('refunded')
  await dialog.getByRole('button', { name: /^(Cancel order|Try again)$/ }).click()
  await expect(dialog).toBeHidden({ timeout: 90_000 })
  await expect(page.getByRole('heading', { name: /Order #order-2 - Cancelled/ })).toBeVisible()
  expect((await orderState(request, token)).status).toBe('cancelled')

  await page.reload()
  await settle(page, async () => { await expect(page.getByRole('tab', { name: /^History/ })).toBeVisible({ timeout: 8000 }) })
  await page.getByRole('tab', { name: /^History/ }).click()
  await expect(page.getByRole('heading', { name: /Order #order-2 - Cancelled/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel order #order-2' })).toHaveCount(0)
})
