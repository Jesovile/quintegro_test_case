import { expect, Page, test } from '@playwright/test'
import {
  clickCheckoutUntilDelivery, expectNoHorizontalScroll, fillCard, fillDelivery, gotoPayment, heading, resetOrders, settle, signIn, startCheckoutApi
} from './helpers'

const PAY = /^Pay \$/

test.beforeEach(async ({ request }) => {
  await resetOrders(request)
})

test.describe('Mobile 360 px (US-8)', () => {
  test.use({ viewport: { width: 360, height: 740 } })

  test('all wizard steps fit without horizontal scroll, incl. <main> (AC-8.1, AC-8.2)', async ({ page, request }) => {
    await signIn(page, request)
    await page.goto('/runtime/order')
    await settle(page, async () => { await expect(page.getByRole('button', { name: 'Checkout', exact: true })).toBeVisible({ timeout: 8000 }) })
    await expectNoHorizontalScroll(page)
    await page.getByRole('tab', { name: /^History/ }).click()
    await expectNoHorizontalScroll(page)
    await page.getByRole('tab', { name: /^Current/ }).click()

    await clickCheckoutUntilDelivery(page)
    await expectNoHorizontalScroll(page)

    // AC-8.2: keyboard hints for mobile
    await expect(page.getByLabel('Email')).toHaveAttribute('inputmode', 'email')
    await expect(page.getByLabel('Email')).toHaveAttribute('autocomplete', 'email')
    await expect(page.getByLabel('Phone')).toHaveAttribute('inputmode', 'tel')
    await expect(page.getByLabel('ZIP code')).toHaveAttribute('inputmode', 'numeric')
    await expect(page.getByLabel('ZIP code')).toHaveAttribute('autocomplete', 'postal-code')

    // Error state must fit as well
    await page.getByLabel('Email').fill('bad')
    await page.getByRole('button', { name: 'Continue to payment' }).click()
    await expectNoHorizontalScroll(page)

    await fillDelivery(page)
    await page.getByRole('button', { name: 'Continue to payment' }).click()
    await settle(page, async () => { await expect(heading(page, 'Payment')).toBeVisible({ timeout: 8000 }) })
    await expectNoHorizontalScroll(page)
    await expect(page.getByLabel('Card number')).toHaveAttribute('inputmode', 'numeric')
    await expect(page.getByLabel('Card number')).toHaveAttribute('autocomplete', 'cc-number')
    await page.getByRole('button', { name: PAY }).click()
    await expectNoHorizontalScroll(page)

    await fillCard(page)
    await page.getByRole('button', { name: PAY }).click()
    await settle(page, async () => { await expect(heading(page, /Processing|Thank you for your order!/)).toBeVisible({ timeout: 8000 }) })
    await expectNoHorizontalScroll(page)

    await expect(page.getByRole('heading', { name: 'Thank you for your order!' })).toBeVisible({ timeout: 120_000 })
    await expectNoHorizontalScroll(page)
  })

  test('cancel dialog and login page fit at 360 px', async ({ page, request }) => {
    await page.goto('/runtime/login')
    await expectNoHorizontalScroll(page)
    const token = await signIn(page, request)
    await startCheckoutApi(request, token)
    await page.goto('/runtime/checkout/order-2/delivery')
    await settle(page, async () => { await expect(heading(page, 'Delivery')).toBeVisible({ timeout: 8000 }) })
    await page.getByRole('button', { name: 'Cancel order #order-2' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    const box = await page.getByRole('dialog').boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(360)
    await expectNoHorizontalScroll(page)
  })
})

const focusByTab = async (page: Page, target: ReturnType<Page['locator']>, max = 40) => {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate(el => el === document.activeElement).catch(() => false)) return
    await page.keyboard.press('Tab')
  }
  throw new Error('Could not reach the element with Tab')
}

