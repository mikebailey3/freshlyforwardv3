/*
# MessagesPage unread-count query -- covering index

## STATUS: PREPARED FOR REVIEW. NOT APPLIED TO PRODUCTION.
Forward migration only. Authored by an implementation agent per the
standing rule: agents may author and package migrations; only
ChatGPT (Supabase/Database Lead) executes them against the live
database.

## Why
N3's MessagesPage fix (src/pages/MessagesPage.tsx) replaced the old,
structurally-broken per-conversation unread count (derived from
`messages` state that only ever held the ACTIVE conversation's rows)
with a real aggregate query:

    supabase.from('messages')
      .select('conversation_id')
      .in('conversation_id', activeConversationIds)
      .neq('sender_type', 'member')
      .eq('is_read', false)

`messages` currently has only `idx_messages_user (user_id, created_at
DESC)` (20260802172349_phase3_membership_system.sql) -- nothing
indexes `conversation_id`. The new query's primary selectivity filter
is `conversation_id IN (...)`, which would fall back to a sequential
scan without this index; flagged independently by Nina Patel (QA) as
a scale risk, not a correctness bug (the query returns correct results
today at low row counts).

## Index choice
A single-column index on `conversation_id` is enough for the `IN`
filter's own selectivity; `sender_type`/`is_read` are cheap boolean/enum
post-filters over the much smaller per-conversation row set once
`conversation_id` narrows it down, so a wider composite index isn't
justified by this query alone. Not partial (unlike the OE 2.0 FK
indexes in 20260920000000) -- there's no analogous "small minority of
rows" skew here; most messages belong to some conversation and this
column is queried for that conversation on every message-thread open,
not just an edge case.

This also happens to be the natural covering index for `messages`'
own (undeclared) FK to `conversations.id` -- Postgres does not
auto-index the referencing side of a foreign key, matching the same
gap class documented in 20260920000000_oe_fk_indexes.sql.
*/

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON public.messages(conversation_id);
