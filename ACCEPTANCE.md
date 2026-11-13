# Acceptance report

Final verification of the brief's acceptance criteria. All checks below were run against the committed repository: a clean clone of `HEAD`, built with `docker compose` as a `linux/amd64` image, plus the local suites. The test files that prove each criterion are named so the results can be reproduced.

**Reproduce:** `pnpm install && pnpm typecheck && pnpm test`, `pnpm build && pnpm build:db && pnpm e2e`, and `scripts/smoke.sh` (Docker build, Playwright against the container, offline and environment checks, reset; it runs in its own compose project on ports 3300/8380, or `SMOKE_GUI_PORT` / `SMOKE_API_PORT`).

| # | Criterion (brief) | Result | Evidence |
|---|---|---|---|
| AC1 | After importing, there are 21,628 leads, 9 users, and your generated records | **PASS** | `fullSeed.test.ts`: 21,628 leads and 9 users, compared with the manifest and the raw CSV field by field; status breakdown and 7,111 Hot; every seed ID and checksum kept. Generated (default profile): 1,838 accounts, 5,079 contacts, 3,513 opportunities, 5,225 contact roles, 19,348 tasks, with no orphaned references, valid 18-character IDs and consistent stages (`generated.test.ts`, both profiles). The importer verifies the seed's sha256 hashes |
| AC2 | All Leads, sort by Company, filter Rating = Hot shows 7,111, each action under one second; the API returns the same count | **PASS** | Playwright `lead-list.spec.ts` (local and against the container): 7,111 shown; final run against the container: open 224 ms, sort 168 ms, filter 169 ms, next page 185 ms (earlier runs 155 to 282 ms). REST and MCP both return 7,111 (`rest.test.ts`, `mcp.test.ts`, smoke). Other lists open, sort and page in under 210 ms |
| AC3 | Full lifecycle working in the GUI | **PASS** | Playwright `lifecycle.spec.ts`: create lead, log a call, Working - Contacted, convert (new account, existing account, with and without an opportunity), relationships and read-only converted lead checked through REST, stages with Amount and Next Step, contact role, task, Closed Won and Closed Lost, and the direct Account → Contact → Opportunity path. `convert.spec.ts` covers the conversion dialog's rules |
| AC4 | The same lifecycle through the API/MCP, on the same business rules | **PASS** | `rest.test.ts` and `mcp.test.ts` run the lifecycle (L1 to L6) over REST and over the MCP client SDK; `parity.test.ts` checks identical results and errors; MCP `tools/list` returns 21 tools (`mcp.test.ts`, smoke `mcp-check`) |
| AC5 | Saves with missing required fields, and moving past Qualification without an Amount, are rejected with the same error in the GUI and the API | **PASS** | `validation.spec.ts` compares the GUI's message with the REST body; `parity.test.ts` checks REST and MCP return identical error arrays (required fields, the Amount rule byte for byte, restricted picklists, references, malformed queries) |
| AC6 | After edits, a reset restores a snapshot byte-identical to the original in under 10 seconds | **PASS** | `reset.test.ts`, `resetData.test.ts` (both profiles, every table, repeated resets, concurrent requests), `reset.spec.ts` (edits through GUI, REST and MCP), `reset-control.spec.ts` (GUI Reset Environment button), smoke (reset CLI in the container, offline reset, small profile). Baselines: default `3cec1ec614e6cb51…`, small `68cdad761143d5d6…`; resets take 85 to 196 ms |
| AC7 | Manual screenshot comparison on the main workflow surfaces | **PARTIAL** (pending the reviewer's manual review) | The GUI follows Salesforce Lightning (Cosmos) measured in a real org. Screenshots come from `scripts/capture-screens.mjs`, which uses an isolated server. Remaining differences are listed in `docs/fidelity/README.md` and `docs/fidelity/gap-checklist.md`; the match is close, not pixel-perfect |

## Final run

Phase 9, from a clean clone of the committed repository:

| Check | Result |
|---|---|
| TypeScript typecheck (server, web, tests) | Pass |
| Vitest (unit and integration) | 310 of 310 passed, 32 files |
| Docker build | `linux/amd64` image built from the clean clone |
| Playwright against the container | 51 of 51 passed. AC2: open 224 ms, sort 168 ms, filter 169 ms, next page 185 ms; Accounts, Contacts, Opportunities and Tasks lists 91 to 199 ms |
| REST and MCP health; All Leads Hot | 7,111 over REST and over MCP |
| Reset CLI in the container after the browser tests | Baseline matched in 157 ms |
| Offline container (`--network none`) | Lifecycle over REST and MCP, Amount rule, Closed Won and Lost, direct path, reset in 167 ms, byte- and content-identical, 7,111 Hot after reset |
| Environment settings (GUI 4100, API 9180, `SEED_PROFILE=small`, fixed `CLOCK`) | Ports, fixed clock, small profile (184 accounts), record dates from `CLOCK`, reset to the small baseline in 91 ms |

## Known limitations

See `FEATURES.md` (implemented, read-only, stubbed and excluded features) and `TRADEOFFS.md` (decisions and assumptions). The main ones:
- **Not built:** out-of-scope Salesforce features are visible but disabled and marked "Not in scope".
- **Brief's screenshot:** the app sidebar was added at the reviewer's request; the brief's Seller Home image has none.
- **Data:** `LastActivityDate` is not recomputed from tasks, and "Recent records" are the most recently modified records.
- **Visual fidelity:** sidebar icons are close equivalents of Salesforce's artwork, and the header cloud is SLDS's own glyph, not Salesforce's logo file.
