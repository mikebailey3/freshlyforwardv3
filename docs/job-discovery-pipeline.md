# Job Discovery Pipeline (Scheduled)

Automates what used to be manual `npm run` commands: scraping Greenhouse /
Lever / Ashby public job-board APIs into `scraped_jobs`, then scoring every
active member against every active job into `job_matches` via FreshFit.

Runs via `.github/workflows/job-discovery-pipeline.yml`, on a schedule
(every 6 hours, UTC) and on-demand (`workflow_dispatch`). It runs the
existing scripts unchanged:

1. `npm run scrape:companies` -- Greenhouse/Lever/Ashby only. `scrapeIndeed.ts`
   is intentionally excluded (ToS risk); it stays a manual, non-scheduled
   fallback.
2. `npm run sync:freshfit` -- always attempted, even if step 1 hard-fails,
   because it re-scores against the existing job backlog, not just this
   cycle's new finds.

## Required GitHub secrets

Set these under repo **Settings -> Secrets and variables -> Actions ->
Repository secrets**. These are the exact same variable names the scripts
already read locally -- no renaming, no second config system for CI:

| Secret name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Same Supabase project URL used locally / in the app's own env |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **service role** key (not the anon key) -- required to write past RLS |

Only a repo admin can set these; this is a manual, credential-handling step
that has to happen before the workflow can do anything real.

## companies.json: seeded slugs are NOT independently verified

`scripts/jobSources/companies.json` was seeded with a small set of real
companies believed to run public Greenhouse/Lever/Ashby job boards
(`pinterest`, `doordash` / `netflix`, `eventbrite` / `ashby`, `ramp`).

**These slugs were not fetched or confirmed live** -- the environment that
seeded them has no general outbound internet access to arbitrary domains
(only GitHub Actions' own runners do). Treat them as a reasonable starting
point, not a verified one. The first `workflow_dispatch` run described
below is the actual verification point: its per-company summary output
will show exactly which slugs are live/correct today and which need
swapping for a real one from that company's current careers page
(`boards.greenhouse.io/<slug>`, `jobs.lever.co/<slug>`,
`jobs.ashbyhq.com/<slug>`).

To add/change a company, edit `scripts/jobSources/companies.json` directly
-- it's a plain `{ "greenhouse": [...], "lever": [...], "ashby": [...] }`
map of provider to slug list. It stays plain JSON on purpose (no comments,
no extra metadata fields) so it remains valid, minimal config; this file is
where that note lives instead.

## Performing the first workflow_dispatch run

1. Confirm both secrets above are set on the repo.
2. Merge this workflow to the repo's default branch (`schedule` triggers
   and the Actions tab's "Run workflow" button both require the workflow
   file to exist on the default branch first).
3. GitHub -> **Actions** tab -> **Job Discovery Pipeline** (left sidebar) ->
   **Run workflow** button -> confirm.
4. Open the run once it starts, expand both steps' logs. Each step ends
   with a clearly delimited summary block, for example:

   ```
   === Job Discovery: Scrape Summary ===
   Companies attempted: 6 (succeeded: 4, failed: 2)
   Jobs discovered this run: 37 (37 new, 0 already known)
   Status: PARTIAL
   ======================================
   ```

   Read the status:
   - `SUCCESS` -- every configured company/provider responded (even a
     company with zero open jobs right now still counts as success).
   - `PARTIAL` -- some companies failed (bad/stale slug, network issue,
     etc.); check the `Failed on <provider>/<slug>: ...` lines above the
     summary for which ones and why. The step still succeeds overall.
   - `FAILED` -- every configured company failed, or companies.json was
     empty; nothing could be scraped. The step (and job) show red.

   The FreshFit sync step reports the same way, in terms of (member, job)
   scoring pairs attempted/succeeded/failed instead of companies.
5. Fix any slugs the run reports as failing, commit, and re-run via
   `workflow_dispatch` again -- no need to wait for the next scheduled
   trigger.

## What this does not verify

Local test/type/build checks confirm the code is correct in isolation. They
cannot confirm live ATS API responses, real Supabase writes, or RLS
behavior against the production database -- only a real `workflow_dispatch`
run (step 3 above) proves the end-to-end scrape -> persist -> score path
actually works, because only GitHub's runners (not this repo's local dev
sandbox) have general outbound internet access to Greenhouse/Lever/Ashby.
