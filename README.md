# Epsilab Salesforce work trial

A working clone of the Salesforce Sales Cloud core (Lead, Account, Contact, Opportunity, Task, with seeded Users), with a GUI, a REST API and an MCP server on one shared service layer.

Status: Phase 1 (stack proof). See `PLAN.md` for the phases and `docs/REQUIREMENTS.md` for the requirements checklist.

## Run with Docker

The seed is not committed to this working repository. Copy and verify it first:

```bash
scripts/fetch-seed.sh            # copies ../salesforce-work-trial/seed and checks sha256 hashes
docker compose up --build
```

| Service | URL |
|---|---|
| GUI | http://localhost:3000 |
| REST API | http://localhost:8080/api |
| MCP (Streamable HTTP, stateless) | http://localhost:8080/mcp |

Configuration comes from environment variables (see `.env.example`): `GUI_PORT`, `API_PORT`, `SEED_PROFILE`, `CLOCK`, `MCP_ALLOWED_HOSTS`.

## Develop

```bash
pnpm install
pnpm build && pnpm build:db    # builds the server, the GUI and data/app.db
pnpm start                     # GUI on :3000, REST and MCP on :8080
pnpm test                      # unit and integration tests
pnpm e2e                       # Playwright GUI tests
scripts/smoke.sh               # full stack check inside the linux/amd64 container, online and offline
```

## MCP tools

| Tool | Description |
|---|---|
| `health` | Reports the seed fixture loaded into the database and the SQLite version |
