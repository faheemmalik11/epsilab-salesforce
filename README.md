# Epsilab Salesforce work trial

A working clone of the Salesforce Sales Cloud core (Lead, Account, Contact, Opportunity, Task, with seeded Users), with a GUI, a REST API and an MCP server on one shared service layer.

Status: Phase 6a (Lightning GUI for the full lifecycle). Phase 6b adds visual polish and the full Seller Home page. See `PLAN.md` for the phases and `docs/REQUIREMENTS.md` for the requirements checklist.

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

Configuration comes from environment variables (see `.env.example`): `GUI_PORT`, `API_PORT`, `SEED_PROFILE`, `CLOCK`, `CLOCK_MODE`, `DEFAULT_USER_ID`, `MCP_ALLOWED_HOSTS`.

## GUI

Salesforce Lightning Experience style, built with the Salesforce Lightning Design System, at desktop width. Pick the seeded user you act as from **Acting as** in the header.

- **Leads, Accounts, Contacts, Opportunities, Tasks:** list views with sorting, filters and exact counts, New/Edit forms, record pages with Details, Related lists and Activity.
- **Lead workflow:** Log a Call, Lead Status path, Convert (new or existing account, optional opportunity). Converted leads are read-only with links to the new records.
- **Opportunity workflow:** stage path, the close dialog (Closed Won or Closed Lost), Contact Roles, tasks and Next Step.
- Validation errors are the API's own messages.

### Stubs (visibly marked in the UI)

| Stub | Where |
|---|---|
| Reports, Dashboards, Forecasts, Campaigns, Cases | Navigation tabs, each opening a page marked "Not available in this trial" |
| Global search | Disabled search box in the header |
| App Launcher | Inert icon beside the app name |
| Recently Viewed, All Open list views | Disabled entries in the list view picker |
| New Event, Email | Disabled tabs in the activity composer |

## REST API

Shaped like the Salesforce REST API. Errors are always the Salesforce array `[{ "errorCode", "message", "fields" }]`, with HTTP 400 (404 for unknown records or objects). Send `X-User-Id: <user id>` to act as a seeded user; without it the API acts as `DEFAULT_USER_ID`, or the first active user by name.

| Method and path | Purpose |
|---|---|
| `GET /api/sobjects`, `GET /api/sobjects/{object}/describe` | Objects and field metadata, including picklists |
| `POST /api/sobjects/{object}` | Create; returns `201 { id, success, errors }` |
| `GET` / `PATCH` / `DELETE /api/sobjects/{object}/{id}` | Read; update (`204`); delete (`204`) |
| `POST /api/query` | `{ object, where: [{ field, op, value }], orderBy: [{ field, direction }], limit, offset }` → `{ totalSize, done, records }` |
| `POST /api/leads/{id}/convert` | `{ convertedStatus, accountId?, doNotCreateOpportunity?, opportunityName?, ownerId? }` |
| `POST /api/tasks/log-call` | `{ whoId?, whatId?, subject?, description?, activityDate? }` |
| `GET /api/users`, `GET /api/mutations` | Seeded users; the mutation log since the last build |

Query operators: `eq`, `ne`, `in`, `isNull`, `notNull`, `contains`. The All Leads view is `IsConverted eq false`.

## Develop

```bash
pnpm install
pnpm build && pnpm build:db    # builds the server, the GUI and data/app.db
pnpm start                     # GUI on :3000, REST and MCP on :8080
pnpm test                      # unit and integration tests
pnpm e2e                       # Playwright GUI tests (starts its own server on ports 3100/8180 with a fresh database)
scripts/smoke.sh               # full stack check inside the linux/amd64 container, online and offline
```

## MCP tools

Streamable HTTP, stateless, at `http://localhost:8080/mcp`. Every tool calls the same service layer as REST, and failures return the same Salesforce error array (`isError: true`, `structuredContent.errors`). Tools that write accept an optional `actingUserId`.

| Tool | Description |
|---|---|
| `health` | Seed fixture and SQLite version |
| `list_objects`, `describe_object` | Supported objects; field metadata and picklists |
| `list_users` | Seeded users and active flags |
| `create_record`, `get_record`, `update_record`, `delete_record` | CRUD on any writable object |
| `query_records` | Filter, sort and page one object |
| `convert_lead` | Atomic lead conversion |
| `log_call`, `create_task` | Activities |
| `add_contact_role` | Contact role on an opportunity |
| `update_opportunity_stage` | Stage change, with optional amount and next step |
| `get_mutation_log` | Changes since the last build |
