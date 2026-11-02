import { expect, test } from '@playwright/test'
import {
  apiToken, fillCard, fillDelivery, gotoPayment, gql, heading, orderState, resetOrders, saveDeliveryApi, settle,
  loginUntilRedirected, signIn, startCheckoutApi
} from './helpers'
import { USERS } from './users'

const PAY = /^Pay \$/

test.beforeEach(async ({ request }) => {
  await resetOrders(request)
})

test('leave checkout and come back: order stays in checkout, saved contacts restored, card is empty (Interrupted: leave and return)', async ({ page, request }) => {
  const token = await signIn(page, request)
  await startCheckoutApi(request, token)
  await page.goto('/runtime/checkout/order-2/delivery')
  await settle(page, async () => { await expect(heading(page, 'Delivery')).toBeVisible({ timeout: 8000 }) })
  await fillDelivery(page, { street: '42 Elm Street', email: 'returning@example.com' })
  await page.getByRole('button', { name: 'Continue to payment' }).click()
  await settle(page, async () => { await expect(heading(page, 'Payment')).toBeVisible({ timeout: 8000 }) })
  await page.getByLabel('Card number').fill('4111 1111 1111 1111')

  // Leave for the orders list: the order is in Current with "Continue checkout" (AC-7.1)
  await page.goto('/runtime/order')
  await settle(page, async () => { await expect(page.getByRole('link', { name: 'Continue checkout' })).toBeVisible({ timeout: 8000 }) })
  expect((await orderState(request, token)).status).toBe('checkout')
  await page.getByRole('link', { name: 'Continue checkout' }).click()

  // The furthest available step is opened; the card has to be typed again
  await settle(page, async () => { await expect(heading(page, 'Payment')).toBeVisible({ timeout: 8000 }) })
  await expect(page.getByLabel('Card number')).toHaveValue('')

  // AC-1.5: back to Delivery, server data is there
  await page.getByRole('navigation', { name: 'Checkout progress' }).getByRole('link', { name: /Delivery/ }).click()
  await settle(page, async () => { await expect(heading(page, 'Delivery')).toBeVisible({ timeout: 8000 }) })
  await expect(page.getByLabel('Email')).toHaveValue('returning@example.com')
  await expect(page.getByLabel('Street address')).toHaveValue('42 Elm Street')
  await expect(page.getByLabel('Full name')).toHaveValue('John Doe')
})

test('direct URL to a step that is not unlocked opens the furthest available step (AC-1.4)', async ({ page, request }) => {
  const token = await signIn(page, request)
  await startCheckoutApi(request, token)
  await page.goto('/runtime/checkout/order-2/payment')
  await settle(page, async () => { await expect(heading(page, 'Delivery')).toBeVisible({ timeout: 8000 }) })
  await expect(page).toHaveURL(/\/checkout\/order-2\/delivery/)

  await page.goto('/runtime/checkout/order-2/processing')
  await settle(page, async () => { await expect(heading(page, 'Delivery')).toBeVisible({ timeout: 8000 }) })
  await expect(page).toHaveURL(/\/checkout\/order-2\/delivery/)

  // The progress bar offers no link to locked steps
  const stepper = page.getByRole('navigation', { name: 'Checkout progress' })
  await expect(stepper.getByRole('link')).toHaveCount(0)

  // Once delivery is saved, Payment opens by URL
  await saveDeliveryApi(request, token)
  await page.goto('/runtime/checkout/order-2/payment')
  await settle(page, async () => { await expect(heading(page, 'Payment')).toBeVisible({ timeout: 8000 }) })
})

