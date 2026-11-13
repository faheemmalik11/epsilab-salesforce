# Picklists

Source for the defaults: Salesforce Help, *Default Standard Picklist Field Values* (https://help.salesforce.com/s/articleView?id=000384457&type=1). The stage mapping comes from Help, *Manage Opportunity Stage to Forecast Category Mappings* (https://help.salesforce.com/s/articleView?id=sales.faq_forecasts_category_mapping.htm&type=5). Picklist metadata objects, per [SF-DOC]: `LeadStatus` (`MasterLabel`, `IsConverted`, `IsDefault`, `SortOrder`) and `OpportunityStage` (`DefaultProbability`, `ForecastCategoryName`, `IsClosed`, `IsWon`, `SortOrder`).

## Lead Status: [DECISION], built from three sources

- [SF-DOC] Values are org-defined; each value is flagged converted or not. The help article's Classic defaults read **Open / Contacted / Qualified / Unqualified**.
- [BRIEF] The workflow needs **Working - Contacted** and **Closed - Converted**.
- [SEED] Ten values; one of them is **Open - Not Contacted**. That's the modern Salesforce default naming the brief also uses, which shows the source org runs the "Open - Not Contacted / Working - Contacted / Closed - Converted / Closed - Not Converted" set. That set is widely seen in Developer Edition orgs, but the help page we could read lists the older Classic labels. We follow the brief and the seed.

Trial picklist, in path order. All seed values are kept verbatim:

| # | Value | Origin | Converted? | Notes |
|---|---|---|---|---|
| 1 | Open - Not Contacted | seed (1) + SF default | no | **Default** for new leads (`IsDefault`) |
| 2 | Prospecting | seed (20,728) | no | |
| 3 | Working - Contacted | brief | no | Workflow step 2 |
| 4 | MQL | seed (1) | no | |
| 5 | Registered | seed (703) | no | |
| 6 | Demo Completed | seed (22) | no | |
| 7 | NQ_Nurture_Trade | seed (4) | no | |
| 8 | Duplicate | seed (163) | no | |
| 9 | Disqualified - Bad Contact | seed (4) | no | |
| 10 | Disqualified - Out of Business | seed (1) | no | |
| 11 | Unqualified - Not a Contractor | seed (1) | no | |
| 12 | Closed - Not Converted | SF default | no | |
| 13 | Closed - Converted | brief + SF default | **yes** | The only converted status. Shown in the Convert dialog, never on the Path |

[DECISION] The Lead **Path** shows the open stages 1, 3 and 12, plus a final "Converted" step. A lead whose seed status isn't on the Path, such as Prospecting, shows that value in the highlights panel and the status field. The Path then highlights no step until the user picks one, which mirrors how Lightning renders a value that isn't on the Path. Ordering seed-only values is a [DECISION]; the seed carries no sort order.

## Lead Rating: [SF-DOC] default

Hot, Warm, Cold. The seed uses exactly these, plus blank [SEED].

## Lead Source

- [SF-DOC] Defaults: Advertisement, Employee Referral, External Referral, Partner, Public Relations, Seminar Internal, Seminar Partner, Trade Show, Web, Word of mouth, Other.
- [SEED] 22 distinct values.
- [DECISION] Picklist = the union of the seed values and the defaults, with seed values verbatim. The same list applies to Contact.LeadSource and Opportunity.LeadSource.

## Salutation

- [SF-DOC] Mr., Ms., Mrs., Dr., Prof.
- [SEED] Variants such as `Mr`, `Mr..` and `Ms` are kept on the imported records.
- [DECISION] The picklist offers the 5 defaults for new values. Restricted-picklist validation applies only to new writes; imported values are preserved, as the seed README asks.

## Opportunity Stage: [SF-DOC] defaults

| Stage | Probability | Forecast category | IsClosed | IsWon |
|---|---|---|---|---|
| Prospecting | 10 | Pipeline | no | no |
| Qualification | 10 | Pipeline | no | no |
| Needs Analysis | 20 | Pipeline | no | no |
| Value Proposition | 50 | Pipeline | no | no |
| Id. Decision Makers | 60 | Pipeline | no | no |
| Perception Analysis | 70 | Best Case | no | no |
| Proposal/Price Quote | 75 | Best Case | no | no |
| Negotiation/Review | 90 | Commit | no | no |
| Closed Won | 100 | Closed | yes | yes |
| Closed Lost | 0 | Omitted | yes | no |

- The probabilities come from the default-picklists article. The forecast categories come from the mapping article, which calls its table an "example mapping". Closed Lost must map to Omitted.
- [DECISION] The stage's API value is **`Id. Decision Makers`**. The articles spell it three ways ("ID Decision Makers", "Id Decision Makers", "Id. Decision Makers"); the dotted form is the one we recall from the API, but that's unverified.
- [SF-DOC] Changing the stage sets Probability and Forecast Category to the stage defaults. Users may then override either one. A user override on save is kept.

## Opportunity Type: [SF-DOC]

Existing Business, New Business.

## OpportunityContactRole.Role: [SF-DOC] defaults

Business User, Decision Maker, Economic Buyer, Economic Decision Maker, Evaluator, Executive Sponsor, Influencer, Technical Buyer, Other.

## Task: [SF-DOC] defaults

- **Status:** Not Started (default), In Progress, Completed (closed), Waiting on someone else, Deferred.
- **Priority:** High, Normal (default), Low.
- **Subject suggestions:** Call, Email, Meeting, Send Letter/Quote, Other.
- [DECISION] **TaskSubtype:** Task, Call, Email. Log a Call creates `TaskSubtype = Call`, `Status = Completed`, `ActivityDate = today` (clock).

## Account

- [SF-DOC] Type: Analyst, Competitor, Customer, Integrator, Investor, Partner, Press, Prospect, Reseller, Other.
- [SF-DOC] Industry: the standard 32-value list, as in the article; it's the same list for Lead.
