# Leading with Heart AI Coaching - Backend API

Node.js/Express.js backend API for the Leading with Heart AI Coaching application.

## Features

- **Authentication**: JWT-based authentication with bcrypt password hashing
- **Database**: PostgreSQL with connection pooling
- **AI Integration**: OpenAI API integration for coaching and email assistance
- **Email Service**: SMTP email service using Nodemailer
- **Stripe Integration**: Subscription management and payment processing
- **Usage Limits**: Daily usage tracking for free and pro users
- **RESTful API**: Clean REST API endpoints for all features

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (jsonwebtoken)
- **Email**: Nodemailer (SMTP)
- **AI**: OpenAI API
- **Payments**: Stripe

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database (or Supabase PostgreSQL)
- OpenAI API key
- Stripe account (for payments)
- SMTP credentials (for email service)

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd lwh-ai-coaching-backend-app
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `ENV_EXAMPLE.txt`:
```bash
cp ENV_EXAMPLE.txt .env
```

4. Configure your `.env` file with your credentials (see `ENV_EXAMPLE.txt` for details)

5. Run database migrations:
```bash
npm run migrate
```

## Environment Variables

See `ENV_EXAMPLE.txt` for all required environment variables.

Key variables:
- `DATABASE_URL` or individual DB connection variables
- `JWT_SECRET` - Secret key for JWT tokens
- `OPENAI_API_KEY` - OpenAI API key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `SMTP_*` - SMTP email configuration

## Running the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will run on `http://localhost:3001` by default (or the port specified in `PORT` env variable).

## API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/signin` - User login
- `GET /api/auth/me` - Get current user

### Subscriptions
- `GET /api/subscriptions` - Get user subscription
- `POST /api/subscriptions` - Update subscription

### Usage Limits
- `GET /api/usage-limits` - Get user usage limits
- `POST /api/usage-limits/increment` - Increment usage counter
- `PUT /api/usage-limits/:userId` - Set custom limits (admin only)

### Difficult Conversations
- `GET /api/difficult-conversations` - Get all conversations
- `GET /api/difficult-conversations/:id` - Get single conversation
- `POST /api/difficult-conversations` - Create conversation
- `PUT /api/difficult-conversations/:id` - Update conversation
- `DELETE /api/difficult-conversations/:id` - Delete conversation

### AI Functions
- `POST /api/ai/coaching-stream` - Streaming coaching responses
- `POST /api/ai/openai-completion` - OpenAI text completion
- `POST /api/ai/ai-assistant` - OpenAI Assistant API operations

### Other Endpoints
- `GET /health` - Health check
- See code for full API documentation

## Database Schema

The database schema is defined in `src/db/schema.sql`. Run migrations with:
```bash
npm run migrate
```

## Development

### Project Structure
```
src/
├── db/              # Database connection and migrations
├── middleware/      # Express middleware (auth, etc.)
├── routes/          # API route handlers
├── services/        # Business logic services
└── server.js        # Main server file
```

### Scripts
- `npm run dev` - Start development server with auto-reload
- `npm start` - Start production server
- `npm run migrate` - Run database migrations

## Migration from Supabase

This backend was migrated from Supabase. See `MIGRATION_GUIDE.md` for details.

## License

[Your License Here]

## Support

For issues and questions, please open an issue on GitHub.
