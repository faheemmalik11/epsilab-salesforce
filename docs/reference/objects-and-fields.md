# Objects and fields

The **[SF-DOC]** columns come from the public Object Reference pages (links in [README.md](README.md)). Flag key: **C** = Create, **U** = Update, **N** = Nillable, **D** = Defaulted on create, **R** = Restricted picklist. Per the reference's convention, a field that is **not Nillable and not Defaulted on create** must be supplied on create.

Only the fields relevant to the trial are listed. Out-of-scope families are omitted: Sales Engagement/cadence, Einstein/insights, Data.com/Jigsaw/D&B, geocode, consent/Individual, partner/portal, Salesforce-to-Salesforce, campaigns, products and pricebooks, local-name variants, and pronouns/gender.

## Key prefixes and IDs

| Object | Prefix | Basis |
|---|---|---|
| Account | 001 | [BRIEF] (it's also Salesforce's standard prefix) |
| Contact | 003 | [BRIEF] |
| Lead | 00Q | [BRIEF], and seed `Lead ID` values start with it [SEED] |
| Opportunity | 006 | [BRIEF] |
| Task | 00T | [BRIEF] |
| User | 005 | [BRIEF], and seed `User ID` values start with it [SEED] |
| OpportunityContactRole | 00K | [CONFIRMED by the user, 2026-11-13]. Salesforce's standard prefix for this object |

- **18-character format.** [BRIEF] asks for Salesforce-style 18-char IDs. [SEED] keeps real 18-char IDs for leads and users. [DECISION] Generated IDs are prefix + 12 base-62 characters + a 3-character case-safe suffix, using the widely published algorithm: for each 5-character chunk, set bit *i* when character *i* is A–Z, then map 0–25 → A–Z and 26–31 → 0–5. We couldn't read an official page for the algorithm. **Verified 2026-11-13: it reproduces the suffix of all 21,637 seed IDs (21,628 leads + 9 users) with 0 mismatches.** The importer re-runs this check.

## Lead

| Field | Type | Flags | Notes |
|---|---|---|---|
| LastName | string(80) | CU | **Required** [SF-DOC] |
| Company | string | CUN | **Required** per the description [SF-DOC]. It's nillable only for person-account orgs, which are out of scope |
| Status | picklist | CUD | Defaulted on create; values come from LeadStatus [SF-DOC] |
| FirstName, MiddleName, Suffix, Salutation, Title | string / picklist | CUN | |
| Email | email | CUN | |
| Phone, MobilePhone, Fax | phone | CUN | |
| Website | url | CUN | |
| Street (textarea), City, State, PostalCode, Country | | CUN | `Address` is a read-only compound field [SF-DOC] |
| StateCode, CountryCode | picklist | CUN | Not used; the seed carries names only [DECISION] |
| Rating | picklist | CUN | |
| LeadSource | picklist | CUN | |
| Industry | picklist | CUN | Blank on every seed lead [SEED] |
| AnnualRevenue | currency | CUN | |
| NumberOfEmployees | int | CUN | |
| Description | textarea | CUN | |
| IsConverted | boolean | CD, default false | Not updatable [SF-DOC] |
| ConvertedAccountId / ConvertedContactId / ConvertedOpportunityId | reference → Account / Contact / Opportunity | CN | Not updatable [SF-DOC] |
| ConvertedDate | date | CN | |
| IsUnreadByOwner | boolean | CUD, default false | |
| DoNotCall, HasOptedOutOfEmail, HasOptedOutOfFax | boolean | CUD, default false | |
| LastActivityDate | date | N, read-only | The most recent of the last event due date and the last closed task due date [SF-DOC] |
| Name | string | read-only | FirstName + MiddleName + LastName + Suffix [SF-DOC] |

## Account

| Field | Type | Flags | Notes |
|---|---|---|---|
| Name | string | CU | **Required** |
| Type, Industry, Rating, AccountSource, Ownership | picklist | CUN | |
| ParentId | reference → Account | CUN | |
| Phone, Fax | phone | CUN | |
| Website | url | CUN | |
| AccountNumber, Site, TickerSymbol | string | CUN | |
| AnnualRevenue | currency | CUN | |
| NumberOfEmployees | int | CUN | |
| BillingStreet/City/State/PostalCode/Country | | CUN | Plus `Shipping*`, the same shape |
| Description | textarea | CUN | |
| LastActivityDate | date | N, read-only | |

