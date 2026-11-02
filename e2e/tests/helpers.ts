import { APIRequestContext, expect, Locator, Page } from '@playwright/test'
import { USERS, UserKey } from './users'

export const API = process.env.E2E_API ?? 'http://localhost:3100'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// The backend answers 500 to every 5th request on purpose: API helpers repeat such calls
export async function resetOrders(request: APIRequestContext): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const res = await request.get(`${API}/reset/orders`, { timeout: 60_000 })
    if (res.ok()) return
  }
  throw new Error('reset/orders kept failing')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function gql<T = any>(request: APIRequestContext, token: string | null, query: string, variables: Record<string, unknown> = {}): Promise<{ data?: T; errors?: { extensions?: { code?: string } }[] }> {
  for (let i = 0; i < 8; i++) {
    const res = await request.post(`${API}/graphql`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      data: { query, variables },
      timeout: 60_000
    })
    if (res.status() >= 500) continue
    const body = await res.json()
    if (body.errors?.[0]?.extensions?.code === 'INTERNAL') {
      await sleep(200)
      continue
    }
    return body
  }
  throw new Error('graphql kept failing')
}

const tokens: Partial<Record<UserKey, string>> = {}
export async function apiToken(request: APIRequestContext, user: UserKey): Promise<string> {
  if (tokens[user]) return tokens[user]!
  const { login, password } = USERS[user]
  const body = await gql<{ login: { token: string } }>(request, null,
    'mutation($input: LoginInput!){ login(input:$input){ token } }', { input: { login, password } })
  const token = body.data?.login.token
  if (!token) throw new Error('login failed')
  tokens[user] = token
  return token
}

// Puts a valid session into localStorage without going through the login form
export async function signIn(page: Page, request: APIRequestContext, user: UserKey = 'john'): Promise<string> {
  const token = await apiToken(request, user)
  await page.goto('/runtime/login')
  await page.evaluate(t => localStorage.setItem('auth_token', t), token)
  return token
}

export interface OrderState {
  status: string
  processingFailed?: boolean
  deliverySaved: boolean
  totals: { subtotal: number; discount: number; total: number }
  promo: { id: string } | null
}

export async function orderState(request: APIRequestContext, token: string, orderId = 'order-2'): Promise<OrderState> {
  const body = await gql(request, token,
    'query($id: ID!){ order(orderId:$id){ orderId status processingFailed deliverySaved totals { subtotal discount total } promo { id } } }',
    { id: orderId })
  return body.data?.order as OrderState
}

export const VALID_DELIVERY = {
  fullName: 'John Doe', email: 'john.doe@example.com', phone: '(555) 123-4567',
  address: { line1: '1 Main St', line2: null, city: 'Austin', state: 'TX', zip: '78701' }
}

export async function startCheckoutApi(request: APIRequestContext, token: string, orderId = 'order-2') {
  await gql(request, token, 'mutation($id: ID!){ startCheckout(orderId:$id){ status } }', { id: orderId })
}

export async function saveDeliveryApi(request: APIRequestContext, token: string, orderId = 'order-2', input: unknown = VALID_DELIVERY) {
  const r = await gql(request, token, 'mutation($id: ID!, $i: DeliveryInput!){ saveDelivery(orderId:$id, input:$i){ status } }', { id: orderId, i: input })
  if (r.errors) throw new Error('saveDelivery: ' + JSON.stringify(r.errors[0]?.extensions))
}

// Repeats an assertion; between attempts presses "Try again" if the UI shows the planned-500 error screen
export async function settle(page: Page, assertion: () => Promise<void>, totalMs = 90_000): Promise<void> {
  const deadline = Date.now() + totalMs
  for (;;) {
    try {
      await assertion()
      return
    } catch (e) {
      if (Date.now() > deadline) throw e
      const retry = page.getByRole('button', { name: 'Try again' })
      if (await retry.count()) await retry.first().click({ timeout: 3000 }).catch(() => undefined)
      await sleep(500)
    }
  }
}

