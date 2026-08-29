# ServEase Backend

REST API serving both the ServEase mobile app (`ServEaseMobile`) and the web client (`ServEaseWeb`). Built with **Node.js + Express + Supabase** (Postgres + Storage).

## Prerequisites

- Node.js >= 22.11
- A Supabase project (free tier works): <https://supabase.com>

## Setup

1. **Create the database schema**

   In the Supabase dashboard open **SQL Editor → New query**, paste the contents of
   [`src/db/schema.sql`](src/db/schema.sql) and run it. This creates the tables,
   seeds the service catalog, and creates the private `verification-docs` storage bucket.

2. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   (Supabase dashboard → **Project Settings → API**). Set a long random `JWT_SECRET`.

   > The service role key bypasses Row Level Security — keep it server-side only,
   > never expose it to the mobile or web clients.

3. **Install and run**

   ```bash
   npm install
   npm run dev      # node --watch, auto-restarts on changes
   # or: npm start
   ```

   The API listens on `http://localhost:5000` (health check: `GET /api/health`).

## API Reference

Base URL: `/api`. Protected routes expect `Authorization: Bearer <token>`.

### Auth

| Method | Endpoint | Body | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | multipart: `fullName`, `email`, `phone`, `password`, `address`, optional file `validId` | Creates a pending customer account and sends a 6-digit OTP |
| POST | `/auth/verify-otp` | `phone`, `code` | Verifies the phone, activates the account, returns JWT |
| POST | `/auth/resend-otp` | `phone` | Sends a new code (60s cooldown) |
| POST | `/auth/login` | `email`, `password` | Returns JWT + user profile |
| POST | `/auth/forgot-password` | `email` | Sends a reset code to the account's phone |
| POST | `/auth/reset-password` | `email`, `code`, `newPassword` | Resets the password |
| GET | `/auth/me` | — 🔒 | Current user profile |

### Service catalog

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/services/categories` | Categories with their services (used by the provider application flow) |

### Service provider applications

| Method | Endpoint | Body | Description |
| --- | --- | --- | --- |
| POST | `/providers/applications` 🔒 | multipart: personal fields, `categories`/`services` (JSON array or comma-separated), `yearsExperience`, `offersHomeService`, `agreeCertify=true`, `agreeTerms=true`, files `validId`, `selfie` (required), `supportingDocs` (optional) | Submits the 3-step application |
| GET | `/providers/applications/me` 🔒 | — | Latest application of the current user |
| GET | `/providers/applications` 🔒 admin | — | All applications |
| PATCH | `/providers/applications/:id/review` 🔒 admin | `action: "approve" \| "reject"`, optional `notes` | Approving promotes the user to `service_provider` |

### Service requests (bookings)

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/bookings/active` 🔒 | The customer's most recent non-final service request (`pending`/`accepted`/`in_progress`), or `null` — powers the customer home "Active Repair" card |

### Notifications

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/notifications` 🔒 | The signed-in user's notifications, newest first (max 50) |
| PATCH | `/notifications/:id/read` 🔒 | Marks a notification as read |

## Development notes

- **OTP delivery uses PhilSMS** — set `PHILSMS_API_TOKEN` (and optionally
  `PHILSMS_SENDER_ID`) in `.env` to send real SMS messages. When the token is
  empty (local dev), codes are logged to the server console and, outside
  production, echoed back in the response as `devOtp` so the mobile app can be
  tested without SMS credits. Phone numbers are normalised to the `639XXXXXXXXX`
  format PhilSMS expects (`src/utils/otp.js`). If a send fails outside
  production (e.g. the PhilSMS trial "sending limit exceeded" error), the code
  is logged to the console as `[sms-fallback]` and the flow continues; in
  production the request fails with a 502 instead.
- **Uploads** (valid ID, selfie, supporting docs) go to the private
  `verification-docs` Supabase Storage bucket; only JPEG/PNG/WebP/PDF up to 5 MB.
- **CORS** is configured via `CORS_ORIGINS` for the web client. The mobile app
  (Android emulator) reaches the backend at `http://10.0.2.2:5000/api`.

## Project structure

```
server.js               Entry point
src/
  app.js                Express app (helmet, CORS, logging, routes)
  config/               Env config + Supabase client
  controllers/          Request handlers
  db/schema.sql         Database schema + seed data
  middleware/           Auth, uploads (multer), error handling
  routes/               Route definitions
  utils/                JWT, OTP, storage, validators
```
