# Daily Tiffin — repaired frontend

## What was broken
- `assets/js/ui.js` was referenced by `app.js` and `login.js` but was missing from the ZIP.
- All application route HTML files (`app/*.html`, `admin/*.html`) were missing.
- `app.js`, `api.js`, and `login.js` contained broken template literals / unquoted strings, so the ES modules could not parse.
- `assets/css/pages.css` contained an accidental `'''bash` marker that broke the CSS rule.
- Absolute `/login.html` and `/app/...` navigation was replaced with relative routes so the project works when hosted under a sub-path as well as at the domain root.
- Added responsive/mobile navigation and mobile form/table refinements.

## Demo accounts
- Customer: `customer` / `customer123`
- Admin: `admin` / `admin123`

OTP login is intentionally disabled in this version. It can be added later behind the same `/auth` module.

## Run
Use a local static server (recommended because ES modules should not be opened with `file://`):
`python -m http.server 5500`

Then open:
`http://localhost:5500/`

The frontend remains in `MOCK_MODE: true` until the backend API is ready.
