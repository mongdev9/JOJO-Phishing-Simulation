# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

JOJO+ Phishing Simulation — an internal cyber-awareness training platform built entirely on **Google Apps Script** with a **Google Sheet** as the database. There is no Node/npm/build pipeline. The source files (`Code.gs`, `Backup.gs`, `Index.html`, `appsscript.json`) are authored locally and synced to the Apps Script project of a Sheet named `JOJO+ Phishing Simulation`. Server code MAY be split across multiple `.gs` files — Apps Script concatenates all `.gs` into one shared global scope, so functions call across files freely (`Backup.gs` holds the Excel-export code and references `HEADERS`/`rows_`/etc. from `Code.gs`). When adding a new `.gs` file, also whitelist it in `.claspignore` (which denies `**/**` then re-allows each source file by name) or `clasp push` will skip it.

This is **Phase 1**. Phase 1 deliberately omits real email sending, sender spoofing, cloned login pages, and any password/credential collection. Do not add these without an explicit scope change — they are excluded for safety, not because they were forgotten (see `README.md` Safety Rules and `project_memory.txt`).

## Hard safety constraints

These are project-level rules that override convenience:

- Never store, log, or transmit passwords or tokens.
- Never clone real login pages.
- Never spoof sender identity.
- All simulation links must terminate at the in-app training page (`?page=training`).
- `appsscript.json` requests `spreadsheets` + `userinfo.email` + `script.send_mail` + `script.scriptapp`. The `spreadsheets` (full) scope was enabled by explicit owner instruction so `Code.gs` can fall back to `SpreadsheetApp.openById(SPREADSHEET_ID)` (`activeSpreadsheet_()`) when `getActiveSpreadsheet()` returns null. The `script.send_mail` scope was added 2026-06-04 by explicit owner instruction so `getGoogleMailQuota()` can read `MailApp.getRemainingDailyQuota()` for the Quota page. On 2026-06-05 the owner explicitly authorized a **test-send feature** (`sendTestMail()`): it uses this same scope to `MailApp.sendEmail()` a sample simulation email **only to the logged-in user's own address** (`Session.getActiveUser().getEmail()`), with no sender spoofing and the link terminating at the training page. This is the ONLY real send; bulk/real campaign sending to other recipients is still NOT implemented in Phase 1. Do not broaden the test-send to arbitrary recipients without explicit instruction. The `script.scriptapp` scope was added 2026-06-04 by explicit owner instruction so the Schedule page can install/remove a daily time-based trigger (`installDailyTrigger`/`removeDailyTrigger` → `runDailySchedule`) that auto-creates queues from the `Schedule` sheet. Do not broaden OAuth scopes further without explicit instruction; if the script is always bound, narrowing back to `spreadsheets.currentonly` and dropping `openById` is the safer posture.

## Running and deploying

There are no test, lint, or build commands — the repo has no package manager.

- **Edit cycle:** modify the local files, then paste their contents into the matching Apps Script files in the bound Sheet's script project. The Apps Script file `Index` must be named exactly that (case-sensitive) — `Code.gs` calls `HtmlService.createTemplateFromFile('Index')`.
- **Initialize the spreadsheet:** in the Apps Script editor, run `setupDatabase()` once. It is idempotent — safe to re-run; it only adds missing sheets/headers/seed rows.
- **Deploy:** Apps Script → Deploy → Web App, **Execute as: user accessing the web app** (required so `Session.getActiveUser().getEmail()` returns the caller, which is how auth works).
- **Local sanity check:** there is no test runner. `project_memory.txt` notes that `Code.gs` has been syntax-checked by piping it through Node — that is the only "lint" that has ever been run here.

## Architecture

### Request flow

1. `doGet(e)` in `Code.gs:66` is the single entry point. It branches on `?page=training`:
   - `page=training` → serves `Index.html` standalone for the awareness landing (the only page anonymous/mail_user roles may reach). The training URL also accepts `g=<group>` and `c=<customer_id>` params used by the quiz.
   - default → calls `setupDatabase()` then serves the full app.
