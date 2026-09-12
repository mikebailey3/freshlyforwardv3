# FreshlyForward AI Employees

Twelve Code Puppy agents implementing the team defined in
[`docs/FRESHLYFORWARD_AI_TEAM.md`](../docs/FRESHLYFORWARD_AI_TEAM.md).

## Using them

Run Code Puppy **from the repo root** — project agents resolve from the current
working directory, so they are invisible from anywhere else.

```
/agent john-carter
```

| Agent | Role | Escalation seat |
|---|---|---|
| `alex-morgan` | CEO / Product Director | yes |
| `john-carter` | CTO / Lead Developer | yes |
| `sarah-chen` | Lead Product Designer | no |
| `marcus-reed` | Career Intelligence Lead | no |
| `priya-shah` | Opportunity Intelligence Lead | no |
| `daniel-brooks` | Resume Systems Lead | no |
| `emily-foster` | Career CRM Lead | no |
| `ryan-mitchell` | Integrations Engineer | no |
| `nina-patel` | QA / Test Lead | no |
| `ethan-cole` | Security & Privacy Lead | no |
| `olivia-grant` | Release Manager | no |
| `chatgpt-supabase` | Supabase / Database Lead | no |

## Do not hand-edit these files

`.code_puppy/agents/*.json` is **generated**. Edits are silently destroyed on
the next generate. Change the source instead:

```
scripts/agents/charter.mjs              shared rules (written once, used 12x)
scripts/agents/roster.leadership.mjs    7 employees
scripts/agents/roster.delivery.mjs      5 employees
scripts/agents/buildAgent.mjs           toolsets + prompt assembly
scripts/generateTeamAgents.mjs          the generator
```

Then:

```
npm run agents:generate    # rewrite the JSON
npm run agents:check       # CI-safe: fails if JSON is out of date
npm run agents:verify      # also validates tool names against Code Puppy
```

The JSON **is** committed, like a lockfile: cloning the repo gets you a working
team without a build step, and `agents:check` catches drift.

## Why a generator instead of 12 JSON files

The shared charter — global rules, Definition of Done, escalation policy,
verification requirements — is ~60 lines that every employee needs. Hand-written,
that is twelve copies drifting apart the first time a rule changes. One source,
twelve renders, no drift.

## Authority is enforced by capability, not by asking nicely

An agent told "do not contact the owner" but given `ask_user_question` will
eventually use it. So the charter's authority model is enforced in the toolset:

- **Only `alex-morgan` and `john-carter` have `ask_user_question`.** Everyone
  else routes through specialist → John → Alex, and is told so explicitly.
- **Nobody has `delete_file`.** All twelve get `edit_file` (create, replace,
  delete-snippet). Whole-file deletion is destructive and the charter reserves
  it for owner approval.
- **Only `chatgpt-supabase` carries database execution authority** in its
  prompt; everyone else is instructed to prepare migrations and stop.

## Gotcha: unknown tool names vanish silently

`JSONAgent.get_available_tools()` filters out names it does not recognise —
**no error, no warning**. A typo produces a quietly crippled agent. That is why
`npm run agents:verify` cross-checks every name against the live registry, and
why `scripts/agents/verify_agents.py` asserts that nothing was dropped.

Note that skill tools (`activate_skill`, `list_or_search_skills`) only exist
after plugins load, so verification must call `load_plugin_callbacks()` first.

## Verifying a change

```
npm run agents:verify
python scripts/agents/verify_agents.py    # needs the Code Puppy venv python
```

`verify_agents.py` checks all twelve load, no tools were dropped, exactly two
escalation seats exist, no agent holds a forbidden tool, and no prompt claims
authority it does not have.
