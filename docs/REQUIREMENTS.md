# Requirements → tests checklist

**The authority is the brief:** https://app.notion.com/p/Salesforce-Work-Trial-416a70051f1f8063a5f6e3665c1e984f. The "Requirement" column quotes it verbatim. The seed files explain the supplied data. `docs/reference/` and `PLAN.md` are supporting notes, not requirements. When they disagree with the brief, the brief wins.

Update the **Status** column as work lands: ☐ not started, ◐ in progress, ☑ verified (link the evidence).

## Acceptance criteria

| ID | Requirement (verbatim) | Planned functionality | How it's verified | Status |
|---|---|---|---|---|
| AC1 | "**Importing data works.** After importing, there are 21,628 leads, 9 users, and your generated records." | `scripts/import-seed.ts` (sha256 check, label→API mapping), then `scripts/generate.ts` (no leads) | `tests/import.test.ts` asserts the counts from `manifest.json` (21,628 / 9 / status breakdown / Hot 7,111 / 22 sources) and non-zero generated Accounts, Contacts, Opportunities, OpportunityContactRoles and Tasks. The acceptance script repeats it against the container | ☐ |
| AC2 | "**Lead list works.** In the GUI, open All Leads, sort by Company, then filter to Rating = Hot. The filter shows 7,111 leads and each action responds in under one second. The same query through the API returns the same count." | Leads list view "All Leads", server-side sort and filter, indexed query, count header; `GET /api/query` with the same filter | Playwright `lead-list.spec`: open All Leads → sort Company → filter Rating = Hot, assert "7,111 items", and assert each step takes < 1000 ms from action to rendered rows. API test: the same query gives `totalSize = 7111`. Run on a fresh reset | ☐ |
| AC3 | "Full lifecycle working in the GUI" | The L1–L6 screens below | Playwright `lifecycle.spec` (L1→L5) and `direct-path.spec` (L6) | ☐ |
| AC4 | "The same lifecycle working via API/MCP." | REST endpoints and MCP tools over the same service layer | `tests/api/lifecycle.test.ts` (REST) and `tests/mcp/lifecycle.test.ts` (MCP client SDK); both run L1–L6 | ☐ |
| AC5a | "Validation in both surfaces. Saves with missing required fields are rejected with the same error in the GUI and the API." | Metadata-driven required check → `REQUIRED_FIELD_MISSING` error array; GUI shows `message` | Parity test: create a Lead without LastName/Company via the API, and capture the JSON. Playwright: save the same form and capture the error text and the network response. Assert the GUI's error equals the API's `message`, `errorCode` and `fields`. Also check MCP | ◐ Service level: one `REQUIRED_FIELD_MISSING` error listing every missing field (`tests/integration/services/records.test.ts`, Phase 3). GUI/API/MCP parity tests come in Phases 5 and 6 |
| AC5b | "Moving an Opportunity past Qualification without an Amount is rejected with the same error in both." | Stage rule → `FIELD_CUSTOM_VALIDATION_EXCEPTION` on `Amount` | Same parity method: API PATCH StageName = Needs Analysis with no Amount, against the GUI Path "Mark as Current Stage", and MCP | ◐ Service level: `FIELD_CUSTOM_VALIDATION_EXCEPTION` on `Amount` for update, create and closed stages, after required-field errors (`tests/integration/services/opportunity.test.ts`, Phase 3). Parity tests come in Phases 5 and 6 |
| AC6 | "**Reset.** After a series of edits, a reset restores a snapshot byte-identical to the original, in under 10 seconds." | Single-file snapshot and reset, rollback journal (PLAN Phase 8) | `tests/reset.test.ts`: edits across every object, including a conversion → reset; assert `.db` sha256 == snapshot sha256, no `-journal`, content digest equal, duration < 10 s. Plus the stale-journal test | ☐ |
| AC7 | "**Fidelity review.** We'll run a manual screenshot comparison on the main workflow UI surfaces." | SLDS-based screens from `docs/reference/gui-surfaces.md` | Manual review in Chrome against the reference images and the brief's Seller Home screenshot. The acceptance script captures our screenshots of each workflow surface for the report | ☐ |

## Lifecycle (verbatim: "End-to-end workflow to support (via GUI, API, or MCP)")

