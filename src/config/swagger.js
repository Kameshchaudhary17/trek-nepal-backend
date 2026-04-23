/* OpenAPI 3.1 spec — hand-written so we don't have to annotate every route.
   Update alongside route changes. Served at GET /api/docs. */
export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Trek Nepal API',
    version: '1.0.0',
    description:
      'Trekking marketplace backend: auth, guides, bookings, pricing, payments (Stripe/NPR), reviews, messaging, AI helpers.',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { message: { type: 'string' } },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          fullName: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['trekker', 'guide', 'admin'] },
          profilePhoto: { type: 'string' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      Guide: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          user: { $ref: '#/components/schemas/User' },
          specialty: { type: 'string' },
          region: { type: 'string' },
          ratePerDay: { type: 'number', description: 'NPR per day' },
          status: { type: 'string', enum: ['pending', 'verified', 'rejected'] },
          averageRating: { type: 'number' },
          reviewCount: { type: 'integer' },
        },
      },
      Booking: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          trekker: { type: 'string' },
          guide: { type: 'string' },
          route: { type: 'string' },
          startDate: { type: 'string', format: 'date-time' },
          days: { type: 'integer', minimum: 1, maximum: 90 },
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'rejected', 'cancelled', 'completed'],
          },
          ratePerDay: { type: 'number' },
          totalCost: { type: 'number', description: 'NPR, incl. platform fee' },
          paymentStatus: {
            type: 'string',
            enum: ['unpaid', 'processing', 'paid', 'failed', 'refunded'],
          },
        },
      },
      Review: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          booking: { type: 'string' },
          guide: { type: 'string' },
          trekker: { type: 'string' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          comment: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Message: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          booking: { type: 'string' },
          from: { $ref: '#/components/schemas/User' },
          to: { type: 'string' },
          text: { type: 'string' },
          readAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'], summary: 'Register (sends OTP to email)', security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['fullName', 'email', 'password'], properties: {
            fullName: { type: 'string' }, email: { type: 'string' }, password: { type: 'string', minLength: 8 },
            role: { type: 'string', enum: ['trekker', 'guide'] }, phone: { type: 'string' },
            profilePhotoUrl: { type: 'string' }, nationalIdPublicId: { type: 'string' },
          }}}},
        },
        responses: {
          201: { description: 'OTP sent', content: { 'application/json': { schema: { type: 'object', properties: {
            message: { type: 'string' }, email: { type: 'string' }, resendAfterSeconds: { type: 'integer' },
          }}}}},
          409: { description: 'Email already registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }}}},
        },
      },
    },
    '/auth/verify-otp': {
      post: {
        tags: ['Auth'], summary: 'Verify email OTP', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, otp: { type: 'string' }}}}}},
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' }}}}},
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Login with email/password', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' }}}}}},
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' }}}},
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/logout': {
      post: { tags: ['Auth'], summary: 'Revoke current token', responses: { 200: { description: 'OK' }}},
    },
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Current user', responses: { 200: { description: 'OK' }}},
    },
    '/guides': {
      get: {
        tags: ['Guides'], summary: 'List verified guides (public)', security: [],
        parameters: [
          { in: 'query', name: 'search', schema: { type: 'string' }},
          { in: 'query', name: 'region', schema: { type: 'string' }},
          { in: 'query', name: 'minRating', schema: { type: 'number' }},
          { in: 'query', name: 'sort', schema: { type: 'string', enum: ['rating', 'price_asc', 'price_desc', 'experience', 'treks'] }},
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 }},
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 }},
        ],
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
          guides: { type: 'array', items: { $ref: '#/components/schemas/Guide' }},
          total: { type: 'integer' }, page: { type: 'integer' }, limit: { type: 'integer' },
        }}}}}},
      },
    },
    '/guides/{id}': {
      get: {
        tags: ['Guides'], summary: 'Public guide profile', security: [],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' }}],
        responses: { 200: { description: 'OK' }, 404: { description: 'Not found' }},
      },
    },
    '/guides/{guideId}/reviews': {
      get: {
        tags: ['Reviews'], summary: 'List reviews for a guide', security: [],
        parameters: [{ in: 'path', name: 'guideId', required: true, schema: { type: 'string' }}],
        responses: { 200: { description: 'OK' }},
      },
    },
    '/treks': {
      get: {
        tags: ['Treks'], summary: 'List active treks', security: [],
        responses: { 200: { description: 'OK' }},
      },
    },
    '/pricing/config': {
      get: {
        tags: ['Pricing'], summary: 'Pricing config (trek prices, tiers, seasons)', security: [],
        responses: { 200: { description: 'OK' }},
      },
    },
    '/bookings': {
      post: {
        tags: ['Bookings'], summary: 'Create booking (trekker)',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['guideId', 'route', 'startDate', 'days'], properties: {
          guideId: { type: 'string' }, route: { type: 'string' }, startDate: { type: 'string', format: 'date' },
          days: { type: 'integer' }, message: { type: 'string' },
        }}}}},
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { booking: { $ref: '#/components/schemas/Booking' }}}}}},
          400: { description: 'Validation error' },
        },
      },
    },
    '/bookings/my': {
      get: { tags: ['Bookings'], summary: 'Trekker: my bookings', responses: { 200: { description: 'OK' }}},
    },
    '/bookings/guide': {
      get: { tags: ['Bookings'], summary: 'Guide: bookings assigned to me', responses: { 200: { description: 'OK' }}},
    },
    '/bookings/{id}/status': {
      patch: {
        tags: ['Bookings'], summary: 'Update booking status',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' }}],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          status: { type: 'string', enum: ['confirmed', 'rejected', 'cancelled', 'completed'] },
          guideNote: { type: 'string' },
        }}}}},
        responses: { 200: { description: 'OK' }},
      },
    },
    '/bookings/{bookingId}/review': {
      get: {
        tags: ['Reviews'], summary: 'Existing review for a booking (parties only)',
        parameters: [{ in: 'path', name: 'bookingId', required: true, schema: { type: 'string' }}],
        responses: { 200: { description: 'OK' }},
      },
      post: {
        tags: ['Reviews'], summary: 'Submit a review (trekker, booking must be completed)',
        parameters: [{ in: 'path', name: 'bookingId', required: true, schema: { type: 'string' }}],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          rating: { type: 'integer', minimum: 1, maximum: 5 }, comment: { type: 'string' },
        }}}}},
        responses: { 201: { description: 'Created' }, 409: { description: 'Already reviewed' }},
      },
    },
    '/bookings/{bookingId}/messages': {
      get: {
        tags: ['Messages'], summary: 'Chat history for a booking',
        parameters: [
          { in: 'path', name: 'bookingId', required: true, schema: { type: 'string' }},
          { in: 'query', name: 'after', schema: { type: 'string', format: 'date-time' }, description: 'Only messages newer than this ISO timestamp' },
        ],
        responses: { 200: { description: 'OK' }},
      },
      post: {
        tags: ['Messages'], summary: 'Send a message',
        parameters: [{ in: 'path', name: 'bookingId', required: true, schema: { type: 'string' }}],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { text: { type: 'string', maxLength: 4000 }}}}}},
        responses: { 201: { description: 'Created' }},
      },
    },
    '/messages/unread': {
      get: { tags: ['Messages'], summary: 'Unread message count', responses: { 200: { description: 'OK' }}},
    },
    '/payments/intent/{bookingId}': {
      post: {
        tags: ['Payments'], summary: 'Create Stripe PaymentIntent (trekker, confirmed booking)',
        parameters: [{ in: 'path', name: 'bookingId', required: true, schema: { type: 'string' }}],
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: {
          clientSecret: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' },
        }}}}}, 503: { description: 'Stripe not configured' }},
      },
    },
    '/payments/webhook': {
      post: {
        tags: ['Payments'], summary: 'Stripe webhook (raw body; signature-verified)', security: [],
        responses: { 200: { description: 'OK' }, 400: { description: 'Signature mismatch' }},
      },
    },
    '/ai/price-check': {
      post: {
        tags: ['AI'], summary: 'Suggest fair guide rate range', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          trekId: { type: 'string' }, startDate: { type: 'string' }, days: { type: 'integer' }, tierId: { type: 'string' },
        }}}}},
        responses: { 200: { description: 'OK' }},
      },
    },
    '/ai/permits/{trekId}': {
      get: { tags: ['AI'], summary: 'Required permits for trek', security: [],
        parameters: [{ in: 'path', name: 'trekId', required: true, schema: { type: 'string' }}],
        responses: { 200: { description: 'OK' }}},
    },
    '/ai/planner/{trekId}': {
      get: { tags: ['AI'], summary: 'Day-by-day outline', security: [],
        parameters: [{ in: 'path', name: 'trekId', required: true, schema: { type: 'string' }}],
        responses: { 200: { description: 'OK' }}},
    },
    '/users/admin/stats': {
      get: { tags: ['Admin'], summary: 'Dashboard counters + recent activity', responses: { 200: { description: 'OK' }}},
    },
  },
};
