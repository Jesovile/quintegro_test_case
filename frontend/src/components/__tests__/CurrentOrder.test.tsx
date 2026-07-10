import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MockedProvider, MockedResponse } from '@apollo/client/testing'
import { Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import fs from 'fs'
import path from 'path'
import CurrentOrder from '../CurrentOrder'
import { GET_CURRENT_CART } from '../../graphql/queries'

function cartMock(currentCart: Record<string, unknown> | null): MockedResponse {
  return {
    request: { query: GET_CURRENT_CART },
    result: { data: { currentCart } }
  }
}

function renderComponent(mocks: MockedResponse[], history = createMemoryHistory()) {
  render(
    <MockedProvider mocks={mocks}>
      <Router history={history}>
        <CurrentOrder />
      </Router>
    </MockedProvider>
  )
  return history
}

describe('CurrentOrder', () => {
  it('has no localStorage read/write anywhere in the file (AC-502-2 regression guard)', () => {
    const source = fs.readFileSync(path.join(__dirname, '../CurrentOrder.tsx'), 'utf-8')
    expect(source).not.toMatch(/localStorage/)
  })

  it('renders badge "5" for a currentCart with products totalling 5 items', async () => {
    renderComponent([
      cartMock({
        orderId: 'order-2',
        products: [{ amount: 3 }, { amount: 2 }]
      })
    ])

    expect(await screen.findByText('5')).toBeInTheDocument()
  })

  it('renders no badge when currentCart is null (AC-502-1/502-2: cart cleared post-purchase)', async () => {
    renderComponent([cartMock(null)])

    await waitFor(() => {
      expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument()
    })
  })

  it('clicking the cart icon navigates to /order (unchanged existing behavior)', async () => {
    const history = renderComponent([cartMock(null)])

    screen.getByTitle('Current Order').click()

    expect(history.location.pathname).toBe('/order')
  })
})
