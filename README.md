# Outbox / ReachInbox Email Scheduler

A full-stack email scheduling system built with Express, PostgreSQL, Prisma, Redis, BullMQ, NextAuth, and Next.js.

## Architecture

- Frontend: Next.js App Router
- Auth: NextAuth with Google OAuth
- API: Express + TypeScript
- Database: PostgreSQL + Prisma
- Queue: BullMQ + Redis
- Worker: standalone delayed email processor
- Delivery: Nodemailer with Ethereal fallback for local/dev testing
- Search: optional Elasticsearch index with PostgreSQL ownership filters
- Monitoring: authenticated Bull Board at `/api/admin/queues`
- Notifications: optional Slack OAuth connection and rate-limit alerts

## Core flow

User
↓
Next.js UI
↓
NextAuth
↓
Express API
↓
Prisma / PostgreSQL
↓
BullMQ queue in Redis
↓
Dedicated worker
↓
Redis-backed delay and rate limiting
↓
SMTP delivery
↓
Database status update to SENT / FAILED

## Local development services

- PostgreSQL on localhost:5433
- Redis on localhost:6379
- Google OAuth credentials for NextAuth

## Install and run

From the root project folder:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

Run the backend API:

```bash
npm run dev:backend
```

Run the frontend:

```bash
npm run dev:frontend
```

Run the worker:

```bash
cd backend
npm run worker
```

For a production-style run, build and apply migrations once, then run each
long-lived process as its own service (the start commands do not return):

```bash
npm run migrate:deploy
npm run build:backend
npm run build:frontend
npm run start:backend
npm run start:worker
```

Start the frontend separately with `npm start` from `frontend/`.

Run the API and worker as separate long-running processes. Provide production
environment variables through the hosting platform rather than committing `.env`
files. PostgreSQL, Redis, and SMTP must be reachable from the processes that use
them. Elasticsearch is optional and must only be reachable when enabled.

Reindex existing PostgreSQL emails into Elasticsearch:

```bash
cd backend
npm run elasticsearch:reindex
```

The command reads PostgreSQL in batches, uses each email ID as the deterministic
Elasticsearch document ID, and exits non-zero if Elasticsearch is unavailable.

Run backend tests:

```bash
cd backend
npm test
```

## Build commands

```bash
npm run build:backend
npm run build:frontend
```

## Environment variables

Use the examples in:

- [backend/.env.example](backend/.env.example)
- [frontend/.env.example](frontend/.env.example)

Core backend values include:

- `DATABASE_URL`
- `REDIS_URL`
- `GOOGLE_CLIENT_ID`
- `ADMIN_EMAILS` (comma-separated verified Google emails allowed to access Bull Board)
- `CLIENT_ORIGIN`

The worker requires `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`SMTP_SECURE`, and `SMTP_FROM`. The frontend requires `NEXTAUTH_URL`,
`NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
`NEXT_PUBLIC_API_URL`. Slack variables are needed only when Slack is enabled;
Elasticsearch variables are optional.

For production, replace all localhost URLs and development credentials, set
`NODE_ENV=production`, use a strong `NEXTAUTH_SECRET`, and configure a public
`NEXTAUTH_URL`, `CLIENT_ORIGIN`, and `SLACK_REDIRECT_URI`.

## Deployment Preparation

No cloud services or credentials are provisioned by this repository. The current
deployment dependency map is:

```text
Frontend -> Backend -> PostgreSQL (Neon)
Backend -> Redis (BullMQ queue)       Worker -> same Redis
Worker -> PostgreSQL and Ethereal SMTP
Backend -> Slack (optional OAuth/notifications)
Backend -> Elasticsearch (optional search/indexing)
```

### Services and Process Commands

- PostgreSQL: Neon. Use its direct connection URL as `DATABASE_URL`; this project
	currently uses one database URL for runtime and migrations.
- Redis: a managed Redis service compatible with BullMQ. Set the same `REDIS_URL`
	on the backend and worker.
- Backend: build with `npm run build` and start with `npm start` from `backend/`.
- Worker: build with `npm run build` and start with `npm run start:worker` from
	`backend/`. Run it as a separate continuous service, not a scheduled job.
- Frontend: build with `npm run build` and start with `npm start` from `frontend/`;
	Vercel can run the existing Next.js app from that directory.
- Migration release step: from `backend/`, run `npx prisma migrate deploy` after
	setting production `DATABASE_URL`. Do not use `prisma db push` in production.

Configure backend and worker environment variables from
[`backend/.env.example`](backend/.env.example). At minimum, backend requires
`DATABASE_URL`, `REDIS_URL`, `GOOGLE_CLIENT_ID`, `CLIENT_ORIGIN`, and `ADMIN_EMAILS`.
The worker additionally requires `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, `SMTP_SECURE`, `SMTP_FROM`, and `SLACK_TOKEN_ENCRYPTION_KEY` when Slack
connections/rate-limit notifications are enabled. Set `ATTACHMENT_STORAGE_DIR` to
a persistent shared volume if attachments are used. `ELASTICSEARCH_URL`,
`ELASTICSEARCH_API_KEY`, and `ELASTICSEARCH_INDEX` are optional.

Configure the frontend from [`frontend/.env.example`](frontend/.env.example):
`NEXTAUTH_URL` is the public frontend URL, `NEXTAUTH_SECRET` must be a strong
private value, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are the Google OAuth
credentials, and `NEXT_PUBLIC_API_URL` is the public backend URL ending in `/api`.
The Google client ID must match the backend's `GOOGLE_CLIENT_ID`.

### OAuth URLs

For Google OAuth, register the frontend origin as an authorized JavaScript origin
and add this exact NextAuth redirect URI:

```text
https://<frontend-domain>/api/auth/callback/google
```

For Slack, set `SLACK_REDIRECT_URI` to:

```text
https://<backend-domain>/api/slack/callback
```

Set `SLACK_SUCCESS_REDIRECT` to `https://<frontend-domain>/dashboard`. Keep
`SLACK_TOKEN_ENCRYPTION_KEY` private and stable; it must be a 32-byte hex key.

