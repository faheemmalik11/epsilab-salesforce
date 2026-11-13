# Features

What this Salesforce Sales Cloud clone supports, following the brief's tiers. Out-of-scope entry points are visible in the GUI, disabled, and marked "Not in scope", with a tooltip naming the feature. Reasons and assumptions are in `TRADEOFFS.md`.

## Tier 1: fully functional (GUI, REST and MCP on one service layer)

| Area | What works |
|---|---|
| Objects | Lead, Account, Contact, Opportunity, Task and Opportunity Contact Role: create, read, update and delete with Salesforce field names, picklists, 18-character IDs and the error array `[{ errorCode, message, fields }]` |
| Lead lifecycle | Create; log a call (a completed Task); move Lead Status along the Path; convert into a new or existing Account, a new Contact and an optional Opportunity, all-or-nothing |
| Opportunity lifecycle | Stage Path through every stage, the Amount rule after Qualification, Closed Won and Closed Lost, Contact Roles with a single primary, tasks, and Next Step |
| Direct path | Account, then Contact, then Opportunity, with no lead |
| Validation | Required fields, restricted picklists, references, inactive owners, converted-lead locks, and the Amount rule, with identical errors in the GUI, REST and MCP |
| List views | All and My views, sorting, picklist filters, "Search this list", wrap or clip per column, inline edit with Cancel / Save, row actions (Edit, Delete, Change Owner), exact counts, infinite scroll |
| Record pages | Details in Lightning sections (the lead page uses About, Get in Touch, Segment and History) with inline edit; Change Owner; Delete; related lists; Path |
| Activity | Log a Call and New Task in a docked composer; a timeline grouped into Upcoming & Overdue and months, with date range, owner and type filters, Refresh and Expand All |
| Navigation | App sidebar (Home, Contacts, Accounts, Sales), object tabs with New, recent records and list view menus, acting-user switcher |
| Seller Home | Build Pipeline, Today's Tasks (with filters and completion), Recent Records |
| Data | Seed import (21,628 leads, 9 users) with hash checks; a deterministic generator for accounts, contacts, opportunities, contact roles and tasks, with realistic mess |
| Environment | Byte-identical reset (REST, MCP, CLI, and a GUI demo admin control with confirmation), named snapshots and verification, the app clock, the mutation log; `SEED_PROFILE` at runtime |
| Queries | REST `POST /api/query` and the MCP `query_records` tool: `eq`, `ne`, `in` (case-insensitive on text), `isNull`, `notNull`, `contains`, sorting and paging |

## Tier 2: read-only

| Item | Detail |
|---|---|
| Users | The 9 seeded users are readable; create, edit and delete return `INSUFFICIENT_ACCESS_OR_READONLY` |
| Converted leads | Shown with links to the new records; edits are refused |
| Audit fields | Created By, Created Date, Last Modified By and Last Modified Date are set by the system |
| Mutation log | Readable through REST and MCP; cleared by a reset |

## Stubbed (visible, disabled and marked "Not in scope")

| Stub | Where |
|---|---|
| Reports, Dashboards, Forecasts, Campaigns, Cases | Navigation tabs, each opening a page that says the feature is not in scope |
| Service, Marketing, Commerce, Your Account, Automation | App sidebar items |
| Global search, App Launcher | Header |
| Recently Viewed and All Open list views, List View Controls, Display as Table, Edit List, Show charts | List view header and toolbar |
| Edit Labels | List row action menu |
| Email, New Event | Activity composer buttons and the record actions menu |
| Choose Existing Contact, Choose Existing Opportunity | Convert Lead dialog |
| My Goals, Today's Events, Salesblazer, Recent Records "View All" | Seller Home |

## Absent or intentionally excluded

| Item | Reason |
|---|---|
| Campaigns, Cases, Events, Products, quotes and other objects not listed in the brief | Out of scope in the brief |
| Real email sending, files, Slack, AI features (Einstein, Agentforce), People Score, Consent Status, duplicate rules | Not in the brief; the trial org's extra panels are not copied |
| SOQL, reports, mass actions on selected rows, list view administration, record types | Not needed by the brief's workflow |
| Tasks split view | Skipped by agreement; Tasks uses the standard list view |
| `LastActivityDate` maintained from tasks | Stored as imported, not recomputed (seed rows stay untouched) |
| View history ("Recently Viewed") | Recent records show the most recently modified records instead |
