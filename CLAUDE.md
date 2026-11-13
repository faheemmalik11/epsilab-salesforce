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
- `seed/` is gitignored here. Copy it with `scripts/fetch-seed.sh`, which verifies the sha256 hashes in `seed/manifest.json`.
- The seed is real pseudonymized company data. Never publish it.
