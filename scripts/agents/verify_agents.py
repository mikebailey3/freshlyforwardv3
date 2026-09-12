"""Verify the generated FreshlyForward agent configs actually load correctly.

Checks the things that fail SILENTLY in Code Puppy:
  1. every declared tool survives JSONAgent's unknown-name filter
  2. the charter's authority model is real (who can escalate / who cannot)
  3. required fields are present and prompts are substantive

Run from the repo root with the Code Puppy venv python.
"""

import json
import sys

from code_puppy.plugins import load_plugin_callbacks

load_plugin_callbacks()

from code_puppy.agents.json_agent import JSONAgent, discover_json_agents  # noqa: E402

# Charter: only the CEO and CTO hold escalation seats.
EXPECTED_ESCALATORS = {"alex-morgan", "john-carter"}

# Charter: destructive whole-file deletion is reserved for owner approval.
FORBIDDEN_EVERYWHERE = {"delete_file"}

lines = []
failures = []

agents = discover_json_agents()
lines.append(f"discovered agents: {len(agents)}")

if len(agents) != 12:
    failures.append(f"expected 12 agents, found {len(agents)}")

actual_escalators = set()

for key in sorted(agents):
    path = agents[key]
    agent = JSONAgent(path)
    with open(path, encoding="utf-8") as handle:
        cfg = json.load(handle)

    declared = set(cfg["tools"])
    effective = set(agent.get_available_tools())

    # JSONAgent drops unknown tool names without complaint - that is the
    # failure mode this check exists to catch.
    dropped = declared - effective
    if dropped:
        failures.append(f"{key}: tools silently dropped -> {sorted(dropped)}")

    forbidden = effective & FORBIDDEN_EVERYWHERE
    if forbidden:
        failures.append(f"{key}: holds forbidden tool(s) {sorted(forbidden)}")

    if "ask_user_question" in effective:
        actual_escalators.add(key)

    prompt = agent.get_system_prompt()
    if len(prompt) < 1200:
        failures.append(f"{key}: system prompt suspiciously short ({len(prompt)} chars)")
    if "HARD RULES" not in prompt:
        failures.append(f"{key}: prompt missing HARD RULES section")
    if "Shared Charter" not in prompt:
        failures.append(f"{key}: prompt missing shared charter")

    # An agent without an escalation seat must not be told it has one.
    if key not in EXPECTED_ESCALATORS and "You hold an escalation seat" in prompt:
        failures.append(f"{key}: prompt claims escalation authority it does not have")

    flag = "ESCALATES" if key in actual_escalators else ""
    lines.append(
        f"  {key:18s} tools={len(effective):2d} prompt={len(prompt):5d} chars  {flag}"
    )

if actual_escalators != EXPECTED_ESCALATORS:
    failures.append(
        f"escalation seats wrong: expected {sorted(EXPECTED_ESCALATORS)}, "
        f"got {sorted(actual_escalators)}"
    )

lines.append("")
if failures:
    lines.append(f"FAILED ({len(failures)} problem(s)):")
    lines.extend(f"  - {f}" for f in failures)
else:
    lines.append("ALL CHECKS PASSED")

report = "\n".join(lines)
with open("agent_verify_report.txt", "w", encoding="utf-8") as handle:
    handle.write(report + "\n")

print(report)
sys.exit(1 if failures else 0)