## Contact

| Field | Type | Flags | Notes |
|---|---|---|---|
| LastName | string | CU | **Required** |
| FirstName, Salutation, Title, Department | | CUN | Title and Department are standard Contact fields we filtered out of the extraction; they're CUN like the rest |
| AccountId | reference → Account | CUN | |
| Email | email | CUN | |
| Phone, MobilePhone | phone | CUN | |
| MailingStreet/City/State/PostalCode/Country | | CUN | |
| LeadSource | picklist | CUN | |
| Description | textarea | CUN | |
| Name | string | read-only | |
| LastActivityDate | date | N, read-only | |

## Opportunity

| Field | Type | Flags | Notes |
|---|---|---|---|
| Name | string | CU | **Required** |
| StageName | picklist | CU | **Required** |
| CloseDate | date | CU | **Required** |
| AccountId | reference → Account | CUN | |
| ContactId | reference → Contact | CN | Create-only. It's set on create to make a primary contact role; the help docs describe the behaviour, but we couldn't read the description text [DECISION: ignore beyond storing it] |
| Amount | currency | CUN | |
| Probability | percent | CUND | Defaulted from the stage |
| ForecastCategory / ForecastCategoryName | picklist | CUND(R) | Defaulted from the stage; the default mapping is in [picklists.md](picklists.md) |
| IsClosed / IsWon | boolean | D, read-only | Derived from the stage (via the OpportunityStage `IsClosed`/`IsWon` fields) [SF-DOC] |
| NextStep | string | CUN | |
| Type, LeadSource | picklist | CUN | |
| Description | textarea | CUN | |
| IsPrivate | boolean | CUD | |
| LastActivityDate | date | N, read-only | |

## OpportunityContactRole

| Field | Type | Flags | Notes |
|---|---|---|---|
| OpportunityId | reference → Opportunity | C | **Required**. Create-only |
| ContactId | reference → Contact | CU | **Required** |
| Role | picklist | CUN | |
| IsPrimary | boolean | C | |

## Task

| Field | Type | Flags | Notes |
|---|---|---|---|
| Subject | combobox | CUN | Free text with suggested values |
| Status | picklist | defaulted, U | Defaulted on create [SF-DOC]. Effectively required with a default |
| Priority | picklist | defaulted, U | Same as Status |
| ActivityDate | date | CUN | Due date |
| WhoId | reference → **Contact, Lead** | CUN | Polymorphic [SF-DOC] |
| WhatId | reference, polymorphic | CUN | Any non-human object. We use Account and Opportunity [DECISION] |
| TaskSubtype | picklist (restricted) | CN | Create-only. `Call` marks a logged call [DECISION: values Task, Call, Email; Call is used by Log a Call] |
| Type | picklist | CUN | |
| CallType | picklist (restricted) | CUN | |
| CallDurationInSeconds | int | CUN | |
| Description | textarea | CUN | |
| IsClosed | boolean | D, read-only | True when the Status is a closed status |
| OwnerId | reference → User | (system) | The assigned user |

## User (read-only in the trial)

[BRIEF] Users are seeded only, with one acting user that can be switched. We keep `Id`, `Username`, `FirstName`, `LastName`, `Name`, `Alias`, `Email`, `IsActive`, `TimeZoneSidKey`, `LocaleSidKey`, `LanguageLocaleKey`, `Title`, plus the profile label as text. The column mapping is in [lead-seed-mapping.md](lead-seed-mapping.md#users-core-csv).

## Relationships we implement

```
User 1─* (OwnerId)  Lead, Account, Contact, Opportunity, Task
Account 1─* Contact (AccountId)        Account 1─* Opportunity (AccountId)
Opportunity 1─* OpportunityContactRole *─1 Contact
Lead ─(on convert)→ ConvertedAccountId / ConvertedContactId / ConvertedOpportunityId
Task.WhoId → Lead | Contact            Task.WhatId → Account | Opportunity
```
