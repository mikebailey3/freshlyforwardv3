#!/usr/bin/env node
/**
 * Generate the FreshlyForward AI employee agent configs.
 *
 *   npm run agents:generate          write .code_puppy/agents/*.json
 *   npm run agents:check             verify on-disk files match (CI-safe)
 *   node scripts/generateTeamAgents.mjs --verify-tools
 *                                    additionally check every tool name
 *                                    against the live Code Puppy registry
 *
 * Source of truth: scripts/agents/{charter,roster.*,buildAgent}.mjs
 * The generated JSON is disposable - never hand-edit it.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { allToolNames, buildAgentConfig } from './agents/buildAgent.mjs';
import { ROSTER_LEADERSHIP, ROSTER_INTELLIGENCE } from './agents/roster.leadership.mjs';
import { ROSTER_DELIVERY } from './agents/roster.delivery.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const OUT_DIR = join(REPO_ROOT, '.code_puppy', 'agents');

const ROSTER = [...ROSTER_LEADERSHIP, ...ROSTER_INTELLIGENCE, ...ROSTER_DELIVERY];

const checkOnly = process.argv.includes('--check');
const verifyTools = process.argv.includes('--verify-tools');

/* ------------------------------------------------------------------ *
 * Validation - fail loudly here, because JSONAgent fails silently.
 * ------------------------------------------------------------------ */

function validateRoster() {
  const problems = [];
  const seenKeys = new Map();
  const seenNames = new Map();

  for (const person of ROSTER) {
    const where = person.key ?? person.displayName ?? '<unnamed entry>';

    for (const field of ['key', 'displayName', 'title', 'description', 'mission', 'toolset']) {
      if (!person[field]) problems.push(`${where}: missing required field "${field}"`);
    }

    if (person.key && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(person.key)) {
      problems.push(`${where}: key must be kebab-case (got "${person.key}")`);
    }

    // Duplicate keys would overwrite each other on disk - one employee would
    // simply vanish, with no error anywhere. Catch it here.
    if (person.key) {
      if (seenKeys.has(person.key)) {
        problems.push(`duplicate key "${person.key}" (also used by ${seenKeys.get(person.key)})`);
      }
      seenKeys.set(person.key, where);
    }
    if (person.displayName) {
      if (seenNames.has(person.displayName)) {
        problems.push(
          `duplicate displayName "${person.displayName}" (also used by ${seenNames.get(person.displayName)})`,
        );
      }
      seenNames.set(person.displayName, where);
    }

    // Trailing whitespace in a display name is invisible in review and ugly
    // in the agent picker.
    if (person.displayName && person.displayName !== person.displayName.trim()) {
      problems.push(`${where}: displayName has leading/trailing whitespace`);
    }
  }

  if (problems.length) {
    console.error('Roster validation failed:\n' + problems.map((p) => `  - ${p}`).join('\n'));
    process.exit(1);
  }
}

/**
 * Cross-check every tool name against the real registry.
 *
 * Worth the subprocess: JSONAgent silently drops unknown tool names, so a
 * typo yields an agent that is quietly missing a capability. Requires the
 * Code Puppy venv, so it is opt-in rather than part of the default run.
 */
function verifyToolNames() {
  const venvPython = join(
    process.env.USERPROFILE || process.env.HOME || '',
    '.code-puppy-venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  );

  const names = allToolNames();
  const py = [
    'from code_puppy.plugins import load_plugin_callbacks',
    'load_plugin_callbacks()',
    'from code_puppy.tools import get_available_tool_names',
    'import json,sys',
    'known=set(get_available_tool_names())',
    `want=${JSON.stringify(names)}`,
    'print("MISSING:" + json.dumps([t for t in want if t not in known]))',
  ].join('; ');

  let output;
  try {
    output = execFileSync(venvPython, ['-c', py], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (err) {
    console.warn(
      `  ! Could not verify tool names (${err.code || err.message}).\n` +
        `    Expected Code Puppy venv at: ${venvPython}`,
    );
    return;
  }

  const match = output.match(/MISSING:(\[.*\])/);
  if (!match) {
    console.warn('  ! Tool verification produced no parseable result; skipping.');
    return;
  }

  const missing = JSON.parse(match[1]);
  if (missing.length) {
    console.error(
      `Unknown tool name(s) - these are silently dropped at load time:\n` +
        missing.map((t) => `  - ${t}`).join('\n'),
    );
    process.exit(1);
  }
  console.log(`  tools verified: all ${names.length} names exist in the registry`);
}

/* ------------------------------------------------------------------ *
 * Generate
 * ------------------------------------------------------------------ */

validateRoster();
if (verifyTools) verifyToolNames();

mkdirSync(OUT_DIR, { recursive: true });

const expectedFiles = new Set();
let written = 0;
let drifted = 0;

for (const person of ROSTER) {
  const config = buildAgentConfig(person);
  const filename = `${person.key}.json`;
  const target = join(OUT_DIR, filename);
  expectedFiles.add(filename);

  const contents = JSON.stringify(config, null, 2) + '\n';

  let current = null;
  try {
    current = readFileSync(target, 'utf8');
  } catch {
    /* not yet generated */
  }

  if (current === contents) continue;

  if (checkOnly) {
    console.error(`  DRIFT: ${filename} is out of date`);
    drifted++;
    continue;
  }

  writeFileSync(target, contents, 'utf8');
  written++;
}

// A renamed employee leaves an orphan behind that would still load as a real
// agent. Surface it rather than letting a ghost linger in the picker.
const orphans = readdirSync(OUT_DIR)
  .filter((f) => f.endsWith('.json'))
  .filter((f) => !expectedFiles.has(f));

if (checkOnly) {
  if (drifted || orphans.length) {
    if (orphans.length) {
      console.error(`  ORPHANS: ${orphans.join(', ')}`);
    }
    console.error('\nAgent configs are out of date. Run: npm run agents:generate');
    process.exit(1);
  }
  console.log(`agents:check - all ${ROSTER.length} configs are up to date`);
} else {
  console.log(
    `Generated ${ROSTER.length} FreshlyForward employees ` +
      `(${written} written, ${ROSTER.length - written} unchanged) -> .code_puppy/agents/`,
  );
  if (orphans.length) {
    console.warn(
      `  ! Orphaned config(s) not in the roster: ${orphans.join(', ')}\n` +
        `    Delete them if an employee was renamed or removed.`,
    );
  }
  console.log(`\nUse them with:  /agent ${ROSTER[0].key}`);
  console.log('(run Code Puppy from the repo root - project agents resolve from CWD)');
}
