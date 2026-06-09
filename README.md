# MX-IX — Full Stack Monorepo

Internet Exchange platform: marketing site + admin control panel (frontend) and
content/telemetry API (backend), merged into a single repository.

```
MX-IX/
├── frontend/        React 18 + Vite + TypeScript + Tailwind (SPA + admin panel)
├── backend/         Node + Express 5 + TypeScript + MongoDB (REST API, JWT auth)
├── package.json     Root scripts (runs both together via concurrently)
├── .env.example     Reference for backend/.env and frontend/.env
└── .gitignore
```

## Prerequisites
- Node.js >= 18
- MongoDB running locally (or a MongoDB Atlas connection string)

## Setup
```bash
# 1. Install root tooling + both apps
npm run install:all

# 2. Create env files
#    backend/.env   -> copy the BACKEND section from .env.example
#    frontend/.env  -> copy the FRONTEND section from .env.example (dev only)

# 3. Run both apps together (FE on :5173, BE on :5000)
npm run dev
```

The backend auto-seeds default data (including the admin user) on first boot.

## Common scripts (run from repo root)
| Command | Description |
|---|---|
| `npm run dev` | Run frontend + backend together |
| `npm run dev:frontend` | Frontend only |
| `npm run dev:backend` | Backend only |
| `npm run build` | Build both for production |
| `npm run seed` | Re-seed the database |

## How they connect
- In **dev**, Vite proxies `/api` to `http://localhost:5000` (see `frontend/vite.config.ts`).
- In **production**, the frontend calls `/api` on the same origin. Put a reverse
  proxy (nginx) in front: serve the built `frontend/dist` at `/` and proxy
  `/api` to the Node server.

## Default admin login
Set via `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `backend/.env`. Change these before
deploying.