| ID | Requirement (verbatim) | GUI | API / MCP | Verified by | Status |
|---|---|---|---|---|---|
| L1 | "A Lead is created, manually or via the API." | New Lead modal | `POST /api/sobjects/Lead`, `create_record` | AC3 and AC4 tests | ◐ Service level: create with defaults, owner and audit fields (`records.test.ts`, Phase 3) |
| L2 | "The rep works it: logs a call as a completed Task, then moves the Lead Status to Working - Contacted." | Log a Call (Task: Call, Completed); Path / Edit → Working - Contacted | `log_call`; `update_record` Status | AC3 and AC4 tests assert the Task is `Status=Completed`, `TaskSubtype=Call`, `WhoId=lead` | ◐ Service level: `logCall` gives a completed Call task; Status moves to Working - Contacted (`activities.test.ts`, `records.test.ts`, Phase 3) |
| L3 | "The Lead is converted. This creates a Contact and an optional Opportunity, and either a new Account or attachment to an existing one. The Lead becomes read-only with status Closed - Converted. Conversion is atomic: a failure creates nothing." | Convert modal (new or existing Account, opportunity optional) | `POST /api/leads/:id/convert`, `convert_lead` | Tests for: new account and existing account; with and without an opportunity; the lead is read-only afterwards (`CANNOT_UPDATE_CONVERTED_LEAD`); **atomicity**, where a failure injected after the Account insert leaves the row counts unchanged | ◐ Service level: new and existing account, with and without opportunity, documented field mapping, read-only afterwards, and atomic rollback after the account and contact inserts (`convert.test.ts`, Phase 3) |
| L4 | "The Opportunity moves through the stages. Contact Roles are added, Tasks are logged and Next Step is updated along the way." | Path, Add Contact Roles, Log a Call / New Task, Edit Next Step | `update_record` StageName/NextStep, `add_contact_role`, `log_call`/`create_task` | AC3 and AC4 tests step through at least 3 stages, with Amount set | ◐ Service level: stages with probability and forecast category, contact roles with one primary, tasks, Next Step (`opportunity.test.ts`, `activities.test.ts`, Phase 3) |
| L5 | "The Opportunity is marked Closed Won or Closed Lost." | Path close dialog | `update_record` StageName | Tests cover both outcomes and assert `IsClosed`/`IsWon`/`Probability`/`ForecastCategoryName` | ◐ Service level: Closed Won and Closed Lost set IsClosed, IsWon, Probability and Forecast Category (`opportunity.test.ts`, Phase 3) |
| L6 | "The direct path also works: create an Account, then a Contact, then an Opportunity, with no Lead." | New Account → New Contact → New Opportunity | `create_record` ×3 | `direct-path.spec` and the API/MCP direct-path tests | ◐ Service level: Account, Contact and Opportunity created with references checked (`records.test.ts`, `opportunity.test.ts`, Phase 3) |

## Platform requirements

| ID | Requirement (verbatim) | Verified by | Status |
|---|---|---|---|
| P1 | "Model these as Salesforce does, using standard field names, picklist values and relationships." | Metadata reviewed against `docs/reference/objects-and-fields.md` and `picklists.md` | ◐ Metadata for all 7 objects in `src/server/metadata/`, checked by `tests/unit/metadata.test.ts` (Phase 2) |
| P2 | "Use Salesforce-style 18-character IDs with the standard key prefixes (001 Account, 003 Contact, 00Q Lead, 006 Opportunity, 00T Task, 005 User)." | `tests/ids.test.ts`: prefix and checksum for generated IDs; seed IDs preserved; checksum check over all seed IDs | ◐ Checksum verified on all 21,637 seed IDs; generated IDs valid and deterministic (`tests/unit/ids.test.ts`, `tests/integration/schema.test.ts`, Phase 2). Preserving seed IDs is checked in Phase 4 |
| P3 | "Target Salesforce Lightning Experience, desktop width." | AC7 review at 1440×900 | ☐ |
| P4 | "The API and MCP tools call the same service layer as the GUI, with the same validation and the same structured errors." | Architecture: the GUI uses the REST API, and REST and MCP call `services/*`. AC5 parity tests | ◐ Shared service layer in `src/server/services/`, throwing one `ServiceError` type with the Salesforce error array (Phase 3). REST and MCP wiring in Phase 5 |
| P5 | "You'll create a deterministic synthetic-data generator that, given the seed, produces the rest of the data … Include realistic mess: near-duplicate accounts, stale opportunities and missing optional fields." | `tests/generate.test.ts`: two runs give identical output (hash); assertions that near-duplicate accounts, stale open opportunities and null optional fields exist | ☐ |
| P6 | "Act as one seeded user, switchable via a header or a dropdown." | GUI dropdown, `X-User-Id` header, MCP `actingUserId` argument; tests assert `CreatedById` follows the acting user | ◐ Service level: `resolveActingUser` (default, explicit, inactive and unknown users), and the acting user stamps `CreatedById`/`LastModifiedById` (`users.test.ts`, `records.test.ts`, Phase 3) |
| P7 | "where the UI shows an entry point for one (for example a Reports tab), render it as a visibly marked stub." | Playwright: every stub tab shows the stub banner; the README lists the stubs | ☐ |

