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
| Mutation log of every create, update and delete, with actor, clock time and full before/after images | Part of the brief's environment plumbing; a reset clears it with the rest of the database |

## Stubbed

None yet.

## Skipped

| Item | Reason |
|---|---|
| Converting a lead into an existing contact | The brief says conversion "creates a Contact" |
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
| Unknown paths with a file extension (such as `/favicon.ico`) return a 404 error array; extensionless paths serve the app shell | Missing assets must fail visibly instead of returning HTML with status 200 |
| The favicon is a neutral local icon, not the Salesforce logo | Avoids using Salesforce branding assets |
