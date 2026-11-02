import { expect, test } from '@playwright/test'
import {
  apiToken, fillCard, fillDelivery, gotoPayment, gql, heading, openCheckoutFromOrders, orderState, resetOrders,
  loginUntilRedirected, saveDeliveryApi, settle, signIn, startCheckoutApi, submitDelivery
} from './helpers'
import { USERS } from './users'

const PAY = /^Pay \$/

test.beforeEach(async ({ request }) => {
  await resetOrders(request)
})

test.describe('Main scenario', () => {
  test('login form -> /order -> Delivery -> Payment -> Processing -> success -> catalog (US-1..US-4)', async ({ page, request }) => {
    // Login through the real form. Its labels are not bound to the inputs (see the a11y test), so placeholders are used here.
    await page.goto('/runtime/login')
    await page.getByPlaceholder('Enter your login').fill(USERS.john.login)
    await page.getByPlaceholder('Enter your password').fill(USERS.john.password)
    await loginUntilRedirected(page, /\/runtime\/?$/)
    const token = await apiToken(request, 'john')

    await openCheckoutFromOrders(page)
    await expect(page).toHaveURL(/\/checkout\/order-2\/delivery/)
    expect((await orderState(request, token)).status).toBe('checkout')

    // AC-1.3: indicator with three steps, order content and total
    const stepper = page.getByRole('navigation', { name: 'Checkout progress' })
    await expect(stepper.getByText('Delivery')).toBeVisible()
    await expect(stepper.getByText('Payment')).toBeVisible()
    await expect(stepper.getByText('Processing')).toBeVisible()
    await expect(stepper.locator('[aria-current="step"]')).toContainText('Delivery')
    const summary = page.getByRole('complementary', { name: 'Order summary' })
    await expect(summary).toBeVisible()
    await expect(summary.getByText('Total', { exact: true })).toBeVisible()

    // AC-2.5: the name is prefilled
    await expect(page.getByLabel('Full name')).toHaveValue('John Doe')

    await submitDelivery(page)
    await settle(page, async () => { await expect(heading(page, 'Payment')).toBeVisible({ timeout: 8000 }) })
    await expect(page).toHaveURL(/\/checkout\/order-2\/payment/)

    await fillCard(page)
    await page.getByRole('button', { name: PAY }).click()
    await settle(page, async () => { await expect(heading(page, /Processing|Thank you for your order!/)).toBeVisible({ timeout: 8000 }) })
    await expect(page.getByText('Payment received')).toBeVisible()

    // AC-4.2/4.3: success page with order number, amount and the catalog button
    await expect(page.getByRole('heading', { name: 'Thank you for your order!' })).toBeVisible({ timeout: 120_000 })
    await expect(page.getByText('#order-2').first()).toBeVisible()
    await expect(page.getByText(/Total paid:\s*\$[\d,]+/)).toBeVisible()
    expect((await orderState(request, token)).status).toBe('deliver')

    // Persistence: reload keeps the success page
    await page.reload()
    await settle(page, async () => {
      await expect(page.getByRole('heading', { name: 'Thank you for your order!' })).toBeVisible({ timeout: 8000 })
    })

    await page.getByRole('link', { name: 'Continue shopping' }).click()
    await expect(page).toHaveURL(/\/runtime\/?$/)
  })

  test('paid order shows in History as Delivery with its content; Checkout is gone from Current (US-7)', async ({ page, request }) => {
    const token = await signIn(page, request)
    await gotoPayment(page, request, token)
    await fillCard(page)
    await page.getByRole('button', { name: PAY }).click()
    await expect(page.getByRole('heading', { name: 'Thank you for your order!' })).toBeVisible({ timeout: 120_000 })

    await page.goto('/runtime/order')
    await settle(page, async () => { await expect(page.getByRole('tab', { name: /^History/ })).toBeVisible({ timeout: 8000 }) })
    await expect(page.getByRole('tab', { name: /^Current \(0\)/ })).toBeVisible()
    await page.getByRole('tab', { name: /^History/ }).click()
    await expect(page.getByRole('heading', { name: /Order #order-2 - Delivery/ })).toBeVisible()
    // AC-5.4: no cancel button for a delivered order
    await expect(page.getByRole('button', { name: 'Cancel order #order-2' })).toHaveCount(0)
  })

  test('Empty state: a user without orders sees "No orders found" (AC-1.2, partially)', async ({ page, request }) => {
    await signIn(page, request, 'jane')
    await page.goto('/runtime/order')
    await settle(page, async () => { await expect(page.getByRole('heading', { name: 'No orders found' })).toBeVisible({ timeout: 8000 }) })
    await expect(page.getByRole('button', { name: 'Checkout' })).toHaveCount(0)
  })
})

test.describe('Alternative scenarios', () => {
  test('invalid delivery form: errors at fields, focus on the first error, no transition (AC-2.1)', async ({ page, request }) => {
    const token = await signIn(page, request)
    await startCheckoutApi(request, token)
    await page.goto('/runtime/checkout/order-2/delivery')
    await settle(page, async () => { await expect(heading(page, 'Delivery')).toBeVisible({ timeout: 8000 }) })

    await page.getByLabel('Full name').fill('')
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByRole('button', { name: 'Continue to payment' }).click()

    await expect(page.getByLabel('Full name')).toBeFocused()
    await expect(page.getByLabel('Full name')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Email')).toHaveAccessibleDescription(/valid email/i)
    await expect(page.getByLabel('Phone')).toHaveAccessibleDescription(/10-digit/)
    await expect(page.getByLabel('State')).toHaveAccessibleDescription(/Select a state/)
    await expect(page.getByLabel('ZIP code')).toHaveAccessibleDescription(/ZIP code like/)
    await expect(heading(page, 'Delivery')).toBeVisible()
    expect((await orderState(request, token)).deliverySaved).toBe(false)
  })

  test('wrong address: geo rejects ZIP 00000, the user fixes it and continues (AC-2.3)', async ({ page, request }) => {
    const token = await signIn(page, request)
    await startCheckoutApi(request, token)
    await page.goto('/runtime/checkout/order-2/delivery')
    await settle(page, async () => { await expect(heading(page, 'Delivery')).toBeVisible({ timeout: 8000 }) })

    await fillDelivery(page, { zip: '00000' })
    await page.getByRole('button', { name: 'Continue to payment' }).click()
    await settle(page, async () => {
      await expect(page.getByLabel('ZIP code')).toHaveAttribute('aria-invalid', 'true', { timeout: 8000 })
    })
    await expect(page.getByLabel('ZIP code')).toHaveAccessibleDescription(/.+/)
    await expect(heading(page, 'Delivery')).toBeVisible()

    await page.getByLabel('ZIP code').fill('78701')
    await page.getByRole('button', { name: 'Continue to payment' }).click()
    await settle(page, async () => { await expect(heading(page, 'Payment')).toBeVisible({ timeout: 8000 }) })
  })

  test('geo service unavailable (ZIP 99999): message with Try again, entered data is kept (AC-2.4)', async ({ page, request }) => {
    const token = await signIn(page, request)
    await startCheckoutApi(request, token)
    await page.goto('/runtime/checkout/order-2/delivery')
    await settle(page, async () => { await expect(heading(page, 'Delivery')).toBeVisible({ timeout: 8000 }) })

    await fillDelivery(page, { zip: '99999', street: '7 Oak Ave' })
    await page.getByRole('button', { name: 'Continue to payment' }).click()
    const alert = page.getByRole('alert').filter({ hasText: /could not check the address|Something went wrong/ })
    await expect(alert).toBeVisible({ timeout: 60_000 })
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(page.getByLabel('Street address')).toHaveValue('7 Oak Ave')
    await expect(page.getByLabel('Email')).toHaveValue('john.doe@example.com')
    await expect(page.getByLabel('ZIP code')).toHaveValue('99999')

    // After correcting the ZIP the flow continues
    await page.getByLabel('ZIP code').fill('78701')
    await page.getByRole('button', { name: 'Continue to payment' }).click()
    await settle(page, async () => { await expect(heading(page, 'Payment')).toBeVisible({ timeout: 8000 }) })
  })

  test('bank declines the card, the user pays with another card (AC-3.3, AC-3.5)', async ({ page, request }) => {
    const token = await signIn(page, request)
    await gotoPayment(page, request, token)

    // AC-3.1: invalid card data -> highlighted fields, the button was not disabled beforehand
    const payButton = page.getByRole('button', { name: PAY })
    await expect(payButton).toBeEnabled()
    await payButton.click()
    await expect(page.getByLabel('Card number')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Card number')).toHaveAccessibleDescription(/valid card number/)
    await expect(page.getByLabel('Expiry')).toHaveAccessibleDescription(/MM\/YY/)
    await expect(page.getByLabel('Security code')).toHaveAccessibleDescription(/security code/)

    await fillCard(page, '4000 0000 0000 0002')
    await payButton.click()
    // AC-3.5: the button is blocked while the request runs
    await expect(payButton).toBeDisabled()
    const declined = page.getByRole('alert').filter({ hasText: /declined|Something went wrong/ })
    await expect(declined).toBeVisible({ timeout: 60_000 })
    if (!(await declined.innerText()).includes('declined')) {
      // A planned 500 hit the request: repeat it, the decline comes back
      await declined.getByRole('button', { name: 'Try again' }).click()
      await expect(page.getByRole('alert').filter({ hasText: 'declined' })).toBeVisible({ timeout: 60_000 })
    }
    expect((await orderState(request, token)).status).toBe('checkout')
    await expect(heading(page, 'Payment')).toBeVisible()

    // Another card
    await page.getByLabel('Card number').fill('4111 1111 1111 1111')
    await page.getByRole('button', { name: PAY }).click()
    await settle(page, async () => { await expect(heading(page, /Processing|Thank you for your order!/)).toBeVisible({ timeout: 8000 }) })
    expect(['paid', 'processing', 'deliver']).toContain((await orderState(request, token)).status)
  })

  test('promo code: unknown and expired are rejected, SAVE10 applies, persists after reload, can be removed (AC-3.8, AC-3.9)', async ({ page, request }) => {
    const token = await signIn(page, request)
    await gotoPayment(page, request, token)
    const before = (await orderState(request, token)).totals
    const code = page.getByLabel(/^Code/)
    const apply = page.getByRole('button', { name: 'Apply' })
    // The promo form has no "Try again": after a planned 500 the user just presses Apply again
    const applyUntil = async (value: string, expected: string) => {
      await settle(page, async () => {
        if (await code.count()) {
          await code.fill(value)
          await apply.click()
        }
        await expect(page.getByText(expected)).toBeVisible({ timeout: 6000 })
      })
    }

    await applyUntil('SAVE5', 'This promo code has expired.')
    await applyUntil('NOSUCH', 'This promo code does not exist.')
    expect((await orderState(request, token)).totals.total).toBe(before.total)

    await applyUntil('SAVE10', 'applied: 10% off')
    const summary = page.getByRole('complementary', { name: 'Order summary' })
    await expect(summary.getByText('Discount (SAVE10)')).toBeVisible()
    const after = await orderState(request, token)
    expect(after.promo?.id).toBe('SAVE10')
    expect(after.totals.discount).toBe(Math.round(before.subtotal * 0.1))
    expect(after.totals.total).toBe(before.subtotal - after.totals.discount)
    await expect(page.getByRole('button', { name: PAY })).toContainText(after.totals.total.toLocaleString('en-US'))

    await page.reload()
    await settle(page, async () => { await expect(page.getByText('applied: 10% off')).toBeVisible({ timeout: 8000 }) })

    await page.getByRole('button', { name: 'Remove promo code SAVE10' }).click()
    await settle(page, async () => { await expect(page.getByLabel(/^Code/)).toBeVisible({ timeout: 8000 }) })
    expect((await orderState(request, token)).totals.discount).toBe(0)

    // Apply SAVE20 and pay: the discount stays on the paid order
    await applyUntil('SAVE20', 'applied: 20% off')
    await fillCard(page)
    await page.getByRole('button', { name: PAY }).click()
    await settle(page, async () => { await expect(heading(page, /Processing|Thank you for your order!/)).toBeVisible({ timeout: 8000 }) })
    const paid = await orderState(request, token)
    expect(paid.totals.discount).toBe(Math.round(before.subtotal * 0.2))
  })

  test('lost bank answer: "Try again" confirms the payment without a second charge (AC-3.4)', async ({ page, request }) => {
    const token = await signIn(page, request)
    await gotoPayment(page, request, token)
    await fillCard(page, '4000 0000 0000 0119')
    await page.getByRole('button', { name: PAY }).click()

    const retry = page.getByRole('button', { name: 'Try again' })
    await expect(retry).toBeVisible({ timeout: 120_000 })
    // Until the payment is checked, a new payment attempt is not offered
    await expect(page.getByRole('button', { name: PAY })).toHaveCount(0)
    await expect(page.getByLabel('Card number')).toHaveAttribute('readonly', '')

    await retry.click()
    await settle(page, async () => { await expect(heading(page, /Processing|Thank you for your order!/)).toBeVisible({ timeout: 15_000 }) })
    expect(['paid', 'processing', 'deliver']).toContain((await orderState(request, token)).status)
  })

  test('cancel in checkout: confirmation dialog, no charge, order becomes cancelled, persists (AC-5.1)', async ({ page, request }) => {
    const token = await signIn(page, request)
    await startCheckoutApi(request, token)
    await page.goto('/runtime/checkout/order-2/delivery')
    await settle(page, async () => { await expect(heading(page, 'Delivery')).toBeVisible({ timeout: 8000 }) })

    await page.getByRole('button', { name: 'Cancel order #order-2' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('You have not been charged')
    await dialog.getByRole('button', { name: 'Keep order' }).click()
    await expect(dialog).toBeHidden()
    expect((await orderState(request, token)).status).toBe('checkout')

    await page.getByRole('button', { name: 'Cancel order #order-2' }).click()
    await dialog.getByRole('button', { name: /^(Cancel order|Try again)$/ }).click()
    await settle(page, async () => {
      await expect(page.getByRole('heading', { name: 'Order cancelled' })).toBeVisible({ timeout: 8000 })
    })
    expect((await orderState(request, token)).status).toBe('cancelled')

    await page.reload()
    await settle(page, async () => { await expect(page.getByRole('heading', { name: 'Order cancelled' })).toBeVisible({ timeout: 8000 }) })
  })

  test('back to order, change quantity, start checkout again (AC-1.6, AC-6.2)', async ({ page, request }) => {
    const token = await signIn(page, request)
    await openCheckoutFromOrders(page)
    const oldTotal = (await orderState(request, token)).totals.total

    await page.getByRole('button', { name: 'Back to order' }).click()
    await expect(page).toHaveURL(/\/runtime\/order/, { timeout: 60_000 })
    expect((await orderState(request, token)).status).toBe('created')

    await settle(page, async () => {
      await expect(page.getByRole('button', { name: /^Increase amount of/ }).first()).toBeVisible({ timeout: 8000 })
    })
    // A planned 500 silently reverts the field, so the click is repeated until the server has the new quantity
    await expect(async () => {
      if ((await orderState(request, token)).totals.total <= oldTotal) {
        await page.getByRole('button', { name: /^Increase amount of/ }).first().click({ timeout: 10_000 })
      }
      await expect.poll(async () => (await orderState(request, token)).totals.total, { timeout: 8000 }).toBeGreaterThan(oldTotal)
    }).toPass({ timeout: 90_000 })
    const newTotal = (await orderState(request, token)).totals.total

    await page.reload()
    await settle(page, async () => { await expect(page.getByRole('button', { name: 'Checkout', exact: true })).toBeVisible({ timeout: 8000 }) })
    await page.getByRole('button', { name: 'Checkout', exact: true }).click()
    await settle(page, async () => { await expect(heading(page, 'Delivery')).toBeVisible({ timeout: 8000 }) })
    await expect(page.getByRole('complementary', { name: 'Order summary' })).toContainText(newTotal.toLocaleString('en-US'))
  })
})
