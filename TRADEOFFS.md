# Tradeoffs

What was built, stubbed or skipped, each with a one-line reason. The brief is the source of truth; the supporting research is in `docs/reference/`.

## Built

| Item | Reason |
|---|---|
| One Node process serving the GUI on `GUI_PORT` and REST + MCP on `API_PORT` | The brief names separate GUI and API/MCP ports; one process keeps the container simple |
| SQLite (`better-sqlite3`) with the default rollback journal, not WAL | One file outside write transactions, so reset is a file copy with a direct byte-identical check |
| MCP over stateless Streamable HTTP (SDK v2) | It's the SDK's documented Fastify pattern and needs no session store |
| The GUI also mounts the REST routes on its own port | The browser calls the API on its own origin, so there's no CORS between ports |
| One declarative definition per object in `src/server/metadata/` drives the schema, and later validation, API, MCP and GUI forms | A single source keeps all surfaces consistent |
| STRICT SQLite tables named and columned exactly as the Salesforce API names | Storage types are enforced, and queries read like SOQL field names |
| One generic record engine (`src/server/services/records/`) with small per-object rules | Validation, defaults, audit fields and the mutation log behave identically for every object and every surface |
| Lead conversion in one SQLite transaction, including its mutation log entries and ID counters | The brief requires "a failure creates nothing"; a test forces a failure after the account and contact inserts |
| One build entry point, `scripts/build-db.ts`: schema, verified seed import, then generated records | The importer and generator always run together in the same order, at image build |
| Seed rows are bulk-inserted directly; generated records go through the service layer | The seed must be kept exactly as given, including mess the save rules would reject; generated records must pass every save rule |
| The GUI port also serves the REST routes, so the browser calls the API on its own origin | No CORS between ports 3000 and 8080; both ports run the same route code over the same service layer and database connection |
| The GUI holds no business rules: required fields, picklist checks, stage defaults and the Amount rule all come back from the API | AC5 needs identical errors; the GUI shows the API's `message` text verbatim, plus "Complete this field." beside required fields as Lightning does |
| List view filters are "equals" on picklist fields, kept in the URL | Covers AC2 (Rating = Hot); shareable and reload-safe |
| Lists load 50 rows at a time with infinite scroll, and show the exact total | AC2 asks the GUI to show 7,111 leads; Salesforce itself shows "50+ items" |
| Relationship names (Owner, Account…) come from the API as nested objects, as in Salesforce relationship queries | Lists show names instead of IDs without extra requests |
| The opportunity name in the Convert dialog is only sent when the user changes it | Otherwise the API applies Salesforce's documented default (the lead's Company) |
| REST follows Salesforce shapes: create returns `201 { id, success, errors }`, PATCH and DELETE return 204, records carry `attributes` | Familiar to anyone who knows the Salesforce REST API |
| Queries use `POST /api/query` with a JSON filter, not SOQL | A SOQL parser is out of scope for one day; the JSON form maps directly to the service query and the MCP tool |
| MCP adds convenience tools (`log_call`, `create_task`, `add_contact_role`, `update_opportunity_stage`) beside generic CRUD | Easier for agents; each is a thin call into the same service functions |
| Reset copies a verified snapshot file over the working database while the connection is closed, then hashes it before reopening | AC6 asks for byte-identical; a file copy is exact and takes under 100 ms for the 14 MB database |
| Reset is fully synchronous inside the Node process | No request can run between closing and reopening the database, which is the app-level lock the plan called for |
| Snapshots are checked against their recorded sha256 before use; a damaged snapshot is refused and nothing changes | A reset must never leave a half-restored database |
| A baseline per `SEED_PROFILE` is built into the image; start-up copies the chosen one to the working database | `SEED_PROFILE` now takes effect at runtime without a rebuild, and start-up runs no SQL writes |
| The Lightning Cosmos look (SLDS 2) is recreated by `src/web/src/cosmos.css` over the BSD-licensed SLDS 1 package | Option B from the Phase 6b study: values measured in a real org and read from the published Cosmos tokens, without taking on the SLDS 2 licence terms |
| Seller Home follows the brief's screenshot: Build Pipeline, Today's Tasks and Recent Records are live | They read our own data through the same REST API as every other screen |
| Build Pipeline is computed in the browser from two existing queries (my open leads newest first, then their tasks) | The query API has no date-range operator; this avoids changing the API for one card |
| "Search this list" filters on the list's name column with the existing `contains` operator, kept in the URL as `q` | Lightning searches the list as you type; no new API was needed |
| The pencil on each detail field opens the existing Edit form at that record | It gives Lightning's inline-edit entry point without a second editing path |
| Save & New in the New form, and an Edit row action in list views | Both are on the Lightning surfaces the brief reviews and reuse the same form and API calls |
| Mutation log of every create, update and delete, with actor, clock time and full before/after images | Part of the brief's environment plumbing; a reset clears it with the rest of the database |

