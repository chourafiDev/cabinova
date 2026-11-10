# Cabinova

Cabinova is a multi-tenant SaaS for medical cabinets in Morocco. Each cabinet gets:

- its own subdomain (`atlas.cabinova.ma`);
- its own database;
- an app in French and Arabic (RTL) for the doctor, the secretary and the cash desk.

The platform team runs every cabinet from a separate Super Admin app.

> This README is a living document. Every new feature adds a line to [What's new](#whats-new) and, when it changes how the product works, to [Features](#features).

---

## Contents

- [Apps and packages](#apps-and-packages)
- [Architecture](#architecture)
- [Features](#features)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Testing](#testing)
- [Conventions](#conventions)
- [What's new](#whats-new)

---

## Apps and packages

A pnpm monorepo (`pnpm@9`, Node 22).

| Path | What it is | Stack | Dev port |
| --- | --- | --- | --- |
| `apps/clinic-web` | Cabinet app for doctors, secretaries and the cash desk (fr/ar) | Next 16, React 19, next-intl, TanStack Query, shadcn | 3002 |
| `apps/clinic-api` | Cabinet API, which resolves the tenant from the host | NestJS 12, raw SQL on Neon | 4100 |
| `apps/admin-web` | Super Admin console | Next 16, React 19, TanStack Query | 3000 |
| `apps/admin-api` | Super Admin API: tenants, plans, billing, provisioning | NestJS 12, Drizzle, Neon | 4000 |
| `apps/landing` | Public site and docs (cabinova.ma), light and dark | Next 16, Tailwind 4, motion | 3001 |
| `packages/tenant-db` | Schema and migrations of a cabinet's own database | | |
| `packages/features` | Registry of every feature the code implements, synced to the admin catalog | | |
| `packages/mail` | Shared e-mail layout: logo, brand colour, footer | | |
| `packages/secret-box` | AES-256-GCM for secrets at rest (tenant DB credentials, 2FA) | | |
| `packages/morocco-time` | Correct Moroccan time on any runtime (permanent UTC+0) | | |
| `packages/request-timing` | `Server-Timing` header and slow-request logs for both APIs | | |

## Architecture

```
            cabinova.ma (landing)        admin.cabinova.ma (admin-web)
                                                   │ /api/*
                                                   ▼
  {cabinet}.cabinova.ma (clinic-web)          admin-api ──► platform DB (Neon)
            │ /api/*                               │  provisions
            ▼                                      ▼
        clinic-api ──── TenancyService ──► one Neon database per cabinet
            │
            └── Cloudflare R2 (patient documents) · Resend (e-mail)
```

- **Database per tenant.** For each request, `TenancyService.resolve(host)` maps the subdomain to its tenant and returns a connection pool. Credentials are stored encrypted with `secret-box`.
- **Same-origin API.** Both Next apps proxy `/api/*` to their API, so the session cookie stays on the cabinet's subdomain.
- **Daily upkeep.** On each cabinet's first request of the Moroccan day, the API closes the previous days' appointments that were never moved on (see the Agenda section below).

## Features

### Cabinet app (`clinic-web` + `clinic-api`)

**Agenda and waiting room**
- Calendar per space (cabinet location), with opening hours, closures and protection against double booking across spaces.
- Status flow: Planifié → Confirmé → Salle d'attente → En consultation → Terminé, plus Annulé and Absent.
- When an appointment's day ends:
  - **Confirmé** becomes **Absent**;
  - **Planifié** becomes **Annulé**.
- Waiting room tab for today's visits. When a consultation is in progress, the doctor sees a "Reprendre la consultation" button.
- Header chips:
  - patients waiting, with a **Suivant** shortcut to call the doctor's next patient;
  - the doctor's current consultation and how long it has been running.

**Patients and consultations**
- Patient files with a dossier, consultations, vitals, prescriptions, certificates and documents (stored on R2).
- In the patient sheet, doctors also get **Ordonnances** and **Certificats** history tabs, read-only, with a reprint link. Cancelled certificates show struck through.
- Reusable phrases and printable documents.

**Payments**
- Cash desk (*Caisse du jour*) with blind cash counting.
- *Visites du jour* table. Its "Voir" button opens a read-only view; "Encaisser" records a payment.
- Owner-only KPIs: total received, number of visits, cancelled visits and payment rate.
- Tariffs, reports.

**Team and communication**
- Staff, roles (owner, doctor, secretary…), absences, sessions and activity log.
- Internal chat, with the unread count on the header's Inbox button.
- Meetings and notifications.

**Settings**
- Cabinet, spaces, opening hours, tariffs, integrations (Google), profile.
- French and Arabic, with full RTL support.

### Super Admin (`admin-web` + `admin-api`)

- Tenants: creation, database provisioning, subdomains.
- Plans, features catalog and billing, with a `billing:sweep` script.
- Platform users, security (2FA), audit log, support, settings and a technical view.

### Landing (`apps/landing`)

- Marketing homepage in French with light and dark themes: hero, specialties, figures, features, roles, how it works, security, pricing, testimonials, FAQ.
- Product docs under `/docs`.

## Getting started

```bash
pnpm install
```

1. Create `.env` files from the examples. The variables are listed in the next section.
2. Set up the platform database and seed the first admin:
   ```bash
   pnpm --filter admin-api db:migrate
   pnpm --filter admin-api db:seed
   pnpm --filter admin-api db:seed-demo   # optional demo cabinet
   ```
3. Run the four main apps:
   ```bash
   pnpm dev
   ```
   Start the landing separately with `pnpm dev:landing`.

In development, open a cabinet at `http://{subdomain}.localhost:3002`.

## Environment variables

Each API validates its variables at boot (`src/config/env.ts`). Never commit real values.

| App | Variables |
| --- | --- |
| `admin-api` | `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `TENANT_DB_ADMIN_URL`, `TENANT_SECRETS_KEY`, `TENANT_SECRETS_KEY_VERSION`, `TENANT_SECRETS_PREVIOUS_KEYS`, `TENANT_BASE_DOMAIN`, `WEB_ORIGIN`, `CLINIC_APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `PORT`, `TRUST_PROXY`, `NEON_WS_PROXY`, `SLOW_REQUEST_MS`, `LOG_ALL_REQUESTS` |
| `clinic-api` | `DATABASE_URL`, `TENANT_SECRETS_KEY`, `TENANT_SECRETS_KEY_VERSION`, `TENANT_SECRETS_PREVIOUS_KEYS`, `TENANT_BASE_DOMAIN`, `CLINIC_APP_URL`, `PLATFORM_WEB_ORIGIN`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `RESEND_API_KEY`, `EMAIL_FROM`, `PORT`, `TRUST_PROXY`, `NEON_WS_PROXY`, `SLOW_REQUEST_MS`, `LOG_ALL_REQUESTS` |
| `admin-web` | `API_URL` (default `http://localhost:4000`) |
| `clinic-web` | `CLINIC_API_URL` (default `http://localhost:4100`; needed at build and at start) |
| `landing` | `NEXT_PUBLIC_CLINIC_APP_URL`, `NEXT_PUBLIC_TENANT_BASE_DOMAIN` (both optional) |

## Scripts

Run these from the repo root:

| Command | What it does |
| --- | --- |
| `pnpm dev` | admin-api, admin-web, clinic-api, clinic-web in parallel |
| `pnpm dev:landing` | Public site on :3001 |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm lint` | oxlint for the APIs, eslint for the web apps |
| `pnpm test` | Unit tests |
| `pnpm test:e2e` | End-to-end tests against a throwaway database (needs Docker) |
| `pnpm build` | Build everything |

## Testing

- **Unit tests:** `pnpm test`.
- **End-to-end tests:** `pnpm test:e2e`.
  - Docker starts Postgres 17 behind Neon's WebSocket proxy, plus an S3 mock (`apps/admin-api/test/docker-compose.yml`). The APIs run the same Neon driver as in production.
  - The suites provision real cabinets and run clinic-api in-process.
  - Stop the containers with `pnpm --filter admin-api test:e2e:db:down`.
- **CI** (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests, every build and the end-to-end suite on each PR and on pushes to `master`.

## Conventions

- **Icons:** each web app imports icons only from its own `@/components/icons` (Iconsax Bulk). Lint enforces this.
- **Time:** use `moroccoZone` from `packages/morocco-time`. Node's built-in time zone data is stale for Morocco.
- **i18n:** clinic-web keeps its messages in `fr` and `ar` JSON files, one per namespace. Every new string goes in both.
- **No AI in the product:** features use built-in templates and search, not LLM services.
- **Money is for the owner:** the cash desk counts blind, so money totals are shown only to the owner.

## What's new

Add new entries at the top, as *date: what changed*.

- **2026-11-10**
  - Patient sheet: Ordonnances and Certificats history tabs (doctors only).
  - At the end of an appointment's day, Confirmé becomes Absent and Planifié becomes Annulé.
  - Header chips for the waiting room ("Suivant") and the current consultation.
  - "Reprendre la consultation" in the waiting room.
  - Wider status dropdown.
  - Owner KPIs on the *Visites du jour* tab, and a read-only "Voir" sheet.
  - Unpaid table removed from *Caisse du jour*.
  - Landing page redesign with light and dark modes, and a fixed security section.
  - Header Inbox button with the unread count.
