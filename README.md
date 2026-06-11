# Orbit PM

A ClickUp-inspired project management app built with Next.js. It supports task creation, assigning work, due dates, priority, status tracking, filters, board view, list view, editing, deletion, estimates, tags, and API-backed database persistence.

Tasks are stored through API routes. Local development uses SQLite at `data/orbit-pm.sqlite`. Deployments use PostgreSQL when `POSTGRES_URL` is configured.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy on Vercel

Create a PostgreSQL database from Vercel Storage, Neon, Supabase, or another hosted provider, then add its connection string to your Vercel environment variables:

```bash
POSTGRES_URL=postgres://...
```

After redeploying, `/api/tasks` will create the `tasks` table and seed starter tasks automatically.

## API

- `GET /api/tasks` - list tasks
- `POST /api/tasks` - create a task
- `PUT /api/tasks/:id` - update a task
- `DELETE /api/tasks/:id` - delete a task
