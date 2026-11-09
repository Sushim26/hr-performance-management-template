# HR Performance Management Template

A full employee performance-review platform: self/manager ratings, OKR
tracking, a 9-box talent grid, skip-level recalibration, a separate
"Performance Incentive" cycle with its own eligibility list, email
notifications, CSV exports, and an admin console — all in vanilla
JS/HTML/CSS, no build step.

Genericized from a production AI-native performance management system used
at a media/entertainment company. The real org chart (300+ employees) has
been replaced with a small 12-person sample org tree across two sub-brands
so every feature (org chart, downline, skip-level, nine-box) is demoable
out of the box. All credentials (Supabase, EmailJS) are blanked.

## Stack

- Plain HTML/CSS/JS — no framework, no bundler
- Supabase (Postgres via raw REST calls, no SDK) for storage
- EmailJS for client-side email notifications
- Designed to deploy as a static site (Cloudflare Pages `_headers` file
  included; works on any static host)

## Setup

1. Create your own Supabase project. You'll need at minimum:
   - An `admin_users` table (see the security note below)
   - Tables for ratings/reviews matching what `js/app.js` reads/writes —
     reverse-engineer the exact shape from the REST calls in `js/app.js`,
     or design your own and adjust the calls to match
2. Fill in `js/config.js`: `SUPABASE_URL`, `SUPABASE_ANON`
3. Fill in `js/app.js`: `EMAILJS_PUBLIC_KEY`, `EMAILJS_SERVICE_ID`,
   `EMAILJS_TEMPLATE_SELF`, `EMAILJS_TEMPLATE_MANAGER` (from your own
   EmailJS account), or leave blank to skip email notifications
4. Edit `js/employees.js` — replace the sample `EMPLOYEES` array with your
   own org data
5. Edit `js/auth.js` — set `allowedDomains` to your company's email domain(s)
6. Serve locally: `npx serve .` (or any static server)

## Customizing cycles

`js/config.js` controls the review calendar:

- `REVIEW_PERIOD` / `TENURE_CUTOFF_DATE` — the main annual cycle
- `REVIEW_CYCLES` — add entries here for additional selectable cycles (the
  sample config ships two: an April–March cycle and a September–October
  cycle)
- `PI_REVIEW_PERIOD` / `PI_ELIGIBLE_EMPLOYEE_IDS` — a separate,
  non-selectable bonus-linked cycle for a fixed employee list, re-declared
  each time it runs

## Security notes — read before deploying for real

- **Admin login is a demo-grade plaintext password check** (see the comment
  in `js/app.js` above `adminLogin()`) — it compares a password via a
  Supabase REST query-string filter, which puts the password in the URL and
  implies plaintext storage. Replace with Supabase Auth or similar before
  using this for anything beyond a prototype.
- `SUPABASE_ANON` is a public, RLS-governed key by design — make sure your
  Row Level Security policies actually restrict what the anon role can read
  and write before relying on it.

## License

MIT — see [LICENSE](LICENSE).