export async function fillDelivery(page: Page, v: { street?: string; zip?: string; state?: string; email?: string; phone?: string; city?: string } = {}) {
  await page.getByLabel('Email').fill(v.email ?? 'john.doe@example.com')
  await page.getByLabel('Phone').fill(v.phone ?? '(555) 123-4567')
  await page.getByLabel('Street address').fill(v.street ?? '1 Main St')
  await page.getByLabel('City').fill(v.city ?? 'Austin')
  await page.getByLabel('State').selectOption(v.state ?? 'TX')
  await page.getByLabel('ZIP code').fill(v.zip ?? '78701')
}

export async function fillCard(page: Page, number = '4111 1111 1111 1111') {
  await page.getByLabel('Card number').fill(number)
  await page.getByLabel('Expiry').fill('12/30')
  await page.getByLabel('Security code').fill('123')
}

export const heading = (page: Page, name: string | RegExp): Locator => page.getByRole('heading', { name, level: 2 })

// Start checkout on /order and wait for the Delivery step
export async function openCheckoutFromOrders(page: Page) {
  await page.goto('/runtime/order')
  await settle(page, async () => {
    await expect(page.getByRole('button', { name: 'Checkout', exact: true })).toBeVisible({ timeout: 8000 })
  })
  await clickCheckoutUntilDelivery(page)
}

// The start-checkout request may hit the planned 500: the page then shows an error under the button
// (without a retry button), and the user presses Checkout again
export async function clickCheckoutUntilDelivery(page: Page, press?: () => Promise<void>) {
  const checkout = page.getByRole('button', { name: 'Checkout', exact: true })
  const deadline = Date.now() + 90_000
  for (;;) {
    // The button is gone once the request succeeded; then the checkout page itself may show its own error with "Try again"
    if (press) await press()
    else if (await checkout.count()) await checkout.click({ timeout: 10_000 }).catch(() => undefined)
    try {
      await expect(heading(page, 'Delivery')).toBeVisible({ timeout: 8000 })
      return
    } catch (e) {
      if (Date.now() > deadline) throw e
      const retry = page.getByRole('button', { name: 'Try again' })
      if (await retry.count()) await retry.first().click({ timeout: 3000 }).catch(() => undefined)
    }
  }
}

export async function submitDelivery(page: Page, v: Parameters<typeof fillDelivery>[1] = {}) {
  await fillDelivery(page, v)
  await page.getByRole('button', { name: 'Continue to payment' }).click()
}

// Reaches the Payment step through the API and opens it in the browser
export async function gotoPayment(page: Page, request: APIRequestContext, token: string) {
  await startCheckoutApi(request, token)
  await saveDeliveryApi(request, token)
  await page.goto('/runtime/checkout/order-2/payment')
  await settle(page, async () => {
    await expect(heading(page, 'Payment')).toBeVisible({ timeout: 8000 })
  })
}

export async function expectNoHorizontalScroll(page: Page) {
  const r = await page.evaluate(() => {
    const main = document.querySelector('main')!
    const de = document.documentElement
    return {
      docOver: de.scrollWidth - de.clientWidth,
      bodyOver: document.body.scrollWidth - document.body.clientWidth,
      mainOver: main.scrollWidth - main.clientWidth
    }
  })
  expect(r, JSON.stringify(r)).toEqual({ docOver: 0, bodyOver: 0, mainOver: 0 })
}

// Fills the login form and presses Login; repeats the press if the planned 500 left the user on the login page
export async function loginUntilRedirected(page: Page, target: RegExp) {
  await page.getByPlaceholder('Enter your login').fill(USERS.john.login)
  await page.getByPlaceholder('Enter your password').fill(USERS.john.password)
  const deadline = Date.now() + 90_000
  for (;;) {
    await page.getByRole('button', { name: 'Login' }).click()
    try {
      await expect(page).toHaveURL(target, { timeout: 8000 })
      return
    } catch (e) {
      if (Date.now() > deadline) throw e
    }
  }
}