## Stubbed

Each stub is visibly marked in the UI with a **Stub** badge or "Not available in this trial".

| Stub | Reason |
|---|---|
| Reports, Dashboards, Forecasts, Campaigns and Cases tabs (stub pages) | Out of scope in the brief; kept so the Sales app navigation matches Salesforce |
| Global search box (disabled) | Search is not part of the brief's workflow |
| App Launcher icon (inert) | Only the Sales app exists |
| "Recently Viewed" and "All Open …" list views (disabled in the picker) | AC2 needs All Leads; All and My views are built |
| New Event and Email buttons in the activity composer | Events and real email are out of scope in the brief |
| Seller Home cards My Goals, Today's Events and Salesblazer, and Recent Records "View All" | Goals, events, community content and view history are out of scope |
| List view toolbar buttons List View Controls, Display as Table, Edit List and Show charts, and Pin this list view | List view administration and charts are out of scope; Refresh and Filters are live |
| "Choose Existing Contact" and "Choose Existing Opportunity" in the Convert dialog | The brief's conversion creates a contact and an optional new opportunity |

## Skipped

| Item | Reason |
|---|---|
| Converting a lead into an existing contact | The brief says conversion "creates a Contact"; the Convert dialog marks it as a stub |
| Renaming the new account in the Convert dialog | The convert API names the account after the lead's Company, as Salesforce does by default; the field is shown read-only |
| True inline editing, mass actions (Change Status, Change Owner) and record deletion in the GUI | Not needed by the brief's workflow; list checkboxes only count the selection, and delete stays available through REST and MCP |
| Tasks split view (list on the left, task on the right) | Skipped for Phase 6b by agreement; Tasks keeps the standard list view and record page |
| Dropdown menus on the navigation tabs (recent items) | The chevrons are shown for fidelity but open nothing; each tab still opens its list |
| Attaching a conversion to an existing opportunity (`opportunityId`) | Not required by the lifecycle; the opportunity is optional and new |
| Email notification on conversion | Real email sending is out of scope in the brief |

## Assumptions

Each one is recorded with its source in `docs/reference/`.

