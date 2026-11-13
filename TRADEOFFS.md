# Tradeoffs

What was built, stubbed or skipped, each with a one-line reason. The brief is the source of truth; the supporting research is in `docs/reference/`.

## Built

| Item | Reason |
|---|---|
| One Node process serving the GUI on `GUI_PORT` and REST + MCP on `API_PORT` | The brief names separate GUI and API/MCP ports; one process keeps the container simple |
| SQLite (`better-sqlite3`) with the default rollback journal, not WAL | One file outside write transactions, so reset is a file copy with a direct byte-identical check |
| MCP over stateless Streamable HTTP (SDK v2) | It's the SDK's documented Fastify pattern and needs no session store |
| The GUI also mounts the REST routes on its own port | The browser calls the API on its own origin, so there's no CORS between ports |

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
