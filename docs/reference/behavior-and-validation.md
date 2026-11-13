# Behaviour and validation

## Lead conversion

[SF-DOC] `convertLead()`: https://developer.salesforce.com/docs/platform/api/guide/sforce-api-calls-convertlead.html

| Argument | Documented behaviour | Trial |
|---|---|---|
| leadId | Required | ✔ |
| convertedStatus | **Required**; must be a LeadStatus with `IsConverted = true` | ✔ Only `Closed - Converted` qualifies |
| accountId | Optional. If omitted, a new Account is created. If given, the lead merges into it and the existing account's name and data are not overwritten | ✔ |
| contactId | Optional. **Must belong to the given accountId**, and accountId is then required. If omitted, a Contact is created under the account. An existing contact's data isn't overwritten | ✘ [DECISION] The brief says conversion "creates a Contact", so we always create one. Merging into an existing contact is extra scope and is listed in `TRADEOFFS.md` |
| doNotCreateOpportunity | Default false, so an Opportunity **is** created by default | ✔ |
| opportunityName | Defaults to the lead's **Company**. Max 80 characters. Can't be combined with opportunityId; must be blank when doNotCreateOpportunity is true | ✔ |
| opportunityId | Attach to an existing opportunity; can't be combined with opportunityName | [DECISION] Not supported, which keeps conversion simple. Recorded in `TRADEOFFS.md` |
| ownerId | Owner of the new records. Defaults to the lead owner. Doesn't change existing records | ✔ |
| overwriteLeadSource | Copy LeadSource onto an existing contact | ✘ Only meaningful with contactId |
| sendNotificationEmail | Email | ✘ Email is out of scope [BRIEF]; the argument is accepted and ignored |

