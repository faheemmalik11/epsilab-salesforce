# GUI surfaces

This fills the brief's missing surfaces list. The list comes from the six workflow steps [BRIEF], the Seller Home screenshot in the brief [BRIEF], Trailhead's Lightning walkthroughs [SF-DOC], and SLDS blueprints. Target: Lightning Experience, desktop width [BRIEF].

The screens are ordered by acceptance-criterion priority: **criteria #2, #3 and #5 first**, the criterion #7 fidelity review second.

| # | Surface | Needed for | Key elements | SLDS blueprints (v1 docs) |
|---|---|---|---|---|
| 1 | App shell | All | Global header (logo, search box as a stub, acting-user dropdown), Sales app navigation bar (Home, Leads, Accounts, Contacts, Opportunities, Tasks), stub tabs (Reports, Dashboards, Campaigns, Cases, Forecasts) marked "Not available in this trial" [BRIEF: visible stubs] | global-header, global-navigation |
| 2 | **Leads list view** | #2, #3 | View picker (All Leads, …), "N items · Sorted by … · Filtered by …", sortable column headers, filter panel (Rating = Hot), New button, infinite scroll | page-headers (object home), data-tables, panels (filter) |
| 3 | New/Edit record modal (all objects) | #3, #5 | Sections from the page layout, required-field markers, inline field errors, page-level error popover with the service error text | modals, form-element, combobox, lookup |
| 4 | **Lead record page** | #3 | Highlights panel (Name, Title, Company, Phone, Email, Status), Path (Lead Status) with "Mark Status as Complete", buttons Edit, **Convert**, Activity / Details tabs, activity composer (**Log a Call**, New Task), activity timeline | page-headers (record home), path, tabs, activity-timeline |
| 5 | **Convert Lead modal** | #3 | Account (create new from Company / choose existing, with name matches listed), Contact (always created from the lead; choosing an existing contact isn't built, see `TRADEOFFS.md`), Opportunity (name, "Don't create an opportunity upon conversion"), Record Owner, Converted Status, Convert → success screen with the three records | modals, radio-group, lookup |
| 6 | **Opportunity record page** | #3, #5 | Highlights (Account, Close Date, Amount, Owner), Path (Stage) with "Mark Stage as Complete" / "Mark as Current Stage", close dialog (Closed Won / Closed Lost), Details (Amount, Next Step, Probability, Forecast Category), Related: **Contact Roles** (Add Contact Roles → role picker → Save), activity composer and timeline | path, modals, data-tables (related list), cards |
| 7 | Account record page | #3 (direct path) | Highlights, Details, Related: Contacts, Opportunities; activity timeline | page-headers, cards |
| 8 | Contact record page | #3 | Highlights, Details, Related: Opportunities (via contact roles); activity timeline | page-headers, cards |
| 9 | List views for Accounts, Contacts, Opportunities, Tasks | #3 (navigation) | Same component as #2 with "All X" views | data-tables |
| 10 | Home (Seller Home) | #7 | The brief's screenshot: Today's Tasks and Recent Records are **live**. Build Pipeline, My Goals, Today's Events and Salesblazer cards are **visible stubs** | cards, illustration |
| 11 | Converted lead view | #3 | Read-only lead with links to the converted Account, Contact and Opportunity | page-headers, cards |

Out of scope [BRIEF]: Chatter tab, Intelligence View, Kanban, mass list actions beyond the required ones, email composer, events and calendar, mobile.

[DECISION] **Change Status / Change Owner** mass actions on the list view come after the criteria. If time runs short, they become visible stubs.

## Reference screenshots (public Trailhead images, linked rather than copied)

| Surface | Image | Page |
|---|---|---|
| Lead record tabs | https://res.cloudinary.com/hy4kyit2a/f_auto/fl_lossy/q_70/learn/modules/leads_opportunities_lightning_experience/create-and-convert-leads-lightning/images/39e9dea2127aedc1863cc0bc73aaac23_kix.l9sp3wfhe24f.png | Create and Convert Leads |
| Leads list view | https://res.cloudinary.com/hy4kyit2a/f_auto/fl_lossy/q_70/learn/modules/leads_opportunities_lightning_experience/create-and-convert-leads-lightning/images/d7e699d4cea5262934f4d2f1d2d1b80a_kix.sgzxty9r2lo2.png | same |
| New Lead form | https://res.cloudinary.com/hy4kyit2a/f_auto/fl_lossy/q_70/learn/modules/leads_opportunities_lightning_experience/create-and-convert-leads-lightning/images/a86e713e80920e6d27cb5dcb2bd1cec2_kix.srgo4cw9knnt.png | same |
| **Convert Lead dialog** | https://res.cloudinary.com/hy4kyit2a/f_auto/fl_lossy/q_70/learn/modules/leads_opportunities_lightning_experience/create-and-convert-leads-lightning/images/93d9a1ef54b68d1e159bb1bec6138999_kix.sv56s936jucs.png | same |
| New Opportunity form | https://res.cloudinary.com/hy4kyit2a/f_auto/fl_lossy/q_70/learn/modules/leads_opportunities_lightning_experience/work-your-opportunities/images/97dae2c6d61d82d89624456eb4e8f5c9_kix.ww01ejzadrgk.png | Work Your Opportunities |
| Add Contact Roles | https://res.cloudinary.com/hy4kyit2a/f_auto/fl_lossy/q_70/learn/modules/leads_opportunities_lightning_experience/work-your-opportunities/images/eb760d77c7a8ed0b2640f32f3542ffa3_kix.e1zh5pjhdl4i.png | same |
| Contact Role picker | https://res.cloudinary.com/hy4kyit2a/f_auto/fl_lossy/q_70/learn/modules/leads_opportunities_lightning_experience/work-your-opportunities/images/6a30f929e37110dfb6f25aa1694ef56b_kix.mxqvtt5bscgw.png | same |
| List view filter icon | https://res.cloudinary.com/hy4kyit2a/f_auto/fl_lossy/q_70/learn/modules/leads-list-view-step-by-step/work-with-lead-list-views/images/05bbbc80203a88cbdabd7123a989e3bc_kix.td92c3xnglur.png | Work with Lead List Views |
| List view controls | https://res.cloudinary.com/hy4kyit2a/f_auto/fl_lossy/q_70/learn/modules/leads-list-view-step-by-step/work-with-lead-list-views/images/42e10a1fbc8ecdb1c62c4140d517669b_kix.lxehjdhplj0o.png | same |
| Seller Home | In the brief (`Screenshot 2026-11-12 at 3.05.07 PM.png`) | Notion |

These image URLs were taken from the Trailhead page source; they haven't been opened or verified yet. They aren't downloaded into the repo, which avoids redistributing Salesforce's images.

## SLDS

- Package: `@salesforce-ux/design-system` 2.264.3 (BSD-3-Clause). It provides the CSS, icons and fonts, so the screens match Lightning without copying Salesforce's app code.
- Blueprint docs: https://v1.lightningdesignsystem.com/components/ (v1 docs, still online). The new SLDS 2 site is https://www.lightningdesignsystem.com/.
