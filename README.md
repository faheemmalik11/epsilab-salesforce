# Epsilab Salesforce work trial

A working clone of the Salesforce Sales Cloud core (Lead, Account, Contact, Opportunity, Task, with seeded Users), with a GUI, a REST API and an MCP server on one shared service layer.

Status: Phase 6b (Lightning visual fidelity and Seller Home) on top of Phase 8 (reset, snapshots, clock). See `PLAN.md` for the phases and `docs/REQUIREMENTS.md` for the requirements checklist.

## Run with Docker

The seed is committed in `seed/` (this repository is private), with its sha256 hashes in `seed/manifest.json`.

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| GUI | http://localhost:3000 |
| REST API | http://localhost:8080/api |
| MCP (Streamable HTTP, stateless) | http://localhost:8080/mcp |

Configuration comes from environment variables (see `.env.example`): `GUI_PORT`, `API_PORT`, `SEED_PROFILE`, `CLOCK`, `CLOCK_MODE`, `DEFAULT_USER_ID`, `MCP_ALLOWED_HOSTS`.

## Reproduce the core workflow (Lead to Closed Won)

**In the GUI** (http://localhost:3000):
1. **Leads** tab → **New** → enter Last Name and Company → **Save**.
2. On the lead, click the call button in Activity (Log a Call) → **Save**: a completed Call task.
3. On the Path, select **Working - Contacted** → **Mark as Current Status**.
4. **Convert** → choose Create New or Choose Existing Account, keep or skip the Opportunity → **Convert**. The success screen links to the new Account, Contact and Opportunity; the lead becomes read-only.
5. Open the Opportunity: use the Path to move through the stages (enter an Amount when asked, since stages after Qualification require one), edit **Next Step** with the pencil, add a **Contact Role** from the related list, and create a task with **New Task**.
6. Select **Closed** on the Path → **Select Closed Stage** → Closed Won or Closed Lost.
7. Direct path: **Accounts** → New, then **New** on its Contacts list, then **New** on its Opportunities list.

**Over REST** (http://localhost:8080):

```bash
API=http://localhost:8080/api
LEAD=$(curl -s -X POST $API/sobjects/Lead -H 'content-type: application/json' -d '{"LastName":"Lovelace","Company":"Engines Ltd"}' | jq -r .id)
curl -s -X POST $API/tasks/log-call -H 'content-type: application/json' -d "{\"whoId\":\"$LEAD\"}"
curl -s -X PATCH $API/sobjects/Lead/$LEAD -H 'content-type: application/json' -d '{"Status":"Working - Contacted"}'
OPP=$(curl -s -X POST $API/leads/$LEAD/convert -H 'content-type: application/json' -d '{"convertedStatus":"Closed - Converted"}' | jq -r .opportunityId)
curl -s -X PATCH $API/sobjects/Opportunity/$OPP -H 'content-type: application/json' -d '{"StageName":"Value Proposition","Amount":80000,"NextStep":"Demo"}'
curl -s -X PATCH $API/sobjects/Opportunity/$OPP -H 'content-type: application/json' -d '{"StageName":"Closed Won"}'
curl -s -X POST $API/query -H 'content-type: application/json' -d '{"object":"Lead","where":[{"field":"IsConverted","op":"eq","value":false},{"field":"Rating","op":"eq","value":"Hot"}],"orderBy":[{"field":"Company"}],"limit":1}' | jq .totalSize   # 7111
```

**Over MCP** (Streamable HTTP at http://localhost:8080/mcp): the same steps are the tools `create_record`, `log_call`, `update_record`, `convert_lead`, `update_opportunity_stage`, `add_contact_role` and `create_task`; `tools/list` lists all 21.

## GUI

Salesforce Lightning Experience style at desktop width: the Salesforce Lightning Design System (SLDS 1) with the Cosmos look recreated in `src/web/src/cosmos.css`. Pick the seeded user you act as from **Acting as** in the header.

- **Seller Home:** Build Pipeline (my leads from the last 30 days and their activity), Today's Tasks and Recent Records.
- **Navigation:** an app sidebar (Home, Contacts, Accounts, Sales), and object tab menus with New, recent records and list views.
- **Leads, Accounts, Contacts, Opportunities, Tasks:** list views with sorting, filters on any column and value (equals, not equal to, contains), "Search this list", wrap or clip per column, inline edit, row actions (Edit, Delete, Change Owner) and exact counts; New (with Save & New) and Edit forms; record pages with details, activity and related lists side by side, inline edit, Change Owner and Delete. The lead page follows Lightning's About, Get in Touch, Segment and History sections. Activity has a docked Log a Call and New Task composer and a filtered, grouped timeline.
- **Lead workflow:** Log a Call, Lead Status path, Convert (new or existing account, optional opportunity). Converted leads are read-only with links to the new records.
- **Opportunity workflow:** stage path, the close dialog (Closed Won or Closed Lost), Contact Roles, tasks and Next Step.
- Validation errors are the API's own messages.

### Stubs

Out-of-scope entry points stay visible, as in Salesforce, but are disabled and marked "Not in scope" with a tooltip naming the feature. The full list is in `FEATURES.md`.

Icons and illustrations come from the Salesforce Lightning Design System (© Salesforce, CC BY-ND 4.0, https://creativecommons.org/licenses/by-nd/4.0/), used unmodified. The SLDS CSS is BSD-3-Clause.

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

Query operators: `eq`, `ne`, `in`, `isNull`, `notNull`, `contains`. `eq`, `ne` and `in` ignore case on text and picklist fields; `eq null` and `ne null` mean empty and not empty, as in SOQL. `in` takes an array, the value-comparing operators require a `value`, and `direction` is `asc` or `desc` in any case; anything else returns `MALFORMED_QUERY`, the same over REST and MCP. The All Leads view is `IsConverted eq false`.

## Data

**Seed (imported exactly):** 21,628 Leads (7,111 Hot) and 9 Users, from `seed/`. The import checks the sha256 hashes in `seed/manifest.json`, and nothing afterwards edits, converts or deletes a seed row.

**Generated:** the rest of the org, built from the seed at image build by `src/server/seed/generate.ts`. It writes through the same service layer as the API, so every save rule holds.

| Object | `default` | `small` |
|---|---|---|
| Accounts | 1,838 | 184 |
| Contacts | 5,079 | 489 |
| Opportunities | 3,513 | 343 |
| Opportunity Contact Roles | 5,225 | 481 |
| Tasks | 19,348 | 1,870 |

`default` models a 7-rep sales team two years into working the seed leads. `small` is the same shape at a tenth of the size. Pick one with `SEED_PROFILE`; both baselines are in the image.

**What's in it:**
- **Accounts:** contractors and the businesses around them, matching the seed's trade-contractor leads. Industries, sizes, states, titles and names vary, and names come from the seed's own first and last names. 300 accounts are named after companies shared by several seed leads, so converting one of those leads finds an existing account.
- **Opportunities:** every stage. 716 are Closed Won and 1,423 Closed Lost (a 33% win rate), and the rest are open. Sizes scale with the account, from $1,000 to about $930,000 with a median of $33,000. Each deal was created early and then moved to its current stage, so creation and modified dates, close dates and probabilities line up.
- **Contact roles and tasks:** 85% of deals with roles have exactly one primary contact. Two years of calls, emails and meetings cover deals, contacts and accounts. 1,800 seed leads have call history, and 745 of them have an open follow-up.
- **Owners:** workloads differ between the 7 active reps. The 2 inactive users still appear as the creators of 237 older accounts.

**Realistically messy, on purpose (brief: "near-duplicate accounts, stale opportunities and missing optional fields"):**
- 38 near-duplicate accounts: "Acme Inc." and "Acme, Inc.", a trailing space, "and" for "&", all capitals, a dropped or added "LLC"/"Inc". **Counting rule:** lowercase the name, replace " and " with " & ", remove `.` and `,`, collapse whitespace, trim, then drop one trailing "inc", "llc", "co" or "corp". Names that normalize to the same text are duplicates. In the `default` baseline this finds 36 groups covering 72 accounts; looser rules find a few more.
- 269 stale opportunities: open, past their close date, and untouched for 90+ days.
- 328 overdue open tasks.
- Optional fields left blank at realistic rates: Website on 44% of accounts, Email on 38% of contacts, Amount on early-stage deals.
- Seed leads at shared companies also appear as contacts, the lead/contact duplicate every org has.

The same seed, profile and `CLOCK` always produce the same database, byte for byte (`3cec1ec6…` for `default`, `68cdad76…` for `small` at the default clock, in the container and locally). Phone numbers use the fictional 555-01xx range. Generated emails and websites use the reserved `.example` domain (2,773 contact emails, 1,034 websites); the 398 contacts copied from seed leads keep the seed's pseudonymized `@example.invalid` emails.

## Reset, snapshots and clock

The image contains a baseline database per `SEED_PROFILE` (`default`, `small`), built from the seed at image build. At start-up the app copies the chosen profile's baseline to its working database; no SQL runs at start-up.

| Action | REST | MCP | CLI |
|---|---|---|---|
| Reset to the baseline (or a named snapshot), byte-identical | `POST /api/admin/reset` `{ "snapshot"? }` | `reset_environment` | `pnpm reset [name]`, or in the container `docker compose exec app node dist/server/scripts/reset.js` |

In the GUI, the settings gear at the top right opens **Environment Controls (demo admin)** → **Reset to Baseline**. It asks for confirmation, calls the same `POST /api/admin/reset`, and on success clears every cached record and returns to Seller Home. It is a control for this assessment environment, not a Salesforce feature.
| Save a named snapshot | `POST /api/admin/snapshots` `{ "name" }` | `create_snapshot` | |
| List snapshots | `GET /api/admin/snapshots` | `list_snapshots` | |
| Prove a restore: file sha256, side files, per-table content | `GET /api/admin/snapshots/{name}/verify` | `verify_snapshot` | |
| Read or set the clock | `GET` / `POST /api/admin/clock` `{ "start", "mode" }` | `get_clock`, `set_clock` | |

A reset returns `{ snapshot, sha256, matches, durationMs, removedSideFiles }` and clears the mutation log. It does not change the clock.

## Develop

```bash
pnpm install
pnpm build && pnpm build:db    # builds the server, the GUI and the baseline snapshots in data/snapshots
pnpm start                     # GUI on :3000, REST and MCP on :8080
pnpm test                      # unit and integration tests
pnpm e2e                       # Playwright GUI tests (starts its own server on ports 3100/8180 with a fresh database)
scripts/smoke.sh               # full stack check in its own linux/amd64 compose project (ports 3300/8380), online, offline and with non-default env settings; it never touches a running dev stack
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
| `get_mutation_log` | Changes since the last build or reset |
| `reset_environment`, `create_snapshot`, `list_snapshots`, `verify_snapshot` | Reset and snapshots |
| `get_clock`, `set_clock` | The app clock |
