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

## Mocked payment processing (GraphQL `payOrder`)

Payment is entirely mocked — no real payment gateway is contacted, and no
card data is ever persisted.

- **Card**: submitting the test card number `4000000000000002` always
  results in a declined payment (order stays `submitted`). Any other
  syntactically valid card number always succeeds (order moves to `paid`).
- **PayPal / Klarna**: the mocked "Proceed to payment" action always
  succeeds.

## Security Notes

- JWT tokens expire after 24 hours
- Passwords are stored in plain text (for demo purposes only)
- In production, use environment variables for secrets
- Implement proper password hashing for production use