2. `Index.html` is one HTML file containing the full SPA (vanilla JS, no framework). On load it either renders the standalone training view or calls `google.script.run.getBootstrap()` (`Code.gs:106`) once and then renders every tab from that single payload — `getBootstrap()` returns the whole app state (user, dashboard, topics, emailList, queue, results, logs, settings, quota, questions) in one round trip.
3. All later mutations call individual server functions via `google.script.run.<fn>` and receive a fresh dashboard slice back so the UI can re-render without a second bootstrap.

### Auth and role scoping (security-critical)

Identity comes from `Session.getActiveUser().getEmail()` — there is no separate login screen. `getCurrentUser_()` in `Code.gs:1185` resolves the email against the `Customers` sheet and assigns one of three roles:

- `admin` — sees all rows across all customers. The dev admin (`APP.developer`, currently `sunart.srisumal@gmail.com`), any address in the `ADMIN_EMAILS` const (`Code.gs:36`), and the spreadsheet owner (`ownerEmail_()`) are auto-promoted to admin even if not in the sheet.
- `customer` — sees only rows matching their `customer_id`.
- `mail_user` — fallback for any signed-in email not registered; can only reach the training page.

Row-level isolation is enforced by `scopeRows_()` (`Code.gs:1246`). **Every backend list/read function must funnel reads through `scopeRows_()`** or it will leak other customers' data to the wrong role. `requireCustomer_()` (`Code.gs:1228`) gates write paths to admin/customer only; `requireAdmin_()` (`Code.gs:1234`) gates central-data writes (topics, triggers).

Two server functions are the deliberate exception: `recordTrainingAction()` (`Code.gs:1141`) and `logClientAction()` (`Code.gs:1176`) are the only `google.script.run` *write* calls reachable by `mail_user`/anonymous callers (they back the standalone training page), so they intentionally **skip** `requireCustomer_()` and `scopeRows_()` and trust the client-supplied `customer_id`/`email`/`action`. The read side of the training page — `getTrainingTopic()` and `getTrainingQuiz(group, customerId)` (`Code.gs:251`) — is likewise public and trusts the client `customer_id` (it filters to GLOBAL + that org's `active` questions). Keep this surface minimal — do not add reads or privileged writes here, and don't "fix" the missing scoping without understanding it serves the anonymous training route.

### Sheet schema

`SHEETS` (`Code.gs:38`) and `HEADERS` (`Code.gs:52`) are the source of truth for both tab names and column order. `ensureHeaders_()` rewrites the header row if it doesn't match `HEADERS` exactly. **If you add a column, append it to the end of the relevant `HEADERS` array** — `setValues` writes are positional and assume the constant order; reordering existing columns will corrupt previously written rows.

`rows_(sheetName)` reads a sheet into header-keyed objects; `sheet_(name)` returns the raw Sheet for `appendRow`/`getRange().setValues()`. Reads use `rows_`, writes go through `sheet_`.

### setupDatabase is the migration

There are no migrations. `setupDatabase()` (`Code.gs:82`) is called from `doGet` and from most server entry points. It (1) creates missing sheets, (2) rewrites header rows to match `HEADERS`, (3) seeds settings/admin/initial customers/topics/questions if absent. Seeders are guarded by existence checks so they don't duplicate. To "migrate" schema, extend `HEADERS` and/or the seeders here, **and bump `SCHEMA_VERSION` (`Code.gs:18`)** — `setupDatabase()` caches a `db_ready_v<SCHEMA_VERSION>` flag in `CacheService` for 6 hours and returns early if set, so changing seeders/headers without bumping the version means the new setup won't run until the cache expires.

### Logging

Every server entry point calls `logAction_()` (`Code.gs:1638`) which appends to the `Logs` sheet with the resolved email/role/customer_id. The right-side panel and `exportLogsText()` (which produces `jojo_phishing_log.txt`) both read from this sheet. When you add a new server-facing action, log it the same way — the logs sheet is the only audit trail.

### Subsystems beyond the basics

- **Question bank / quiz (`Questions` sheet).** Separate from `MailTopics`. Questions are grouped into the five `QUESTION_GROUPS` codes (`link`, `cred`, `finance`, `file`, `social` — `Code.gs:21`). Each row is owned by a `customer_id`, or by `GLOBAL`/empty meaning "central bank visible to everyone." `questionsForOrg_()` resolves the visible pool (central + own org, `active` only); `getTrainingQuiz()` picks 3 at random from the requested group. Admins write to the `GLOBAL` bank, customers to their own (`bankOwnerId_()`); ownership is enforced on edit/delete. Import paths: `importQuestions` (client-parsed CSV rows) and `importQuestionsFromSheet` (reads a Google Sheet by URL). `normalizeQuestion_()` validates every row and `assertSafeContent_()` rejects HTML/links/`on*=`/`javascript:` so quiz text can never become a live link or script.

- **Quota (`computeQuota_`, `Code.gs:594`).** Phase 1 counts a *queued* row with today's `send_date` as quota usage (no real send). Two ceilings apply at once: `platform_daily_cap` (Gmail-free-style global cap) and `customer_daily_cap` (per-org fair share), both overridable in `Settings`. `available = min(platform_remaining, customer_remaining)`. `createRandomQueue` clamps requested count to `available` and blocks at zero. `getGoogleMailQuota()` separately reports Google's real remaining send quota for the Quota page.

- **Schedule + daily trigger (`Schedule` sheet).** `setScheduleDay`/`getSchedule` upsert a per-day, per-customer plan (optionally a specific email list). `installDailyTrigger`/`removeDailyTrigger` (admin-only) manage a single time-based trigger that fires `runDailySchedule()` at 08:00 daily; it finds today's non-`done` rows and calls `createQueueForCustomer_()` (which does NOT use `getCurrentUser_` — it's driven by the trigger, so it takes the customer id explicitly and still respects quota), then marks them `done`.