Documented rules we implement:
- [SF-DOC] Standard lead fields map onto the standard Account, Contact and Opportunity fields. When merging into existing records, **only empty target fields are filled**.
- [SF-DOC] Blank lead picklists take the target object's default picklist value.
- [SF-DOC] After conversion the lead is **read-only**. `IsConverted`, `ConvertedAccountId`, `ConvertedContactId`, `ConvertedOpportunityId`, `ConvertedDate` and `Status` are set. Changing Status to a converted value **doesn't** convert a lead.
- [SF-DOC] Converted leads **disappear from the Leads tab** but remain queryable.
- [SF-DOC] The returned result contains `leadId`, `accountId`, `contactId`, `opportunityId`, `success` and `errors`.
- [SF-DOC, Trailhead] The UI dialog has an Account section (create new from Company / choose existing), a Contact section (create new / choose existing), an Opportunity section (name / don't create), Record Owner and Converted Status, then a **Convert** button. The trial builds every section except "choose existing contact" (see contactId).
- [BRIEF] **Atomic:** if anything fails, nothing is created. Implemented as one database transaction.

Field mapping: **[SF-DOC]** Salesforce Help, *Lead Conversion Field Mapping*, https://help.salesforce.com/s/articleView?id=sf.lead_conversion_mapping.htm&type=5 (read in Chrome on 2026-11-13). Business-account rows only; person-account and out-of-scope rows (Campaign, Partner Account, geolocation, local-name fields) are omitted:

| Lead field | Account | Contact | Opportunity |
|---|---|---|---|
| Company | Account Name | Account (lookup) | Opportunity Name *and* Account |
| Address (Street, City, State, Postal Code, Country) | Billing address | Mailing address | |
| Phone | Phone | Phone | |
| Fax | Fax | Fax | |
| Website, Industry, Annual Revenue, No. of Employees, Rating | the same fields | | |
| First Name, Last Name, Title, Email, Mobile | | the same fields | |
| Description | | **Description (Contact only)** | |
| Do Not Call, Email Opt Out, Fax Opt Out | | the same fields; *not updated when converting into an existing contact* | |
| Lead Source | Account Source | Lead Source | Lead Source |
| Lead Owner | Owner | Owner | Owner |

- **Not mapped for business accounts** [SF-DOC]: Salutation, Middle Name and Suffix are listed for person accounts only, so they **don't** copy to the Contact. We follow the document, even though it's an unusual detail.
- **Opportunity CloseDate** [SF-DOC]: with a standard fiscal year, the close date is **the last day of the current fiscal quarter**, using the app clock. With the default clock of 2028-11-11, that's 2028-12-31.
- **Opportunity StageName** [DECISION]: the documents we read don't name the stage. `convertLead()` says blank picklists take the target's default picklist value, so we use the stage picklist's default, the first stage (**Prospecting**).
- **Contact role** [CONFIRMED by the user, 2026-11-13]: when conversion creates both the Contact and the Opportunity, Salesforce links them with an OpportunityContactRole. We create that link with **`IsPrimary = false` and an empty Role**, because no source we have shows it as primary.
- **Merging into an existing account** [SF-DOC]: only empty target fields are filled, and the account name isn't overwritten.
- **Open tasks** [SF-DOC, a best-practice note]: the doc *suggests* the client creates tasks against the new contact and opportunity. It doesn't describe automatic re-parenting. [DECISION] We don't move the lead's tasks; they stay on the lead, which stays readable.

Errors we raise (codes from the `StatusCode` list [SF-DOC]):

| Case | errorCode |
|---|---|
| Lead already converted | `CANNOT_UPDATE_CONVERTED_LEAD` ("A converted lead couldn't be updated") |
| convertedStatus missing | `REQUIRED_FIELD_MISSING` |
| convertedStatus not a converted status | `INVALID_STATUS` [DECISION: the documented meaning is about org status, so we use it with an explicit message] |
| Unknown or malformed accountId / ownerId | `INVALID_CROSS_REFERENCE_KEY` / `MALFORMED_ID` |
| opportunityName given with doNotCreateOpportunity | `FIELD_INTEGRITY_EXCEPTION` [DECISION] |

## Converted leads are read-only

- [SF-DOC] "After a lead has been converted, it's read only." Updates fail with `CANNOT_UPDATE_CONVERTED_LEAD`.
- [DECISION] Delete is also rejected.
- The GUI shows a converted lead's page with no Edit, Convert or Path actions, plus a "This lead was converted" panel linking to the Account, Contact and Opportunity.

## Opportunity stage rules

- [SF-DOC] A stage change sets `Probability` and `ForecastCategoryName` to the stage defaults unless the same request sets them explicitly. `IsClosed` and `IsWon` follow the stage.
- [BRIEF] **"Moving an Opportunity past Qualification without an Amount is rejected with the same error in both."** This is a trial rule, not stock Salesforce. Salesforce would implement it as a *validation rule*, which surfaces as `FIELD_CUSTOM_VALIDATION_EXCEPTION`.
  - [DECISION] The rule applies to any stage whose sort order is after Qualification, including Closed Won and Closed Lost, when `Amount` is null. The error is attached to the `Amount` field.
  - [DECISION] Message: `Amount is required for stages after Qualification.` with errorCode `FIELD_CUSTOM_VALIDATION_EXCEPTION` and fields `["Amount"]`.
  - [DECISION] It applies on create as well as update. A new opportunity at Needs Analysis without an Amount is also rejected.
- [Trailhead] Closing happens from the Path: pick a closed stage, then Closed Won or Closed Lost in a dialog.

## Required-field validation

[SF-DOC] `REQUIRED_FIELD_MISSING`: "A call requires a field that wasn't specified." Required fields come from [objects-and-fields.md](objects-and-fields.md): Lead LastName + Company, Account Name, Contact LastName, Opportunity Name + StageName + CloseDate, OpportunityContactRole OpportunityId + ContactId. Lead Status and Task Status/Priority are defaulted, so they're never missing.

- [DECISION] The message format is `Required fields are missing: [LastName, Company]`, with errorCode `REQUIRED_FIELD_MISSING` and fields `["LastName","Company"]`. That's the format Salesforce returns, from memory; the error code and the body shape are documented.
- [DECISION] Restricted picklists and the stage picklist reject unknown values with `INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST` ("You specified an invalid or null value for a restricted picklist") [SF-DOC code].

## Error body: [SF-DOC] REST format

https://developer.salesforce.com/docs/platform/api-rest/guide/errorcodes.html. Errors are a JSON array:

```json
[ { "fields": ["Id"], "message": "Account ID: id value of incorrect type: 001900K0001pPuOAAU", "errorCode": "MALFORMED_ID" } ]
[ { "message": "The requested resource does not exist", "errorCode": "NOT_FOUND" } ]
```

HTTP status codes: 400 (bad request or validation), 404 (not found), 201 (create), 204 (delete and PATCH), 200 (GET).

[BRIEF] The GUI and MCP must show **the same structured error**:
- The service layer throws one error type.
- The REST layer returns the array with HTTP 400.
- MCP returns the same array as the tool error content.
- The GUI renders the `message` text in the field-level error and the page-level error popover.

## List views

- [SF-DOC, Trailhead] The Leads home defaults to **Recently Viewed**. A picker switches between views such as All Open Leads, My Leads and My Unread Leads.
- The filter panel has Add Filter (field, operator, value), Done, Save and Remove All.
- Users can sort by clicking column headers.
- Row actions include Change Status and Change Owner.
- [BRIEF] Criterion #2 names an **"All Leads"** view, sorted by Company and filtered to Rating = Hot (7,111). The count must match the API.
- [DECISION] Scope is held to what AC2 needs. The picker offers **All Leads** (all unconverted leads; it's our default view) and **My Leads**. Salesforce's Recently Viewed and All Open Leads views appear in the picker as visible stubs.
  - Filtering is server-side and supports equals and not-equals on picklists and text.
  - The header shows "N items · Sorted by Company · Filtered by Rating".
- [SF-DOC] Converted leads are excluded from every Leads tab view. On the seed this has no effect, because none are converted.
- Performance [BRIEF], each action under 1 s:
  - Sorting and filtering run as SQLite queries with indexes on `(IsConverted, Company)` and `(IsConverted, Rating, Company)`.
  - The count comes from `COUNT(*)` with the same WHERE clause.
  - Pages are keyset-paginated, 50 rows at a time.

## Acting user: [BRIEF]

Auth is out of scope. The acting user is chosen from a header dropdown (GUI), the `X-User-Id` header (REST) or an `actingUserId` tool argument (MCP; the transport is stateless). [DECISION] The default is the first active user, sorted by name. The acting user becomes `CreatedById` and `LastModifiedById`, and the default `OwnerId` on create.
