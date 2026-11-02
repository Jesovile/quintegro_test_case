import { CardFormValues, cardDigits } from '@/lib/cardValidation'

// Exchanges card data for an opaque token; the card never reaches our API. A real provider's SDK replaces the mock.
export interface ICardTokenizer {
  tokenizeCard(card: CardFormValues): Promise<{ cardToken: string }>
}

// Test cards that drive the mock bank scenarios; any other valid card is approved
export const TEST_CARDS = {
  approve: '4111111111111111',
  decline: '4000000000000002',
  timeout: '4000000000000119'
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// crypto.randomUUID exists only in secure contexts (HTTPS, localhost); getRandomValues works over plain HTTP too
const randomId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')

export class MockCardTokenizer implements ICardTokenizer {
  constructor(private delayMs = 300) {}

  async tokenizeCard(card: CardFormValues): Promise<{ cardToken: string }> {
    await wait(this.delayMs)

    const digits = cardDigits(card.cardNumber)
    const scenario = digits === TEST_CARDS.decline ? 'decline' : digits === TEST_CARDS.timeout ? 'timeout' : 'approve'
    return { cardToken: `tok_${scenario}_${randomId()}` }
  }
}

// The implementation used by the app: replace with the provider's tokenizer
export const cardTokenizer: ICardTokenizer = new MockCardTokenizer()