### Demo Limitations and Post-Deploy Checks

- Ethereal is a test mailbox, not a production delivery provider. The current
	environment's SMTP settings are not copied into deployment configuration. No
	hosting provider has been selected, so outbound TCP access to Ethereal on port
	587 cannot be verified here; check the chosen provider's policy and test from
	its deployed worker before relying on it.
- Attachments are stored on the local filesystem. Ephemeral or separate backend/
	worker filesystems are not safe for attachment delivery. Demonstrate without
	attachments unless both services share durable storage mounted at the same
	`ATTACHMENT_STORAGE_DIR`. Moving to object storage would require changing the
	upload and worker retrieval paths.
- Elasticsearch is optional. Leaving `ELASTICSEARCH_URL` unset does not stop
	scheduling or sending; search is unavailable until Elasticsearch is configured.
- After configuration, verify `/api/health`, Google login and authenticated API
	access, a scheduled test email and Ethereal preview, the worker queue, Slack if
	enabled, and admin-only access to `/api/admin/queues`. Do not treat a successful
	API response as proof of SMTP delivery.

## Scheduling behavior

- There is no cron scheduler.
- Scheduling is implemented with BullMQ delayed jobs.
- The API persists email records and creates queue jobs for each recipient.
- The worker claims `PENDING` records atomically before send.
- Redis-backed delay coordination enforces minimum spacing between sends.
- Redis-backed hourly counting enforces sender-level rate limits.
- Over-limit jobs are rescheduled instead of failing permanently.
- Duplicate send attempts are prevented with idempotent status transitions.

## Authentication

The frontend uses Google OAuth through NextAuth. API requests carry a Google ID token in
the Authorization header. The backend verifies that token against the configured Google
client ID and derives the sender from verified claims; identity headers are not trusted.

## Search and queue monitoring

PostgreSQL remains the source of truth. When `ELASTICSEARCH_URL` is configured, scheduled
records are indexed and `/api/emails/search` applies the authenticated sender filter before
returning results. Elasticsearch failures return a service-unavailable response without
blocking persistence or queue delivery.

The actual `email-scheduler` BullMQ queue is visible through the admin-protected Bull Board
route `/api/admin/queues`. Authenticated non-admin users receive `403`; configure
`ADMIN_EMAILS` or set the persisted Sender role to `ADMIN`.

## Slack

Slack connection starts at `GET /api/slack/connect`, completes at the configured OAuth
callback, stores the encrypted access token in PostgreSQL, and disconnects through
`DELETE /api/slack/connection`. Hourly-limit notifications are deduplicated in Redis and
Slack failures are logged without failing email jobs. Slack and Elasticsearch require
external services and credentials for end-to-end verification.

## Senders and attachments

The authenticated Google sender is provisioned as the default sender. Additional sender
identities can be created through the authenticated `/api/senders` API and are owned by
the authenticated sender. Compose loads those records and submits the selected sender ID;
the schedule API verifies ownership before persisting `Email.senderId`.

Compose attachments are uploaded as multipart files, validated for supported types and a
10 MB per-file limit, stored under `ATTACHMENT_STORAGE_DIR`, and represented in PostgreSQL
by attachment metadata. BullMQ carries only the email ID; the worker resolves attachment
references from PostgreSQL and sends them through Nodemailer. Files are retained after
failure so retries do not lose them.

## Verification status

Implemented and locally verified: frontend build, backend build, Prisma validation and
generation, schedule validation tests, secure header rejection, sender ownership checks in
the schedule path, bounded attachment storage references, Bull Board admin middleware, and
the reindex command's non-zero failure behavior when Elasticsearch is unavailable.

Implemented but requiring external verification: Slack OAuth and notifications,
Elasticsearch indexing/search, Ethereal attachment delivery, and worker restart recovery
against live PostgreSQL/Redis/SMTP infrastructure.

Not yet covered by the lightweight local test suite: full multi-worker Redis tests,
database-backed sender isolation tests, attachment SMTP integration tests, and a complete
restart/no-duplicate end-to-end scenario.

## Idempotency and safety

- The worker only processes rows that are currently `PENDING`.
- already-sent records are skipped
- job retries are controlled by the queue and worker logic
- database state updates happen atomically via Prisma updates

## CSV / TXT handling

The compose flow accepts CSV/TXT uploads, parses valid email addresses, removes duplicates, and preserves sanitized values before submission to the backend.

## Final notes

- The app is intended for local/dev use with Ethereal SMTP unless real SMTP credentials are configured.
- The frontend is real NextAuth + backend-integrated and does not use permanent mock scheduling data.
- The backend remains the source of truth for user ownership, validation, and scheduling enforcement.
