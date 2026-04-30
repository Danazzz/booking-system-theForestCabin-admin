# Forest Cabin Booking Admin

Internal MERN admin system for managing bookings, room availability, OTA iCal sync, alerts, notifications, and admin access for one property.

## Project Structure

```text
backend/   Express + MongoDB API
frontend/  Vite React admin dashboard
```

## What This System Does

- Stores bookings in MongoDB.
- Prevents double booking using availability checks.
- Supports dynamic booking channels such as OTA or manual sources.
- Syncs OTA iCal sources.
- Creates admin alerts for risky situations.
- Sends admin email notifications for successful bookings and important alerts.
- Creates Google Calendar events for successful bookings when Calendar credentials are configured.
- Provides a protected React admin dashboard.

## Requirements

- Node.js
- npm
- MongoDB running locally

The backend currently expects MongoDB at:

```text
mongodb://127.0.0.1:27017/booking-sync
```

## Environment

Create or update `backend/.env`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/booking-sync
JWT_SECRET=change_this_to_a_secure_random_value
PORT=4000
```

Optional email notification settings:

```env
ADMIN_EMAIL=admin@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
EMAIL_FROM=Forest Cabin <no-reply@example.com>
```

Optional Google Calendar settings:

```env
GOOGLE_CALENDAR_ID=primary
```

Place the Google service account file at:

```text
backend/config/google-service-account.json
```

Do not commit real secrets.

## Install Dependencies

Backend:

```bash
cd backend
npm install
```

Frontend:

```bash
cd frontend
npm install
```

## Run The System

Start MongoDB first.

Start backend:

```bash
cd backend
npm run start
```

Backend runs on:

```text
http://127.0.0.1:4000
```

Start frontend:

```bash
cd frontend
npm run dev
```

Open the Vite URL shown in the terminal, usually:

```text
http://127.0.0.1:5173
```

If that port is busy, Vite may use `5174`, `5175`, or another nearby port.

## Admin Login

Seeded first admin:

```text
Username: admin
Password: admin
```

Use this only as a first-time local login. Change the password before using the system for real operations.

## Frontend Pages

### Dashboard

Use this page to check room availability and view active alerts.

Required inputs:

- `roomId`
- `checkIn`
- `checkOut`

The dashboard shows:

- total rooms
- booked rooms
- available rooms
- latest active alerts

### Bookings

Use this page to:

- create bookings
- view bookings
- edit bookings
- cancel bookings
- add promo details
- add internal notes

Booking create/update runs backend availability validation. If a room is unavailable, the backend rejects the booking and can create an overbooking alert.

### Rooms

Use this page to manage room types.

You can:

- create room types
- update room capacity
- enable or disable rooms
- delete a room only if it has no active bookings

Important fields:

- `name`
- `code`
- `totalUnits`

### Channels

Use this page to manage booking sources dynamically.

Examples:

- OTA source
- manual booking source
- direct booking source

The system does not hardcode source names. Create channels in the database, then use those channel names or IDs when creating bookings or syncing iCal.

Important fields:

- `name`
- `type`
- `isActive`

### Configs

Use this page to manage alert thresholds.

Important fields:

- `lowAvailabilityThreshold`
- `syncDelayThresholdMinutes`

These values are used by alert logic. They are not hardcoded in code.

### Alerts

Use this page to view active alerts.

Alert examples:

- low availability
- overbooking attempt
- sync delay

You can mark alerts as read.

### Sync

Use this page to manually run iCal sync from an OTA calendar URL.

Required inputs:

- `iCal URL`
- `roomId`
- `channel name`
- `roomCount`

Optional:

- `channelId`

iCal sync:

- fetches `.ics` data
- parses calendar events
- maps event UID to `externalId`
- skips duplicate bookings
- creates bookings through the normal booking service
- triggers availability checks and alerts
- sends successful-booking email notifications
- creates Google Calendar events when configured

## API Authentication

Most API routes require JWT authentication.

Login:

```http
POST /auth/login
```

Request:

```json
{
  "username": "admin",
  "password": "admin"
}
```

Protected requests must include:

```http
Authorization: Bearer <token>
```

The frontend stores the token in `localStorage`.

## Main API Routes

Auth:

```text
POST /auth/login
POST /auth/register
```

Bookings:

```text
POST   /bookings
GET    /bookings
GET    /bookings/:id
PATCH  /bookings/:id
DELETE /bookings/:id
```

Rooms:

```text
POST   /rooms
GET    /rooms
GET    /rooms/:id
PATCH  /rooms/:id
DELETE /rooms/:id
```

Channels:

```text
POST   /channels
GET    /channels
GET    /channels/:id
PATCH  /channels/:id
DELETE /channels/:id
```

Configs:

```text
POST   /configs
GET    /configs
GET    /configs/:id
PATCH  /configs/:id
DELETE /configs/:id
```

Alerts:

```text
GET   /alerts
PATCH /alerts/:id/read
```

iCal sync:

```text
POST /sync-ical
```

Availability:

```text
GET /availability
```

## Recommended First Use

1. Start MongoDB.
2. Start the backend.
3. Start the frontend.
4. Login with `admin` / `admin`.
5. Create rooms.
6. Create channels.
7. Create config thresholds.
8. Create manual bookings or run iCal sync.
9. Watch the dashboard, alert badge, and alerts page.

## Notes

- OTA availability cannot be controlled from this system.
- iCal sync only imports booking events.
- Existing bookings are skipped during iCal sync to prevent duplicates and avoid overwriting valid data blindly.
- Room deletion is blocked if active bookings exist.
- Booking deletion is a soft delete by setting status to `cancelled`.
- Channel deletion disables the channel by setting `isActive` to `false`.
