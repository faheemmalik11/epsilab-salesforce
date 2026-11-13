# Phase 6b interaction gap checklist

Written before the second round of Phase 6b work. Each control was used in a real Lightning org (Cosmos theme, viewport 1854×927). The inspection was read-only: every edit was cancelled, and composers and menus were closed without saving. The brief stays the source of truth. A control outside its scope keeps a visibly marked stub, never fake behaviour.

**Status key:** **Fix** = build or correct now. **Stub** = keep it visible and marked. **OK** = already matches.

Result: every **Fix** row below is now implemented. Each is covered by `tests/e2e/interactions.spec.ts`, except the visual rows, which are checked in the screenshots. The details are in `README.md`, under Verified matches.

## Navigation

| Control | Salesforce | Ours before | Action |
|---|---|---|---|
| Object tab chevron (Leads, Accounts, Contacts, Opportunities, Tasks) | Opens a menu under the chevron. It has "+ New Lead", a **Recent records** section, a **Recent lists** section, and "Open … in New Tab". The menu is white with an 8px radius and `shadow-2`, with 4px vertical padding. Items are 34px tall with 8px 12px padding, in 12px #2e2e2e text. Section headers are 12px/600 with a #c9c9c9 divider above. Hovering focuses an item: #d6e6ff background, a 2px #001e5b inset ring and a 6px radius. Escape, a click outside and the arrow keys all work | Decorative chevron that opens nothing | **Fix:** working menu with New, recent records from our data, our list views, and the keyboard and close behaviour |
| "Open … in New Tab" | Opens the current page in a console tab | None | **Fix:** open the object's list in a new browser tab |
| Stub tabs (Reports, Dashboards…) | Real tabs | Marked stub pages | **Stub** (kept) |

## Lead list view

| Control | Salesforce | Ours before | Action |
|---|---|---|---|
| Card | `slds-card_boundary` with a **transparent** border and a 20px radius | Visible gray border | **Fix:** remove the border |
| Row hover | The row turns #f3f3f3 and the hovered cell white, with a pencil at the right of editable cells | Whole row light blue, no pencil | **Fix** |
| Inline edit | The pencil opens a popover editor over the cell, with a combobox for picklists and an input for text. Leaving the cell marks it edited: #fbf3e0 background, 600 weight and a 2px #001e5b inset ring. A docked footer then shows centred **Cancel** and **Save**. Cancel restores the values; Save writes every edited row | None | **Fix:** same flow, through the existing PATCH API. Failed rows stay edited and show the API's error messages |
| Row action menu | Edit, Delete, Change Owner, Edit Labels | Edit only | **Fix:** Edit, Delete (with confirmation), Change Owner (modal). Edit Labels becomes a marked **Stub** (labels are out of scope) |
| Column header | Clicking the label sorts. The chevron opens a menu with **Wrap text** and **Clip text** (the checked one is current) | The chevron did nothing | **Fix:** working Wrap / Clip menu per column |
| Header cells | #f3f3f3, 32px tall, 13px/600 #5c5c5c, padding 8px 4px 8px 8px | Close | **OK**, padding adjusted |
| List view picker | "Search lists..." box, a **List Views** header, the views, and the current view highlighted | No search box | **Fix:** search box and header |
| Search this list, sort, filters, refresh | Work | Work | **OK** |
| New button | Opens the New form | Same | **OK** |
| Import, Add to Campaign, Send Email, Add to an Actionable List | Shown in the org | Not shown | Out of scope, left out to avoid noise (the trial's Starter org also shows them only for Leads) |
| Pin list view, List View Controls, Display as, Edit List, Charts | Work | Marked stubs | **Stub** (kept) |

## Lead record page

| Control | Salesforce | Ours before | Action |
|---|---|---|---|
| Header actions | Convert, Change Owner and Edit pill group, plus an overflow menu (New Event, Log a Call, New Task, Delete) | Convert and Edit only | **Fix:** Change Owner, and the overflow with Log a Call, New Task and Delete; New Event a marked **Stub** |
| Detail pencil | Switches the whole details panel into edit mode, with a sticky footer of Cancel and Save. Changed fields are highlighted, and errors show under the fields | Opened the Edit modal | **Fix:** real inline edit mode on the same API |
| Path | Steps, then "Mark Status as Complete" or "Mark as Current Status" | Same | **OK** |
| Activity composer | Icon buttons (email, event, call, task), each opening a **docked composer** window at the bottom right. The window has a header with an icon, title, minimize and close; the fields; and Save | Inline form under the buttons | **Fix:** docked composer for Log a Call and New Task; Email and Event stay marked **Stubs** |
| Activity timeline | "Upcoming & Overdue" section, then month groups | One flat list | **Fix:** grouped timeline |

## New / Edit Lead, Convert Lead

| Control | Salesforce | Ours before | Action |
|---|---|---|---|
| New / Edit modal | 840px, "* = Required Information", Name compound field, Cancel / Save & New / Save | Matches | **OK** |
| Convert dialog | Three rows with Create New, "- OR -" and Choose Existing; account search and matches | Matches | **OK**. Choose Existing Contact and Opportunity stay marked **Stubs** |

## Seller Home

| Control | Salesforce | Ours before | Action |
|---|---|---|---|
| Today's Tasks | Card with a filter dropdown, and a checkbox per task that completes it | List only | **Fix:** working filter menu (today, overdue, all open) and the completion checkbox |
| My Goals settings, Today's Events, Salesblazer | Org features | Marked stubs | **Stub** (kept) |
| Build Pipeline, Recent Records | Live | Live | **OK** |

## Accounts, Contacts, Opportunities, Contact Roles, Tasks

| Control | Salesforce | Ours before | Action |
|---|---|---|---|
| List views, row actions, inline edit, nav menus | As for Leads | As before | **Fix:** the same shared components |
| Record overflow menu and inline edit | As for Leads | As before | **Fix:** shared |
| Opportunity stage path and Closed dialog | Mark Stage as Complete; Select Closed Stage opens a dialog | Same | **OK** |
| Add Contact Roles | Pick contacts, then set the Role and Primary | One contact at a time | **OK** for the brief; noted as a remaining difference |
| Tasks split view | Split view | Standard list | Skipped by agreement (see `TRADEOFFS.md`) |

## Visual corrections found in the same pass

| Item | Salesforce | Action |
|---|---|---|
| List card border | Transparent | **Fix** |
| Row hover | #f3f3f3 row and white cell | **Fix** |
| Activity form box, filter item boxes | Plain, no inner boxes | **Fix:** remove the extra borders |
| Menus | No border; `shadow-2` and an 8px radius | **Fix** |
