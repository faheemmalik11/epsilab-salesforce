# Phase 6b fidelity review

The measurements and plan are in `reference-study.md`. Option B was chosen: SLDS 1 (BSD) stays, and `src/web/src/cosmos.css` recreates the Cosmos look. Page-specific layout is in `src/web/src/app.css`.

## Screenshots

| Folder | What | Committed |
|---|---|---|
| `before/` | Our 13 surfaces before Phase 6b, 1440×900 | No (git-ignored: they show seed records) |
| `after/` | The same 13 surfaces after Phase 6b, 1440×900 | No (git-ignored: they show seed records) |
| `reference/` | The brief's Seller Home and read-only captures of a real org | No (git-ignored: org content and personal data) |

Recreate ours with `pnpm build && node scripts/capture-screens.mjs docs/fidelity/after`. The script builds its own database in a temporary folder, runs its own server on ports 3210/8290 with a fixed clock, and deletes everything afterwards. It never touches the development database.

**Dimensions do not match.** Our captures are 1440×900. The org was inspected in a maximized Chrome window, so its page area was 1854×871. Those captures were saved at 1568×737, and the window could not be resized. The brief's Seller Home image is 2048×1330, rendered about 1440 wide. Lightning uses fixed pixel sizes, so we compared measured values (font sizes, heights, radii, colours) rather than overlaying images.

## Measured in the org and applied

- **Text and colour:** the `system-ui` font at 13px, text #03234d, and the #f3f3f3 page background.
- **Header and navigation:**
  - The global header is 50px, with a pill-shaped search box.
  - Nav items are 13px/500. The active tab has a 3px #0250d9 underline. Hovering shows a 3px #001e5b underline with rounded ends and no background fill.
- **Cards:** white, with a 20px radius and no shadow; titles are 20px/400.
- **Buttons:**
  - Pill-shaped and 32px tall, in 13px/600 type.
  - Neutral: white, with a #5c5c5c border and #0250d9 text. On hover it turns #f3f3f3, lifts 1.5px and shows a #2e2e2e under-shadow.
  - Brand: #066afe. On hover it turns #0250d9, lifts 2px and shows a #002775 under-shadow.
  - Pressing settles the button back down. Movement uses `transform` and `box-shadow` transitions of 150ms ease-in-out, and focus shows a ring.
  - Disabled colours follow the Cosmos tokens.
