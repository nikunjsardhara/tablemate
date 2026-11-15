# Tablemate ☕

Ask the café a question. Meet the person who answers it best.

Scan the QR code at your table, post a listing with questions (and private
expectations), and Gemini scores every answer against what you were actually
looking for. If someone's answers convince you, share your profile and propose
a meeting at the same café.

## Stack

- Next.js 16 (App Router, client pages + Route Handlers, `cacheComponents`)
- Gemini API (`@google/genai`) — screening + scoring in two batched calls
- Cloud SQL for PostgreSQL (local dev: any Postgres)
- Tailwind CSS 4
- Cloud Run for deployment

## Run locally

```bash
createdb tablemate
psql "$DATABASE_URL" -f init.sql      # schema
psql "$DATABASE_URL" -f seed.sql      # demo data
```

Create `.env.local`:

```
DATABASE_URL=postgresql://<user>@127.0.0.1:5432/tablemate
DATABASE_SSL=false
GEMINI_API_KEY=<your key>
GEMINI_MODEL=gemini-3.8-flash
```

```bash
npm run dev
```

Without `GEMINI_API_KEY` the app falls back to deterministic mock scoring so
the whole flow still works offline. Set `SCORING_MODE=mock` to force it.

## Deploy to Cloud Run

```bash
gcloud auth login
gcloud config set project $GOOGLE_CLOUD_PROJECT_ID
./scripts/deploy.sh setup    # APIs, Cloud SQL instance, database, user
./scripts/deploy.sh deploy   # build + deploy (needs a gemini-api-key secret)
```

One-time secret:

```bash
gcloud secrets create gemini-api-key --data-file=- <<< "$GEMINI_API_KEY"
```

Schema is applied once through the Auth Proxy:

```bash
./cloud-sql-proxy $PROJECT_ID:$REGION:tablemate-db --port 5432 &
psql "postgresql://app:$DB_PASSWORD@127.0.0.1:5432/tablemate" -f init.sql
```

The Cloud Run service talks to Cloud SQL over the unix socket
(`/cloudsql/<connection-name>`), so `DATABASE_SSL=false` in both environments.

## API

| Route | Method | Purpose |
|---|---|---|
| `/api/profile` | GET / PUT | Read or update my profile (creates session) |
| `/api/listings` | GET / POST | Browse open listings / create (screened) |
| `/api/listings/[id]` | GET | Asker: ranked responses + scores; others: questions only |
| `/api/listings/[id]/respond` | POST | Submit answers, screen + score, persist |
| `/api/invitations` | GET / POST | Inbox / share profile + propose meeting |
| `/api/invitations/[id]` | PATCH | Accept / decline / counter-propose |

Privacy rules enforced server-side: expectations only ever leave the database
for the asker; `profiles.contact` is only ever serialized inside a shared
invitation.
