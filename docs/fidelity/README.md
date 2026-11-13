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
| Navigation tab chevrons open no menu | Recent-item menus are out of scope (see `TRADEOFFS.md`) |
| The object header icon is the SLDS sprite glyph, not Salesforce's PNG | The sprite is the licensed SLDS asset; the shape and colour match |
| Account Name in the Convert dialog is read-only | The convert API names the account after the lead's Company |
| Choose Existing Contact and Opportunity are disabled stubs | Not in the brief's workflow |
| The Tasks tab is a standard list view, not the split view | Skipped by agreement for Phase 6b |
| Lightning shows "50+ items"; we show the exact count | AC2 needs the exact 7,111 |
| Field labels in our detail sections follow standard Sales layouts (two columns) | The org uses a single-column Starter layout |
| Lightning's record pages load with gray "stencil" placeholders; ours show the brand spinner | The spinner is the same component Lightning uses for list and modal loads |
| Org-only elements (trial banner, left icon rail, People Score, Consent, AI Summary, Agentforce, Slack, "Ask") are absent | Org-specific or out of scope |
