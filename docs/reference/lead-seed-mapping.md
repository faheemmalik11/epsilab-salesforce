# Seed column mapping

This fills the brief's missing "Lead row". Rules: [SEED] `seed/README.md` (labels → API names, `-` = blank, `feature included` = true, `$` text revenue, `MM/DD/YYYY` dates, owner names → user IDs) and [BRIEF] (out of scope: record types, Data.com fields, "other seed columns", so the importer may drop them).

Every column was profiled against `seed/leads.csv` (21,628 rows) on 2026-11-13.

## leads.csv (53 columns)

### Kept: mapped to standard Lead fields

| Seed column | API field | Transform | Seed profile |
|---|---|---|---|
| Lead ID | Id | Keep verbatim (18-char, 00Q) | Unique |
| Last Name | LastName | `-` → null | 6,648 placeholders "No Name" (5 casings in the data, although the seed README says 3), kept. 2 leads have a blank Last Name and are imported as-is [SEED] |
| First Name | FirstName | `-` → null | 4,224 blank |
| Salutation | Salutation | Verbatim | Variants `Mr`, `Mr.`, `Mr..`, `Ms`, `Ms.`, `Mrs.` |
| Title | Title | Verbatim | Mixed case; 12 cells hold an email address |
| Company / Account | Company | Verbatim | `Business <hex>`; 1,444 leads share a name |
| Email | Email | Verbatim | `@example.invalid` |
| Phone / Mobile / Fax | Phone / MobilePhone / Fax | Verbatim | |
| Website | Website | Verbatim | |
| Street | Street | Verbatim | Equals `Street Line 1` on 21,622 rows; the other 6 contain lines 1 and 2 (no newlines in the data) |
| City | City | | |
| State/Province | State | | Identical to the "(text only)" column on all rows |
| Zip/Postal Code | PostalCode | | Always `00000` |
| Country | Country | | United States 21,620, Canada 7, blank 1 |
| Lead Status | Status | Verbatim | 10 values ([picklists.md](picklists.md)) |
| Rating | Rating | Verbatim, `-` → null | **Hot 7,111**, Cold 4,794, Warm 1,759, blank 7,964 |
| Lead Source | LeadSource | Verbatim | 22 values, 98 blank |
| Industry | Industry | | Blank on all rows |
| Annual Revenue | AnnualRevenue | `$457,000` → 457000 | 247 blank |
| No. of Employees | NumberOfEmployees | int; thousands separators removed (`1,250` → 1250) | 242 blank |
| Description | Description | | 13 non-blank (email addresses) |
| Converted | IsConverted | `feature included` → true | All false |
| Unread By Owner | IsUnreadByOwner | boolean | 21,627 true, 1 false |
| Lead Owner | OwnerId | Full name → User Id | All "Jon Santiago" |
| Created By | CreatedById | Full name → User Id | |
| Last Modified By | LastModifiedById | Full name → User Id | |
| Create Date | CreatedDate | `MM/DD/YYYY` → `YYYY-MM-DDT00:00:00Z` [DECISION: midnight UTC, because the seed has no time] | |
| Last Modified | LastModifiedDate | Same as Create Date | The newest is 2028-11-09 |
| Last Activity | LastActivityDate | date | Blank on all rows |

### Dropped

| Seed column(s) | Reason |
|---|---|
| Lead Record Type, Clean Status, Data.com Key, Company D-U-N-S Number, Created Month | Named out of scope by [BRIEF] or the seed README |
| Street Line 1/2/3 | Duplicates `Street` [SEED] |
| State/Province (text only), Country (text only) | Duplicates; identical on every row [SEED] |
| Lead Owner Alias, Created Alias, Last Modified Alias | Derived from the User record |
| Owner Role Name, Owner Role Display | Role hierarchy is out of scope [BRIEF]; blank on all rows |
| Email Bounced Reason, Email Bounced Date | Email is out of scope [BRIEF]; blank on all rows |
| Current Generator(s), Primary, SIC Code, Product Interest, Number of Locations | Custom fields, not standard Lead fields; blank on all rows [SEED]. [DECISION] Drop them, since the brief asks for standard fields |

The importer records the dropped columns in its log, so the drop is visible rather than silent.

## users-core.csv (9 rows, 53 columns)

| Seed column | API field |
|---|---|
| User ID | Id (005) |
| Username | Username |
| First Name / Last Name | FirstName / LastName |
| Full Name | Name. [SEED] One user's Full Name doesn't match First + Last; we keep the seed's Full Name as the display name, because owner names resolve against it |
| Alias | Alias |
| Email | Email (3 users share one) |
| Active | IsActive (`feature included`). 2 inactive users: Christy Sanchez and Andrew Larsen |
| Title | Title (blank on all) |
| Profile | ProfileName (text; profiles are out of scope) |
| Time Zone / Locale / Language | TimeZoneSidKey / LocaleSidKey / LanguageLocaleKey, as label text |
| Created Date, Last Modified Date, Last Login | CreatedDate, LastModifiedDate, LastLoginDate (`MM/DD/YYYY, hh:mm AM`, read as UTC) |
| Created By, Last Modified By | CreatedById, LastModifiedById, resolved by full name. Two users name "Tracy Hart", who is not a seed user, as Last Modified By; stored as null and reported by the build |
| *All other columns* (address, delegated approver, marketing/knowledge flags, password expiry, …) | Dropped. Not needed for ownership or the acting-user switch |

[DECISION] Inactive users can't be chosen as the owner of a new or reassigned record. They still display as the owner of existing records. That follows Salesforce's documented rule that inactive users can't own new records; it's from memory, not a page we read, and it's low risk.
