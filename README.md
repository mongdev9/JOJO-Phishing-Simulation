# JOJO+ Phishing Simulation

Coding Version Phase 1 for Google Apps Script and Google Sheet.

## Scope

Phase 1 includes:

- Google Auth login with `Session.getActiveUser().getEmail()`
- Portable Sheet connection with `SpreadsheetApp.getActiveSpreadsheet()`
- Sheet tab creation and headers
- Admin/customer role structure
- Customer data isolation
- Dashboard statistics
- Email list paste import with duplicate and domain checks
- Random queue records without real email sending
- Awareness training page
- Logs and TXT export as `jojo_phishing_log.txt`

Phase 1 intentionally does not include real phishing email generation, sender spoofing, cloned login pages, password collection, or credential handling.

## Files

- `Code.gs` - Apps Script backend, schema, auth, dashboard, logs
- `Index.html` - HTML/CSS/Vanilla JS frontend
- `appsscript.json` - Apps Script manifest
- `me.md` - local project preference note

## Install

1. Create a Google Sheet named `JOJO+ Phishing Simulation`.
2. Open Extensions > Apps Script.
3. Add `Code.gs`, `Index.html`, and `appsscript.json`.
4. Run `setupDatabase()` once from Apps Script.
5. Deploy as Web App.
6. Use Execute as: user accessing the web app.
7. Use access that matches your internal workspace policy.

The developer admin seeded by default is:

```text
sunart.srisumal@gmail.com
```

## Sheet Tabs

The script creates:

- `Customers`
- `EmailList`
- `MailTopics`
- `OldTopics`
- `Queue`
- `Results`
- `Reports`
- `Settings`
- `Logs`

## Customer Setup

Add customers in the `Customers` tab:

```text
customer_id | login_email | role | allowed_domains | max_send_day | status | created_at | last_login
ACME        | user@acme.com | customer | acme.com,subsidiary.com | 10 | active | date | blank
```

Roles:

- `admin` sees all data.
- `customer` sees only matching `customer_id`.
- `mail_user` can access the training page only.

## Safety Rules

- Do not collect passwords.
- Do not clone real login pages.
- Do not spoof sender identity.
- Simulation links must go to the training page.
- The platform is for internal awareness training only.
