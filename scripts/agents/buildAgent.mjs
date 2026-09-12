/**
 * Prompt assembly + toolset definitions for FreshlyForward employees.
 *
 * The charter's authority model is enforced HERE, in capability rather than
 * politeness. An agent told "do not contact the owner" but handed
 * `ask_user_question` will eventually use it; an agent that simply lacks the
 * tool cannot. Same reasoning for database execution and destructive deletes.
 *
 * TOOL NAMES ARE VALIDATED against the live Code Puppy registry by
 * `generateTeamAgents.mjs --verify-tools`. Unknown names are silently dropped
 * by JSONAgent at load time, so a typo produces a quietly crippled agent
 * rather than an error. Do not add a name here without verifying it.
 */

import { sharedCharter, STACK_BRIEF } from './charter.mjs';

/** Tools every employee gets: read, search, run, reason, delegate. */
const BASE_TOOLS = [
  'list_files',
  'read_file',
  'grep',
  'agent_run_shell_command',
  'agent_share_your_reasoning',
  'list_agents',
  'invoke_agent',
  'activate_skill',
  'list_or_search_skills',
];

/**
 * `edit_file` expands to create_file + replace_in_file + delete_snippet.
 * Deliberately NOT `delete_file` - whole-file deletion is a destructive act
 * the charter reserves for owner approval.
 */
const EDIT_TOOLS = ['edit_file'];

/**
 * Toolsets by role. The differences are the point - if every agent got the
 * same tools, the org chart would be decoration.
 */
export const TOOLSETS = {
  /** Alex Morgan. Product direction: reads and writes docs, does not ship code. */
  strategy: [...BASE_TOOLS, ...EDIT_TOOLS, 'ask_user_question'],

  /** John Carter. Full engineering authority plus an escalation seat. */
  lead: [...BASE_TOOLS, ...EDIT_TOOLS, 'ask_user_question', 'invoke_agent_with_model'],

  /** Sarah Chen. Code plus visual verification of rendered UI. */
  design: [...BASE_TOOLS, ...EDIT_TOOLS, 'load_image_for_analysis'],

  /** Implementation specialists: Marcus, Priya, Daniel, Emily, Ryan, Nina, Ethan. */
  engineer: [...BASE_TOOLS, ...EDIT_TOOLS],

  /** Olivia Grant. Verification-heavy; edits docs/manifests, not features. */
  release: [...BASE_TOOLS, ...EDIT_TOOLS],

  /** ChatGPT. Database execution authority. */
  database: [...BASE_TOOLS, ...EDIT_TOOLS],
};

/** Every distinct tool name used above - what `--verify-tools` checks. */
export function allToolNames() {
  return [...new Set(Object.values(TOOLSETS).flat())].sort();
}

const bullets = (items) => items.map((i) => `- ${i}`).join('\n');
const numbered = (items) => items.map((i, n) => `${n + 1}. ${i}`).join('\n');

/** Render `plans` / `lockedDecisions` objects as a labelled list. */
function renderMap(map, { code = false } = {}) {
  return Object.entries(map)
    .map(([label, value]) => `- ${label}: ${code ? `\`${value}\`` : value}`)
    .join('\n');
}

/** Optional section - omitted entirely when the employee has no such data. */
function section(heading, body) {
  return body ? `\n### ${heading}\n${body}\n` : '';
}

/**
 * Build one employee's full system prompt.
 *
 * Order is intentional: identity -> mission -> scope -> rules -> charter.
 * Role-specific hard rules land BEFORE the shared charter so a specialist's
 * non-negotiables read as their own, not as boilerplate they inherited.
 */
export function buildSystemPrompt(person) {
  const parts = [];

  parts.push(
    `# ${person.displayName} - ${person.title}`,
    '',
    `You are ${person.displayName}, ${person.title} at FreshlyForward.`,
    '',
    person.mission,
  );

  if (person.authority?.length) {
    parts.push(section('You decide', bullets(person.authority)));
  }
  if (person.ownership?.length) {
    parts.push(section('You own', bullets(person.ownership)));
  }
  if (person.dependencies?.length) {
    parts.push(
      section(
        'You depend on (consume, never duplicate)',
        bullets(person.dependencies),
      ),
    );
  }
  if (person.methodology?.length) {
    parts.push(
      section(
        'Core methodology',
        bullets(person.methodology) +
          '\n\nThese are Superpowers skills. Use `list_or_search_skills` to find them and ' +
          '`activate_skill` to load one before leaning on it.',
      ),
    );
  }
  if (person.classifications?.length) {
    parts.push(
      section(
        'Mandatory classification for external code',
        bullets(person.classifications),
      ),
    );
  }
  if (person.lockedDecisions) {
    parts.push(section('Locked decisions', renderMap(person.lockedDecisions)));
  }
  if (person.definitionOfDone?.length) {
    parts.push(
      section('Your definition of done', numbered(person.definitionOfDone)),
    );
  }
  if (person.releaseGate?.length) {
    parts.push(
      section(
        'Release gate (every item must be verified, not assumed)',
        numbered(person.releaseGate),
      ),
    );
  }
  if (person.handoffFlow?.length) {
    parts.push(section('Supabase handoff flow', numbered(person.handoffFlow)));
  }
  if (person.plans) {
    parts.push(
      section(
        'Your plans',
        renderMap(person.plans, { code: true }) +
          '\n\nRead the relevant plan before starting work in that area.',
      ),
    );
  }
  if (person.hardRules?.length) {
    parts.push(
      section(
        'HARD RULES - non-negotiable',
        numbered(person.hardRules) +
          '\n\nThese outrank convenience, speed, and your own judgement. ' +
          'If a request conflicts with one, say so rather than quietly complying.',
      ),
    );
  }

  parts.push('\n' + STACK_BRIEF);
  parts.push('\n' + sharedCharter({ canEscalateToOwner: Boolean(person.escalates) }));

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Build the complete JSONAgent config object for one employee. */
export function buildAgentConfig(person) {
  const tools = TOOLSETS[person.toolset];
  if (!tools) {
    throw new Error(
      `Unknown toolset "${person.toolset}" for ${person.key}. ` +
        `Valid toolsets: ${Object.keys(TOOLSETS).join(', ')}`,
    );
  }

  return {
    name: person.key,
    display_name: person.displayName,
    description: person.description,
    system_prompt: buildSystemPrompt(person),
    tools,
  };
}
