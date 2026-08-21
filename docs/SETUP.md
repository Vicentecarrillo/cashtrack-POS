# Apps Script setup

How to stand up the backend: the shared `CashtrackLib` library, a tenant's bound script, and the web app URL the Netlify functions talk to. See the [README](../README.md) for what the pieces are and why they're arranged this way.

The two files in `apps-script/` are **not** two files of one project — they belong to two separate Apps Script projects:

| File           | Apps Script project                           | Deployed as | How many                   |
| -------------- | --------------------------------------------- | ----------- | -------------------------- |
| `cashtrack.js` | Standalone project named `CashtrackLib`       | **Library** | One, shared by all tenants |
| `Code.gs.js`   | Script **bound** to the tenant's config sheet | **Web app** | One per tenant             |

They're kept as `.js` in the repo so ESLint/Prettier can see them. In the Apps Script editor the files are `.gs` — paste the contents in, the `.js` extension is a repo-only convention. There is no `clasp` setup; copy/paste is the workflow today.

## 1. Create the library project (`cashtrack.js`)

1. Go to [script.google.com](https://script.google.com) → **New project**. Rename it `CashtrackLib` (the name matters — it becomes the identifier tenants call).
2. Replace the contents of `Code.gs` with all of `apps-script/cashtrack.js`.
3. Set `SHARED_SECRET` at the top of the file to a long random string, or leave it `""`. Whatever you put here **must equal** the `CASHTRACKLIB_SHARED_SECRET` Netlify env var — the proxy sends it as `body.key` and `doPostConfig`/`doPostSale` compare against it. Leaving it `""` disables the secret check entirely (api-key auth still applies), which is fine for local development but not for production.
4. Optionally set `AUTH_CONFIG.DEBUG_SHEET_ID` to a spreadsheet with a `logs` tab to capture `debugLog()` output. Left blank, it logs to the active spreadsheet's `logs` tab if one exists, otherwise to the execution log.
5. Save, then **Deploy → New deployment → Type: Library**, give it a description, and deploy. This pins a numbered version.
6. Copy the **Script ID** from **Project Settings** — tenants need it.

Any time you edit the library you must create a **new version** (Deploy → Manage deployments, or Deploy → New deployment) and bump each tenant's library version, unless the tenant is pinned to `HEAD` (development mode). `HEAD` is convenient while iterating and risky in production — a broken save breaks every tenant instantly.

## 2. Create the tenant's bound script (`Code.gs.js`)

1. Create the tenant's config Google Sheet (the `Auth`, `Catalog`, and `Sheets` tabs are created automatically on first use, so an empty sheet is fine).
2. Create the Drive folder that will hold the monthly sales spreadsheets and note its ID (the segment after `/folders/` in the URL).
3. From the config sheet: **Extensions → Apps Script**. This creates the bound script.
4. Replace `Code.gs` with the contents of `apps-script/Code.gs.js` and fill in the constants:
   - `CONFIG_SHEET_ID` — leave as-is; because the script is bound, `SpreadsheetApp.getActiveSpreadsheet().getId()` already resolves to the config sheet.
   - `FOLDER_ID` — the Drive folder ID from step 2. If left `""`, new sales sheets land in the root of My Drive.
   - `SHEET_PREFIX` — e.g. the business name; monthly sheets are named `${SHEET_PREFIX} yyyy-MM`.
   - `ENV_NAME` — free-form label (`dev`, `prod`) for your own bookkeeping.
5. Add the library: in the editor sidebar click **Libraries → +**, paste the `CashtrackLib` Script ID, pick the version, and make sure the identifier is exactly **`CashtrackLib`** — that's the name `Code.gs.js` calls.

## 3. Deploy the bound script as a web app

**Deploy → New deployment → Type: Web app**, then:

- **Execute as:** _Me_ — the script needs the sheet/Drive permissions of the owner, not the caller.
- **Who has access:** _Anyone_ — the Netlify function calls it without a Google identity. Access control is the api key plus the shared secret, not Google auth.

Copy the `/exec` URL and set it as `APP_SCRIPT_CONFIG_URL` on Netlify. Use the `/exec` URL, not `/dev`.

Re-deploying after a code change requires **Manage deployments → edit → New version**; creating a brand-new deployment mints a different URL that you'd then have to update on Netlify.

## 4. Authorize and seed the first admin

1. In the bound script editor, select `createAdmin` and **Run**. Google will prompt for authorization — accept the "unverified app" warning (it's your own script). The requested scopes cover Sheets, Drive, and script triggers.
2. Open the config sheet's `Auth` tab and copy the generated `api_key`. That's what a user pastes into the app (stored in `localStorage.api_key`).
3. Add more rows manually for additional users: `api_key, role, active, user_name, devices`. `active` must be truthy; `devices` fills in on its own as registers pair.

## 5. Install the monthly rotation trigger

Select `installTriggers` and **Run** once. It clears existing triggers on the project and installs a time-based trigger that calls `autoRotateSheet` on the 1st of each month at 08:00 (project timezone — set it under **Project Settings → Time zone**), which provisions the next `${SHEET_PREFIX} yyyy-MM` spreadsheet.

Rotation is not required for the app to work: `doGetProducts` creates a sales sheet on demand when the `Sheets` tab is empty, and an admin can roll one at any time from the app's _New sheet_ action.

## Provisioning another tenant

The library is deployed once. Each additional tenant only repeats steps 2–5:

1. Create a config Google Sheet and a Drive folder for the tenant's monthly sales sheets.
2. From the config sheet, create a bound Apps Script with the contents of `apps-script/Code.gs.js`, fill in `FOLDER_ID` and `SHEET_PREFIX`, and add `CashtrackLib` as a library.
3. Deploy it as a Web App (_Execute as: Me_, _Access: Anyone_) and set the `/exec` URL as `APP_SCRIPT_CONFIG_URL` on Netlify.
4. Run `createAdmin` once from the script editor to seed the first admin api key.
5. Run `installTriggers` once to schedule monthly sheet rotation.

## Gotchas

- **Authorization headers don't survive to Apps Script web apps.** Google strips them, which is why `isAuthed` looks at `e.parameter.api_key` and the JSON body before `e.headers.Authorization`, and why the Netlify functions inject `api_key` into the body / query string rather than relying on the header.
- **The library's `SHARED_SECRET` and Netlify's `CASHTRACKLIB_SHARED_SECRET` must match**, or every write returns `401 Unauthorized`.
- **The library is stateless by design.** It never reads `getActiveSpreadsheet()` for tenant data — everything comes from the three constants passed in by the bound script. Don't add tenant-specific values to `cashtrack.js`.
- **Responses always return HTTP 200**; the real code is in the JSON `status` field, which is what the Netlify functions forward as `statusCode`.
- **Writes are serialized with `LockService`** per sales sheet. Long imports will queue rather than fail.
