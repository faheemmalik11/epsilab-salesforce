# Project rules

Salesforce Sales Cloud clone built for the Epsilab work trial. Plan: `PLAN.md`. Requirements checklist: `docs/REQUIREMENTS.md`.

## 1. Writing and attribution
- Never use em dashes in code comments, documentation, commit messages, or other project text.
- Never add `Co-Authored-By: Claude` or any Claude attribution to Git commits.
- Keep commit messages short, clear, and professional.

## 2. Code quality
- Write clean, readable, maintainable TypeScript.
- Follow established best practices for each technology.
- Keep functions focused on one responsibility.
- Create reusable components, hooks, services, and utilities when functionality is shared.
- Avoid duplicate code, but don't introduce unnecessary abstractions.
- Maintain consistent naming and project structure.
- Keep business logic separate from API routes, MCP handlers, and UI components.

## 3. Testing
- Test every feature as it's implemented.
- Write unit tests for business logic and validation.
- Write integration tests for API, MCP, and database operations.
- Use Playwright for critical GUI workflows.
- Test success cases, validation failures, and edge cases.
- Run relevant tests after changes and fix failures before proceeding.
- Never claim a feature works without verifying it.

## 4. Comments and documentation
- Avoid long or unnecessary code comments.
- Write comments only when they explain a decision that isn't obvious from the code.
- Prefer clear names and simple code over explanations.
- Keep documentation accurate and concise.

## 5. Requirements and delivery
- The original assessment remains the primary source of truth: https://app.notion.com/p/Salesforce-Work-Trial-416a70051f1f8063a5f6e3665c1e984f
- Use `docs/REQUIREMENTS.md` to track acceptance criteria.
- Follow the agreed implementation phases in `PLAN.md`.
- Keep GUI, REST API, and MCP on the same service layer (`src/server/services/`).
- Record assumptions and tradeoffs in `TRADEOFFS.md`.
- Do not silently stub features.
- Do not add features outside the required scope unless necessary.
- Verify Docker compatibility with `linux/amd64`.
- Work in the current development repository. Do not merge or push to the reviewer's repository (`../salesforce-work-trial`) without approval.

## Seed data
- `seed/` is committed in this private repository, byte-identical to the sha256 hashes in `seed/manifest.json`. `scripts/fetch-seed.sh` can re-copy and verify it from `../salesforce-work-trial`.
- The seed is real pseudonymized company data. Never publish it outside private repositories.

## Project context and source of truth

Before starting any development phase or making a technical decision, review the relevant project documentation.

**Read in this order:**

1. **Original Salesforce Work Trial assessment:** the primary source of truth. Its scope, acceptance criteria, priorities, and deliverables override everything else.
2. **`docs/REQUIREMENTS.md`:** maps the original requirements to implementation tasks and tests. Use it to track progress and verify completion.
3. **`PLAN.md`:** the agreed architecture, development phases, and execution order.
4. **`docs/reference/README.md`:** explains the research sources and how to interpret the reference files.
5. **Relevant files in `docs/reference/`:** consult them when implementing the related functionality:
   - `objects-and-fields.md` for data models and relationships.
   - `lead-seed-mapping.md` for importing seed data.
   - `picklists.md` for statuses, stages, and picklist values.
   - `behavior-and-validation.md` for business rules, conversion, and validation.
   - `gui-surfaces.md` for Lightning UI screens and components.

**Rules:**

- The original assessment always takes priority over research notes and implementation decisions.
- Reference documents explain Salesforce behavior. They do not introduce new requirements.
- Do not read every reference file on every task. Read the relevant files before implementing or modifying that area.
- Before each phase, check its requirements in `docs/REQUIREMENTS.md`.
- After each phase, update the checklist with actual test results and evidence.
- If documents conflict, return to the original assessment and resolve the difference.
- Document assumptions in `TRADEOFFS.md`.
- Never mark a requirement complete without testing it.
- Follow the code quality, testing, and Git attribution rules above.
