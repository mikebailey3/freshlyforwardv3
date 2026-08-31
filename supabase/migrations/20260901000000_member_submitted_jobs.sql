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
  WITH CHECK (member_id = auth.uid());
