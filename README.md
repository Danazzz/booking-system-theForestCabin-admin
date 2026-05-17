# The Forest Cabin Admin

Admin workspace for The Forest Cabin Kintamani. The production admin panel is the Vite React app in `frontend/`.

## Structure

```text
frontend/  Admin dashboard used by staff
backend/   Legacy/reference backend from the earlier admin project
```

The live booking system uses the shared backend in:

```text
forestCabin-booking/backend
```

Do not create a second production backend for admin. The admin frontend and guest frontend should both use the same `VITE_API_URL`.

## Local Development

Admin frontend:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev -- --port 5174
```

Shared backend:

```bash
cd ../forestCabin-booking/backend
cp .env.example .env
npm install
npm run dev
```

The running URLs are printed by each dev server in the terminal.

## Production

- Deploy `frontend/` as the admin panel.
- Set `VITE_API_URL` to the deployed shared backend URL.
- Add the admin frontend URL to backend `CORS_ORIGIN`.
- Seed the admin account from the shared backend after MongoDB Atlas is connected.

## Folder Docs

- Admin frontend details: [frontend/README.md](frontend/README.md)
- Legacy backend note: [backend/README.md](backend/README.md)