## Priority order (verbatim: "If time runs short, prioritize in this order")

1. "Data model and service layer, with API/MCP parity" → PLAN Phases 2–5
2. "The end-to-end lifecycle working in the GUI" → Phase 6a
3. "Environment plumbing (reset, snapshot, mutation log)" → Phase 8
4. "GUI fidelity on the listed surfaces" → Phase 6b
5. "Synthetic data volume and realism" → Phase 7 (a minimal deterministic set exists earlier, so AC1 and L3 "existing account" can be tested)

## Deliverables (verbatim: "By the end of the day, push to the repo we provide")

| ID | Requirement (verbatim) | Verified by | Status |
|---|---|---|---|
| D1 | "The working app (GUI, API and MCP) built as a Docker container, runnable with one command" | A fresh clone runs `docker compose up` | ☐ |
| D1a | "It builds from a Dockerfile in the repo and starts with one command (`docker compose up` is fine), with no dependencies on your host machine." | `docker compose build --no-cache` in a clean clone | ◐ Builds with `--no-cache` and starts with `docker compose up` (Phase 1, `scripts/smoke.sh`). Re-verify from a clean clone in Phase 9 |
| D1b | "It targets `linux/amd64`." | `platform: linux/amd64` in compose; `docker image inspect` shows the arch | ☑ `linux/amd64` confirmed by `docker image inspect` in `scripts/smoke.sh` (Phase 1) |
| D1c | "Everything it needs is inside the container: the app, the database, and the seed data. It shouldn't call out to external services at runtime." | Run with `--network none` after the build. The GUI loads with no external requests (SLDS fonts and icons bundled; no CDN) | ◐ GUI, REST and MCP work with `--network none`; Playwright saw no external requests (Phase 1). Re-verify at the end |
| D1d | "Configuration (ports, seed profile, clock) comes from environment variables, not hard-coded local paths." | `.env.example`; README table; test that `CLOCK` changes the conversion CloseDate | ◐ The clock drives conversion dates (`convert.test.ts`, Phase 3). Wiring `CLOCK`/`CLOCK_MODE` from the environment comes in Phase 5 |
| D1e | "The GUI and the API/MCP server listen on `0.0.0.0` at documented ports, so we can reach them from outside the container." | Reach the GUI port and the API/MCP port from the host | ◐ GUI on :3000 and REST/MCP on :8080 reachable from the host (Phase 1) |
| D2 | "The lead importer and synthetic data generator" | In the repo; covered by AC1 and P5 | ☐ |
| D3 | "An acceptance criteria report" | `ACCEPTANCE.md`, generated by `scripts/acceptance.ts` with evidence for AC1–AC7 | ☐ |
| D4 | "A README covering how to run it, the architecture in a paragraph or a diagram, and the full MCP tool list" | README review; the MCP tool list is generated from the server's tool registry | ☐ |
| D5 | "`TRADEOFFS.md`: a list of what you built, stubbed or skipped, with a one-line reason for each" | Review; includes every [DECISION] from `docs/reference/` | ☐ |
| D6 | "Provide a FEATURES.md that documents all supported and unsupported behavior: Fully functional features (Tier 1), Read only features (Tier 2), Stubbed, absent, unsupported, or intentionally excluded behavior." | Review | ☐ |
| D7 | "In your write up explain how you're making the generated data realistically messy." | README section "Synthetic data" | ☐ |

## Communication (verbatim)

| ID | Requirement | How we comply |
|---|---|---|
| C1 | "Make tradeoffs explicit. If you decide not to build something or to stub it, say so in Slack when you decide, and record it in `TRADEOFFS.md`." | When a stub or skip decision is made, draft a one-line Slack note for the user to send, and add it to `TRADEOFFS.md` at the same time |
| C2 | "Never stub silently. Anything stubbed is visibly marked in the UI and the README." | P7 plus the README stub list |
| C3 | "Flag a blocker or a spec ambiguity within 30 minutes rather than guessing. If you have to guess, write the guess down." | Research first, then record the guess in `TRADEOFFS.md`. Escalate only if an acceptance criterion is at risk |