test.describe('Keyboard only (Slice 9)', () => {
  test('/order tabs switch with arrow keys, Home and End (roving tabindex)', async ({ page, request }) => {
    await signIn(page, request)
    await page.goto('/runtime/order')
    await settle(page, async () => { await expect(page.getByRole('tab', { name: /^Current/ })).toBeVisible({ timeout: 8000 }) })
    const current = page.getByRole('tab', { name: /^Current/ })
    const history = page.getByRole('tab', { name: /^History/ })

    await focusByTab(page, current)
    await expect(current).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowRight')
    await expect(history).toBeFocused()
    await expect(history).toHaveAttribute('aria-selected', 'true')
    await expect(history).toHaveAttribute('tabindex', '0')
    await expect(current).toHaveAttribute('tabindex', '-1')
    await page.keyboard.press('ArrowRight') // wraps
    await expect(current).toBeFocused()
    await expect(current).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('End')
    await expect(history).toBeFocused()
    await page.keyboard.press('Home')
    await expect(current).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(history).toBeFocused()
  })

  test('wizard with Tab / Enter only: focus lands on the step heading after each transition', async ({ page, request }) => {
    await signIn(page, request)
    await page.goto('/runtime/order')
    const checkout = page.getByRole('button', { name: 'Checkout', exact: true })
    await settle(page, async () => { await expect(checkout).toBeVisible({ timeout: 8000 }) })

    await focusByTab(page, checkout, 400)
    // After a planned 500 the user presses Enter again; if the failed request took the focus away from the
    // (temporarily disabled) button, the keyboard user has to Tab back to it: recorded as an accessibility finding
    let firstPress = true
    await clickCheckoutUntilDelivery(page, async () => {
      if (!firstPress && !(await checkout.evaluate(el => el === document.activeElement))) {
        test.info().annotations.push({ type: 'a11y', description: 'Focus is lost after a failed Checkout request' })
        await focusByTab(page, checkout, 400)
      }
      firstPress = false
      await page.keyboard.press('Enter')
    })
    await expect(heading(page, 'Delivery')).toBeFocused()

    // Tab order follows the visual order: name, email, phone, street, apartment, city, state, zip
    const typeInto = async (label: string, text: string) => {
      await page.keyboard.press('Tab')
      await expect(page.getByLabel(label)).toBeFocused()
      if (text) await page.keyboard.type(text)
    }
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Full name')).toBeFocused()
    await typeInto('Email', 'john.doe@example.com')
    await typeInto('Phone', '5551234567')
    await typeInto('Street address', '1 Main St')
    await typeInto('Apartment, suite', '')
    await typeInto('City', 'Austin')
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('State')).toBeFocused()
    await page.keyboard.type('Texas')
    await expect(page.getByLabel('State')).toHaveValue('TX')
    await typeInto('ZIP code', '78701')
    await page.keyboard.press('Enter') // submits the form
    await settle(page, async () => { await expect(heading(page, 'Payment')).toBeVisible({ timeout: 8000 }) })
    await expect(heading(page, 'Payment')).toBeFocused()

    // Payment: promo code, Apply, then the card fields
    await page.keyboard.press('Tab')
    await expect(page.getByLabel(/^Code/)).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Apply' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Card number')).toBeFocused()
    await page.keyboard.type('4111111111111111')
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Expiry')).toBeFocused()
    await page.keyboard.type('12/30')
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Security code')).toBeFocused()
    await page.keyboard.type('123')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: PAY })).toBeFocused()
    await page.keyboard.press('Enter')

    await settle(page, async () => { await expect(heading(page, /Processing|Thank you for your order!/)).toBeVisible({ timeout: 8000 }) })
    await expect(heading(page, /Processing|Thank you for your order!/)).toBeFocused()

    // The server moves the order on by itself; the success heading then takes focus (focus was lost with the removed heading)
    await expect(page.getByRole('heading', { name: 'Thank you for your order!' })).toBeVisible({ timeout: 120_000 })
    await expect(page.getByRole('heading', { name: 'Thank you for your order!' })).toBeFocused()
  })

  test('validation by keyboard: Enter on an invalid form puts focus on the first invalid field', async ({ page, request }) => {
    const token = await signIn(page, request)
    await startCheckoutApi(request, token)
    await page.goto('/runtime/checkout/order-2/delivery')
    await settle(page, async () => { await expect(heading(page, 'Delivery')).toBeVisible({ timeout: 8000 }) })
    await page.getByLabel('Full name').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Email')).toBeFocused()
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  test('cancel dialog: opens with Enter, Esc closes it and focus returns to the button', async ({ page, request }) => {
    const token = await signIn(page, request)
    await gotoPayment(page, request, token)
    const cancel = page.getByRole('button', { name: 'Cancel order #order-2' })
    await focusByTab(page, cancel)
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(cancel).toBeFocused()
  })

  test('a11y: login form fields are reachable by label', async ({ page }) => {
    await page.goto('/runtime/login')
    await expect(page.getByLabel('Login', { exact: true })).toBeVisible({ timeout: 5000 })
    await expect(page.getByLabel('Password')).toBeVisible({ timeout: 5000 })
  })
})
