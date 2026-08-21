# CashTrack

A lightweight, offline-first Point-of-Sale (POS) and expense tracker. Sales and expenses are recorded on-device, synced through a Netlify Functions proxy, and land in a per-tenant set of Google Sheets that double as the database, the admin UI, and the reporting layer.

## Why Google Sheets?

The whole backend is Apps Script + Google Sheets. That gives us, at zero infrastructure cost:

- **A free database** — one config sheet per tenant, plus rotating monthly sales sheets.
- **A free admin UI** — editing the `Catalog`, `Auth`, and `Sheets` tabs _is_ the admin panel. No CRUD screens to build.
- **Free reporting and BI** — every new monthly sales sheet is auto-provisioned with a `Revenue Overview` tab full of live `QUERY()` formulas and column charts. Tenants can also pivot, filter, and chart the raw `Sales`/`SalesItems`/`Expenses` tabs with the full power of Google Sheets, share dashboards with a link, or wire the data into Looker Studio.
- **Free Drive-backed storage, ACLs, versioning, and audit history.**

The tradeoff is throughput: writes are serialized through Apps Script `LockService`, and dedup does a full column scan. Monthly sheet rotation keeps each sheet small enough that this stays fast in practice.

## What the app does

- Ring up sales from a per-location product catalog with quantity, discount, cash/card payment type, and optional notes.
- Record custom sales and expenses (non-catalog) from a menu action.
- Keep working while offline. Every event is written to IndexedDB first; a background queue pushes them upstream when the network returns.
- Show recent history and export all local events as CSV.
- Support multiple locations (registers). Cart, discount, cash input, and notes are persisted per location.
- Install as a PWA (standalone, offline-capable) via `vite-plugin-pwa`.

## Architecture

```
┌────────────────────┐    HTTPS    ┌────────────────────┐    HTTPS    ┌──────────────────────────────┐
│  React PWA (Vite)  │ ──────────► │ Netlify Functions  │ ──────────► │  Apps Script "CashtrackLib"  │
│  IndexedDB queue   │             │  (auth proxy)      │             │  ├─ Config sheet (per tenant)│
└────────────────────┘             └────────────────────┘             │  │   Auth · Catalog · Sheets │
                                                                      │  └─ Sales sheets (monthly)   │
                                                                      │      Sales · SalesItems ·    │
                                                                      │      Expenses · _Dedup ·     │
                                                                      │      Revenue Overview        │
                                                                      └──────────────────────────────┘
```

- **Frontend** (`src/`) — React 19 + TypeScript + Tailwind 4, built with Vite. State that must survive reloads (cart, catalog, unsynced events, device id, api key) lives in IndexedDB or `localStorage`.
- **Netlify Functions** (`netlify/functions/`) — thin proxy that attaches the shared secret before forwarding to Apps Script. The secret never touches the browser.
- **Apps Script** (`apps-script/cashtrack.js`) — deployed as a reusable library (`CashtrackLib`). Every function is stateless and takes `CONFIG_SHEET_ID`, `FOLDER_ID`, `SHEET_PREFIX` — so one library serves many tenants. Each tenant has a tiny bound script that hard-codes those three values and forwards `doGet`/`doPost` into the library. Setup steps live in [docs/SETUP.md](docs/SETUP.md).

## Sheet model (per tenant)

### Config sheet — long-lived, identified by `CONFIG_SHEET_ID`

| Tab       | Purpose                                                                                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Auth`    | `api_key, role, active, user_name, devices` — one row per user; `devices` is a comma-separated list of registered device IDs.                                                       |
| `Catalog` | Product master (`product_id`, `name`, `price`, `unit_cost`, `category`, `vendor`, `active`, `location_visibility`, `image_url`, `updated_at`). Edited by admins directly in Sheets. |
| `Sheets`  | `sheet_id, created_at` — a log of every sales spreadsheet ever created. The **latest row wins**: that's the "active" sales sheet the client writes to.                              |

### Sales sheets — created on demand

`createNewSalesSheet` spins up a new spreadsheet named `${SHEET_PREFIX} yyyy-MM`, drops it in `FOLDER_ID` on Drive, and provisions:

| Tab                | Purpose                                                                                                                                                                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Sales`            | Header row per transaction (totals, discount, payment type, device, timestamp).                                                                                                                                                                                                         |
| `SalesItems`       | One row per line item (product, qty, unit price, vendor, location, timestamp, payment type). This is the fact table that powers reporting.                                                                                                                                              |
| `Expenses`         | Non-sale outflows.                                                                                                                                                                                                                                                                      |
| `_Dedup`           | UUIDs of every event applied — the idempotency ledger.                                                                                                                                                                                                                                  |
| `Revenue Overview` | Auto-generated dashboard: summary cards (total sales, items sold, expenses, net), performance snapshot (avg daily/weekly, avg transaction, items per sale), and four column charts (Category, Vendor, Location, Top Products), all driven by live `QUERY()` formulas over `SalesItems`. |

Rotating sheets monthly keeps each `_Dedup` scan and each report render fast, and gives tenants a natural per-period archive.

## Data flow

### Recording a sale

