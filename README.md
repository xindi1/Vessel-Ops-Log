# Vessel Ops Log

A lightweight, offline-first PWA for tracking vessel trips, conditions, fuel notes, issues, and maintenance.

## Included
- Today dashboard
- Quick log flow
- Trip history with search/filter
- Maintenance watchlist
- Pattern summary
- Local-only storage
- JSON import/export
- CSV export
- Demo data loader
- Installable PWA shell

## Run locally
From this folder:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Notes
- Data is stored in localStorage on the device/browser.
- To refresh the service worker after changes, do a hard refresh.
