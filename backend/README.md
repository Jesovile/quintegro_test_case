# Quintegro Backend API

A REST API built with Express.js and TypeScript, implementing the Repository pattern with in-memory data storage.

## Features

- **Express.js** with **TypeScript** for type safety
- **Repository Pattern** for data access abstraction
- **In-memory data storage** (no database required)
- **JWT authentication** for secure login
- **Swagger/OpenAPI documentation** for API exploration
- **CORS enabled** for cross-origin requests
- **Security middleware** with Helmet

## Project Structure

```
src/
├── config/
│   └── swagger.ts          # Swagger configuration
├── controllers/
│   └── authController.ts   # Authentication controller
├── repositories/
│   ├── interfaces.ts       # Repository interfaces
│   └── implementations.ts  # In-memory implementations
├── routes/
│   └── authRoutes.ts       # Authentication routes
├── services/
│   └── authService.ts      # Authentication business logic
├── types/
│   └── entities.ts         # TypeScript interfaces
├── app.ts                  # Express application setup
└── index.ts                # Application entry point
```

## API Endpoints

### Authentication

- **POST** `/api/login` - Authenticate user and get JWT token

### System

- **GET** `/` - API information
- **GET** `/health` - Health check
- **GET** `/api-docs` - Swagger API documentation

## Data Models

### UserRecord
```typescript
{
  id: string;
  name: string;
}
```

### AuthRecord
```typescript
{
  userId: string;  // References existing user
  login: string;
  password: string;
}
```

## Stub Data

The application comes with pre-populated data:

**Users:**
- `user-1`: John Doe
- `user-2`: Jane Smith

**Auth Records:**
- Login: `john.doe`, Password: `password123`
- Login: `jane.smith`, Password: `password456`

## Setup and Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the project:**
   ```bash
   npm run build
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

## Development

For development with auto-reload:

```bash
npm run dev
```

Or with file watching:

```bash
npm run watch
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - JWT signing secret (default: development secret)

## API Usage Examples

### Login Request

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "login": "john.doe",
    "password": "password123"
  }'
