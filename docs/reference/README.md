# Phase 0 reference research

Research collected on 2026-11-13 to settle the gaps in the brief before implementation. Scope is limited to what the seven acceptance criteria and the six-step workflow need.

## How this was gathered (and what it is not)

- **Public sources only.** The Developer Edition signup failed, so **no authenticated `describe` responses and no live network requests were captured**. Field names, types and properties come from the public Object Reference pages, read in Chrome (`developer.salesforce.com` refuses automated fetches with HTTP 403). Help articles were read in Chrome too. Trailhead pages were fetched directly.
- Object Reference pages don't list **system fields** (`Id`, `OwnerId`, `CreatedById`, `CreatedDate`, `LastModifiedById`, `LastModifiedDate`, `SystemModstamp`, `IsDeleted`). Every object has them. `OwnerId` exists on Lead, Account, Contact, Opportunity and Task.
- The Object Reference says a picklist's **values are org-configured**. Default values come from Salesforce Help ([picklists.md](picklists.md)).

## Labels used in every file

| Tag | Meaning |
|---|---|
| **[SF-DOC]** | Documented Salesforce behaviour, with a source link |
| **[BRIEF]** | A rule from the trial brief (Notion) or its acceptance criteria |
| **[SEED]** | A fact about the supplied seed, verified against `seed/leads.csv`, `users-core.csv`, `README.md` and `manifest.json` |
| **[DECISION]** | Our decision where the sources are silent or conflict, with a reason. These also go into `TRADEOFFS.md` → Assumptions |

## Files

- [objects-and-fields.md](objects-and-fields.md): field definitions and relationships for the 7 objects we build
- [lead-seed-mapping.md](lead-seed-mapping.md): all 53 seed Lead columns mapped to API names, kept or dropped (this fills the missing "Lead row"), plus the User columns
- [picklists.md](picklists.md): documented defaults and the trial picklists (Lead Status, Stage, Rating, Contact Role, Task)
- [behavior-and-validation.md](behavior-and-validation.md): lead conversion, read-only converted leads, stage rules, list-view semantics, error format and the two required validation errors
- [gui-surfaces.md](gui-surfaces.md): the screens to build (this fills the missing "GUI surfaces" list), with reference screenshots and SLDS blueprints

## Sources

| Source | URL | How it was read |
|---|---|---|
| Object Reference: Lead | https://developer.salesforce.com/docs/platform/object-reference/references/standard-objects/object-lead.html | Chrome |
| Object Reference: Account | https://developer.salesforce.com/docs/platform/object-reference/references/standard-objects/object-account.html | Chrome |
| Object Reference: Contact | https://developer.salesforce.com/docs/platform/object-reference/references/standard-objects/object-contact.html | Chrome |
| Object Reference: Opportunity | https://developer.salesforce.com/docs/platform/object-reference/references/standard-objects/object-opportunity.html | Chrome |
| Object Reference: OpportunityContactRole | https://developer.salesforce.com/docs/platform/object-reference/references/standard-objects/object-opportunitycontactrole.html | Chrome |
| Object Reference: Task | https://developer.salesforce.com/docs/platform/object-reference/references/standard-objects/object-task.html | Chrome |
| Object Reference: OpportunityStage | https://developer.salesforce.com/docs/platform/object-reference/references/standard-objects/object-opportunitystage.html | Chrome |
| Object Reference: LeadStatus | https://developer.salesforce.com/docs/platform/object-reference/references/standard-objects/object-leadstatus.html | Chrome |
| SOAP API: `convertLead()` | https://developer.salesforce.com/docs/platform/api/guide/sforce-api-calls-convertlead.html | Chrome |
| REST API: Status Codes and Error Responses | https://developer.salesforce.com/docs/platform/api-rest/guide/errorcodes.html | Chrome |
| SOAP API: Core Data Types (`StatusCode` list) | https://developer.salesforce.com/docs/platform/api/guide/sforce-api-calls-concepts-core-data-objects.html | Chrome |
| Help: Default Standard Picklist Field Values | https://help.salesforce.com/s/articleView?id=000384457&type=1 | Chrome |
| Help: Stage to Forecast Category mapping | https://help.salesforce.com/s/articleView?id=sales.faq_forecasts_category_mapping.htm&type=5 | Chrome |
| Trailhead: Create and Convert Leads | https://trailhead.salesforce.com/content/learn/modules/leads_opportunities_lightning_experience/create-and-convert-leads-lightning | Fetched |
| Trailhead: Work Your Opportunities | https://trailhead.salesforce.com/content/learn/modules/leads_opportunities_lightning_experience/work-your-opportunities | Fetched |
| Trailhead: Work with Lead List Views | https://trailhead.salesforce.com/content/learn/modules/leads-list-view-step-by-step/work-with-lead-list-views | Fetched |
| Lightning Design System (SLDS 2 site) | https://www.lightningdesignsystem.com/ | Chrome |
| SLDS v1 component blueprints | https://v1.lightningdesignsystem.com/components/ | HTTP check |
| npm `@salesforce-ux/design-system` 2.264.3, BSD-3-Clause | https://www.npmjs.com/package/@salesforce-ux/design-system | `npm view` |

Sources tried that **failed**: direct HTTP fetches of `developer.salesforce.com` (403) and of `help.salesforce.com` (an empty JavaScript shell). Both were re-read in Chrome, as listed above.
