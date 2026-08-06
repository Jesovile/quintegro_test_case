import swaggerJsdoc from 'swagger-jsdoc';

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
              enum: ['created', 'submited', 'waiting_payment', 'finished'],
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
            orderId: {
              type: 'string',
              description: 'Unique order identifier',
              example: 'order-1'
            },
            status: {
              type: 'string',
              enum: ['created', 'submited', 'waiting_payment', 'finished'],
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
