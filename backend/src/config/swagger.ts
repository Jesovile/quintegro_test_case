import swaggerJsdoc from 'swagger-jsdoc';
import { CheckoutErrorCode } from '../types/enums';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Quintegro API',
      version: '1.0.0',
      description: 'REST API with Express.js and TypeScript',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        CustomerInfo: {
          type: 'object',
          required: ['firstName', 'lastName', 'email', 'phone', 'address', 'zipcode'],
          properties: {
            firstName: { type: 'string', minLength: 1, maxLength: 100 },
            lastName: { type: 'string', minLength: 1, maxLength: 100 },
            email: { type: 'string', format: 'email', maxLength: 254 },
            phone: { type: 'string', maxLength: 40, description: '7 to 15 digits; common separators and a leading + are accepted' },
            address: { type: 'string', minLength: 1, maxLength: 1000 },
            zipcode: { type: 'string', pattern: '^\\d{5}(-\\d{4})?$', description: 'US ZIP or ZIP+4 code; leading zeros are preserved' }
          }
        },
        CreditCardInput: {
          type: 'object',
          writeOnly: true,
          required: ['cardholderName', 'number', 'expiryMonth', 'expiryYear', 'securityCode'],
          properties: {
            cardholderName: { type: 'string', maxLength: 100 },
            number: { type: 'string', writeOnly: true, description: '13 to 19 digits passing Luhn validation; spaces and hyphens accepted' },
            expiryMonth: { type: 'integer', minimum: 1, maximum: 12 },
            expiryYear: { type: 'integer', description: 'Four-digit year; card must not be expired' },
            securityCode: { type: 'string', writeOnly: true, pattern: '^\\d{3,4}$' }
          }
        },
        CheckoutInput: {
          type: 'object',
          required: ['customer', 'creditCard'],
          properties: {
            customer: { $ref: '#/components/schemas/CustomerInfo' },
            creditCard: { $ref: '#/components/schemas/CreditCardInput' }
          }
        },
        Checkout: {
          allOf: [
            { $ref: '#/components/schemas/CustomerInfo' },
            {
              type: 'object',
              required: ['orderId', 'userId', 'paymentId', 'paymentProvider'],
              properties: {
                orderId: { type: 'string' },
                userId: { type: 'string' },
                paymentId: { type: 'string', description: 'Payment identifier issued by the bank' },
                paymentProvider: { type: 'string', description: 'Acquiring provider identifier' }
              }
            }
          ]
        },
        SubmitOrderResult: {
          type: 'object',
          required: ['success', 'code', 'message', 'orderId'],
          properties: {
            success: { type: 'boolean' },
            code: {
              type: 'string',
              enum: ['APPROVED', ...Object.values(CheckoutErrorCode)]
            },
            message: { type: 'string' },
            orderId: { type: 'string' },
            paymentId: { type: 'string' },
            paymentProvider: { type: 'string' }
          }
        },
        UserRecord: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique user identifier',
              example: 'user-1'
            },
            name: {
              type: 'string',
              description: 'User full name',
              example: 'John Doe'
            }
          },
          required: ['id', 'name']
        },
        AuthRecord: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'Reference to existing user ID',
              example: 'user-1'
            },
            login: {
              type: 'string',
              description: 'User login/username',
              example: 'john.doe'
            },
            password: {
              type: 'string',
              description: 'User password',
              example: 'password123'
            }
          },
          required: ['userId', 'login', 'password']
        },
        LoginRequest: {
          type: 'object',
          properties: {
            login: {
              type: 'string',
              description: 'User login/username',
              example: 'john.doe'
            },
            password: {
              type: 'string',
              description: 'User password',
              example: 'password123'
            }
          },
          required: ['login', 'password']
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'JWT authentication token',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            }
          },
          required: ['token']
        },
        ProductRecord: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique product identifier',
              example: 'product-1'
            },
            title: {
              type: 'string',
              description: 'Product title',
              example: 'Laptop'
            },
            description: {
              type: 'string',
              description: 'Product description (max 300 characters)',
              example: 'High-performance laptop with latest specifications and great battery life. Perfect for work and gaming.'
            },
            image: {
              type: 'string',
              description: 'URL to product image',
              example: '/productImg/laptop.svg'
            }
          },
          required: ['id', 'title', 'description', 'image']
        },
        OrderRecord: {
          type: 'object',
          properties: {
            orderId: {
              type: 'string',
              description: 'Unique order identifier',
              example: 'order-1'
            },
            userId: {
              type: 'string',
              description: 'ID of user who owns the order',
              example: 'user-1'
            },
            status: {
              type: 'string',
              enum: ['created', 'submited', 'finished'],
              description: 'Order status',
              example: 'finished'
            },
            createAt: {
              type: 'number',
              description: 'Creation timestamp',
              example: 1703123456789
            },
            products: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    description: 'Product ID',
                    example: 'product-1'
                  },
                  amount: {
                    type: 'number',
                    minimum: 0,
                    maximum: 10,
                    description: 'Product quantity (0-10)',
                    example: 1
                  },
                  price: {
                    type: 'number',
                    minimum: 0,
                    description: 'Product price',
                    example: 1299.99
                  }
                },
                required: ['id', 'amount', 'price']
              }
            },
            promo: {
              $ref: '#/components/schemas/PromoEntity'
            }
          },
          required: ['orderId', 'userId', 'status', 'createAt', 'products']
        },
        OrderDTO: {
          type: 'object',
          properties: {
            checkout: { $ref: '#/components/schemas/Checkout' },
            orderId: {
              type: 'string',
              description: 'Unique order identifier',
              example: 'order-1'
            },
            status: {
              type: 'string',
              enum: ['created', 'submited', 'finished'],
              description: 'Order status',
              example: 'finished'
            },
            products: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  product: {
                    $ref: '#/components/schemas/ProductRecord'
                  },
                  amount: {
                    type: 'number',
                    minimum: 1,
                    maximum: 10,
                    description: 'Product quantity (1-10)',
                    example: 1
                  },
                  price: {
                    type: 'number',
                    minimum: 0,
                    description: 'Product price',
                    example: 1299.99
                  }
                },
                required: ['product', 'amount', 'price']
              }
            },
            promo: {
              $ref: '#/components/schemas/PromoEntity'
            }
          },
          required: ['orderId', 'status', 'products']
        },
        PromoEntity: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Human readable short code (unique)',
              example: 'SAVE10'
            },
            discount: {
              type: 'number',
              enum: [5, 10, 20],
              description: 'Discount percentage',
              example: 10
            },
            dueDate: {
              type: 'number',
              description: 'Expiration timestamp',
              example: 1703123456789
            }
          },
          required: ['id', 'discount', 'dueDate']
        }
      }
    }
  },
  apis: ['./src/routes/*.ts'], // Path to the API routes
};

export const specs = swaggerJsdoc(options);
