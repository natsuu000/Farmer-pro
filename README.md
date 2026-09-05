# KrishiSetu

Database-backed Smart India Hackathon 2026 prototype for farmer procurement scheduling.

## Run

```powershell
npm install
npm run demo:reset
npm run dev
```

The app is served at `http://localhost:5173`; the API runs at `http://localhost:4000`.

## Deploy publicly with Railway

This repository is configured as a single-service deployment. The Express server serves both the built React app and `/api` routes, so the public app uses one origin.

1. Push this repository to GitHub.
2. Create a Railway project and deploy the GitHub repository.
3. Add a persistent volume mounted at `/data`.
4. Set these variables in Railway:

```text
NODE_ENV=production
DATABASE_PATH=/data/krishisetu.sqlite
SESSION_SECRET=<long-random-secret>
```

5. Generate a Railway domain and open it in a browser.

Railway uses `railway.json` to run `npm run build:deploy` and then `npm start`. The first deployment creates and seeds the SQLite database. Do not use `npm run demo:reset` on the public service because it deletes live data.

Demo accounts use password `demo123`:

- `demo.farmer@example.com`
- `demo.operator@example.com`
- `demo.admin@example.com`

## Persistence and reset

SQLite data is stored in `data/krishisetu.sqlite`. Run `npm run demo:reset` before a presentation to restore the repeatable scenario. `npm run db:migrate` creates the schema without deleting data.

## Waiting-time algorithm

`estimatedWait = eligibleFarmersAhead * averageProcessingMinutes / activeCounters`. Queue positions are recalculated from database bookings ordered by slot and creation time. Centre recommendations score queue length, capacity utilization, wait time, and available slots; the score is deterministic for the same database state.

## API

- `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/centres`, `GET /api/farmer/dashboard`, `POST /api/bookings`, `DELETE /api/bookings/:id`
- `GET /api/operator/queue`, `POST /api/operator/bookings/:id/check-in`, `POST /api/operator/call-next`, `POST /api/operator/bookings/:id/advance`
- `GET /api/admin/analytics`, `GET /api/notifications`, `POST /api/notifications/:id/read`

All mutations validate sessions, roles, ownership, state transitions, and database constraints. SMS and WhatsApp are provider-ready abstractions represented by persisted in-app notifications in development.
