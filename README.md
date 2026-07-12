# Firefighter Retirement Calculator — Shift to Wealth

Standalone web calculator for municipal/state firefighters with
defined-benefit pensions: pension formula + DROP + 457(b) deferred comp,
presented as honest ranges rather than point estimates. Companion tool to the
*Shift to Wealth* newsletter. Free — no paywall, no account tiers, no
lead-gen.

## Stack

- **Vite + React** (plain JS, no router — the whole flow is one page of state)
- **Supabase** for magic-link auth + saved scenarios. The client in
  `src/lib/supabase.js` is null until `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` are set, and the app degrades gracefully: the
  calculator itself never needs a backend or an account — signing in only
  adds "save my inputs and come back later".

## Supabase setup (for saved scenarios)

1. Create a project at supabase.com (free tier is fine).
2. SQL editor → paste and run `supabase/schema.sql` (creates the `scenarios`
   table with row-level security so users only see their own rows).
3. Authentication → Providers → Email: leave **Email OTP / magic link** on
   (default); no password provider needed.
4. Authentication → URL Configuration: add your dev URL
   (`http://localhost:5173`) and, later, the production URL to the redirect
   allow-list.
5. Project Settings → API: copy the URL and anon key into `.env.local`
   (see `.env.example`), restart `npm run dev`.

How saving works: one `scenarios` row per (user, name). Saving under the
same name overwrites; typing a new name and hitting "Save as new" creates a
separate scenario ("retire at 50" vs "retire at 55"). On sign-in the app
pre-fills the form from the most recently updated scenario — unless you've
already started typing, in which case it won't clobber your inputs.

Known limitation: magic-link sign-in should happen on the standalone site,
not inside a third-party iframe — browsers partition iframe storage, so an
embedded calculator may not see the session created by the email link. The
tool itself works fine embedded; treat accounts as a standalone-site feature.

## Run it

```bash
npm install
npm run dev
```

## Iframe embedding (beehiiv etc.)

The layout is built to live inside an iframe on another site:

- no fixed/sticky headers, no `100vh`, no scroll hijacking
- no routing / URL-bar dependence — all state is in-page
- fluid from 320px up; the page grows naturally in height
- when framed, the app detects it and shows an **"Open in full page ↗"**
  link in the masthead as the escape hatch for cramped embeds (also the
  right path for magic-link sign-in — see the storage caveat below)
- optional `?bg=transparent` drops the soft-gray page plane so the cards
  sit directly on the host page's background (best on light host pages)

Embed snippet (beehiiv: add an HTML/embed block on a page and paste):

```html
<iframe
  src="https://YOUR-DEPLOYED-URL/?bg=transparent"
  title="Firefighter Retirement Calculator"
  style="width:100%;border:0;min-height:1400px"
  loading="lazy"></iframe>
```

beehiiv doesn't run custom scripts on the parent page, so the iframe can't
auto-size — set `min-height` generously (results view is the tallest,
~1400px covers it on desktop; taller if your page is narrow) and rely on
the built-in "Open in full page" link as the fallback.

`public/embed-test.html` is a local harness that renders the app in
320/480/full-width iframes inside a fake article page — `npm run dev` and
visit `/embed-test.html`.

## Deploying

**GitHub Pages (default, zero extra setup):** `.github/workflows/deploy-pages.yml`
lints, tests, builds, and publishes to Pages automatically on every push to
`main`. One-time setup after the repo exists on GitHub: Settings → Pages →
Build and deployment → Source: **GitHub Actions**. The live URL is
`https://<username>.github.io/stw-pension-calc/`. The workflow sets
`DEPLOY_TARGET=gh-pages` so Vite prefixes asset URLs with `/stw-pension-calc/`
(see `vite.config.js`); a plain `npm run build` elsewhere stays rooted at `/`.

**Elsewhere (Vercel / Netlify / Cloudflare Pages):** static site — `npm run
build` produces `dist/`, host it anywhere, no server code, one URL, no
routes. After deploying:

1. Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as build-time env
   vars on the host (they're baked in at build).
2. Add the production URL to Supabase Auth → URL Configuration so magic
   links redirect correctly.

## Second calculator: In-DROP (`/in-drop.html`)

A separate page for firefighters **already in DROP**. Their pension board
fixed the monthly benefit at entry, so there's no accrual math — the
calculator takes the known monthly amount (plus an optional statement
balance as an anchor) and projects the DROP balance to exit: 6% simple
interest for years 1–5 (plan-fixed), a low/mid/high "plan returns" range
for years 6–8, and an optional 10-year self-directed conversion modeled
with the same Monte Carlo machinery as the main calculator (stock/bond
blend set by the user).

Both calculators build from one repo — Vite's multi-page
`rollupOptions.input` emits `dist/index.html` and `dist/in-drop.html`; in
dev it's just `localhost:5173/in-drop.html`. Same embed rules, same styles.

- `src/InDropApp.jsx` — step container + `calculateInDrop()` wiring
- `src/indrop-steps/` — status, plan terms, self-directed conversion, review
- `src/lib/indropEngine.js` — simple-interest accrual, conversion Monte
  Carlo, and the `parseInDropForm` validation layer (hard errors + soft
  warnings, same pattern as `engine.js`)
- `src/components/InDropResults.jsx` — results view, same range-bar language

Converting redirects the account: from the conversion date on, *every* new
pension deposit goes into the self-directed track, not the plan track. Only
the portion of the balance-at-conversion you explicitly leave behind stays
on plan rates, and it gets no further deposits (confirmed 2026-07-11).

**⚠️ Still verify with the pension board before this page goes live:** the
plan documents no crediting rate for DROP years 9–10 (only reachable via
the self-directed conversion), so the calculator doesn't extend the 3–6%
range past year 8. Instead, whatever balance wasn't self-directed keeps
plan crediting through year 8, then the year-8 balance rides the pension
fund's own historical return and volatility (7.3%/yr ±8%, from the Fort
Lauderdale Police & Firefighters' Retirement System's trailing performance
— `planReturn` in `src/lib/assumptions.js`) through the same Monte Carlo
engine as the self-directed slice. What to confirm with the board: what
actually happens to a non-self-directed balance in years 9–10, and whether
a fund-return model is an acceptable stand-in until they say.

## Where things are

- `src/App.jsx` — step container, progress bar, validation gating
- `src/steps/` — one component per form step (about, pension, DROP, savings,
  Social Security, review)
- `src/lib/formDefaults.js` — the form's single source of truth: initial
  state, dropdown options, per-step required fields
- `src/components/Field.jsx` — shared field/number/choice-pill primitives

## Status / roadmap

- [x] Multi-step input form
- [x] Calculation engine (`src/lib/engine.js`): DB pension math with
      high-3/high-5 FAS and salary growth, DROP freeze + compound
      accumulation, Monte Carlo P10/P50/P90 on the 457(b), combined income
      as three scenarios. Assumptions all live in `src/lib/assumptions.js`.
      Unit tests: `npm test` (hand-checkable cases incl. a 0-volatility run
      vs. the compound-interest closed form)
- [ ] **Results view (next):** wire `calculate()` to the Review step's
      "Run my numbers" button, show the three income scenarios + charts
- [ ] Supabase: save/share a scenario
- Related prior art: `~/Desktop/agent calculator/agent-sdk/engine.js` has an
  audited Monte Carlo engine (percentile bands, guidance solver) worth
  porting patterns from.

## Design principles

- Ranges, not promises — anything market-driven shows P10/P50/P90.
- Never guess a number the user didn't give us (Social Security especially —
  WEP/GPO makes guessing wrong more often than right for this audience).
- Plan documents win: the fine print tells users to verify multipliers and
  DROP terms with their pension office.