1. User taps products in `Products.tsx`; `addToCart` in `App.tsx` builds the local cart.
2. `cart.ts` derives `subTotal`, `discount`, and `total` on-device.
3. `save()` builds an event (`kind: "sale"`) with `line_items[]` and calls `putEvent()` (`src/db.ts`), which writes to the IndexedDB `events` store with `synced: 0`.
4. `useSyncQueue` picks up unsynced events, POSTs each to `/.netlify/functions/append` (`Authorization: Bearer <api_key>`), and marks them `synced: 1` on success.
5. `append.js` adds the shared secret, sets `action: "log_event"`, and forwards to Apps Script.
6. `doPostConfig` in the library authenticates the api key against the tenant's `Auth` sheet, then `logEvent` acquires a script lock, checks `_Dedup`, appends to the active sales sheet's `Sales` and `SalesItems` tabs, and records the UUID.
7. Failures back off client-side (2s → 30s) and retry on `online`, `visibilitychange`, or manual _Sync now_.

### Loading the catalog

1. `useCatalog` shows cached products from IndexedDB immediately.
2. It fetches `/.netlify/functions/products-get`, which calls `doGetProducts` in the library.
3. The library auths the api key, reads `Catalog` from the config sheet, resolves the active sales sheet (creating one if none exist), and returns `{ products, role, user_name, activeSheetID, configSheetID }`.
4. Client replaces its local catalog and stores metadata in the `meta` KV store.
5. `filterByLocation` narrows the catalog to the current register; admins see everything.
6. The service worker uses `NetworkFirst` with a 4s timeout for `products-get` so the app stays responsive on flaky networks.

## Auth model

- Every user has an api key row in the tenant's `Auth` sheet. Roles today: `admin` and everything else.
- The browser stores the key in `localStorage.api_key` and sends it as `Authorization: Bearer <key>`.
- Netlify functions add the shared secret before forwarding — the secret is server-side only.
- `registerDevice` appends the device ID to the user's `devices` cell so the same key can be paired to multiple registers.
- Admin-gated actions: `createNewSheet` (roll a new monthly sales sheet). Key management (`createKey`, `revokeKey`, `listKeys`) is scaffolded in the library and can be enabled when needed.

## Key modules

| File                                | Purpose                                                                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`                       | Top-level POS shell: header, product/cart panes, mobile sheet, menu drawer.                                                                   |
| `src/db.ts`                         | IndexedDB schema (`events`, `products`, `meta`) and CRUD helpers via `idb`.                                                                   |
| `src/useSyncQueue.ts`               | Background sync loop with exponential backoff. Exposes `window.kickSync`.                                                                     |
| `src/useCatalog.ts`                 | Cache-then-network product fetch, exposes `refresh()`.                                                                                        |
| `src/cart.ts`                       | Pure cart math (subtotal, discount, total).                                                                                                   |
| `src/config.ts`                     | App version, endpoints, `deviceId()`, `ensureDurableStorage()`.                                                                               |
| `src/exportCSV.ts`                  | Dumps all local events as CSV.                                                                                                                |
| `netlify/functions/append.js`       | Proxies sale/expense events to Apps Script.                                                                                                   |
| `netlify/functions/products-get.js` | Fetches catalog + user metadata.                                                                                                              |
| `netlify/functions/config-post.js`  | Config actions (create sheet, register device, keys).                                                                                         |
| `apps-script/cashtrack.js`          | The `CashtrackLib` library — auth, config, sales, dashboard provisioning.                                                                     |
| `apps-script/Code.gs.js`            | Per-tenant bound script: holds the three tenant constants, forwards `doGet`/`doPost` into the library, installs the monthly rotation trigger. |

## Getting started

```bash
npm install
npm run dev
```

The app expects a Netlify Functions dev environment. Either run `netlify dev` (recommended) or point `ENDPOINT_*` at a deployed environment.

### Required environment variables (Netlify)

| Variable                     | Where   | Purpose                                |
| ---------------------------- | ------- | -------------------------------------- |
| `APP_SCRIPT_CONFIG_URL`      | Netlify | Deployed Apps Script Web App URL.      |
| `CASHTRACKLIB_SHARED_SECRET` | Netlify | Shared secret verified by Apps Script. |

The user-facing api key is stored in `localStorage.api_key` and sent as `Authorization: Bearer <key>` to the functions; the functions add the shared secret before forwarding.

Both values come from the backend. Deploying the `CashtrackLib` library, wiring a tenant's bound script, and provisioning the first admin key are covered in [docs/SETUP.md](docs/SETUP.md).

## Scripts

- `npm run dev` — Vite dev server (PWA enabled in dev).
- `npm run build` — Type-check and produce production `dist/`.
- `npm run preview` — Preview the built output.
- `npm run test` — Vitest unit + component tests in `tests/`.
- `npm run lint` — ESLint over the project.
- `npm run deploy:dev` / `deploy:prod` — Load env from `.env.*` and deploy via Netlify CLI.

## Offline behaviour

- Events are written to IndexedDB before any network attempt, so nothing is lost on connection drops or page reloads.
- `ensureDurableStorage()` requests persistent storage so the browser is less likely to evict IndexedDB under pressure.
- The catalog fetch is served from cache when the network is unreachable (service worker + local `products` store).
- The unsynced badge (`⏳ N`) in the header reflects `countUnsynced()`; the drawer's _Sync now_ forces a flush.
- Idempotency is end-to-end: each event carries a client-generated `local_event_id` UUID that the server rejects on the second write via the `_Dedup` tab.

## Reporting

Because everything lands in Sheets, tenants get reporting for free:

- The `Revenue Overview` tab in each monthly sales sheet updates live as new sales sync in — no cron, no rebuild.
- Raw `SalesItems` is normalized enough to pivot, filter, or feed into any BI tool. Point Looker Studio at it and you're done.
- Sharing a dashboard = sharing a Google Sheet link.
- Historical data is browsable one spreadsheet per month — a natural archive.
