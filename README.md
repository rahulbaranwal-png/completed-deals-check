# Completed deals check

Completed deals check is a local, read-only comparison app for completed M&A deals. It compares an Origin CSV export with a Gain CSV export, identifies fields that are missing or different on Gain, and creates a reviewer-approved CSV patch.

The current MVP never writes to Origin or Gain.

## Shareable static website

The `docs` folder contains a plain HTML/CSS/JavaScript edition that can be
published on GitHub Pages, Vercel, Netlify, or Cloudflare Pages. It has no
server-side code and makes no API calls. Origin and Gain CSV or Excel files are parsed
inside the visitor's browser and are not uploaded to the website host.

The rolling Origin baseline is saved in the current browser. Use **Backup
baseline** before switching browsers or devices, then use **Import baseline**
on the other device. This keeps the static edition private-by-design while
preserving the rolling comparison workflow.

To publish with GitHub Pages:

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch **main**, folder **/docs**, and save.
4. Open `https://rahulbaranwal-png.github.io/completed-deals-check/` after the
   Pages deployment finishes.

If GitHub does not allow Pages for the private repository on the current plan,
either make the source repository public or import the private repository into
Vercel/Netlify and set `docs` as the project root.

## What it does

- Loads Origin and Gain CSV or Excel (`.xlsx`) exports in the browser.
- Matches deals using deal IDs, target and buyer names, or target and completion date.
- Proposes Origin values only when the corresponding Gain field is blank.
- Locks conflicting values for manual review.
- Keeps unmatched deals visible instead of forcing a weak match.
- Exports approved changes with source classification and match confidence.

## Supported CSV and Excel columns

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

The app is installed as a Windows login task, so it starts automatically and restarts if the local server stops. Its always-available link on this computer is:

```text
http://127.0.0.1:3000/
```

This link stays the same when Wi-Fi assigns a different local-network IP address. To use the app from another device on the same trusted network, use the current Wi-Fi IPv4 address with port `3000`.

For a manual start, double-click `Start Completed deals check.cmd`. It starts the local-network app and a private GitHub auto-save process. Keep that window open while using the app.

The auto-save process checks once per minute. It commits only source files allowed by `.gitignore`, then pushes them to the private `rahulbaranwal-png/completed-deals-check` repository. Deal exports, spreadsheets, databases, logs, credentials, and environment files remain excluded.

To start the app without automatic GitHub saving, use:

```powershell
npm install
npm run dev
```

The development server is configured to listen on `0.0.0.0` and to stay on port `3000`. The current Wi-Fi IP address is also usable from another device on the same trusted network, but that IP can change after reconnecting. Prefer `http://127.0.0.1:3000/` on this computer.

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
