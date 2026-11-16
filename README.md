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
| `packages/medicines-db` | Schema and migrations of the shared medicines database (the AMMPS list) | | |
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
- **Shared medicines database.** One Neon database (`MEDICINES_DATABASE_URL`) holds the national AMMPS medicines list for every cabinet. Only admin-api writes it, and migrates it at startup; clinics only read it. A cabinet's own wording, favorites and custom medicines stay in its own database, linked by `ammps_id`, with no keys across databases. No patient data goes there.
- **Same-origin API.** Both Next apps proxy `/api/*` to their API, so the session cookie stays on the cabinet's subdomain.
- **Daily upkeep.** On each cabinet's first request of the Moroccan day, the API closes the previous days' appointments that were never moved on (see the Agenda section below).

## Features

### Cabinet app (`clinic-web` + `clinic-api`)

**Dashboard**
- Period filter: 7 jours (default), 30 jours, 90 jours, 1 an, or a custom date range (a year at most). The KPI cards compare with the previous period of the same length, and the activity chart switches between days, weeks and months to fit the period.
- Today's appointments, the waiting room and the welcome line always show today.
- The owner of several spaces picks one space or *Tous les espaces* from a dropdown next to the period.

**Agenda and waiting room**
- Calendar per space (cabinet location), with opening hours, closures and protection against double booking across spaces.
- Status flow: Planifié → Confirmé → Salle d'attente → En consultation → Terminé, plus Annulé and Absent.
- Agenda header, **acts filter** next to the status filter: tick acts (with their colour) to show only their appointments; none ticked shows them all. Kept in the URL (`?acte=`), like the status filter.
- Events on the calendar wear their act's colour (Paramètres › Tarifs), matched by the motif; a motif that isn't an act shows in grey. Absent and Annulé visits are faded, and Annulé is struck through. Status colours stay on the badges and the status filter.
- When an appointment's day ends:
  - **Confirmé** becomes **Absent**;
  - **Planifié** becomes **Annulé**.
- **Tableau** tab: today's patient flow as a kanban board (Planifié → Confirmé → Salle d'attente → En consultation → Terminé). Drag a card, or use its menu, to change the status. The desk moves cards between the first three columns; only a doctor moves a card into or out of En consultation. Visits are finished in the dossier, so Terminé accepts no drops.
- Waiting room tab for today's visits. When a consultation is in progress, the doctor sees a "Reprendre la consultation" button.
- Header chips:
  - patients waiting, with a **Suivant** shortcut to call the doctor's next patient;
  - the doctor's current consultation and how long it has been running.