- **Icons:** object icons are circles. Lead uses its Cosmos theme colour #06A59A, read from the org's object metadata. Account, Contact, Opportunity, Task and User match the standard sprite colours.
- **Loading:** brand-blue (#066afe) bouncing dots. Full-area loads sit on a 75% white overlay, as Lightning does.
- **Modal:**
  - 840px wide, with a 20px radius.
  - The close button is a 32px white circle above the top-right corner.
  - The dialog fades in over 0.1s. The backdrop (#2e2e2e at 80%, 5px blur) fades in over 0.4s.
- **Toast:** 8px radius, #acf3e4 background with #056764 text.
- **Path:**
  - Upcoming steps are #e5e5e5. Complete steps are #acf3e4 with a #056764 check.
  - The selected step is #032d60. The current but unselected step has a #022ac0 outline.
  - The Path sits full width in its own panel.
- **Inputs:** 32px tall, 8px radius, a #5c5c5c border, and a single chevron on picklists. Labels are 13px/600 #2e2e2e.

## Verified matches

Each row was compared against the real org at the same viewport (1854×927) and checked by Playwright where it's behaviour. Our 1440×900 captures are in `after/`, and the 1854×927 ones in `after-1854x927/`; both are local only. Run `node scripts/capture-screens.mjs <dir> --viewport 1854x927` to recreate them.

| Area | What matches | Test |
|---|---|---|
| Object tab menus | Chevron menu with "+ New …", Recent records (live), Recent lists (All and My), "Open … in New Tab". Measured placement, 8px radius, `shadow-2`, 34px items in 12px #2e2e2e, section dividers, #d6e6ff hover. Arrow keys, Home/End, Escape (focus returns to the chevron), Tab and a click outside close it | `interactions.spec.ts` "object tab menus" |
| Nav underline | Active tab: 3px #0250d9, kept while hovered. Hovered tab: 3px #001e5b | "nav underline" |
| Lead list inline edit | Pencil on hover; popover editor; Escape restores, Enter or a click outside keeps the value. Edited cell in #fbf3e0 at 600 weight. Docked Cancel / Save bar. Each row saved through PATCH; failed rows keep their edits, with an error icon and "We hit a snag." showing the API's message | "list inline edit" |
| Row actions | Edit, Delete (confirmation dialog), Change Owner (dialog), Edit Labels (marked stub) | "row actions" |
| Column menu | Wrap text / Clip text, with the current choice checked | "column menus" |
| List view picker | "Search lists..." box, List Views header, current view checked, stub views marked | "column menus" |
| Table | 32px #f3f3f3 header, 38px rows, #f3f3f3 row hover with a white hovered cell, #e5e5e5 row dividers, #c9c9c9 table bottom, transparent card border | Screenshots 02 and 15 |
| Record inline edit | Pencil switches the details panel to edit mode, with the field focused, changed fields highlighted, and a sticky Cancel / Save footer. Errors appear under the fields and in "We hit a snag." | "record inline edit" |
| Record header | Convert / Change Owner / Edit plus the overflow menu (New Event stub, Log a Call, New Task, Delete) | "record inline edit" |
| Docked composer | Log a Call and New Task open a window at the bottom right, with icon, title, minimize, close, fields, a Name / Related To pill and Save | "record inline edit", `lifecycle.spec.ts` |
| Activity timeline | "Upcoming & Overdue" (overdue dates in red), then month groups, each collapsible | `tests/unit/timeline.test.ts` |
| Seller Home Today's Tasks | Filter menu (Today's, Overdue, All Open) and a checkbox that completes the task | "Seller Home task filters" |
| Dialog close button | 32px circle 40px above the header, right-aligned; the same pixel position as the org at 1854px | `modals.spec.ts` (1280, 1440 and 1854px, all dialogs) |
| Table separators | Dividers only at the right edge of data column headers; none around row number, checkbox or actions | `modals.spec.ts` |
| Focus and cursor | No outline or ring after a mouse click anywhere; keyboard focus keeps a ring. Everything clickable shows the pointer; disabled controls don't | Manual check |
| Add Contact Roles | Two steps: a contact list (the opportunity's account first, "Search Contacts..." for all, Show Selected) with Cancel / Next, then Primary Contact (Optional) and a Contact / Role table with Back / Cancel / Save. One API call per role | `contact-roles.spec.ts` |
| Section bands | Detail and form sections collapse and expand from their title, with one chevron that turns | `record-layout.spec.ts` |
| Header and navigation | 592px white search pill with a #5c5c5c border; 40px bar, 32px tabs 3px apart, 12px label padding, 24px menu buttons, underline 3px below the tab. Measured in the org at 1854px | `shell.spec.ts` |
| List meta line | "N items • Sorted by X • Filtered by All leads - Rating • Updated a few seconds ago", as the org words it | `lead-list.spec.ts` |
| New / Edit dialog | One column inset under plain section bands; invalid fields pink (#fddde3) with a #b60554 border and icon; "We hit a snag." popover above an icon button left of Cancel, with field links. Measured in the org | `validation.spec.ts`, `record-layout.spec.ts` |
| Empty lists | A centred message under the column headers with an Add button; the org's wording for Accounts and Opportunities, "No items to display." when a filter or search matches nothing | `lead-list.spec.ts` |
| Lead record | Path always marks the current status; 48px rows with 13px values; email and phone as links | Measured in the org |
| Convert Lead | 1024px dialog with a 24px title; rows collapse and expand from a chevron, Account open and Contact and Opportunity collapsed to pills | Measured in the org |
| From the first pass | Theme tokens, buttons (hover lift, press, disabled), spinner, modal fade and blur, toast, Path colours, New / Edit modal, Convert dialog | See above |

## Surface by surface

| # | Surface | Reference | Result |
|---|---|---|---|
| 01 | Seller Home | Brief screenshot | Title and greeting; 3×2 grid of Build Pipeline (live ring and activity chips), My Goals, Today's Events, Today's Tasks (live), Recent Records (live) and Salesblazer, each with its footer button. Stub cards are marked |
| 02, 03 | Leads list, filter panel | Org Leads list | One rounded card with the gray header block, breadcrumb, 28px title, picker and pin, "Search this list...", toolbar icon buttons, checkbox column, header chevrons, 38px single-line rows and a row-action menu |
| 04 | New Lead | Org New Lead | 840px rounded modal, "* = Required Information", the Name compound field (Salutation, First Name, Last Name), section bands, Cancel / Save & New / Save |
| 05 | Lead record | Org Lead record | Icon, object label and 28px name on the page background; Convert / Edit pill group; full-width Path panel with "Mark Status as Complete"; rounded panels; section bands with chevrons; Name shown as one row; edit pencils |
| 06 | Convert Lead | Org Convert dialog | Account, Contact and Opportunity rows, each with Create New, "- OR -" and Choose Existing; the account matches list; the contact name pill; the opportunity name pill and "Don't create…"; Record Owner and Converted Status at the bottom |
| 07, 08 | Opportunity record, Contact Roles | Lead page measurements (no opportunities in the org) | Same header, Path and panels; Cosmos path colours; icon-button activity composer and timeline; related lists as cards |
| 09–11 | Account, Contact, Task records | Lead page measurements | Same components |
| 12, 13 | Opportunities and Accounts lists | Org lists | Same list card as Leads |

## Remaining differences

| Difference | Why |
|---|---|
| The logo is a neutral icon, not the Salesforce cloud; there are no utility icons at the right of the header | Salesforce branding isn't copied; setup, help and notifications are out of scope |
| Stub tabs and cards carry a small "Stub" badge | The brief requires stubs to be visibly marked |
| The object header icon is the SLDS sprite glyph, not Salesforce's PNG | The sprite is the licensed SLDS asset; the shape and colour match |
| Account Name in the Convert dialog is read-only | The convert API names the account after the lead's Company |
| Choose Existing Contact and Opportunity are disabled stubs | Not in the brief's workflow |
| The Tasks tab is a standard list view, not the split view | Skipped by agreement for Phase 6b |
| Lightning shows "50+ items"; we show the exact count | AC2 needs the exact 7,111 |
| Lightning's record pages load with gray "stencil" placeholders; ours show the brand spinner | The spinner is the same component Lightning uses for list and modal loads |
| "Recent records" in the nav menus are the most recently modified records, not the user's view history | There is no view tracking; changed records are real data |
| The Leads list header lacks Import, Add to Campaign, Send Email and Add to an Actionable List | Out of scope; leaving them out avoids a row of stubs |
| Lightning's composer Subject is a combobox of suggested subjects; the task form has Assigned To and Related To pickers | Our composer keeps Subject, Comments or Due Date, and the record it belongs to; the assignee is the acting user |
| Add Contact Roles is built from the Trailhead images, not measured in the org | The org has no opportunities, so the dialog could not be opened read-only. The toast wording and the disabled Next button with nothing selected are from memory of Lightning |
| Dialogs close on a backdrop click (with a discard prompt for unsaved changes) | Requested in review; the org ignores backdrop clicks on the Edit dialog |
| Our org comparison viewport is 1854×927, not 1440×900 | The org window was maximized and Chrome ignored resizing; our app was captured at both sizes |
| Org-only elements (trial banner, left icon rail, People Score, Consent, AI Summary, Agentforce, Slack, "Ask") are absent | Org-specific or out of scope |
