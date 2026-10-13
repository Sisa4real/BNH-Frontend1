# CLAUDE.md — bnh-ui

## Custodian rules

- Money is integer kobo only; never floats; never computed by an AI at runtime.
- DoA thresholds live in a database/config table and are enforced on the server. A role cannot approve above its band.
- Authority = a position held by a person for a period. Designations are data.
- The event log is append-only. No role, including admin, can edit or delete it. Corrections are new entries.
- Never commit .env files, keys, passwords or real BNH data.
- `bnh-ui` reads the backend URL from an environment variable, never hard-coded.
- For every task: `git pull` → make the change → run the app and all tests → fix until green → explain in plain words → commit → push → report the commit hash.
- Never force-push. If a push is rejected, pull, resolve, re-test, then push.
- When a change affects the API between the two repos, say so, and list what the other repo must change.

## This repo

Staff-facing frontend for **Custodian by Brendan**, Brendan Nicholas Holdings' (BNH) requisitions and Delegation of Authority (DoA) system — Module 1. Implementation is well underway. Inspect the code and recorded verification before assuming a feature is complete. The Custodian rules above override anything below.

### Known gaps against the Custodian rules (fix as dedicated tasks, not silently)

- **Backend URL fallback**: `src/hooks.server.ts` reads `process.env.BACKEND_URL` but falls back to a hard-coded `http://127.0.0.1:8000` when it is unset. The rule forbids a hard-coded URL; the fix is to fail clearly (503 "not configured") when the variable is missing.
- **Money over the API**: the backend sends amounts as decimal naira strings (e.g. `"71640.00"`). `src/lib/money.ts` already converts them to `BigInt` kobo for previews and formatting — keep it that way and never use JS `Number` for money. When the backend moves to integer kobo (a backend task), this repo must update `money.ts`, the regenerated `src/lib/api/schema.ts`, and every form/display that sends or parses amounts.
- **DoA thresholds**: the UI must not encode authority bands. Show the server-assigned authority and explanation only. The thresholds are currently hard-coded in the backend (`app/authority/policy.py`), which is a backend gap.

### Product references

- `docs/reference/ui_scrrens.md` (filename typo is real) — the authoritative release scope: fourteen screens.
- `docs/reference/implementation_pan.md` — requirements, stable feature IDs, acceptance criteria and the canonical status tracker. Do not create a second tracker.
- `docs/reference/recap.md` — approval rules. `docs/reference/features.md` — scope summary only.
- `docs/reference/ui_todos.md` (endpoint-consumption notes) and `docs/reference/task_done.md` (verified delivery notes).
- `docs/development.md` — onboarding guide for both repos. `docs/render.md` — deployment.
- These are snapshots of a shared `docs/` folder from the original workspace, which does not exist here. When changing shared API contracts, read `../bnh-backend/CLAUDE.md`.

The user's latest explicit decisions take precedence. Do not infer new financial policy.

### Release scope: fourteen screens

1. Sign In 2. Forgot Password 3. Set Password / Activate Account 4. Dashboard 5. Requisitions 6. Create / Edit Requisition 7. Requisition Details & Review 8. My Tasks / Approval Inbox 9. Board Resolution Workspace 10. Vendors 11. Staff & Access Management 12. Organisation & Authority 13. Audit Log 14. My Account & Security

Drawers/dialogs handle vendor details and edits, invitations, appointments, department edits and signing; a header drawer holds notifications; a viewer shows attachments and generated documents. Reuse screens across roles and states. No extra apps or screens, workflow builder, contracts, scoring, payments, or placeholder screens for Modules 2–4. Approved means authorised, not paid.

### Stack

- SvelteKit 3 with Svelte 5 (runes forced on for project files), strict TypeScript 6, Vite 8, `@sveltejs/adapter-node` (Node server, not a static site).
- Node 24.21.0 pinned in `.nvmrc` and `package.json` engines (`>=24.21.0 <25`, `engine-strict=true`). npm with the committed `package-lock.json`; install with `npm ci`.
- ESLint 10 + Prettier 3 (Svelte plugin), svelte-check, Vitest 4, Playwright. `pdfjs-dist` for the document viewer.
- Native form controls and built-in Svelte reactivity. Add a state/form library or UI kit only for a demonstrated need.