| Assumption | Reason |
|---|---|
| Lead Status keeps all 10 seed values, plus `Working - Contacted`, `Closed - Converted` and `Closed - Not Converted`; only `Closed - Converted` counts as converted | The brief's workflow needs these statuses; the seed values must stay intact |
| New leads default to `Open - Not Contacted` | Salesforce's default first status; it's also present in the seed |
| Opportunity stages, probabilities and forecast categories use the Salesforce defaults | Documented in Salesforce Help; the brief doesn't define them |
| The stage API value is `Id. Decision Makers` | Salesforce's docs spell it three ways |
| Moving past Qualification without an Amount fails with `FIELD_CUSTOM_VALIDATION_EXCEPTION` on `Amount`, on create and update, including closed stages | That's how a Salesforce validation rule reports; this rule comes from the brief |
| Missing required fields fail with `REQUIRED_FIELD_MISSING` and the message `Required fields are missing: [Field, ...]` | The code and error shape are documented; the exact message wording isn't |
| A converted opportunity uses the default stage (Prospecting), with CloseDate at the end of the current fiscal quarter | The close date is documented; the stage follows the documented picklist-default rule |
| The contact role created during conversion is not primary and has no Role | Salesforce links the contact; nothing documents it as primary |
| Lead tasks stay on the lead after conversion | Salesforce docs describe re-parenting only as a client-side best practice |
| Salutation, Middle Name and Suffix don't copy to the Contact on conversion | The official mapping lists them for person accounts only |
| Seed columns that are blank or custom are dropped on import (see `docs/reference/lead-seed-mapping.md`) | The brief allows dropping seed columns outside the Lead field set |
| Seed dates without a time are stored as midnight UTC | The seed has no time component |
| The All Leads view excludes converted leads | Salesforce hides converted leads from the Leads tab |
| Inactive users can't own new records but still show as owners of existing ones | Matches Salesforce; two seed users are inactive |
| `seed/` is gitignored in this working repo and copied by `scripts/fetch-seed.sh` | The seed is real company data; the reviewer repo already contains it |
| Lead Status, Stage, Forecast Category, Contact Role and Task Status/Priority/Subtype are restricted picklists; Rating, Lead Source, Salutation, Industry and Type are not | The business rules depend on the restricted ones; the others hold descriptive values, and the seed has variants to keep |
| Generated IDs use pod characters `SB0` plus a base-62 counter stored in the database | Deterministic across builds, and they can't collide with the seed's real IDs |
| Referential integrity is checked in the service layer, not with SQLite foreign keys | Task.WhoId and Task.WhatId are polymorphic, and the service returns Salesforce-style errors |
| Name on Lead, Contact and User is stored, and kept in sync by the service layer | List views sort and search by it without computing it per row |
| List sorting on text is case-insensitive (NOCASE) | Salesforce list views sort case-insensitively |
| Object icons are circles in the standard SLDS colours, except Lead, which uses its Cosmos theme colour #06A59A | Measured in the real org (object theme info); the other objects match the sprite colours |
| Recent Records shows the most recently modified leads, accounts, contacts and opportunities, newest Id first on ties | There is no view history; with the fixed test clock many records share a timestamp |
| The Home greeting uses the app clock's UTC hour | All app dates come from the app clock, not the browser |
| Button hover, press and focus, the spinner, the modal fade and the blurred backdrop use the Cosmos values measured in the org | The user asked for loaders, animations, buttons and icons to match Salesforce |
| The Seller Home empty states use SLDS's own illustrations, unmodified (CC BY-ND 4.0, credited in the README) | No artwork is copied from Salesforce's product pages; SLDS's icons are under the same licence |
| Account Type uses the 10 standard values; the help article's extra "Consulting" entry is left out | It appears at the boundary with the Industry list and looks like a formatting artefact |
| Errors are reported in Salesforce's order: field and required-field errors together first, then business rules such as the Amount rule | Salesforce runs system validation before validation rules |
| A field with a bad value is reported once, not also as a missing required field | One problem, one error |
| Unrestricted picklists accept values outside their list | Salesforce accepts them through the API for unrestricted picklists |
| The restricted-picklist message is `<Label>: bad value for restricted picklist field: <value>` | The code is documented; the wording follows Salesforce's usual form, from memory |
| A record ID that is unknown, malformed, or of another object type returns NOT_FOUND on get, update and delete | Matches Salesforce REST, which returns 404 for these |
| Lead Status can't be set to `Closed - Converted` directly; only conversion sets it (`INVALID_STATUS`) | Salesforce documents that changing Status doesn't convert a lead |
| Deleting an account deletes its contacts, opportunities, contact roles and related tasks; deleting a contact or opportunity deletes its contact roles and tasks | Matches Salesforce's cascade; the brief's lifecycle doesn't need deletes, so this is kept simple |
| Conversion fails with `STRING_TOO_LONG` if the default opportunity name (the Company) exceeds the 120-character limit | Salesforce's documentation doesn't say it truncates; the caller can pass a shorter opportunityName |
| The runtime clock starts at `CLOCK` and advances with real time (`offset` mode); tests use `fixed` mode | Records get distinct, realistic timestamps while dates stay anchored to the seed's timeline |
| Last Activity dates are not updated when tasks are logged | Not needed by the brief's workflow; listed as read-only behaviour |
| Some documented standard fields are not modelled: Account AccountNumber, Site, TickerSymbol, Ownership; Opportunity ContactId, IsPrivate; Task Type, CallType, CallDurationInSeconds | None is needed by the workflow or the seed; adding one later is a metadata change |
| Two seed leads with a blank Last Name are imported unchanged | The brief needs exactly 21,628 leads and the seed README says to keep the mess; Last Name is still required when a user saves them |
| User audit references to a name that is not a seed user ("Tracy Hart") are stored as null and reported at build | The seed doesn't contain that user, so there's no ID to point at |
| Seed user timestamps (`MM/DD/YYYY, hh:mm AM`) are read as UTC | The export doesn't say which time zone they're in |
| The importer refuses a database that already holds seed data; rebuilding is how to re-import | Re-running never duplicates rows; two builds from the same seed are byte-identical |
| The Phase 4 generated set is small (5 accounts, 10 contacts, 5 opportunities, 5 contact roles, 8 tasks) | It exists so the lifecycle can attach to existing accounts; volume and realistic mess come in Phase 7, the brief's lowest priority |
| Generated accounts use the names of companies shared by several seed leads, and contacts reuse those leads' (pseudonymized) names | Gives the "attach to an existing account" conversion path realistic matches |
| Generated data never creates, edits or converts a lead, and adds no tasks to seed leads | Keeps the 21,628 and 7,111 counts exact and the seed rows untouched |
| The mutation log is emptied at the end of the build | The baseline has no history; the log shows changes since the last build or reset |
| The acting user is the `X-User-Id` header (REST) or an `actingUserId` argument (MCP), defaulting to `DEFAULT_USER_ID` | No sessions are needed, and MCP is stateless |
| Users are read-only as an object: create, edit and delete return `INSUFFICIENT_ACCESS_OR_READONLY` | Users are seeded only; the brief puts user management out of scope |
| Malformed JSON bodies return `JSON_PARSER_ERROR` | That's the REST-specific code Salesforce uses; it isn't in the SOAP StatusCode list we could read, so this is from memory |
| Bad query paging returns `MALFORMED_QUERY`; an unknown operator returns `INVALID_QUERY_FILTER_OPERATOR` | Documented Salesforce codes |
| Generated data is anchored to the image-build clock; at runtime `CLOCK` and `CLOCK_MODE` drive the app clock, which can also be changed through the admin API | Baselines must be identical on every start for byte-identical reset |
| Reset restores data, not configuration: the clock and `SEED_PROFILE` stay as set | They are environment settings, not part of the database |
| `small` profile generates 2 accounts, `default` 5 (Phase 7 grows `default`) | Two profiles prove the setting works; both import the full seed |
| Admin errors use the non-Salesforce code `INVALID_SNAPSHOT` | The admin API has no Salesforce equivalent |
| The Lead path shows Open - Not Contacted, Working - Contacted, Closed - Not Converted, then Converted; seed statuses such as Prospecting show in the record but not as path steps | The seed's custom statuses have no defined order; the path covers the brief's workflow |
| Home shows the acting user's open tasks and recently updated opportunities | The full Seller Home layout from the brief's screenshot is Phase 6b |
| The acting user is chosen in the header and remembered in the browser | The brief allows "a header or a dropdown"; inactive users are listed but cannot be chosen |
| Unknown paths with a file extension (such as `/favicon.ico`) return a 404 error array; extensionless paths serve the app shell | Missing assets must fail visibly instead of returning HTML with status 200 |
| The favicon is a neutral local icon, not the Salesforce logo | Avoids using Salesforce branding assets |
