# Completed deals check

Completed deals check is a local, read-only comparison app for completed M&A deals. It compares an Origin CSV export with a Gain CSV export, identifies fields that are missing or different on Gain, and creates a reviewer-approved CSV patch.

The current MVP never writes to Origin or Gain.

## What it does

- Loads Origin and Gain CSV exports in the browser.
- Matches deals using deal IDs, target and buyer names, or target and completion date.
- Proposes Origin values only when the corresponding Gain field is blank.
- Locks conflicting values for manual review.
- Keeps unmatched deals visible instead of forcing a weak match.
- Exports approved changes with source classification and match confidence.

## Supported CSV columns

The app recognises common variations of these fields:

- `deal_id`, `origin_deal_id`, or `gain_deal_id`
- `target`, `target_name`, `company`, or `asset`
- `buyer`, `acquirer`, or `investor`
- `seller` or `vendor`
- `completion_date`, `completed_date`, or `close_date`
- `enterprise_value`, `deal_value`, or `transaction_value`
- `revenue`
- `ebitda`
- `stake` or `stake_acquired`
- `advisers` or `advisors`
- `source_type` or `intelligence_type`
- `source_date` or `intelligence_date`

## Start on the local network

Prerequisite: Node.js 22.13 or later.

For the simplest start, double-click `Start Completed deals check.cmd`. It starts the local-network app and a private GitHub auto-save process. Keep that window open while using the app.

The auto-save process checks once per minute. It commits only source files allowed by `.gitignore`, then pushes them to the private `rahulbaranwal-png/completed-deals-check` repository. Deal exports, spreadsheets, databases, logs, credentials, and environment files remain excluded.

To start the app without automatic GitHub saving, use:

```powershell
npm install
npm run dev
```

The development server is configured to listen on `0.0.0.0`, making it available through the host computer's local-network IP address. On the current computer and network, the confirmed URL is:

```text
http://10.190.91.0:3000/
```

The IP address can change when the computer reconnects to Wi-Fi. Run `ipconfig` and use the Wi-Fi IPv4 address with port `3000`.

Windows Firewall may ask whether to allow Node.js on private networks. Allow private networks only if colleagues on the same trusted network need to access the app.

## Verify the build

```powershell
npm run build
```

## Data and GitHub safety

Use a private repository. Real deal exports, spreadsheets, databases, logs, credentials, and environment files are excluded from source control. Do not override those exclusions for production intelligence.

## Next production steps

1. Confirm the exact Origin and Gain export schemas.
2. Add a persistent, reviewer-owned audit log.
3. Confirm whether Gain supports an update API or bulk-import template.
4. Add authenticated, approved Gain writes with before-and-after verification.
