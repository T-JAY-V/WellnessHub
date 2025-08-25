# WellnessHub Backend

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
- Set your email credentials for notifications
- Update JWT_SECRET with a secure key

3. Start the server:
```bash
npm run dev
```

## API Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/appointments` - Book appointment
- `POST /api/contact` - Send contact message
- `POST /api/newsletter` - Subscribe to newsletter
- `GET /api/health` - Health check

## Frontend Integration

Include `public/api.js` in your HTML and use the provided functions to connect with the backend.