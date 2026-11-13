# Seed data

The seed holds Leads and Users only. It has no accounts, contacts, opportunities or tasks. Your generator creates those.

| File | Rows | Columns |
| --- | --- | --- |
| `leads.csv` | 21,628 | 53 |
| `users-core.csv` | 9 | 53 |

The files come from Salesforce report exports, then pseudonymization. Your importer must handle the points below.

## File format

- **Column names are screen labels, not API names.** For example, `Lead Owner`, `No. of Employees` and `Company / Account`. Map them to the standard API names, such as `OwnerId`, `NumberOfEmployees` and `Company`.
- **`-` means blank.**
- **Yes/no fields hold text:** `feature included` means true, and `feature not included` means false.
- **Annual Revenue is text,** such as `$457,000`.
- **Dates use `MM/DD/YYYY`.** `Create Date` and `Last Modified` have no time.
- **Owners are names, not IDs.** `Lead Owner`, `Created By` and `Last Modified By` hold a user's full name. Each name matches exactly one `Full Name` in `users-core.csv`.
- **IDs are real Salesforce IDs.** `Lead ID` and `User ID` are valid 18-character IDs with the standard prefixes (`00Q`, `005`). Keep them.
- **Some columns repeat.** For example, `Street` and `Street Line 1`, or `State/Province` and `State/Province (text only)`.
- **Some columns are out of scope.** For example, `Lead Record Type`, `Clean Status`, `Data.com Key` and `Created Month`. The importer may drop them.

## Dates

All dates were moved 731 days forward. The newest edit is on 11/09/2028. A default clock of **2028-11-11** fits the data.

## What was replaced

| Field | What you see |
| --- | --- |
| Person names | Fake names |
| Company | `Business 0BAC66574769` and similar |
| Email | `contact.…@example.invalid` |
| Phone, Mobile, Fax | `+1 202-555-01xx ext. …` |
| Street | `9436 Synthetic 4BA8E4 Way` and similar |
| City | `Test City FAFBA830` and similar |
| Zip/Postal Code | Always `00000` |
| Website | `https://site-….invalid` |
| Lead Record Type | `Synthetic category …` |

State and Country are real. Lead Status, Lead Source, Rating, Salutation, Annual Revenue and No. of Employees are real values.

## Known mess

This mess is real, so keep it. It is what a real org looks like.

- **Placeholder names.** 6,648 leads have the Last Name `No Name`, in three spellings. 4,224 leads have no First Name.
- **Titles.** Common titles keep their original case: `Owner`, `OWNER` and `owner` all appear. Rare titles are blank. 12 Title cells hold an email address.
- **Description** is blank, except on 13 leads where it holds an email address.
- **Industry** is blank on every lead.
- **Salutation** has variants: `Mr`, `Mr.`, `Mr..`, `Ms`, `Ms.` and `Mrs.`.
- **Shared companies.** 1,444 leads share a company name with at least one other lead.
- **One owner.** Jon Santiago owns all 21,628 leads.
- **Users.** Two of the 9 users are inactive (Christy Sanchez and Andrew Larsen). No user has a Title. Three users share one email. One user's `Full Name` does not match their First and Last Name.

## Counts

Your importer should reproduce these counts.

| Lead Status | Leads |
| --- | --- |
| Prospecting | 20,728 |
| Registered | 703 |
| Duplicate | 163 |
| Demo Completed | 22 |
| NQ_Nurture_Trade | 4 |
| Disqualified - Bad Contact | 4 |
| Unqualified - Not a Contractor | 1 |
| MQL | 1 |
| Disqualified - Out of Business | 1 |
| Open - Not Contacted | 1 |

| Rating | Leads |
| --- | --- |
| Hot | 7,111 |
| Cold | 4,794 |
| Warm | 1,759 |
| blank | 7,964 |

Lead Source has 22 values, and 98 leads have no Lead Source. No lead is converted.
