# Phase 6b reference study: Salesforce Lightning vs localhost

Read-only study of a real Salesforce org (Lightning Experience, Sales app) in Chrome on 2026-11-13, compared with our "before" screenshots in `docs/fidelity/before/`. Nothing in the org was created, edited or converted. The New Lead and Convert Lead dialogs were opened for inspection only and closed without saving.

**Primary reference for Home:** the Seller Home screenshot in the brief (`Screenshot 2026-11-12 at 3.05.07 PM.png`, 2048×1330). The org's own Home is a trial onboarding page and isn't used.

**Not copied (org-specific):** the trial banner ("Don't wait: Save 60%…"), the Starter edition's left icon rail, People Score, Consent Status, AI Summary, Agentforce, Slack, the "Ask" button, onboarding pop-ups, and the org's Japanese status values.

**Viewport:** the Chrome window was maximized (1854×927 page area), so resizing to 1440×900 had no effect. Lightning's measurements below are fixed pixel values, so they apply at 1440. Final before/after shots of our app are taken at 1440×900.

## Root cause of most differences

The org runs **SLDS 2 with the Cosmos theme**. Our GUI uses `@salesforce-ux/design-system` 2.264, which renders **SLDS 1** (brand #0176d3, 4px radii, square buttons, Arial-like text). SLDS 2 is published separately as `@salesforce-ux/design-system-2` (2.264.2), with a bundled Cosmos theme at `dist/css/bundled/slds2.cosmos.css`. It is CSS only; icons still come from the current package.

Licence: SLDS 1 is BSD-3-Clause. SLDS 2 is under Salesforce Terms of Use: free use and redistribution, but with an indemnification clause. **This needs the user's decision** (see Plan, step 1).

## Measured design values (Cosmos)

| Element | Real Lightning | Ours (before) |
|---|---|---|
| Font | `system-ui` stack, 13px base, line-height 19.5px | SLDS 1 stack (Arial-like) |
| Body text colour | #03234d (navy) | #181818 / #080707 |
| Secondary text | #5c5c5c | #444 / #706e6b |
| Page background | #f3f3f3 | white body, gray only in headers |
| Global header | 50px, white, padding 8px; search 592×32 pill (radius 240px), placeholder #5c5c5c | 50px but sits on the nav; square search box |
| Nav bar | 40px, white, padding 4px 0; app name 20px/400; items 13px/500 #03234d, 32px tall, hover pill radius 12px; active item #0250d9 with a **3px #0250d9 underline** | items 13px/400 blue; active item has a top bar, no underline; stub badges crowd the bar |
| Cards and panels | white, **radius 20px**, no shadow, 1px transparent border; title 20px/400 #03234d | radius 4px, gray border, title 16px bold |
| Buttons | **pill** (radius 240px), 32px tall, neutral = white with 1px #5c5c5c border and #0250d9 13px/600 text; brand = #066afe with white text; groups join into one pill | square-cornered, #0176d3 |
| Inputs and dropdowns | 32px, radius 8px, 1px #5c5c5c border | radius 4px, #c9c9c9 border |
| Field labels | 13px/600 #2e2e2e | 12px/400 #444 |
| Record header | on #f3f3f3, padding 16px; object label 13px #444; name **28px/400** #03234d | white box with highlights panel; name 20px/700 |
| Path | 32px steps; current #032d60 with white text; upcoming #e5e5e5 with #2e2e2e text; first step rounded left (32px); action button #066afe pill 30px | SLDS 1 path (#0176d3 current, green complete) |
| Detail fields | label 13px/600 #2e2e2e above value 13px #181818; row 48px with 1px #c9c9c9 bottom line; inline-edit pencil on the right | 12px label, larger value, no pencil |
| Section header | 32px band, #f3f3f3, radius 8px, 20px/400 text with a collapse chevron | gray band, square, 16px |
| Modal | 840px wide, radius 20px; title 20px/400 centred with a divider; footer frosted white, padding 12px 16px; close button a white circle outside the top-right corner | 1296px wide ("large"), square |
| List view panel | one white card, radius 20px, holding header and table; header block #f3f3f3, padding 16px 16px 12px | header box and table as separate blocks |
| List title | "Leads" breadcrumb 13px #5c5c5c above "All Open Leads" 28px/400 with a picker triangle and a pin button | 13px label above 18px bold title |
| List toolbar | "Search this list…" 240×32 (radius 8px) plus icon buttons 44×32 pills (list controls, display as, refresh, edit columns, charts, filter) | filter icon button only |
| Meta line | 12px #5c5c5c: "N items • Sorted by X • Filtered by Y • Updated a few seconds ago" | same text, 12px |
| Table | header 32px, 13px/600 #5c5c5c on #f3f3f3, each header has a dropdown chevron; rows 38px, cell padding 8px; links 13px/500 #0250d9; row numbers 12px #5c5c5c; checkbox column; row-action chevron column | header 40px, rows 48px (phone wraps), no checkbox or chevrons |

## Surface by surface

### 1. Seller Home (brief screenshot) vs ours: **largest gap**

Reference: "Seller Home" title (24px) with "Good afternoon, <name>. Let's get selling!" beside it; a 3×2 grid of equal rounded cards:
1. **Build Pipeline:** "Leads owned by me and created in the last 30 days", a ring with the lead count, and three status chips (Upcoming Activity, Past Activity, No Activity); footer "View Leads".
2. **My Goals:** illustration and a "Set goals" button.
3. **Today's Events:** illustration, "Looks like you're free and clear the rest of the day.", footer "View Calendar".
4. **Today's Tasks:** a list or the empty illustration "Nothing due today…", footer "View All".
5. **Recent Records:** object icon plus record name, footer "View All".
6. **Salesblazer:** an article card, footer "Join the Community".

Ours: two plain tables ("My Open Tasks", "Recently Updated Opportunities") with no title row, greeting or grid.

### 2. Global header and Sales navigation

Missing or different: the Salesforce cloud logo (we show an opportunity icon; we must not use the Salesforce logo, so a neutral mark stays); pill search; right-side utility icons; nav items in navy weight 500 with a 3px underline; per-item dropdown chevrons; the pencil "edit nav" icon at the far right. Our Stub badges inside every nav item make the bar busier than Lightning's.

### 3. Leads list view

Structure matches (picker, count line, sortable table) but the styling doesn't: no white rounded card, a small title, a single square "New", no "Search this list…", no toolbar icon group, no checkbox column, no header chevrons, rows too tall because phone numbers wrap.

### 4. Record pages (Lead, Account, Contact, Opportunity, Task)

The real header is lighter: icon, small object label and a 28px name on the gray background, with a pill button group. In the reference org, highlight fields aren't shown in a separate band for this Starter layout; on standard Sales layouts they appear under the name as a compact row (Trailhead "Lead record tabs" image). The Path sits in its own white rounded panel with Cosmos colours. The body is white rounded panels with collapsible 20px section bands, 13px/600 labels and inline-edit pencils.

The org has no Opportunity, Account, Contact or Task records, so those pages couldn't be inspected read-only. They share the same header, panel, Path and related-list components, so they follow the Lead page's measurements plus the Trailhead references in `docs/reference/gui-surfaces.md`.

### 5. New/Edit modal

Real: 840px, radius 20px, "* = Required Information" at top right, collapsible section bands, the **Name compound field** (Salutation, First Name, Last Name under one required "Name" label), footer "Cancel | Save & New | Save". Ours: 1296px wide, square, Name split into separate fields, no "Save & New". (Our two-column field layout matches standard Sales layouts; the org's single column is its Starter layout.)

### 6. Convert Lead dialog: **large structural gap**

Real: three collapsible rows (Account, Contact, Opportunity). Each row has the "Create New …" radio and a boxed form on the left, "- OR -" with a vertical divider in the middle, and the "Choose Existing …" radio with a search box and an "N Account Matches" area on the right. Contact shows the name as a pill. Opportunity has "Don't create an opportunity upon conversion" under the name. A bottom row holds Record Owner (a user pill) and Converted Status. Ours: stacked fieldsets with the existing-account lookup appearing below the radios.

### 7. Opportunity Path, Contact Roles and activity

Path: see the measured values; ours uses SLDS 1 colours (green complete steps) and truncates labels because our Path shares the column with the Activity panel. In the reference, the Path spans the full page width above the panels. Activity: the real composer is a row of rounded icon buttons (email, event, call, task) above the timeline; ours is a tab strip. Related lists are white rounded cards with 20px titles.

### 8. Tasks

The Tasks tab in Lightning is a **split view** (a narrow list on the left, the selected task's detail on the right), not a table. Ours is a standard list view.

## Differences ranked by impact on the AC7 screenshot review

| # | Difference | Surfaces | Impact |
|---|---|---|---|
| 1 | SLDS 1 instead of SLDS 2 Cosmos (font, colours, radii, pill buttons, inputs) | All | Very high: affects every screen |
| 2 | Seller Home layout | Home | Very high: the brief's only screenshot |
| 3 | Nav bar: underline, weights, chevrons, quieter stub marking | All | High |
| 4 | Record page structure: header, full-width Path panel, rounded panels, section bands, label style | Lead, Opportunity, Account, Contact, Task | High: main workflow surfaces |
| 5 | Convert Lead dialog: three-row Create New / OR / Choose Existing layout | Lead conversion | High: core workflow surface |
| 6 | List view card, title size, toolbar, search box, checkbox and header chevrons, row height | All list views | Medium-high |
| 7 | Modal width 840px, Name compound field, "* = Required Information", Save & New | New/Edit | Medium |
| 8 | Activity composer as icon buttons; timeline styling | Record pages | Medium |
| 9 | Tasks split view | Tasks | Low-medium: not on the brief's main workflow |

## Proposed Phase 6b plan

The order follows the impact ranking. Each step keeps every `data-testid` and accessible name the Playwright tests rely on, and is verified by the full regression suite.

1. **Theme.** Decided: Option B (approved for Phase 6b).
   - **Option A (recommended for fidelity):** switch the stylesheet to `@salesforce-ux/design-system-2`'s `slds2.cosmos.css`, keeping icons from the current package. It gives the exact Cosmos tokens with almost no custom CSS. It needs acceptance of Salesforce's Terms of Use, including the indemnification clause, since the client will own and distribute the code.
   - **Option B:** stay on BSD SLDS 1 and override its styling hooks (`--slds-g-*` CSS variables) with the measured Cosmos values above, plus a small override layer for radii and pill buttons. Permissive licence, but more custom CSS and an approximate match.
2. **Shell:** nav underline and weights, a dropdown chevron per object tab, the pill search box, right-side utility icon area (inert, marked), and stub tabs marked by a lighter "(not available)" treatment instead of a badge per item. Neutral logo kept.
3. **Seller Home:** rebuild the 3×2 grid from the brief: Build Pipeline (live lead count ring and activity chips from our own data), Today's Tasks (live), Recent Records (live, recently modified), and My Goals, Today's Events and Salesblazer as visibly marked stubs, using SLDS illustration markup with no copied artwork.
4. **Record pages:** header restyle (object label plus 28px name and pill button group), full-width Path in its own panel above the two columns, rounded panels, collapsible section bands, Cosmos field labels and inline-edit pencils that open the existing Edit modal.
5. **Convert Lead dialog:** rebuild into the three-row Create New / OR / Choose Existing layout, with account matches listed on the right. Same API call and behaviour.
6. **List views:** one rounded card holding header and table, 28px title with picker and pin (pin marked as stub), "Search this list…" (wired to the existing `contains` query on Name), toolbar icon buttons (refresh live, the rest marked), a checkbox column, header chevrons (sort), single-line rows.
7. **Modal:** 840px, "* = Required Information", the Name compound field group, Save & New.
8. **Activity:** icon-button composer (Log a Call and New Task live; Email and Event marked), Cosmos timeline.
9. **Tasks split view:** only if time allows; otherwise recorded in `TRADEOFFS.md`.

**Verification:** `scripts/capture-screens.mjs` re-shoots the 11 surfaces at 1440×900 into `docs/fidelity/after/`; each is compared against its reference (the brief's screenshot for Home, the measured org pages and Trailhead images for the rest), and remaining differences are listed in this folder. Then the full regression runs: Vitest, Playwright locally and against the `linux/amd64` container, smoke, and reset.
