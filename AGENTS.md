# JCB Spending Visualizer — Codex Development Instructions

This repository follows Spec-Driven Development (SDD).

Before modifying code, always read:

- `AGENTS.md`
- `specs/PROJECT_SPEC.md`
- the currently assigned child spec

## Specification Priority

When requirements conflict, use this priority:

1. Current explicit user instruction
2. `PROJECT_SPEC.md`
3. Current child spec
4. Existing implementation
5. Agent assumptions

Do not silently override the Project Spec.

## SDD Development Rule

Implement only the currently assigned child spec.

Do not implement future specs in advance.

For Spec 01, allowed scope includes:

- Next.js foundation
- Navigation
- CSV import UI
- Basic CSV file validation

Do not implement:

- JCB CSV parsing
- Transaction conversion
- OpenAI integration
- Category classification
- Dashboard charts
- Transaction filtering

## Scope Discipline

Do not introduce unspecified features such as databases, authentication, user accounts, Discord integration, MyJCB scraping, bank integration, budget management, waste detection, or AI financial advice unless the Project Spec is explicitly changed.

Prefer the simplest implementation that satisfies the current spec.

## Architecture Rules

Target stack:

- Next.js
- TypeScript
- Tailwind CSS
- Recharts
- Papa Parse
- Vercel
- OpenAI API
- localStorage
- No database for MVP

Keep responsibilities separated:

- CSV parsing: `src/lib/csv/`
- AI-specific logic: `src/lib/ai/`
- Category logic/cache: `src/lib/categories/`
- Analytics: `src/lib/analytics/`
- Shared domain types: `src/types/`

Create these directories only when required by the active spec.

## Privacy Rules

The complete JCB statement CSV must remain in the browser.

Never upload the complete JCB CSV to the application server.

Do not send transaction amount, date, approval number, complete CSV contents, or other unnecessary transaction information to the AI provider.

Only merchant information needed for classification may be sent.

## API Key Security

Use server-side `OPENAI_API_KEY`.

Never use `NEXT_PUBLIC_OPENAI_API_KEY`.

Never expose, hard-code, commit, return, or log API keys.

Required architecture:

```text
Browser
  ↓
Next.js server endpoint
  ↓
OpenAI API
```

## TypeScript / Code Quality

Use TypeScript throughout.

Avoid `any` unless genuinely unavoidable.

Prefer:

- Small components
- Pure functions
- Clear naming
- Single-responsibility modules
- Minimal dependencies
- Simple control flow

Avoid:

- Premature abstraction
- Large monolithic components
- Duplicated validation logic
- Hidden side effects
- Dead code
- Unused future infrastructure

File input and drag-and-drop must share the same validation logic.

## Dependencies

Do not add a dependency unless necessary for the current spec.

Do not install dependencies needed only by future specs.

## Testing and Verification

Before declaring a spec complete, run:

```bash
npm run lint
npm run build
```

If tests exist, also run the repository's test command.

Do not claim a command passed unless it was actually executed successfully.

## Implementation Workflow

For each child spec:

1. Read `AGENTS.md`, `specs/PROJECT_SPEC.md`, and the assigned child spec.
2. Inspect the current repository.
3. Briefly state likely files to change, implementation approach, scope boundaries, and tests.
4. Implement only the current spec.
5. Run relevant tests, lint, and build.
6. Compare implementation against every Acceptance Criterion.
7. Report completion.

## Completion Report

Report:

- Implementation summary
- Files changed
- Acceptance Criteria as `PASS` / `FAIL`
- Verification commands actually run
- Dependencies added
- Remaining issues

Do not mark incomplete requirements as PASS.

## Forbidden Agent Behavior

Do not:

- Implement future specs
- Change product requirements without instruction
- Introduce database/authentication
- Send complete CSV to server
- Expose API secrets
- Disable lint rules merely to silence errors
- Delete tests because they fail
- Perform large unrelated refactors
- Claim tests passed without running them

## Source of Truth

```text
specs/PROJECT_SPEC.md
        ↓
Child specification
        ↓
Implementation
        ↓
Tests
```

## Current Development Sequence

```text
Spec 01 — Application Foundation & CSV Import
Spec 02 — JCB CSV Parsing
Spec 03 — AI Category Classification
Spec 04 — Category Cache & Manual Correction
Spec 05 — Dashboard Visualization
Spec 06 — Transaction Explorer
MVP v1.0
```

Only the explicitly assigned spec is active.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
