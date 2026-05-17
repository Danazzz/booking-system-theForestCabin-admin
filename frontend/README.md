# The Forest Cabin Admin Frontend

Vite React admin dashboard for managing bookings, rooms, promos, gallery, payment options, invoices, exports, and calendar views.

## Local Setup

```bash
cp .env.example .env
npm install
npm run dev -- --port 5174
```

The dev server prints the preview URL in the terminal.

## Environment

```env
VITE_API_URL=https://api.example.com
VITE_ADMIN_IDLE_TIMEOUT_MINUTES=10
```

For production, set `VITE_API_URL` to the deployed shared backend URL.

## Content Management

Admin-managed content shown on the guest frontend:

- Rooms page: room inventory, room descriptions, adult/child capacity, base price, and multiple room photos.
- Promos page: active offers, date validity, promo image, and price adjustment rules.
- Gallery page: guest-facing gallery images.
- Payments page: manual transfer, virtual account, QRIS, and other manual payment options.
- Invoice Settings page: invoice branding and email message settings.

## Commands

```bash
npm run dev -- --port 5174
npm run lint
npm run build
npm run preview
```
