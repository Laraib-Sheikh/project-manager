# Orbit PM

A ClickUp-inspired project management app built with Next.js. It supports task creation, assigning work, due dates, priority, status tracking, filters, board view, list view, editing, deletion, estimates, tags, and API-backed database persistence.

Tasks are now stored through API routes in a local SQLite database at `data/orbit-pm.sqlite`.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## API

- `GET /api/tasks` - list tasks
- `POST /api/tasks` - create a task
- `PUT /api/tasks/:id` - update a task
- `DELETE /api/tasks/:id` - delete a task
