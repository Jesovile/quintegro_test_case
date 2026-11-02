import { expect, test } from '@playwright/test'
import { fillCard, heading, orderState, resetOrders, saveDeliveryApi, settle, signIn, startCheckoutApi, VALID_DELIVERY } from './helpers'

// Runs on its own backend (see playwright.fail-retry.config.ts): the mock fulfillment service breaks only the
// first job of order-2 per backend process, and /reset/orders does not reset that counter.

test.beforeEach(async ({ request }) => {
  await resetOrders(request)
})

test('Interrupted: processing fails (FAIL street), user sees Try again / Cancel order, retry succeeds (AC-4.4)', async ({ page, request }) => {
  const token = await signIn(page, request)
  await startCheckoutApi(request, token)
  await saveDeliveryApi(request, token, 'order-2', { ...VALID_DELIVERY, address: { ...VALID_DELIVERY.address, line1: 'FAIL 1 Main St' } })
  await page.goto('/runtime/checkout/order-2/payment')
  await settle(page, async () => { await expect(heading(page, 'Payment')).toBeVisible({ timeout: 8000 }) })

  await fillCard(page)
  await page.getByRole('button', { name: /^Pay \$/ }).click()
  await settle(page, async () => { await expect(heading(page, 'Processing')).toBeVisible({ timeout: 8000 }) })

  // The job takes 5 s and then fails; the page polls the order
  const failure = page.getByRole('alert').filter({ hasText: 'We could not prepare order' })
  await expect(failure).toBeVisible({ timeout: 90_000 })
  await expect(failure.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel order #order-2' })).toBeVisible()
  expect((await orderState(request, token)).status).toBe('processing')

  // A reload keeps the failure state (persistence)
  await page.reload()
  await settle(page, async () => { await expect(failure).toBeVisible({ timeout: 8000 }) })

  await failure.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'Thank you for your order!' })).toBeVisible({ timeout: 120_000 })
  expect((await orderState(request, token)).status).toBe('deliver')
})