### Structure

- `src/routes/` — pages, layouts and loaders. `(workspace)/` holds the signed-in screens (dashboard, requisitions, `[id]`, `[id]/board`, `new`, vendors, staff, organisation, audit, account). `login`, `forgot-password`, `recover` are public.
- `src/lib/features/<domain>/` — reusable feature components (account, board, notifications, organisation, requisitions).
- `src/lib/components/ui/` — shared primitives. `src/lib/styles/app.css` — design tokens.
- `src/lib/api/` — `client.ts` plus generated `openapi.json` and `schema.ts` (never hand-edit).
- `src/lib/server/proxy.ts` — server-only API proxy. `src/hooks.server.ts` — `/health` and the `/api/v1/*` proxy.
- `src/lib/money.ts` — BigInt kobo arithmetic and formatting helpers.
- `tests/*.e2e.ts` — Playwright journeys. `src/**/*.test.ts` — Vitest unit tests.

Import alias `#lib/*` maps to `src/lib/*`. Keep request/user state scoped to the request or component tree, never a shared mutable server singleton.

### How it connects to bnh-backend

- `bnh-backend` (FastAPI) is the sibling directory `../bnh-backend`. FastAPI owns authentication, business rules and persistence.
- The browser calls same-origin `/api/v1/*`; `hooks.server.ts` forwards it to `BACKEND_URL` (backend origin, no `/api/v1`) and passes back session cookies. Only `content-type`, `cookie`, `x-csrf-token`, `origin`, `accept` are forwarded.
- The backend's `ALLOWED_ORIGINS` must list this UI's exact origin. Use `localhost` consistently in development.
- API types are generated in the backend: `uv run python -m scripts.export_openapi` (run in `../bnh-backend`) writes `src/lib/api/openapi.json` and `schema.ts` here. Commit them with the matching change.
- Playwright starts `../bnh-backend` (`.venv/bin/python -m scripts.browser_fixture`, port 8017) and the built UI (`node build`, port 4173).

### Install, run, test

```bash
nvm use            # or install Node 24.21.0 another way
npm ci
cp .env.example .env    # BACKEND_URL only; never commit .env
BACKEND_URL=http://127.0.0.1:8000 npm run dev -- --host localhost --port 5173 --strictPort
```

Open `http://localhost:5173/login`. The backend must already be running.

Checks (all must pass before committing):

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test -- --run
npm run build
npx playwright install chromium
npm run test:e2e
```

E2E needs the sibling backend set up with `uv sync` and its isolated PostgreSQL test cluster (`uv run python -m scripts.dev_database`), with ports 8017 and 4173 free. Rebuild before E2E; it serves `build/`. Missing services or skipped tests are not a pass; report them as not run.

### Deployment

Render, Docker web service, using `Dockerfile` and `render.yaml` (`healthCheckPath: /health`). Set `BACKEND_URL` to the backend's origin; `NODE_ENV=production` and `BODY_SIZE_LIMIT=11M` are set in the image. Deploy the backend first. Details in `docs/render.md`.

Note: `render.yaml` and the docs still name branch `dev`, and `docs/development.md` still clones from `Bapper-Ik/bnh-ui`. The current remote is `github.com/Sisa4real/BNH-Frontend1` and has only `main`. Confirm the deploy branch with the owner before changing either.

### Engineering conventions

- Work on one feature at a time by its stable feature ID in `docs/reference/implementation_pan.md`, finished end to end with the backend where needed. Put the feature ID in the commit message. Update the tracker, `ui_todos.md` and `task_done.md` with actual results.
- Preserve existing partial work and other people's changes; stage only the current feature.
- Server responses decide totals, lifecycle, permissions and next actions. Hiding a button is never authorisation; no client-side policy engine.
- Send expected versions and idempotency keys on relevant mutations; reuse a key only for a retry of identical intent. Disable duplicate clicks.
- Never store credentials, recovery tokens, restricted evidence or bank data in browser storage. Don't log credentials, bank details, signatures or signed URLs. Clear user-scoped caches on logout or account change.
- Mocks and fixtures only in tests or explicit isolated dev mode; never fake success after an API failure.
- Test meaningful behaviour (cost forms, validation, revision conflicts, permission-driven actions, signing, Board wording), not static markup. Playwright uses distinct synthetic requester, approver, Secretary and Chairman identities against a real test backend.
- Never copy personal or bank data from sample forms into fixtures or screenshots. Three genuine staff requisitions are a separate human acceptance gate.

### Visual and interaction standard

| Purpose                                  | Colour    |
| ---------------------------------------- | --------- |
| Primary headings                         | `#000000` |
| Main interface text / secondary headings | `#1A1A1A` |
| Body text                                | `#595959` |
| Light / secondary metadata               | `#8C8C8C` |
| Borders and dividers                     | `#D9D9D9` |
| Subtle surfaces                          | `#F2F2F2` |
| Background                               | `#FFFFFF` |

