# Salesforce Work Trial: build plan, from an empty directory to ready to push

## Context

This is the Epsilab one-day paid trial. The **source of truth is the Notion brief** (https://app.notion.com/p/Salesforce-Work-Trial-416a70051f1f8063a5f6e3665c1e984f). The goal is a working clone of Sales Cloud core (Lead, Account, Contact, Opportunity, Task, with seeded Users as owners). It must run the full Lead → Closed Won lifecycle through a GUI and through an API/MCP surface, with identical validation in both.

- **Build here:** `epsilab-salesforce/`, which is empty apart from `.git`.
- **Merge target, at the end:** the reviewer starter repo in the sibling folder `../salesforce-work-trial/`. It holds `seed/leads.csv` (21,628 rows), `seed/users-core.csv` (9 rows), `seed/manifest.json` (sha256 and counts) and `seed/README.md` (importer rules). Its `.gitattributes` keeps the seed byte-exact.
- **Seed data is real company data**, so the working repo must never go to a public remote. Delete local copies after the trial.

**Authority order.**
1. **The brief** is the primary source of truth. Its requirements are traced verbatim in [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md), which is the checklist we return to throughout development.
2. **The seed files** (`README.md`, `manifest.json`) explain the supplied data and are the importer spec.
3. **Salesforce documentation** explains how the platform behaves.
4. `docs/reference/` and this plan are supporting notes, not requirements.

### Delivery priority
It's one paid day, so **working acceptance criteria and their verification come first.** Anything beyond the 7 criteria and the workflow, such as extra list views, inline edit, global search, or fidelity polish past the workflow screens, happens only if time remains. Otherwise it's listed as a stub in `TRADEOFFS.md`.

### How we handle gaps
Work through gaps independently instead of asking the client about each one, using the authority order above. A Salesforce detail that isn't needed by a requirement in `docs/REQUIREMENTS.md` doesn't add scope.

Process for any gap:
1. Investigate it.
2. Tie the decision to an acceptance criterion.
3. Record it in `TRADEOFFS.md` → *Assumptions*.

Only escalate a mismatch we can't explain that would put an acceptance criterion at risk.

### Seed verification (done 2026-11-13)
- The sha256 of both files matches `manifest.json`.
- `leads.csv` parses to 21,628 rows × 53 columns. Lead IDs are unique.
- **Rating = Hot is 7,111**: an exact, case-sensitive match with no whitespace variants. That's the same as `manifest.json` (`rating_hot: 7111`), `seed/README.md` and acceptance criterion #2. **There's no mismatch to raise.**
  - The other values: Cold 4,794, Warm 1,759, blank (`-`) 7,964.
- The status breakdown matches the manifest exactly. All 21,628 leads have `Converted = feature not included`, and all are owned by Jon Santiago.
- **Rules that protect the 7,111 count:**
  - Import Rating verbatim. Map only `-` to null.
  - Generate no new Hot leads.
  - Convert, delete or edit no seed lead in the snapshot.
  - Run the acceptance check right after a reset, because criterion #2 is measured on fresh data.
  - The All Leads list excludes converted leads, as Salesforce does (`IsConverted = false`). That costs nothing here, because no seed lead is converted.

## Stack (final, approved 2026-11-13; versions checked on npm the same day)

One Node process in one `linux/amd64` container, with no runtime services. All database work, validation and business logic live in `src/server/services/`. REST, MCP and (through REST) the GUI are thin adapters over it.

| Layer | Choice (version) | Why |
|---|---|---|
| Runtime | **Node 22 LTS** (local 22.23.1); image `node:22-bookworm-slim` (glibc); `engines: >=22.12` | `better-sqlite3` 13 needs Node ≥22 and Vitest 5 needs ≥22.12. Debian rather than Alpine, to match the glibc prebuild |
| Language | TypeScript, pnpm | One language and one set of shared field and error types across the GUI, API, MCP and scripts |
| Frontend | React 19 + Vite 8 + **SLDS** `@salesforce-ux/design-system` 2.264 (BSD-3), React Router, TanStack Query | Lightning look for AC7. The SLDS CSS, fonts and icons are bundled into the Vite build, so there's no CDN (D1c) |
| Backend | **Fastify 5** (5.12) + `@fastify/static` 10 | Serves the REST API and `/mcp` on `API_PORT`, and the built GUI on `GUI_PORT`. One process, two listeners |
| MCP | **MCP TypeScript SDK v2**: `@modelcontextprotocol/server` 2.4, `@modelcontextprotocol/node` 2.1 (`NodeStreamableHTTPServerTransport`), `@modelcontextprotocol/fastify` 2.0.1 (peer `fastify ^5.2`, `server ^2.3`); `@modelcontextprotocol/client` 2.4 for tests; **zod 4** (required by v2) | v2 is the current stable line; v1 is the legacy `@modelcontextprotocol/sdk` 1.32. Streamable HTTP at `POST /mcp`, **stateless** (a server and transport per request, as in the adapter's documented pattern) |
| Database | **SQLite** via `better-sqlite3` 13.1 (prebuilt `linux-x64` N-API binary in the npm package, so no compiler), **rollback journal (`journal_mode=DELETE`, SQLite's default)**, not WAL | See below |
| Testing | Vitest 5 (service, API, MCP via the v2 client), Playwright 1.65 (GUI, timings, screenshots) | Playwright stays out of the runtime image |
| Deployment | Multi-stage Dockerfile, `platform: linux/amd64`, `docker compose up` | The build stage installs dependencies, builds the GUI, imports the seed, generates data and writes the snapshot. The runtime stage holds only the built app, production dependencies, the seed and the snapshot |

**Why the rollback journal instead of WAL:**
- This is a single-process, low-concurrency app, so WAL's concurrent reader/writer benefit doesn't matter here.
- In DELETE mode, every committed write is already in the main `.db` file. The only side file, `-journal`, exists only during an open write transaction.
- Reset becomes "lock → close → copy → verify hash", with no checkpoint, which makes byte-identical proof direct.
- With indexes, the AC2 reads stay well under 1 s either way.
- We'd switch back to WAL only if a measured AC2 timing fails.
- The app runs **no writes at startup** (schema, import and generation all happen at image build), so opening the database never changes its bytes.

**MCP specifics:**
- **Stateless transport**, so there's no session state. The acting user travels as an optional `actingUserId` argument on each write tool (the default is `DEFAULT_USER_ID` or the first active user). That replaces the session-based `set_acting_user` tool.
- **DNS-rebinding Host validation** (`hostHeaderValidation`) is on, with allowed hosts from `MCP_ALLOWED_HOSTS` (default `localhost,127.0.0.1,[::1]`). Reviewers can extend the list if they reach the container under another hostname.
- We register `/mcp` on **our own** Fastify app, which binds `0.0.0.0`. The adapter's `createMcpFastifyApp()` defaults to 127.0.0.1, so we don't use it to create the app.

## Phases

**Execution order, following the brief's priority list:** 0 → 1 → 2 → 3 → 4 (with a minimal generated set) → 5 → **6a** lifecycle GUI → **8** environment tooling → **6b** fidelity → **7** generator volume and realism → 9. Phase numbers are labels; this line sets the order.

### Phase 0: Research and assumptions (DONE 2026-11-13, public sources)
The Developer Edition signup failed, so Phase 0 used **public Salesforce sources only**: the Object Reference and API guides (read in Chrome), Salesforce Help, Trailhead and SLDS. **No authenticated describe responses or live network requests were captured.** Results are in `docs/reference/`. Each statement there is tagged [SF-DOC], [BRIEF], [SEED] or [DECISION].
- `objects-and-fields.md`: fields, flags and relationships for Lead, Account, Contact, Opportunity, OpportunityContactRole, Task and User. Key prefixes and the ID checksum, which was verified against all 21,637 seed IDs.
- `lead-seed-mapping.md`: all 53 Lead columns and the User columns mapped, kept or dropped, with reasons. This fills the missing "Lead row".
- `picklists.md`: the trial Lead Status list (10 seed values plus the Working - Contacted / Closed - Converted / Closed - Not Converted defaults; only Closed - Converted counts as converted), stages with probabilities and forecast categories, contact roles, and task status/priority.
- `behavior-and-validation.md`: convertLead semantics, the read-only rule for converted leads, stage defaults, the Amount-after-Qualification rule as `FIELD_CUSTOM_VALIDATION_EXCEPTION`, `REQUIRED_FIELD_MISSING`, the REST error-array format, and All Leads semantics.
- `gui-surfaces.md`: 11 surfaces ranked by acceptance criterion, with Trailhead reference images and SLDS blueprints. This fills the missing "GUI surfaces" list.
- Every [DECISION] entry is copied into `TRADEOFFS.md` → Assumptions when that file is created in Phase 1.
- Slack: one status update stating the approach. Raise items only for an unexplained mismatch that puts an acceptance criterion at risk.

### Phase 1: Scaffold, with Docker working from the first hour (~45 min)
- Layout:
  ```
  src/server/   app.ts, config.ts (env), clock.ts, db/, metadata/, services/, api/, mcp/
  src/web/      React app (Vite)
  scripts/      import-seed.ts, generate.ts, build-snapshot.ts, acceptance.ts
  seed/         copied verbatim from the starter, plus the .gitattributes rule
  tests/        unit/, api/, e2e/
  ```
- Env config:
  - `GUI_PORT` (default 3000) and `API_PORT` (REST and `/mcp`, default 8080). Both run in one Node process, and both bind `HOST=0.0.0.0`. The brief names "the GUI and the API/MCP server" separately, so they get separate documented ports.
  - `SEED_PROFILE` (`default|small`). It changes **generated volume only**; all 21,628 seed leads always load. A snapshot is built per profile at image build.
  - `CLOCK` (default `2028-11-11T09:00:00Z`, fixed or offset mode).
  - `DATA_DIR`.
- **No runtime network calls.** SLDS CSS, fonts and icons are bundled from the npm package, with no CDN.
- **Stack proof comes first, before any Salesforce functionality.** A throwaway end-to-end slice inside the amd64 container:
  1. The Vite+React+SLDS page on `GUI_PORT` renders with an SLDS icon and font loaded locally.
  2. It calls `GET /api/health` on `API_PORT`, which reads a row through `better-sqlite3` from a DB built at image build from `seed/manifest.json`.
  3. An MCP client (v2) calls a `health` tool over Streamable HTTP at `/mcp` and gets the same row from the shared service.
  4. The container runs with `--network none` and everything still works.
  5. `docker image inspect` shows `amd64`.
  - It's scripted as `scripts/smoke.sh` and kept as a regression check.

### Phase 2: Metadata and data model (priority 1, ~1 h)
- `metadata/*.ts`: one declarative definition per object, from `docs/reference/objects-and-fields.md` and `picklists.md`, which come from public docs; there's no describe JSON. Each field gets its API name, label, type, required flag, picklist values, reference target and default. Every other layer works from these definitions: DDL, validation, API schema, MCP tool schemas, GUI forms and list columns.
- Objects: User (005), Lead (00Q), Account (001), Contact (003), Opportunity (006), OpportunityContactRole (00K), Task (00T).
- Standard fields such as `OwnerId`, `CreatedById`, `CreatedDate`, `LastModifiedDate`, `IsDeleted`, `ConvertedAccountId`, `ConvertedContactId`, `ConvertedOpportunityId`, `IsConverted`, `StageName`, `Probability`, `ForecastCategoryName`, `IsClosed`, `IsWon`, `NextStep`, `WhoId`/`WhatId` (Task), and `Status`/`Subject`/`ActivityDate`/`TaskSubtype` (Task).
- `db/ids.ts`: real 18-character Salesforce IDs. The first 15 characters are the key prefix, pod characters and a base-62 counter. The last 3 are the case-safe checksum suffix. The counter is deterministic per object.
- Indexes for the lead list (Company, Rating, LastName, Status, OwnerId).

### Phase 3: Service layer (priority 1, ~2 h). The core of the build
- Generic `create/update/get/delete/query(object, …)` driven by the metadata, plus domain operations:
  - `convertLead(leadId, {accountId?, doNotCreateOpportunity, opportunityName?, ownerId?, convertedStatus})` runs in **one SQLite transaction**.
    - It always creates a new Contact. Merging into an existing contact isn't built; that's in `TRADEOFFS.md`.
    - It creates or attaches the Account, and creates the optional Opportunity.
    - It sets `IsConverted`, the `Converted*Id` fields, `ConvertedDate` and `Status`.
    - If any step throws, it rolls back so nothing persists.
    - Field mapping follows Salesforce's documented *Lead Conversion Field Mapping* (`docs/reference/behavior-and-validation.md`); for example, Description goes to the Contact only.
    - The Opportunity's CloseDate is the end of the current fiscal quarter, and its StageName is the default stage.
    - When both the Contact and the Opportunity are created, an OpportunityContactRole links them, with `IsPrimary=false` and no Role.
  - Converted leads are read-only: updates are rejected with `CANNOT_UPDATE_CONVERTED_LEAD`.
  - Opportunity stage rules: stages after `Qualification` require `Amount` (`FIELD_CUSTOM_VALIDATION_EXCEPTION`). Stage drives `Probability`, `ForecastCategoryName`, `IsClosed` and `IsWon`.
  - `logCall`: a Task with `TaskSubtype='Call'` and `Status='Completed'`. Also contact-role add/remove/set-primary.
- Salesforce-shaped structured errors, shared by every surface: `[{ "errorCode": "REQUIRED_FIELD_MISSING", "message": "Required fields are missing: [LastName]", "fields": ["LastName"] }]`.
- Acting user: the GUI dropdown sends `X-User-Id`, REST reads the `X-User-Id` header, and MCP takes an `actingUserId` tool argument; the default is `DEFAULT_USER_ID`. It sets `CreatedById`, `LastModifiedById` and the default `OwnerId`. The services receive it as an explicit parameter.
- **Mutation log**: every write appends a `mutation_log` row with seq, clock timestamp, actor, op, object, id, before and after JSON. It's readable via the API.
- Vitest covers every rule. The tests double as the parity contract.

### Phase 4: Importer (priority 1, ~1 h)
- `scripts/import-seed.ts`. Steps in order:
  1. Verify the sha256 against `manifest.json`.
  2. Parse the CSVs with `csv-parse`.
  3. Map screen labels to API names: `Lead Owner`→`OwnerId` by full name, `No. of Employees`→`NumberOfEmployees`, `Company / Account`→`Company`.
  4. Convert values: `-`→null, `feature included`→true, `$457,000`→457000, `MM/DD/YYYY`→ISO.
  5. Keep the real IDs.
  6. Drop the out-of-scope columns (record type, Data.com, Created Month, …).
- Keep the real mess as-is: "No Name" spellings, title case, salutation variants.
- After import, assert the manifest counts: 21,628 leads, 9 users, the status breakdown, 7,111 Hot, 22 lead sources, 2 inactive users. Also re-check the ID checksum on every seed ID.
- Then run a **minimal deterministic generated set** (a handful of accounts, contacts and opportunities, with no leads). That makes AC1 ("your generated records") and the L3 "existing account" path testable early. Phase 7 grows it.

### Phase 5: REST API and MCP (priority 1, ~1.5 h)
- REST, shaped like Salesforce's: `/api/sobjects/:object` (POST), `/api/sobjects/:object/:id` (GET/PATCH/DELETE), `/api/query?object=Lead&where=Rating:Hot&orderBy=Company&limit&offset` returning `totalSize` and `records`, `/api/leads/:id/convert`, `/api/opportunities/:id/contact-roles`, `/api/tasks/log-call`, `/api/users`, `/api/admin/{reset,snapshot,mutations,clock}`.
- MCP tools, each a thin wrapper over the same service functions: `list_objects`, `describe_object`, `create_record`, `get_record`, `update_record`, `delete_record`, `query_records`, `convert_lead`, `log_call`, `create_task`, `add_contact_role`, `update_opportunity_stage`, `list_users`, `reset_environment`, `get_mutation_log`.
- One error mapper turns service errors into the HTTP 400 body and the MCP tool error. That's what makes the errors identical across surfaces.
- API tests that run the whole lifecycle over REST and over the MCP client SDK.

### Phase 6: GUI. 6a lifecycle (priority 2), then 6b fidelity (priority 4, which runs **after Phase 8**) (~3.5 h)
Built with SLDS blueprints, desktop width only. 6a = items 1–6, functional and on SLDS, with no polish. 6b = item 7 plus visual polish against the reference images.
1. **App shell**: global header (search box, which can be a stub, and the **acting-user dropdown**) and a Sales app nav bar with tabs Home, Leads, Accounts, Contacts, Opportunities, Tasks. Reports, Dashboards, Campaigns, Cases and Forecasts are **visibly marked stubs** ("Not available in this trial").
2. **List views**: object home pages with an "All X" list view (All Leads excludes converted leads, as Salesforce does), server-side sort on the column headers, a filter panel (Rating = Hot), infinite scroll, a record count ("7,111 items · Sorted by Company"), and a New button.
3. **New/Edit record modal**, generated from the metadata, with inline field errors and an error popover that shows the service error text.
4. **Record page**: a highlights panel, a **Path** component (Lead Status or Opportunity Stage, with a "Mark Status as Complete" or "Mark as Current Stage" button), a Details tab, a Related tab (Contacts, Opportunities, Contact Roles, Tasks), and an **Activity timeline** with Log a Call / New Task.
5. **Convert Lead modal**: a new or existing Account (with a duplicate-account lookup), a Contact, an optional Opportunity, and a converted status, then a success screen with links. A converted lead renders read-only.
6. **Contact Roles**: add/edit from the Opportunity related list.
7. **Home** (6b): a Seller Home layout like the brief's screenshot. Today's Tasks is live, and Recent Records shows recently *modified* records, which avoids building view tracking. Other cards are visible stubs.

Cover both paths with a Playwright end-to-end test: Lead → Closed Won, and Account → Contact → Opportunity.

### Phase 7: Synthetic data generator (priority 5, ~1 h)
**Order:** a minimal deterministic set is built in Phase 4, right after the importer: a few accounts, contacts and opportunities, so AC1 and the "existing account" path in L3 can be tested. This phase adds volume and realism last, per the brief's priority order.
- `scripts/generate.ts`, using a seeded PRNG (mulberry32 keyed by `SEED_PROFILE`) and the fixed clock, so the same input always gives the same output. It's driven from the imported leads. It runs after the lead-list checks are in place and before the snapshot is built.
- What it creates:
  - Accounts derived from shared company names, plus extra accounts
  - Contacts for each account
  - Opportunities across all stages, including Closed Won and Closed Lost
  - Contact roles
  - Tasks on Contacts, Accounts and Opportunities only. **None on seed leads**, because a task would change the lead's derived `LastActivityDate`, and the seed must stay exactly as imported.
  - **No leads at all.** Criterion #1 expects exactly 21,628 leads after import, and criterion #2 expects 7,111 Hot. So the generator neither adds nor converts leads. Converted-lead history appears only once someone runs the workflow.
- Deliberate mess, which goes in the write-up:
  - Near-duplicate accounts ("Business 0BAC… Inc" vs "Business 0BAC…, Inc." vs a trailing space)
  - Stale opportunities with a past `CloseDate` that are still open, untouched for 90+ days
  - Optional fields missing at realistic rates (Phone, Title, Amount on early stages)
  - Owners skewed toward active users
  - A few tasks that are overdue
- Records that already exist in the seed are never changed: imported leads stay exactly as imported.

### Phase 8: Environment tooling (priority 3, ~45 min)
The database uses the rollback journal (`journal_mode=DELETE`). Outside an open write transaction the database is exactly one file. **Byte-identical means the sha256 of the working `.db` equals the snapshot's sha256.**

- **Create a snapshot** (at image build, and on demand):
  1. Take the app-level write lock, so no transaction is open.
  2. Confirm no `-journal` file exists.
  3. Copy the `.db` to `snapshots/<name>.db` via a temp file and a rename.
  4. Write `<name>.sha256`.
- **Image build**: import, run the generator, close the DB, then write `snapshots/baseline-<profile>.db` and its sha256.
- **Start**: if no working DB exists, copy the baseline for `SEED_PROFILE`. Open read/write; no statements run at startup.
- **Reset** (`POST /api/admin/reset`, the MCP `reset_environment` tool, and a CLI):
  1. Take the exclusive app lock, so API, MCP and GUI requests wait.
  2. Close the connection.
  3. Remove any leftover `-journal`. It can only be stale here, because we hold the lock and no transaction is open; a hot journal would otherwise roll back onto the restored file.
  4. Copy the snapshot into place via a temp file and a rename.
  5. Verify the sha256 *before reopening*.
  6. Reopen, release the lock, and return `{ sha256, matches, durationMs }`. The mutation log lives in the DB, so it's reset too.
- **Proof** (`GET /api/admin/snapshot/verify`): under the lock, hash the working `.db` and compare it with the snapshot hash. As a second check, compare a per-table row-count and content digest. Reads don't modify the file.
- **Finding from Phase 4:** SQLite bumps header bytes (file change counter) on every committed write transaction, even one whose savepoint was rolled back. After a reset, nothing may open a write transaction on the restored file before the hash is taken. Plain reads are safe.
- **Determinism check**: build the baseline twice and compare hashes. It's informative only, since criterion #6 compares against the snapshot.
- **Clock**: the env value can be fixed or ticking, and `GET/POST /api/admin/clock` reads or changes it. The service layer reads time only from `clock.ts`.

### Phase 9: Acceptance report, docs, handoff (~1 h)
- `scripts/acceptance.ts` runs the 7 criteria against the running container and writes `ACCEPTANCE.md`:
  - The import counts
  - The 7,111 count and timings over the API, plus Playwright timings in the GUI
  - The lifecycle over the GUI, REST and MCP
  - Byte-for-byte comparison of the two validation errors across surfaces
  - Reset hash equality and duration
  - Our screenshots of each workflow surface, listed next to the reference image links. There are no live Salesforce screenshots, because we had no org
- Docs:
  - `README.md`: how to run it, ports, an architecture diagram, the full MCP tool list and the stub list
  - `TRADEOFFS.md`: what was built, stubbed or skipped, plus assumptions
  - `FEATURES.md`: Tier 1 (fully working), Tier 2 (read-only), and stubbed or excluded behaviour. Also explains how the generated data is made messy
- Final check: from a fresh clone, run `docker compose build --no-cache` and then `docker compose up` on linux/amd64, then run the acceptance script against the result. Also run the container with outbound network disabled, which proves D1c.
- Tick every row of `docs/REQUIREMENTS.md` with linked evidence before the merge.
- **Merge into `../salesforce-work-trial`.** Keep its `seed/` and `.gitattributes` untouched and confirm the manifest hashes still match. Only push after you confirm.

## Critical files (to create)
`src/server/metadata/*.ts`, `src/server/services/{records,leadConvert,opportunity,tasks,errors,mutationLog}.ts`, `src/server/db/{ids,schema,snapshot}.ts`, `src/server/api/routes.ts`, `src/server/mcp/tools.ts`, `scripts/{import-seed,generate,acceptance}.ts`, `src/web/…`, `Dockerfile`, `docker-compose.yml`, `README.md`, `TRADEOFFS.md`, `FEATURES.md`, `ACCEPTANCE.md`.

## Verification
- `pnpm test`: service and API unit tests, including importer counts against the manifest, atomic conversion rollback, and validation error equality.
- `pnpm e2e`: Playwright runs both lifecycles through the GUI, plus the lead-list sort and filter.
- Reset test:
  1. Reset, then make a series of edits across every object, including a lead conversion.
  2. Reset.
  3. Assert that the sha256 of the `.db` equals the snapshot's sha256, that no `-journal` exists, and that the content digest matches.
  4. Assert the reset took under 10 s.

  A separate test plants a stale `-journal` before a reset and confirms the restored hash still matches.
- `docker compose up`, then `pnpm acceptance --base http://localhost:8080`. All 7 criteria should pass, and the run regenerates `ACCEPTANCE.md`.
- Manually, in Chrome: walk the lifecycle and compare screenshots against the reference images listed in `docs/reference/gui-surfaces.md` (Trailhead and the brief's Seller Home).

## Housekeeping
- Commit at the end of each phase. At each phase boundary, re-check `docs/REQUIREMENTS.md` against the brief.
- Every stub or skip decision gets a one-line Slack note for the user to send at the time, plus a `TRADEOFFS.md` entry (brief: "say so in Slack when you decide").
