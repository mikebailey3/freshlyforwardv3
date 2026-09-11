# GitHub First Gate — Mandatory Pre-Project Capability Scan

## Purpose

Before implementation begins on every new FreshlyForward project or major subsystem, the AI Engineering Team must perform a targeted GitHub capability scan.

The purpose is to determine whether existing open-source projects, libraries, components, algorithms, patterns, or integrations can accelerate development, improve quality, reduce technical risk, or provide proven architectural ideas.

The objective is NOT to find another platform on which to rebuild FreshlyForward.

The objective is:

**Find useful parts → evaluate them → integrate surgically → preserve FreshlyForward.**

FreshlyForward remains the authoritative product, architecture, user experience, canonical data model, authentication system, routing system, database architecture, branding system, and source of truth.

## Gate Position

Every major project follows:

`PROJECT SELECTED`
→ `CURRENT-STATE AUDIT`
→ `GITHUB FIRST GATE`
→ `LICENSE + SECURITY REVIEW`
→ `FRESHLYFORWARD INTEGRATION MAP`
→ `DESIGN`
→ `IMPLEMENTATION PLAN`
→ `IMPLEMENT`
→ `QA`
→ `SECURITY`
→ `VERIFY`
→ `RELEASE`

Implementation may not begin until the GitHub First Gate has been completed.

## Gate Owner

Primary Owner: **Ryan Mitchell — Integrations Engineer**

Supporting reviewers:
- **John Carter — CTO / Lead Developer:** architecture compatibility, implementation value, dependency impact, integration boundaries.
- **Ethan Cole — Security & Privacy Lead:** licensing concerns, dependency/security risk, suspicious or unsafe code, abandoned dependencies, data/privacy implications.
- **Project Domain Owner:** validates whether the capability actually improves the project.

## Step 1 — Define Capability Map

Before searching GitHub, Ryan and the project owner break the project into capabilities.

Do not search only for the FreshlyForward feature name.

Search for:
1. complete product concept
2. individual capabilities
3. underlying technical problems
4. reusable libraries
5. algorithms
6. UI components
7. adapters/connectors
8. data models and schemas
9. test approaches
10. mature architectural patterns

## Step 2 — Audit FreshlyForward First

Before recommending external code, inspect FreshlyForward's existing implementation.

Determine:
- what already exists
- what is partially implemented
- what is authoritative
- what can be extended
- what should not be duplicated
- what existing components can be reused
- what existing data structures must remain canonical

External code must solve an actual gap.

If FreshlyForward already has a strong implementation, classify the candidate as `ALREADY HAVE`.

## Step 3 — Search GitHub

Ryan performs targeted GitHub searches using the capability map.

Consider:
- repository relevance
- license
- recent maintenance
- adoption/stars where useful
- contributor activity
- release history
- issue activity
- documentation quality
- test coverage
- architecture
- dependency footprint
- language/framework compatibility
- security history
- API stability

Preference generally goes to:
1. actively maintained projects
2. permissively licensed projects
3. focused libraries over massive platforms
4. projects compatible with the current FreshlyForward stack
5. capabilities with clean integration boundaries
6. projects with meaningful automated tests
7. projects with clear documentation

Popularity alone does not determine quality.

## Step 4 — Search Beyond Exact Matches

Search adjacent technical categories, not just the product label.

Evaluate the capability, not merely the repository's marketing category.

## Step 5 — Candidate Classification

Every meaningful candidate receives exactly one classification:

### DIRECT REUSE
Use when the license permits direct use, implementation fits FreshlyForward, dependency risk is acceptable, and the capability does not replace authoritative systems.

### ADAPT COMPONENT
Use when part of the implementation is valuable but must be modified to fit FreshlyForward.

FreshlyForward must not be adapted around the external component.

### REIMPLEMENT SMALL CAPABILITY
Use when the idea/algorithm is valuable but direct code reuse is undesirable, licensing is restrictive, architecture is incompatible, or the capability is small enough to rebuild natively.

### ARCHITECTURAL INSPIRATION
Use when a repository demonstrates useful design patterns but direct code reuse is unnecessary or inappropriate.

### ALREADY HAVE
Use when FreshlyForward already contains an equivalent or superior capability.

### REJECT
Use when license, security, maintenance, dependency footprint, architecture, duplication, or integration cost make the candidate inappropriate.

## Step 6 — License Review

Record:
- license
- reuse restrictions
- attribution requirements
- redistribution requirements
- copyleft implications

Permissive licenses such as MIT, Apache-2.0, and BSD are preferred.

AGPL/GPL/copyleft repositories require additional review.

Do not copy code from AGPL/copyleft projects into proprietary FreshlyForward code without explicit legal/licensing clearance.

If licensing cannot be confidently determined, stop that candidate and continue evaluating alternatives.