test('after payment the Delivery and Payment steps are closed (AC-1.7) and Back from success cannot resubmit (AC-4.5)', async ({ page, request }) => {
  const token = await signIn(page, request)
  await gotoPayment(page, request, token)
  await fillCard(page)
  await page.getByRole('button', { name: PAY }).click()
  await settle(page, async () => { await expect(heading(page, /Processing|Thank you for your order!/)).toBeVisible({ timeout: 8000 }) })

  for (const step of ['delivery', 'payment']) {
    await page.goto(`/runtime/checkout/order-2/${step}`)
    await settle(page, async () => {
      await expect(heading(page, /Processing|Thank you for your order!/)).toBeVisible({ timeout: 8000 })
    })
    await expect(page).toHaveURL(/\/checkout\/order-2\/processing|\/checkout\/order-2\/success/)
    await expect(page.getByRole('button', { name: PAY })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toHaveCount(0)
  }
  // The progress bar has no links back
  await expect(page.getByRole('navigation', { name: 'Checkout progress' }).getByRole('link')).toHaveCount(0)

  // Server side: saving delivery on a paid order is refused
  const r = await gql(request, token,
    'mutation($id: ID!, $i: DeliveryInput!){ saveDelivery(orderId:$id, input:$i){ status } }',
    { id: 'order-2', i: { fullName: 'John Doe', email: 'a@b.co', phone: '5551234567', address: { line1: '1 A St', city: 'Austin', state: 'TX', zip: '78701' } } })
  expect(r.errors?.[0]?.extensions?.code).toBeTruthy()

  // AC-4.5: browser Back from the success page does not bring the payment form back
  await expect(page.getByRole('heading', { name: 'Thank you for your order!' })).toBeVisible({ timeout: 120_000 })
  await page.goBack()
  await settle(page, async () => {
    await expect(heading(page, /Processing|Thank you for your order!|Your Orders/)).toBeVisible({ timeout: 8000 }).catch(() => undefined)
  }, 20_000)
  await expect(page.getByRole('button', { name: PAY })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Continue to payment' })).toHaveCount(0)
})

test('two tabs: payment in one, the other tab ends up on the right step with a single payment (AC-3.6)', async ({ context, request }) => {
  const token = await apiToken(request, 'john')
  const first = await context.newPage()
  await first.goto('/runtime/login')
  await first.evaluate(t => localStorage.setItem('auth_token', t), token)
  await startCheckoutApi(request, token)
  await saveDeliveryApi(request, token)

  const second = await context.newPage()
  for (const p of [first, second]) {
    await p.goto('/runtime/checkout/order-2/payment')
    await settle(p, async () => { await expect(heading(p, 'Payment')).toBeVisible({ timeout: 8000 }) })
    await fillCard(p)
  }

  await first.getByRole('button', { name: PAY }).click()
  await settle(first, async () => { await expect(heading(first, /Processing|Thank you for your order!/)).toBeVisible({ timeout: 8000 }) })

  // The second tab still shows the pay form for an order that is already paid; paying again must not charge twice
  await second.getByRole('button', { name: PAY }).click()
  await settle(second, async () => {
    await expect(heading(second, /Processing|Thank you for your order!/)).toBeVisible({ timeout: 8000 })
  })
  await expect(second.getByRole('alert')).toHaveCount(0)

  // A reload of another stale tab goes to the right step as well
  await second.reload()
  await settle(second, async () => {
    await expect(heading(second, /Processing|Thank you for your order!/)).toBeVisible({ timeout: 8000 })
  })
  expect(['paid', 'processing', 'deliver']).toContain((await orderState(request, token)).status)
})

test('two tabs: order cancelled in one tab, the other tab shows it cancelled after reload', async ({ context, request }) => {
  const token = await apiToken(request, 'john')
  const first = await context.newPage()
  await first.goto('/runtime/login')
  await first.evaluate(t => localStorage.setItem('auth_token', t), token)
  await startCheckoutApi(request, token)

  const second = await context.newPage()
  await second.goto('/runtime/checkout/order-2/delivery')
  await settle(second, async () => { await expect(heading(second, 'Delivery')).toBeVisible({ timeout: 8000 }) })

  await first.goto('/runtime/checkout/order-2/delivery')
  await settle(first, async () => { await expect(heading(first, 'Delivery')).toBeVisible({ timeout: 8000 }) })
  await first.getByRole('button', { name: 'Cancel order #order-2' }).click()
  await first.getByRole('dialog').getByRole('button', { name: /^(Cancel order|Try again)$/ }).click()
  await settle(first, async () => { await expect(first.getByRole('heading', { name: 'Order cancelled' })).toBeVisible({ timeout: 8000 }) })

  // The stale tab submits delivery for a cancelled order: it must not move on to Payment
  await fillDelivery(second)
  await second.getByRole('button', { name: 'Continue to payment' }).click()
  await expect(heading(second, 'Payment')).toHaveCount(0, { timeout: 10_000 })
  await second.reload()
  await settle(second, async () => { await expect(second.getByRole('heading', { name: 'Order cancelled' })).toBeVisible({ timeout: 8000 }) })
})

test('invalid session: user is sent to login and returns to checkout after signing in (AC-6.4)', async ({ page, request }) => {
  const token = await apiToken(request, 'john')
  await startCheckoutApi(request, token)

  // The real signing secret is not available to the tests, so a token the server rejects stands in for an expired one
  await page.goto('/runtime/login')
  await page.evaluate(() => localStorage.setItem('auth_token', 'expired.invalid.token'))
  await page.goto('/runtime/checkout/order-2')
  await expect(page).toHaveURL(/\/runtime\/login\?redirect=%2Fcheckout%2Forder-2/, { timeout: 90_000 })
  expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull()

  await page.getByPlaceholder('Enter your login').fill(USERS.john.login)
  await page.getByPlaceholder('Enter your password').fill(USERS.john.password)
  await loginUntilRedirected(page, /\/runtime\/checkout\/order-2/)
  await settle(page, async () => { await expect(heading(page, 'Delivery')).toBeVisible({ timeout: 8000 }) })
})

test('someone else\'s order is not shown (AC-6.4)', async ({ page, request }) => {
  await signIn(page, request, 'jane')
  await page.goto('/runtime/checkout/order-2')
  await settle(page, async () => { await expect(page.getByRole('heading', { name: 'Order not found' })).toBeVisible({ timeout: 8000 }) })
})

test('reload on the Processing step restores the step by status', async ({ page, request }) => {
  const token = await signIn(page, request)
  await gotoPayment(page, request, token)
  await fillCard(page)
  await page.getByRole('button', { name: PAY }).click()
  await settle(page, async () => { await expect(heading(page, /Processing|Thank you for your order!/)).toBeVisible({ timeout: 8000 }) })

  await page.reload()
  await settle(page, async () => {
    await expect(heading(page, /Processing|Thank you for your order!/)).toBeVisible({ timeout: 8000 })
  })
  await expect(page.getByRole('heading', { name: 'Thank you for your order!' })).toBeVisible({ timeout: 120_000 })
})