**Patients and consultations**
- Global search (⌘K / Ctrl+K or `/`): type 2 characters to find a patient of the current space by name, phone, CIN or file number, then open their file. Pages and actions are listed under the results.
- Patient files with a dossier, consultations, vitals, prescriptions, certificates and documents (stored on R2).
- Dossier header, during a visit: **Renouveler l'ordonnance** (the last ordonnance's lines into today's, then its tab) and **Imprimer ▾** (everything written at this visit: ordonnance, certificates, bilans biologiques, comptes rendus, letters, numbered when there are several of a kind, each on its print page; what is being typed is saved first). A keyboard button lists the dossier's shortcuts (1–9 for the tabs, ⌘/Ctrl+S, formatting).
- Dossier **tab bar**: the tabs that fit, then **Plus ▾** with the others (showing the active one when it is there). Keys **1–9** open a tab when the doctor isn't typing. Counts on Bilan, Documents and Ordonnance; an amber dot when work isn't saved yet (red if saving failed) on Interrogatoire, Ordonnance, Bilan biologique, Compte rendu and Lettres. Those writing tabs stay mounted, so switching tabs never loses a draft.
- Dossier header, **clinical alerts**: the name, file number and age, then chips from the medical profile that stay visible on every tab: sensitive treatments found in the current treatments (anticoagulant, antiagrégant, insuline, corticoïdes, immunosuppresseur; orange) and the permanent note. An ⓘ button explains what each label is and where it comes from; the note's label opens the tab where it is edited. A chip shows the full text on hover and opens the patient file to edit it.
- Dossier header, **Rendez-vous** button: the agenda's booking dialog over the dossier, the patient already chosen and the doctor as practitioner; opening hours, congés, holidays and double booking are checked as in the agenda. Beside the form, a small calendar and the practitioner's appointments on the chosen day; picking a day there sets the date.
- Dossier, **Interrogatoire et examen** tab: first a **Note permanente** (rich text on the patient, autosaved, also shown in the header's alerts), then Motif, Observation and Diagnostic (rich text, saved with today's visit), Antécédents (one rich-text note on the patient, the same at every visit) and Traitement (the past ordonnances, with a reprint link). Rich text is cleaned by the API to the editor's formatting.
- Dossier, **Bilan** tab (second): the analyses the patient had done elsewhere, kept on the patient across visits, shown as a grid (a row per test, searchable, a column per date, newest first, with ↑/↓ against the previous value; an empty cell adds a value for that test and day, a filled one shows it to delete), or switched to **Graphiques**: one curve per test with numbers on a real time axis, its last value with the % change since the previous one, min, max and since when (values that aren't numbers are listed apart). The doctor picks a test from a built-in catalog (glycémie, NFS, bilan lipidique, rénal, hépatique, thyroïde…, with its unit), types the value and the day of the analysis. Newest first, each with the previous value of the same test. Doctors only.
- Dossier, **Documents** tab (third): the same documents as the patient sheet. The doctor adds them (classified, by file or camera), opens them and filters the history; deleted by whoever added them, or the owner.
- Dossier, **Bilan biologique** tab (fifth): the analyses the doctor asks for. Pick one or more bilans (Cabinova's list or the doctor's own custom bilans) and the rich editor fills in; the doctor edits the text, then **Enregistrer** and **Imprimer** (letterhead, A5 or A4, at `/bilans/:id`). The history reprints a bilan or takes it up again. Written by doctors, printed by the whole staff.
- Dossier, **Compte rendu** tab (just before Lettres): works like Lettres, with its own history; the print page is titled "Compte rendu".
- Lettres and Compte rendu offer **examples** to start from (adressage, urgences, liaison, avis cardiologique, radiologie, kiné, médecine du travail, mutuelle; consultation, suivi diabète/HTA, pédiatrie, ECG, échographie, préopératoire, soins). Picking one fills the editor with the patient, age, CIN, date and doctor; what was written can be brought back.
- Dossier, **Lettres** tab (last, in place of Historique): the doctor writes a letter in the rich editor, then **Enregistrer** and **Imprimer** (letterhead, A4 or A5, at `/lettres/:id`). The history reprints a letter or opens it to correct it. Written by doctors, printed by the whole staff.
- In the patient sheet, doctors also get **Ordonnances** and **Certificats** history tabs, read-only, with a reprint link. Cancelled certificates show struck through.
- Reusable phrases and printable documents.

**Payments**
- Cash desk (*Caisse du jour*) with blind cash counting.
- *Visites du jour* table. Its "Voir" button opens a read-only view; "Encaisser" records a payment.
- Owner-only KPIs: total received, number of visits, cancelled visits and payment rate.
- **Mutuelle (Oui / Non)** per visit, in the checkout and the dossier's Prix consultation: whether the patient sends this visit to their mutuelle. Anyone at the cabinet can answer; saved with the checkout and shown on a settled visit.
- A visit paid in full is final: the checkout shows its details only, and the API refuses changes (`VISIT_SETTLED`). To correct it, cancel the payment first.
- Tariffs, reports. Each act has a colour, picked from the calendar palette or any custom colour (colour chooser or a "#rrggbb" code); a new act without one gets the least-used palette colour.

**Team and communication**
- Staff, roles (owner, doctor, secretary…), absences, sessions and activity log.
- Internal chat, with the unread count on the header's Inbox button.
- Meetings and notifications.

**Medicines (AMMPS)**
- The ordonnance suggests medicines from the national AMMPS list (about 9,950), shared by every cabinet: one line per medicine (name, dosage, form) with its boxes and lowest PPV, each word typed matched on its own ("doliprane 1g"). Withdrawn and suspended medicines are never suggested.
- Each doctor's own layer: favorites first, their label, usual posology and duration, hidden medicines, and their medicines outside the list. Managed in Paramètres › Mes médicaments, and from the ordonnance (★, 🔖, "Ajouter à mes médicaments").
- When the AMMPS renames a medicine a doctor renamed, they choose: take the new value or keep theirs. Renewing an old ordonnance flags what has been withdrawn since.
- Ordonnance lines are snapshots: what was printed never changes, whatever happens to the list later.

**Settings**
- Cabinet, spaces, opening hours, tariffs, integrations (Google), profile, Mes médicaments (doctors).
- French and Arabic, with full RTL support.

### Super Admin (`admin-web` + `admin-api`)

- Tenants: creation, database provisioning, subdomains.
- Plans, features catalog and billing, with a `billing:sweep` script.
- Platform users, security (2FA), audit log, support, settings and a technical view.
- Médicaments: the shared AMMPS list (counts, search, status filters) and its imports. A Super Admin uploads the AMMPS export (.xlsx); the import is all or nothing, never deletes a medicine, and refuses a file that looks incomplete (under 80 % of the active medicines, or over 5 % unreadable lines). Every import is audited.

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

### Medicines database (optional)

Without it, everything runs; ordonnances then suggest only each doctor's own medicines.

1. Create a dedicated Neon database and put its owner URL in `apps/admin-api/.env` as `MEDICINES_DATABASE_URL`. admin-api creates and migrates the tables at startup (`packages/medicines-db`).
2. Give clinic-api a role that can only read, and put its URL in `apps/clinic-api/.env` as `MEDICINES_DATABASE_URL`. clinic-api also opens every session read-only.
   ```sql
   create role medicines_reader login password '…';
   grant connect on database <medicines_db> to medicines_reader;
   grant usage on schema public to medicines_reader;
   grant select on all tables in schema public to medicines_reader;
   alter default privileges in schema public grant select on tables to medicines_reader;
   ```
3. Fill it once with the AMMPS export, then refresh it from Super Admin › Médicaments:
   ```bash
   pnpm --filter admin-api medicines:import ~/Downloads/medicaments-ammps.xlsx
   ```
4. Run `pnpm --filter admin-api db:seed` once so the Super Admin gets the `medicines:read` / `medicines:write` permissions, and apply the cabinet migration `0041_medication_overrides` with **Migrer**.

## Environment variables

Each API validates its variables at boot (`src/config/env.ts`). Never commit real values.

| App | Variables |
| --- | --- |
| `admin-api` | `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `MEDICINES_DATABASE_URL` (optional: owner URL of the medicines database; fill it with `pnpm medicines:import <file.xlsx>`), `TENANT_DB_ADMIN_URL`, `TENANT_SECRETS_KEY`, `TENANT_SECRETS_KEY_VERSION`, `TENANT_SECRETS_PREVIOUS_KEYS`, `TENANT_BASE_DOMAIN`, `WEB_ORIGIN`, `CLINIC_APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `PORT`, `TRUST_PROXY`, `NEON_WS_PROXY`, `SLOW_REQUEST_MS`, `LOG_ALL_REQUESTS` |
| `clinic-api` | `DATABASE_URL`, `MEDICINES_DATABASE_URL` (optional, ideally a read-only role), `TENANT_SECRETS_KEY`, `TENANT_SECRETS_KEY_VERSION`, `TENANT_SECRETS_PREVIOUS_KEYS`, `TENANT_BASE_DOMAIN`, `CLINIC_APP_URL`, `PLATFORM_WEB_ORIGIN`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `RESEND_API_KEY`, `EMAIL_FROM`, `PORT`, `TRUST_PROXY`, `NEON_WS_PROXY`, `SLOW_REQUEST_MS`, `LOG_ALL_REQUESTS` |
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
| `pnpm --filter admin-api medicines:import <file.xlsx>` | Imports the AMMPS export into the medicines database once (`MEDICINES_DATABASE_URL`) |

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

- **2026-11-16**
  - Dossier, Bilan › Graphiques, redesigned for patients with many bilans: a list of tests on the side (grouped as on a lab report, searchable, each with its last value, trend and a small curve) and one large chart for the test picked, with Tout / 1 an / 6 mois, round axis values, min / moyenne / max, the change since the previous value (in units, and % when meaningful) and its values in a table. A single measure shows a message instead of an empty chart.
  - Every **Imprimer** in the cabinet app (ordonnance, certificats, bilans biologiques, comptes rendus, lettres, reçus, devis, factures) opens a print dialog instead of a new tab: the document previewed exactly as printed, A5 / A4 where offered, then **Annuler**, **Enregistrer (PDF)** (a PDF of the sheet, made in the browser, about 70 KB) or **Imprimer** (the document only). Ctrl / ⌘ click still opens the page in a new tab. The print pages themselves no longer have a toolbar (A5 / A4, Imprimer / PDF): the dialog has those buttons.
  - Ordonnance: **Aperçu et modification**, a rich editor under the lines showing the whole ordonnance (numbered medicines, posology, duration, advice). It follows the lines until the doctor rewords it; then that text is saved and printed as is, with "Recomposer à partir des lignes" to start again from the lines, and a warning when the lines change after the rewording (migration `0042_prescription_body`).
  - Medicines, step 1: the shared medicines database (`packages/medicines-db`, migration `0000_baseline`: `medications`, `medication_imports`, `pg_trgm`). admin-api migrates it at startup when `MEDICINES_DATABASE_URL` is set.
  - Medicines, step 2: admin-api reads the AMMPS export (.xlsx, inline or shared strings): columns found by header, prices to DH ("4.303.00 DH", "10,70 DH", "SANS PPV"), status to marketed / not marketed / withdrawn, bad lines and repeated ids reported. The 2026-11-15 file reads in full: 9,947 medicines.
  - Medicines, step 3: the AMMPS import, all or nothing: new medicines added, only real changes updated, medicines no longer in the file marked inactive (never deleted), returning ones reactivated. Refused, with nothing changed, when the file has under 80% of the active medicines or over 5% unreadable lines. One import at a time; one cut off by a restart is released after 15 minutes. `pnpm medicines:import <file.xlsx>` runs it once (the 2026-11-15 file: under 2 s).
  - Medicines, step 4: Super Admin **Médicaments** page (Administration): active / marketed / not marketed / withdrawn counts, the searchable list with status filters, the import history, and **Importer la liste AMMPS** (drop the .xlsx, see what was added, changed or retired, or why the file was refused). New permissions `medicines:read` / `medicines:write` (run `pnpm db:seed` once so the Super Admin gets them); every import is in the audit journal.
  - Medicines, step 5: each doctor's own medicines data in the cabinet database (migration `0041_medication_overrides`): `medication_overrides` (their wording, usual posology and duration, favorite or hidden, per AMMPS medicine, with the AMMPS name and dosage saved alongside to spot later AMMPS changes) and `custom_medications` (products outside the AMMPS list). Ordonnance lines may now keep `ammpsId` / `customMedicationId` next to the text they print, which never changes once saved.
  - Medicines, step 6: clinic-api reads the medicines database (`MEDICINES_DATABASE_URL`, every session read-only) and `/medications` serves doctors:
    - `search?q=` from 2 letters, accents aside: their own medicines and the AMMPS list, one line per medicine (name, dosage, form) with its boxes and lowest PPV, their wording, posology, favorite and hidden ones applied, never a withdrawn or inactive medicine, favorites first;
    - `favorites`, `overrides` (with "updated by the AMMPS" when the AMMPS changed what they renamed), `PUT / DELETE ammps/:id/override`, `POST ammps/:id/override/accept-ammps`, CRUD `custom`;
    - `check-renewal`: before renewing an ordonnance, the lines whose medicine was withdrawn, left the list, or was deleted (warnings only).
    Without the medicines database, search falls back to the doctor's own medicines.
  - Medicines, step 7: the ordonnance's medicine field suggests from 2 letters, each word matched on its own ("doliprane 1g", "amlor 5"): favorites ★ first with their usual posology, the AMMPS list (dosage, form, substances, boxes, lowest PPV, "Non commercialisé" / "Mis à jour par l'AMMPS"), the doctor's own medicines, then what they prescribed before, and "Ajouter « … » à mes médicaments" for anything typed. Picking fills the line and its usual posology, then moves to the posology. On a picked line, ★ makes it a favorite and 🔖 keeps its posology as the usual one. Renewing an old ordonnance flags the lines whose medicine has since been withdrawn, left the list, or was deleted.
  - Medicines, step 8: **Paramètres › Mes médicaments** (doctors only; each doctor's own): AMMPS updates to review ("Prendre la nouvelle valeur" or "Garder la mienne") when the AMMPS changed the name or dosage of a medicine they renamed; their AMMPS medicines (their label with the official name below, usual posology and duration, favorite, hidden), customised from a search of the list or reverted to the AMMPS values; their medicines outside the list (add, edit, favorite, delete). Medicine names stay readable in Arabic (isolated as left-to-right text), here and in the ordonnance suggestions.
- **2026-11-15**
  - Dossier, Bilan: results as a tests × dates grid.
  - Dossier, Bilan: Tableau / Graphiques switch, with a curve per test.
- **2026-11-14**
  - Tarifs: a custom colour for an act, shown everywhere in the agenda (migration `0040_act_custom_color`).
  - Prix consultation / checkout: Mutuelle oui/non per visit (migration `0039_charge_mutuelle`).
  - Agenda: filter by act.
  - Dossier header: Renouveler l'ordonnance, an Imprimer menu for the visit's documents, and the shortcuts help.
  - Dossier: tabs that always fit (Plus menu), keys 1–9, counts and unsaved markers.
  - Dossier: the permanent note is editable again, as a rich editor at the top of Interrogatoire et examen.
  - Maladies chroniques removed from the app and the database (migration `0038_drop_chronic_conditions`, which deletes the stored values).
  - Allergies removed from the app (header chips, appointment panel, antécédents, API) and from the database (migration `0037_drop_allergies`, which deletes the stored allergies).
  - Patient sheet: the Note administrative is gone (no longer in the form); the sheet shows the Note permanente instead, so the patient has a single note.
  - Dossier header: clinical alert chips replace the repeated identity and the allergies strip.
  - Dossier: book the patient's next appointment without leaving the page, with a small calendar and the day's appointments beside the form.
  - Dossier: Lettres tab replaces Historique (migration `0035_letters`).
  - Dossier: Compte rendu tab, like Lettres (migration `0036_letter_kind`).
  - Lettres and Compte rendu: a list of examples to start from.
  - Dossier: Bilan biologique tab, fifth, with custom bilans, print page and history (migration `0034_lab_requests`).
  - Dossier: Documents tab, third (history and upload, shared with the patient sheet).
  - Dossier: Bilan tab, second, for the analyses done outside (migration `0033_lab_results`); Bilan biologique stays a placeholder for now.
  - Dossier: a compact left column (one patient card with a line per detail, latest constantes three to a row) that fits the screen without scrolling.
  - Dossier: the Interrogatoire et examen tab now holds Motif, Antécédents, Observation, Diagnostic (rich editors) and Traitement; constantes, conduite à tenir and the next-visit note left the tab (migrations `0031_rich_dossier`, `0032_rich_diagnosis`).
  - Global search finds patients (name, phone, CIN, file number).
  - Tarifs: each act has a colour, and the agenda colours appointments by act instead of by status (migration `0030_act_color`).
- **2026-11-13**
  - Dashboard: period filter (7 days, 30 days, 90 days, 1 year or a date range) instead of the space toggle; the space choice moved to a dropdown.
  - Sidebar: Patient aujourd’hui (the flow board) in the Agenda group, and a marker on the active item.
- **2026-11-10**
  - Agenda: new Tableau tab, a kanban board of the day's patient flow.
  - Paid visits are read-only in the checkout (UI and API).
  - New icon (airplane) for Congés et absences.
  - Patient sheet: Ordonnances and Certificats history tabs (doctors only).
  - At the end of an appointment's day, Confirmé becomes Absent and Planifié becomes Annulé.
  - Header chips for the waiting room ("Suivant") and the current consultation.
  - "Reprendre la consultation" in the waiting room.
  - Wider status dropdown.
  - Owner KPIs on the *Visites du jour* tab, and a read-only "Voir" sheet.
  - Unpaid table removed from *Caisse du jour*.
  - Landing page redesign with light and dark modes, and a fixed security section.
  - Header Inbox button with the unread count.