- One system sans-serif stack, weights 400 and 600 only, no decorative letter spacing.
- Red/amber/green only for functional status, always with a label or icon. Navigation, buttons (including Approve/Reject), charts and branding stay greyscale.
- Check contrast; don't use the light metadata colour for small text on white. Record adjustments for review.
- Visible focus, real labels, keyboard-operable forms and dialogs, accessible errors, announced async states. Never rely on colour, position or a signature canvas alone.
- Works on desktop and narrow screens without clipping totals or hiding actions.
- Loading, empty, error, forbidden and stale/conflict states. Preserve unsaved edits where safe.
- **Wording**: Title Case for headings, navigation, field labels and buttons (keep acronyms HOD, MD, NGN, PDF; lowercase short articles/prepositions, e.g. Scope of Work; "Sign In"). Sentence case for instructions, feedback and errors. Use Vendor Name, Requisition, Bank Transfer Request. Show readable office names; never change API enum values, stored data, filenames or signed declarations for typography. Update Playwright selectors when wording changes.

### Screen behaviour

- Vendor capture: vendor/contact/bank info, scope/dates, payment terms, warranty, cost lines, attachments, declarations. Bank details may be explicitly unknown; new account numbers are exactly 10 digits, kept as strings.
- Requester, department, eligibility and actions come from the server. No free-text authority settings or role switcher. Administration does not imply approval authority.
- Display server-assigned routing and explanation. Offer HOD self-approval only when the server authorises it (current, unique HOD of own department, ₦1–₦5m, separate fresh signature, department sub-account).
- Approvers approve, reject or return with a reason and signing ceremony; they cannot edit amounts or vendors. Submitted content is read-only; returns create a successor revision with fresh signing. Keep earlier revisions in history.
- Board: Secretary recording and Chairman confirmation are separate. Uploading a resolution is not approval. Show the actual outcome (approval, rejection, deferment, conditions); keep conditional holds visible; distinguish return-to-Secretary from return-to-requester.
- Missing or conflicting assignments are shown clearly, with no substitute selector.
- Signing shows the exact content, requires fresh authentication and explicit consent, binds to the server challenge/revision, and never pre-applies a saved signature or signs on load. For approvals, show debit account, beneficiary, amount and the transfer-signature consent before signing.
- Uploads start on file selection (no draft needed first), with progress and validation feedback. A file isn't ready until the server confirms validation and private storage. Never label files scanned or malware-free (scanning deferred by owner).
- Requesters may delete their own drafts and retract pending requests before any approver/Board action.
- Documents come from authorised backend exports only; never build approval PDFs client-side. Requisition PDFs and transfer letters show business content only (no hashes or internal IDs).
- Administrator oversight (full admin bundle) gives read-only views of requisitions and vendors, no actions, Audit Log or document downloads. Bank-detail visibility follows the backend's vendor policy.
- Timestamps display with Africa/Lagos context.
