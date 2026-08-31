/*
# Member-Submitted Jobs

## Overview
Lets a member submit their own job lead (typed in, not fetched from a
URL) directly into the existing Opportunity Engine pipeline, instead of
only waiting for the scheduled scraper. Purely additive: no existing
table, column, trigger, or policy is modified.

## Security
- scraped_jobs: the existing service-role-only write assumption for
  every other source is untouched. This adds one narrowly-scoped policy
  letting an authenticated member INSERT a row only when
  source = 'member-submitted' -- they cannot insert or spoof rows for
  any other source.
- job_matches: the existing service-role-only write assumption (aside
  from the member-dismiss / strategist-promote UPDATE policies) is
  untouched. This adds one policy letting an authenticated member
  INSERT a row only for themselves (member_id = auth.uid()). This is
  safe because a self-computed FreshFit score is not a trust boundary --
  worst case a member inflates their own score, which only changes what
  they see in their own queue; strategists independently review the
  underlying posting before promoting anything to a real Opportunity.
  The INSERT check additionally requires promoted_opportunity_id and
  dismissed_at to be NULL at insert time, so a member cannot forge a
  row that already looks promoted (pointing at an arbitrary, possibly
  guessed opportunities.id) or pre-dismissed.

## Defense-in-depth: posting_url scheme
Client-side validation (src/lib/jobSubmission.ts) already rejects
non-http(s) URL schemes (e.g. javascript:, data:) before a member's
submission reaches the database, and every render site guards with
src/lib/url.ts's isSafeHttpUrl() before ever putting the value into a
live href. This CHECK constraint is a third, DB-level backstop: it
holds even against a client that skips the app entirely and calls the
Supabase REST API directly with a valid session token.
*/

DROP POLICY IF EXISTS "member_insert_own_scraped_job" ON scraped_jobs;
CREATE POLICY "member_insert_own_scraped_job"
  ON scraped_jobs FOR INSERT
  TO authenticated
  WITH CHECK (source = 'member-submitted');

DROP POLICY IF EXISTS "member_insert_own_job_match" ON job_matches;
CREATE POLICY "member_insert_own_job_match"
  ON job_matches FOR INSERT
  TO authenticated
  WITH CHECK (
    member_id = auth.uid()
    AND promoted_opportunity_id IS NULL
    AND dismissed_at IS NULL
  );

-- Belt-and-suspenders backstop against javascript:/data:/etc URIs, in
-- addition to the app-level checks in src/lib/jobSubmission.ts and
-- src/lib/url.ts. Added NOT VALID so it can't fail this migration against
-- any pre-existing row from the scraper sources -- it still applies
-- immediately to every new INSERT/UPDATE going forward. Run
-- `ALTER TABLE scraped_jobs VALIDATE CONSTRAINT scraped_jobs_posting_url_scheme;`
-- once existing data has been confirmed clean, to close that gap too.
ALTER TABLE scraped_jobs DROP CONSTRAINT IF EXISTS scraped_jobs_posting_url_scheme;
ALTER TABLE scraped_jobs
  ADD CONSTRAINT scraped_jobs_posting_url_scheme
  CHECK (posting_url = '' OR posting_url ~* '^https?://')
  NOT VALID;