Escalate unresolved material licensing ambiguity.

## Step 7 — Security Review

Ethan reviews surviving candidates for:
- known vulnerabilities
- unsafe dependencies
- dependency age
- suspicious install scripts
- post-install hooks
- secrets handling
- authentication assumptions
- authorization assumptions
- external network behavior
- telemetry
- data collection
- filesystem access
- arbitrary code execution
- XSS/injection exposure
- supply-chain risk

Open source does not equal trusted.

## Step 8 — Surgical Integration Map

For every accepted capability record:

### Capability
What capability are we adding?

### Source
Repository/project/library.

### Classification
DIRECT REUSE / ADAPT COMPONENT / REIMPLEMENT SMALL CAPABILITY / ARCHITECTURAL INSPIRATION / ALREADY HAVE / REJECT

### License
Exact known license.

### FreshlyForward Authority
Which existing FreshlyForward system remains authoritative?

### Integration Point
Exact existing module/component/service the capability extends. Use exact paths/files where practical.

### External Elements Used
What specific part of the external project is useful?

### FreshlyForward Elements Preserved
What existing code/data model/workflow remains unchanged?

### Dependencies
Any new dependencies introduced.

### Security Impact
Security/privacy considerations.

### Database Impact
None / application-only / proposed migration handoff required.

### Testing Impact
Tests required to prove the integration works without regression.

## Step 9 — Candidate Scorecard

For significant candidates score:
- Capability Value — 1–5
- Architecture Fit — 1–5
- Maintenance Health — 1–5
- License Fit — 1–5
- Security Confidence — 1–5
- Integration Cost — 1–5 where 5 means expensive
- Dependency Risk — 1–5 where 5 means risky

The scorecard supports judgment; it does not replace it.

## Step 10 — Required Output

Before design/implementation begins, Ryan produces a **GitHub First Gate Report** containing:

### Project
Project being evaluated.

### Capability Map
Technical capabilities searched.

### FreshlyForward Current State
What already exists and must remain authoritative.

### Search Queries
Major GitHub search categories/queries used.

### Candidates Reviewed
For each meaningful candidate:
- repository
- capability
- license
- maintenance status
- classification
- architecture fit
- security concerns
- integration cost
- recommendation

### Recommended Reuse
Capabilities worth directly integrating.

### Recommended Adaptations
Components worth adapting.

### Recommended Reimplementations
Ideas/capabilities worth implementing FreshlyForward-native.

### Architectural Lessons
Patterns worth learning from without incorporating source code.

### Already Have
Capabilities FreshlyForward already provides.

### Rejected
Candidates rejected and why.

### Surgical Integration Map
Exact FreshlyForward integration points for accepted recommendations.

### Dependency Changes
Expected dependency additions/removals.

### Database Impact
Expected DB requirements.

### Security/License Findings
Any issues requiring additional review.

### Final Recommendation
How GitHub findings should affect the implementation plan.

## Step 11 — Gate Decision

The gate ends with one of three results:

### GREEN — PROCEED
Useful candidates have been evaluated and the implementation approach is clear.

### GREEN — BUILD NATIVE
No external repository provides enough value. Proceed with a FreshlyForward-native implementation.

This is a successful gate.

### BLOCKED
A material unresolved issue prevents safe implementation, such as licensing ambiguity, architecture conflict, or serious dependency/security concerns.

## Search Timebox

Search until:
- major capability categories have reasonable coverage
- strong candidates have been identified
- additional searches are producing diminishing returns

Do not delay implementation merely to find a theoretically perfect repository.

## Permanent Architecture Rule

GitHub is FreshlyForward's **parts warehouse**, not its **architecture**.

External repositories may provide:
- components
- algorithms
- parsers
- renderers
- adapters
- utilities
- design patterns
- test patterns
- provider integrations
- isolated libraries

They may not automatically replace:
- FreshlyForward
- Career Vault
- canonical career evidence
- Forward Profiles
- Resume Intelligence
- Master Resume
- FreshFit
- Opportunity Engine
- ForwardOS
- Career Compass
- authentication
- routing
- branding
- canonical data architecture

Every integration must produce:

**FreshlyForward + upgrade**

Never:

**FreshlyForward rebuilt around another repository**

## Enforcement

John Carter may not approve a major project's implementation plan until the GitHub First Gate Report exists.

Ryan owns completion of the scan.
Ethan owns security/license review.
The project's domain owner validates usefulness.
John owns final architecture acceptance.
Nina verifies regression coverage.
Olivia verifies the gate was completed as part of the release record.

If the project requires database changes:

`Feature Owner → John → Ethan → migration/tests/manifest → Olivia → STOP → ChatGPT`

The GitHub First Gate never grants an agent authority to execute production database changes.
