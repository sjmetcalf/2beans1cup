# Doppio Drifters

A third-wave-cafe-styled training house for two athletes chasing the Grand Traverse Triple Crown (ski, run, bike between Crested Butte and Aspen). Live at **[doppiodrifters.com](https://doppiodrifters.com)**.

## Pages
- **Cafe** (`#/`): badge, race countdowns, last-30-days totals, latest activities, what's coming up
- **The Menu** (`#/menu`): shared calendar with races, sessions, logistics and each of our activities dotted in
- **Pour Log** (`#/pour-log`): every activity, filterable by sport and person
- **Side by Side** (`#/side-by-side`): totals by sport and week-by-week comparison
- **Bar Station** (`#/bar`): checklists per race
- **Barista** (`#/barista`): enter the shared code, rename beans, connect Garmin

## How it works
- **Public read, protected write.** Anyone can view. Changes go through the `barista` Supabase edge function, which checks a shared code stored in the `BARISTA_CODE` secret.
- **Garmin:** each of us pastes a Garmin Connect *Personal API key* on the Barista page. Keys live in a table the browser can never read; the edge function swaps them for access tokens and pulls activity summaries. GPS coordinates are never stored.
- **Hosting:** Cloudflare Worker serving `public/` (static assets), deployed on every push to `main`.
- **Backend:** Supabase (`supabase/migrations`, `supabase/functions/barista`).

## Develop
```sh
npm install
npm run build        # bundles src/ → public/assets/app.js + app.css (committed)
npx wrangler dev     # preview locally
```

Motion components (BlurText, CountUp, SpotlightCard, Marquee, ShinyText, grain) are dependency-free takes on patterns from [React Bits](https://reactbits.dev).

## Brand
`brand/` holds the badge: lettering in Inter Display SemiBold around the original beans illustration. Regenerate with `python3 brand/build_badge.py`.