- **Report (`getReportData`, `Code.gs:451`).** Builds a per-person funnel (targets → sent → clicked → trained → passed) and per-group attempt/pass stats by joining `EmailList`, `Results`, and `Queue` (all scoped). `Results.action` values flow as `clicked` < `trained` < `passed`; `Results.topic` holds the quiz *group code*, which is how group stats are bucketed.

- **Excel backup (`Backup.gs`).** `exportDataXlsx()` builds a real `.xlsx` (OOXML zipped with `Utilities.zip`, no library, no extra scope) and returns base64. Admin gets all sheets/rows; customer gets only customer-scoped sheets + `MailTopics`.

- **Caching & web-app URL.** Two request-scoped memos cut redundant sheet reads: `_userMemo` (resolved user, re-checked by email every call) and `_rowsCache` (only enabled inside `getBootstrap` for read-only consistency — kept `null` elsewhere so writes never see stale rows). `last_login` and owner-email lookups are throttled via `CacheService`. Training links are built from `getAppUrl_()`, which prefers the live `/exec` URL but falls back to the hardcoded `WEBAPP_URL` (`Code.gs:1693`) because the client runs in a sandboxed iframe where `location.href` and a blank `getUrl()` would otherwise break the link.

## UI conventions (from `me.md`)

The project owner has explicit UI preferences that should guide frontend changes:

- **3-bar layout** (left sidebar / center main / right info panel) — already implemented in `Index.html` `.layout`. Preserve it.
- **Excel-like tables**: sortable, filterable, frozen header. Reach for table-first UIs, not card grids.
- **Soft green palette** — the CSS variables in `:root` at the top of `Index.html` are the palette; reuse them rather than introducing new colors.
- **Language split**: Thai for the Worker/training surfaces, English for the Admin/monitor surfaces. Don't mix.
- **Strict Worker vs Admin separation** — never surface admin controls on worker views.
- **No unnecessary options or long copy.** Keep flows direct.

## Things to leave alone unless asked

- `me.md` and `project_memory.txt` are the owner's own notes. Read them for context; don't rewrite or "tidy" them.
- The seeded developer admin email and the seeded `TFP` customer in `seedAdmin_`/`seedInitialCustomers_` are intentional — they make a fresh deploy usable. Don't remove them unless asked.
- Phase 1 limits listed in `project_memory.txt` (no real bulk/campaign sending, monthly-repeat partially represented, `auto_reduce_sequence` quota-auto-reduce stored but not enforced) are known and intentional — don't "complete" them as drive-by work. Note that some items that `project_memory.txt` calls "planned" have since shipped (Excel export via `Backup.gs`, CSV/Sheet import, quota enforcement, scheduling) — `project_memory.txt` is a historical snapshot, so trust the code over it when they disagree.