```

### Expected Response

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Testing the API

1. Start the server: `npm run dev`
2. Open Swagger docs: http://localhost:3000/api-docs
3. Use the interactive documentation to test endpoints
4. Or use tools like Postman/Insomnia with the examples above

## Security Notes

- JWT tokens expire after 24 hours
- Passwords are stored in plain text (for demo purposes only)
- In production, use environment variables for secrets
- Implement proper password hashing for production use

## Checkout and mocked payments

Order submission now requires checkout information and an approved payment. Both
REST and GraphQL use the same in-memory repositories. Nothing survives a restart.
The frontend checkout page sends this input and handles the structured result.

Customer information contains required `firstName`, `lastName`, `email`, `phone`,
`address`, and `zipcode` strings. ZIP codes use US five-digit or ZIP+4 format and
preserve leading zeros. The frontend combines address and State into the address
string and sends zipcode separately. Information is stored as a
snapshot linked to the authenticated `userId` and `orderId`; the user profile is
not changed. Read it through the existing authenticated order endpoints in the
optional `checkout` field. Seeded orders have no checkout information.

Card information is a request-only DTO: `cardholderName`, `number`, `expiryMonth`,
`expiryYear` (four digits), and `securityCode`. Number and security code must be
strings. Card numbers are checked with Luhn validation; spaces and hyphens are
accepted. Expiry is valid through the end of the indicated UTC month. No card
fields are stored or returned, and request/provider errors are sanitized.

### REST

`POST /api/order/:orderId`, with `Authorization: Bearer <token>` and a JSON body:

```json
{
  "customer": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+12025550123",
    "address": "123 Main Street, New York",
    "zipcode": "10001"
  },
  "creditCard": {
    "cardholderName": "John Doe",
    "number": "4242424242424242",
    "expiryMonth": 12,
    "expiryYear": 2035,
    "securityCode": "123"
  }
}
```

The response has `success`, `code`, `message`, `orderId`, and, on approval,
`paymentId` and `paymentProvider`. Checkout stores these bank identifiers with
the customer snapshot. Payment details, including amount and currency, are not
stored or fetched; the bank owns that information. The charge amount is calculated
from stored order quantities/prices and any valid stored promo, then passed to
the acquiring adapter in USD cents. Client-supplied amounts, prices, quantities,
promos, user IDs, and payment identifiers are not used by checkout.

| HTTP | Code | Meaning |
| --- | --- | --- |
| 200 | `APPROVED` | Customer snapshot and bank identifiers saved; status becomes `submited` |
| 400 | `VALIDATION_ERROR` / `INVALID_ORDER_TOTAL` | Invalid checkout details or stored order total |
| 402 | `PAYMENT_DECLINED` | Payment declined |
| 403 | `AUTHENTICATION_REQUIRED` | Missing or invalid token |
| 404 | `ORDER_NOT_FOUND` | Unknown order or another user's order |
| 409 | `INVALID_ORDER_STATUS` / `ORDER_PROCESSING` | Order cannot be submitted or is already being paid |
| 502 | `PAYMENT_PROVIDER_ERROR` | Acquiring service failed |
| 500 | `INTERNAL_ERROR` | Unexpected submission failure |

Declines and provider failures leave the order `created` and save no checkout or
bank identifiers. A subsequent attempt is allowed. Concurrent submissions cannot
charge twice. Once approved, retries return the original payment ID and provider
without replacing the customer snapshot or calling the provider again. Submitted orders cannot
be edited. Edits and resets are also blocked while payment is in progress.

### GraphQL

```graphql
mutation Checkout($orderId: ID!, $input: CheckoutInput!) {
  submitOrder(orderId: $orderId, input: $input) {
    success
    code
    message
    orderId
    paymentId
    paymentProvider
  }
}
```

`input` has the same `customer` and `creditCard` objects as the REST body.
Business failures use the same result codes. Invalid GraphQL syntax, input types,
or missing required GraphQL fields use sanitized GraphQL errors.

```graphql
query Order($orderId: ID!) {
  order(orderId: $orderId) {
    orderId
    status
    checkout {
      userId
      orderId
      firstName
      lastName
      email
      phone
      address
      zipcode
      paymentId
      paymentProvider
    }
  }
}
```

### Acquiring adapter and mock scenarios

`IAcquiringService` in `src/services/interfaces.ts` accepts the request-only
card DTO, amount in minor units, currency, order reference, and an idempotency key.
It returns `approved` with `paymentId` and `provider`, `declined`, or
`provider_error`. Replace `MockAcquiringService` in `src/app.ts` with a real adapter
implementing this interface; the public checkout API remains the same. The adapter
must honor the idempotency key and must not log card details or return them as a
payment identifier. The same order lifecycle uses the same key across attempts.

Mock behavior, with any valid future expiry and 3–4 digit security code:

| Card number | Outcome |
| --- | --- |
| `4242424242424242` | Approved |
| `4000000000000002` | Declined |
| `4000000000000119` | Provider failure |

Other valid card numbers are approved by the mock. It does not contact an external
service or retain payment requests. `GET /reset/orders` resets orders and clears
checkout snapshots and bank identifiers; reseeded orders receive a new payment
lifecycle/key.

### Types and error handling

Persistence records live in `src/types/entities.ts`; request/response DTOs live in
`src/types/dtos.ts`. Repository and service interfaces live in their respective
`interfaces.ts` files.

`OrderService.submitOrder` returns the saved checkout on success and throws
`CheckoutError` on failure. Its `code` is a `CheckoutErrorCode` enum value from
`src/types/enums.ts`. Validation errors use the same hierarchy. REST and GraphQL
map errors to their public responses through `src/mappers/checkoutMapper.ts`;
unexpected exceptions become `INTERNAL_ERROR` without exposing their details.

### Verification

Run `npm test` in `backend`. This builds the backend and runs Node's test runner
without adding dependencies. Integration tests bind an ephemeral localhost port.
They retry only the existing deliberately injected every-fifth-request server
error; the existing 1.5-second request delay remains enabled.

The frontend's quantity edits are still local-only. Checkout charges for the
quantities stored in the backend, not unsaved frontend changes.
