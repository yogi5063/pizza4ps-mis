# Pizza 4P's India — MIS Dashboard
## Complete Requirements, Data Contract & Build Specification
### Last Updated: March 2026 | Version: 1.0

---

## 1. PROJECT OVERVIEW

**Client:** Pizza 4P's India Private Limited
**Location:** BGL - IDN (Indiranagar, Bengaluru, Karnataka)
**Project:** Executive MIS Dashboard — single self-contained HTML file
**Built by:** Claude (Anthropic) in collaboration with YK (BCL India)
**Current Phase:** Phase 1 complete (shell + 9 pages), enhancements pending

**Purpose:** A fully interactive management information system dashboard that allows restaurant owners and management to make real-time operational, financial and strategic decisions from a single HTML file. No server required. All data embedded.

---

## 2. DESIGN SYSTEM — LOCKED

**Theme:** Hybrid — dark sidebar + light content area
**Primary colour:** #6958C2 (purple)
**Sidebar background:** #0f0e1a (near black)
**Content background:** #f7f7fb (light grey)
**Card background:** #ffffff
**Font — Headings:** Cormorant Garamond (serif, luxury)
**Font — Body:** DM Sans
**Font — Numbers:** DM Mono
**Border radius:** 10px cards, 6px small elements

**Category colour mapping (consistent across ALL pages):**
- Pizza → #6958C2 (purple)
- Food → #22c55e (green)
- Drink → #3b82f6 (blue)
- Dessert → #ec4899 (pink)
- Add-on → #f59e0b (amber)
- Retail → #8b5cf6 (violet)
- Other → #94a3b8 (grey)
- Comment → #cbd5e1 (light grey)

**Channel colour mapping:**
- Handy → #6958C2
- TTO → #22c55e
- POS → #f59e0b
- BYOD → #3b82f6

**Exchange rate base:** INR = 1 (all data stored in INR, converted at display time)

---

## 3. DATA FILES — COMPLETE CONTRACT

### 3.1 Revenue Files

**Source files uploaded:**
- 4PS_Revenue_working_of_Jan_26.xlsb — Jan 2026
- 4PS_Revenue_working_of_Feb_26.xlsb — Feb 2026

**Sheet to read:** Detail (Recalculate)_1st Jan (Jan) / Detail (Recalculate)_1st Mar (Feb)
**NOTE:** Feb sheet is misnamed as "Mar" — this is a source file issue, not a data error
**Header row:** Index 2 (row 3 in Excel)
**Data starts:** Row index 3

**Standard upload filename going forward:** upload_revenue_[Month]_[Year].xlsx
**Standard sheet name going forward:** Revenue_Data (user must rename before uploading)

**Column mapping (exact header names in source file):**
- Month → month label
- date → date (Excel serial float → convert to YYYY-MM-DD using datetime.date(1899,12,30) + timedelta(days=int(val)))
- order_time → time (Excel fraction x 24 = hour, e.g. 0.75 x 24 = 18 = 6:00 PM)
- id → order line ID (NOT invoice ID — do not use for invoice count)
- store_code → store code
- store_name → store name
- item_name → dish/item name
- category_name → category (Pizza/Food/Drink/Dessert/Add-on/Retail/Other/Comment)
- class_name → sub-class (Full Pizza/Half Pizza/Appetizer etc.)
- quantity → qty sold
- order_channel → channel (Handy/TTO/POS/BYOD)
- table_type → table type (Dine-in etc.)
- table_name → table name/number
- Status → Active / Cancelled
- GST Rate (POS) → GST rate (0, 0.05, 0.18)
- Amount\n[1] → gross amount before discount
- Discount\n[2] → discount amount
- Net amount\n[3]=[1] - [2] → NET REVENUE (primary revenue figure)
- Service charge\n[4] = [3] x 10% → service charge (10% of net)
- Total GST amount\n[7] = [5] + [6] → total GST
- Total amount\n[8] = [3] + [4] + [7] → total invoice value

**CRITICAL — Time conversion:**
- Excel stores time as fraction of 24 hours
- 0.75 x 24 = 18 → 18:00 → 6:00 PM
- Restaurant operating hours: 11:00 AM to 11:00 PM
- Always display as 12-hour format with AM/PM
- Early morning hours (1am-9am) should never appear

**CRITICAL — Invoice count:**
- The id column is ORDER LINE ID (one per item on a bill)
- TRUE invoice count = count of unique check_no/receipt_no per period
- Confirmed invoice counts: Jan 2026 = 7,192 | Feb 2026 = 6,819
- Avg bill Jan = Rs.2,470 | Avg bill Feb = Rs.2,497

**Revenue KPIs — Jan 2026 (verified):**
- Net Revenue (excl SC & GST): Rs.1,77,60,978
- Discount: Rs.1,75,978
- Service Charge: Rs.14,58,609
- GST: Rs.8,56,269
- Total Invoice Value: Rs.2,00,75,856
- Gross Revenue (Net + SC): Rs.1,92,19,587
- Invoices: 7,192 | Avg Bill: Rs.2,470 | Cancelled: 107 | Qty sold: 88,118

**Revenue KPIs — Feb 2026 (verified):**
- Net Revenue: Rs.1,70,24,192
- Discount: Rs.1,40,133
- Service Charge: Rs.13,18,584
- GST: Rs.8,15,106
- Gross Revenue (Net + SC): Rs.1,83,42,776
- Invoices: 6,819 | Avg Bill: Rs.2,497 | Cancelled: 130 | Qty sold: 84,692

---

### 3.2 COGS Files

**Source files uploaded:**
- Copy_of_4PS_IDN___COGS_report_in_Jan_2026.xlsx — Jan 2026
- Copy_of_4PS_IDN___COGS_report_in_Feb_2026.xlsx — Feb 2026

**Standard upload filename going forward:** upload_cogs_[Month]_[Year].xlsx
**Standard sheet name going forward:** COGS_Report (user must rename before uploading)
**Current sheet name in source files:** COGS Report (with space)

**CRITICAL — How COGS Summary is computed:**
DO NOT use the SUMMARY sheet values directly.
The SUMMARY sheet uses Pivot sales data sheet for Net Sales (which includes SC).
We build our own summary from COGS Report sheet directly.

**COGS Report sheet structure:**
- Header row: Index 6 (row 7 in Excel)
- Data starts: Index 7
- Grand total row: Index 4 (used for adjustment column totals)

**Column mapping (0-based index):**
- A(0) = Category_1
- B(1) = Category_2 — PRIMARY FILTER COLUMN
- C(2) = Group Item (ingredient group: Oil, Cheese, Flour etc.)
- D(3) = Sub group
- E(4) = Item No.
- F(5) = Item Description (ingredient name)
- G(6) = Min UOM (unit of measure)
- H(7) = Q'ty OB (opening balance qty)
- I(8) = Amt OB (opening balance amount)
- J(9) = Q'ty purchase
- K(10) = Amt purchase
- L(11) = Q'ty returned
- M(12) = Amt returned
- N(13) = Q'ty stock count (closing stock qty)
- O(14) = Amt stock count (closing stock amount)
- P(15) = Q'ty actual (actual consumed qty)
- Q(16) = Price
- R(17) = Amt actual — ACCOUNTING COG
- S(18) = Q'ty Std
- T(19) = Price std
- U(20) = COG std — STANDARD COG
- V(21) = Quantity Var
- W(22) = Amt var
- AC(28) = Amt (Other period) — ADJUSTMENT
- AG(32) = Amt (Food loss) — FOOD WASTAGE
- AI(34) = Amt (Training) — ADJUSTMENT
- AK(36) = Amt (Tasting) — ADJUSTMENT
- AO(40) = Amt (Gift) — ADJUSTMENT
- AQ(42) = Amt actual (Recalculate) — RECALCULATED ACTUAL COG

**CRITICAL — Category_2 filter:**
Filter Col B (Category_2) case-insensitively for: food, alcohol drink, non alcohol
(Excel SUMIFS is case-insensitive; Python must use .lower() comparison)
Data has "Alcohol Drink" (capital D) but formula uses "Alcohol drink" — must match case-insensitively

**COGS computation logic:**
- Accounting COG = SUM(col R) WHERE Category_2 IN (food, alcohol drink, non alcohol) case-insensitive
- Standard COG = SUM(col U) WHERE same filter
- Food Wastage = grand total row[32] (col AG)
- Other Period adj = grand total row[28] (col AC)
- Training adj = grand total row[34] (col AI)
- Tasting adj = grand total row[36] (col AK)
- Gift adj = grand total row[40] (col AO)
- Total Adjustment = Other Period + Training + Tasting + Gift
- Material COG = Accounting COG - Total Adjustment
- COG Variance = Material COG - Standard COG
- Store Variance = COG Variance - Food Wastage
- Gross Margin = Net Revenue - Accounting COG

**COG % denominator — TWO versions always shown:**
- Primary: % of Net Rev (excl SC) = COG / Net Revenue from Revenue file
- Secondary: % of Net Rev (incl SC) = COG / (Net Revenue + Service Charge)
- User toggles between the two on COGS page
- COGS file's own % uses Net Sales incl SC — our dashboard shows both with clear labels

**COGS KPIs — Jan 2026 (verified, excl SC denominator):**
- Accounting COG: Rs.71,16,220 (40.07%)
- Standard COG: Rs.54,50,092 (30.69%)
- COG Variance: Rs.16,04,847 (9.04%)
- Food Wastage: Rs.69,438 (0.39%)
- Store Variance: Rs.15,35,409 (8.64%)
- Total Adjustment: Rs.61,281
- Gross Margin: Rs.1,06,44,758 (59.93% GP)

**COGS KPIs — Feb 2026 (verified, excl SC denominator):**
- Accounting COG: Rs.69,09,572 (40.59%)
- Standard COG: Rs.52,95,645 (31.11%)
- COG Variance: Rs.15,18,732 (8.92%)
- Food Wastage: Rs.1,47,889 (0.87%)
- Store Variance: Rs.13,70,842 (8.05%)
- Total Adjustment: Rs.95,196
- Gross Margin: Rs.1,01,14,620 (59.41% GP)

**Other sheets used from COGS file:**
- Exploded_Parent (39,981 rows) — theoretical ingredient consumption per dish per date
  Columns: Date, Store, SAPCode, ItemCode, ItemName, ParentIngredient, IngredientName, QtySold, UoM, StdQty, YieldPct, StdCons
  Used for: per-dish theoretical vs actual COG variance, inventory reconciliation
- Cost Decomposition (357 rows) — dish-level standard cost and GP%
  Header row: Index 5
  Columns: Category, Sub category, Product code, Product name, Selling Price, COGs(std), %COGs, %GP, Quantity, Theoretical sales, Theoretical COGs
  Used for: Menu Engineering page
- Mapping (372 rows) — POS item codes to COGS item codes

---

### 3.3 Other Upload Files (Phase 3 — structure TBD when files are shared)

- upload_pl_[Month]_[Year].xlsx → Sheet: PL_Data
- upload_bs_[Month]_[Year].xlsx → Sheet: BS_Data
- upload_cfs_[Month]_[Year].xlsx → Sheet: CFS_Data

---

### 3.4 Pre-computed Data Files (on Claude filesystem)

- /home/claude/dashboard_data.json — 162KB embedded data payload
- /home/claude/build_data.py — Python script to rebuild from source Excel files
- /home/claude/pizza4ps_mis_phase1_final.html — Phase 1 built HTML (254KB)
- /mnt/user-data/outputs/Pizza4PS_MIS_Dashboard_Phase1.html — delivered output

**dashboard_data.json structure:**
- kpi: {2026-01: {nr, disc, sc, gst, qty, inv, avg_bill, canc}, 2026-02: {...}}
- daily: {2026-01|2026-01-01: {nr, disc, sc, gst, qty, dow, inv}}
- cat_ch: {2026-01|Pizza|Handy: {nr, qty}}
- heatmap: {2026-01|18|0: {nr, qty, inv}} — key = month|hour|dow
- items: {2026-01|Burrata Salad Pizza(75G): {nr, qty, disc, cat, cls}}
- hr_sum: {2026-01|18: {nr, qty, inv}}
- cogs: {2026-01: {full COGS summary + groups{} + ingredients[]}}
- menu: [{cat, item, price, std_cog, cog_pct, gp_pct, qty}] — 296 items
- months: [2026-01, 2026-02]
- cats: [Add-on, Comment, Dessert, Drink, Food, Other, Pizza, Retail]
- channels: [BYOD, Handy, POS, TTO]

---

## 4. KEY BUSINESS LOGIC — LOCKED DECISIONS

**Revenue definitions:**
- Net Revenue = Amount[1] - Discount[2] (excludes SC and GST)
- Gross Revenue = Net Revenue + Service Charge (what restaurant earns before GST) — NEW KPI CARD NEEDED
- Total Invoice Value = Net Revenue + SC + GST (what customer pays)
- COGS % = always calculated against Net Revenue (excl SC) as primary denominator
- Both % versions always shown: excl SC and incl SC

**Cancellation handling:**
- Active transactions only used for all revenue KPIs by default
- Status filter allows toggling to include cancelled
- Cancelled invoices tracked separately for Void & Cancellation Analysis page

**Invoice count:**
- TRUE invoice count from unique check_no/receipt_no
- Jan 2026: 7,192 | Feb 2026: 6,819
- Do NOT use order line ID count as invoice count

**Time display:**
- ALL times shown in 12-hour AM/PM format
- Restaurant hours: 11:00 AM to 11:00 PM
- Excel time fraction: multiply by 24 to get hour (0.75 -> 18 -> 6:00 PM)
- BUG IN PHASE 1: hours were displaying incorrectly — must fix

**Currency:**
- Base: INR. 15 currencies supported (see Section 10)
- Rates manually entered in Admin, saved in session
- One display currency at a time via topbar dropdown
- Every number everywhere converts instantly

**Inventory variance thresholds:**
- Over-consumption: >10% above standard = Red flag
- Under-consumption: >5% below standard = Amber flag
- Within range = Green OK

---

## 5. COMPLETE SIDEBAR STRUCTURE (FINAL — 25 pages)

OVERVIEW
  Daily Flash — morning briefing (NEW)

REVENUE INTELLIGENCE
  Overview
  Monthly Detail
  Comparison — REBUILT as full pivot
  Item Analysis — REBUILT with 6 sub-tabs
  COGS & Margin
  Targets & Budget (NEW)

FINANCIAL STATEMENTS
  P&L Statement (Phase 3)
  Balance Sheet (Phase 3)
  Cash Flow (Phase 3)

SALES ANALYTICS
  Sales Register (Phase 2)
  Sales vs COGS — Category Profitability Matrix (NEW)
  Product Analysis (Phase 2)
  Discount Analysis (NEW)
  Void & Cancellations (NEW)
  GST Summary (NEW)

OPERATIONS
  Peak Hours & Days — fix AM/PM (Phase 2)
  Table Performance (NEW)
  Top Invoices (NEW)
  Cover Analytics (NEW)

INVENTORY
  Inventory Intel — add Item-wise Consumption sub-tab
  Menu Engineering — enhanced

ADMIN
  Data Upload
  Month-End Checklist (NEW)

---

## 6. GLOBAL UI RULES (apply to every single page)

1. Scrollable main content — overflow-y: auto on main area, never clip content
2. Collapsible sidebar — hamburger toggle collapses sidebar to icon-only rail (48px), content expands to fill
3. Collapsible filter panel — every page has filters behind a Filters & Slicers button, collapsed by default. Shows active filter summary line when collapsed e.g. "Jan 2026 - Pizza - Excl SC"
4. Filter bar contents (every page): Year (multi-select), Month (multi-select), Country -> State -> City -> Location hierarchy, Category (multi-select slicer buttons), Channel (multi-select slicer buttons), Table Type, Status, Clear All
5. All filters fully interactive — any change instantly updates ALL KPIs, charts, tables. Nothing static.
6. Chart type toggle — every chart card has toggle: Bar | Line | Donut | Heatmap (relevant options per chart)
7. Visual category icons — consistent icon + colour per category across all pages
8. Currency converts everywhere — change topbar currency, every number updates instantly
9. Export on every table — CSV button on every table header
10. Alerts panel — Overview page shows auto-flagged anomalies

---

## 7. PAGE SPECIFICATIONS

### Daily Flash (NEW)
- Yesterday's revenue vs same day last week vs same day last year
- Yesterday's covers vs month average, avg bill vs month average
- Top 3 selling items yesterday (qty + revenue)
- Cancelled invoices yesterday
- Active alerts/anomalies panel
- One screen, no scrolling needed

### Overview (ENHANCED)
KPI Cards (8): Net Revenue (MoM), Gross Revenue = Net+SC (NEW), Total Invoices (MoM), Avg Bill (MoM), Total Discount (% of rev), Service Charge, GST Collected, Cancelled Orders
Charts: Daily trend line, Category donut, Channel bar, Peak hours bar (fixed AM/PM)
Alerts panel: auto-flagged anomalies at top of page

### Monthly Detail (ENHANCED)
Tab per loaded month. 8 KPI cards. Daily bar+invoice line, DOW bar, Category bar, Channel donut. Daily summary table. All filters interactive.

### Comparison (REBUILT — Full Pivot)
- Multi-select any months and years independently
- Grouping: Day | Week | Month | Quarter | Half Year | FY (Apr-Mar)
- Slicer panel: Category, Channel, Table Type, DOW, Hour Range — interactive toggle buttons
- Pivot table: rows = periods, columns = user-selected metrics
- Chart type: Line | Bar | Stacked Bar | Waterfall
- Thumb principle: every element responds to every filter instantly

### Item Analysis (REBUILT — 6 Sub-tabs)

Tab 1 — Revenue Ranking:
- Columns: #, Item, Category, Net Rev, Gross Rev, Qty, Avg Price, Discount, Rev Share %
- Rev Share % recalculates relative to FILTERED total (not full menu)
- Sort any column, search, Top 10/20/50/All filter

Tab 2 — Period Comparison:
- Select 2+ date ranges independently
- Each period = column group: Net Rev | Qty | Avg Price | Rev Share %
- Variance column: Rs. change + % change
- Colour coded: green=grew, red=declined, grey=new/discontinued

Tab 3 — Trend Analysis:
- Multi-select items from searchable dropdown
- Line chart: revenue trend across all months
- Secondary axis: qty sold
- 3-month rolling average option

Tab 4 — Category Deep Dive:
- Select category -> all items ranked within it
- Category KPIs: total rev, % of overall, MoM change, avg GP%
- Treemap OR ranked bar toggle
- Cannibilisation view

Tab 5 — New vs Existing Items:
- Tag: New (first appeared) | Existing | Discontinued
- Revenue contribution by tag, month by month

Tab 6 — Item Combo Analysis:
- Items that appear together on same invoice
- Top 10/20 pairs and triplets
- Drives upsell and combo offer strategy

### COGS & Margin (ENHANCED)
- Multi-period selector (not just one month at a time)
- Local toggles (persist across COGS + Inventory + Menu pages): % Base excl/incl SC, currency, period
- 8 KPI cards (see Phase 1 spec)
- Charts: COG% trend, Std vs Actual bar by category, Wastage trend, Store Variance trend, Waterfall, Ingredient group heatmap
- Tables: Group breakdown, Top variance ingredients
- Colour coding: Red = over-budget AND MoM deterioration, Amber = under 5%, Green = OK
- Validated badge: Validated OR Rs.X unreconciled in page header

### Targets & Budget (NEW)
- Input monthly revenue target per month
- Actual vs Target KPI with progress bar
- Projected month-end = current daily run rate x days remaining
- Days left counter, Target vs Actual chart

### Sales vs COGS — Category Profitability Matrix (NEW)
Table: Category | Sales | COGS | Gross Profit | GP% | Contribution% | Margin Bar
- Margin Bar: red <50%, amber 50-65%, green >65%
- Click row -> expands to dish level
- KPI cards: Best GP% cat, Worst GP% cat, Total GP, Blended GP%
- Charts toggle: Stacked bar | Waterfall | Treemap | Scatter
- GP% trend per category across all months

### Discount Analysis (NEW)
- By channel (fraud detection)
- By item (most discounted dishes)
- By day and hour (slow night patterns)
- MoM trend of discount as % of gross revenue
- Top 20 highest-discount invoices

### Void & Cancellation Analysis (NEW)
- Count and value by hour, channel, item
- Pattern detection: same item cancelled repeatedly
- MoM cancellation trend
- Jan: 107 | Feb: 130 cancelled

### GST Summary (NEW)
- Sales by slab: 0%, 5%, 18%
- CGST and SGST split
- HSN code wise summary
- GSTR-1 ready format, one-click CSV export

### Peak Hours & Days (Phase 2 — BUG FIX CRITICAL)
BUG: Time conversion wrong in Phase 1. Must fix: Excel fraction x 24 = hour.
0.75 x 24 = 18 = 6:00 PM — was showing as 6:00 AM.
Display range: 11:00 AM to 11:00 PM only. 12-hour AM/PM format throughout.

### Table Performance (NEW)
Three heatmaps:
1. Table x Hour — rows=tables, cols=hours, value=revenue
2. Table x Day of Week — rows=tables, cols=Mon-Sun
3. Hour x Day of Week — rows=days, cols=hours (gold/dark colour scheme)
Cell value toggle: Revenue | Invoice Count | Avg Bill | Covers
Colour scheme: Gold/Dark (primary) | Purple | Red-Green
Click cell -> drill down panel: invoices, top items, avg bill, channel
Summary row/column pinned at edges
Table ranking panel next to heatmap
Occupancy gap auto-flags
Full collapsible filter panel

### Top Invoices (NEW)
Top N selector: 10/20/30/50/100/custom
Table: Rank | Invoice No | Date | Day | Time | Table | Channel | Items | Net Rev | Discount | SC | GST | Total Bill
Click row -> line-item drill down
KPI cards: Highest bill, Avg of top N, Top N as % of total revenue
Charts: by DOW, by hour, by channel
Download: CSV + Excel with line items

### Cover Analytics (NEW)
- Covers per day (guests not invoices)
- Revenue per cover
- Lunch (11am-3pm) vs Dinner (6pm-11pm) split
- Table occupancy rate by hour
- Avg turn time per table (order_time to time_out columns)

### Inventory Intelligence (ENHANCED)
Sub-tab 1 — Variance Analysis (existing, fix Feb data):
- Both months must load (currently only Jan)
- All KPIs, charts, tables update on month filter change

Sub-tab 2 — Item-wise Consumption (NEW):
Table: Ingredient | Unit | Opening Stock | Purchased | Total Available | Consumed | Closing Stock | Waste | Cost | Waste%
- OB qty = col H, Purchase qty = col J, Stock count qty = col N, Actual consumed = col P
- Waste = Total Available - Consumed - Closing Stock
- Waste% = Waste / Total Available
- Cost = col R (Actual COG)
- Waste% colour: red if high, green if low
- Filter by group, month, waste threshold

### Menu Engineering (ENHANCED)
- Multi-month aggregation: Qty=sum, COG%=weighted avg
- Actual vs Standard COG toggle — changes COG%, GP%, quadrant, recommended price
- Variance column: Std vs Actual Rs. and %
- Click dot -> dish detail popup
- Quadrant labels: name + count + total revenue e.g. "Stars — 42 dishes — Rs.1.2Cr"
- Chart types: Scatter | Bubble | Bar | Heatmap
- Action flags: Promote more | Market harder | Reprice-COG drifted | Review pricing | Consider removing
- What-if pricing: change price -> GP% recalculates + dot moves on scatter live
- Validation Export Excel (4 sheets): Dish reconciliation, Ingredient reconciliation, Summary check vs COGS file, Audit trail
- Validated/Unreconciled badge on COGS page header

### Month-End Close Checklist (NEW)
Tickable checklist:
- Revenue reconciled with POS
- COGS uploaded and validated
- GST summary exported
- Inventory count done
- P&L uploaded
- Management report sent
Visual progress bar: X/6 complete

---

## 8. ALERTS & ANOMALY DETECTION (Overview page)

Auto-generated, no manual setup:
- Red: Revenue down >20% vs same day last week
- Red: Cancellations up >30% vs last week
- Red: COG variance breached threshold (>10% over standard)
- Amber: Avg bill dropped >10% vs last month
- Amber: Discount % up vs last month
- Green: Best revenue day in X weeks
- Green: GP% improvement vs last month

---

## 9. DATA UPLOAD ARCHITECTURE (3 options, all supported)

Option A — Browser Upload + Embed:
User drags Excel onto Admin -> dashboard reads in browser (SheetJS) -> Save & Embed button downloads new HTML with data baked in

Option B — JSON Folder (for internal server/shared drive):
HTML + /data/ folder with one JSON per month. Adding month = drop new JSON file.

Option C — Python Preprocessor (recommended for bulk):
Script: build_data.py (already built at /home/claude/build_data.py)
Run: python build_data.py
Reads all Excel files in folder, outputs single HTML with all months embedded

---

## 10. CURRENCY SYSTEM

15 currencies, manually entered rates in Admin:
- INR (Rs.) = 1 (base)
- VND (d) = 305
- USD ($) = 0.012
- EUR (€) = 0.011
- SGD (S$) = 0.016
- JPY (¥) = 1.78
- CNY (¥) = 0.086
- GBP (£) = 0.0095
- AUD (A$) = 0.018
- HKD (HK$) = 0.093
- MYR (RM) = 0.056
- THB (฿) = 0.41
- AED (AED) = 0.044
- CAD (C$) = 0.016
- KRW (₩) = 16.1

One display currency at a time. Topbar global dropdown. All numbers on all pages convert instantly.

---

## 11. VISUAL DESIGN REQUIREMENTS

Sidebar redesign needed (current is too plain):
- Proper emoji/SVG icons per nav item — colourful, distinct, meaningful
- More spacing, better hierarchy between sections
- Active item: brighter text + left accent bar or glow
- Brand circle: gradient or textured, not flat purple
- Width: 260px for icons + labels comfortably
- Subtle depth/gradient, not flat black

Category Icon Cards (like coffee/tea/juice reference image provided):
- Each category gets illustrated icon card with warm illustrated style
- Used as clickable filter buttons on Overview and Item Analysis
- Click category card = filter page to that category, highlights the card

Ingredient group icons in Inventory:
- Cheese, Meat, Seafood, Herbs, Tomato, Oil, Flour etc. each get distinct icons

Menu Engineering dish cards (toggle view):
- Table view OR card grid view
- Each card: category icon, GP% badge, quadrant, qty sold

Table Performance heatmap:
- Primary: Gold/Dark colour scheme (dark bg, yellow-gold intensity)
- Like reference image provided: dark cells = low revenue, bright gold = peak

---

## 12. RECONCILIATION NOTES

Revenue vs COGS Net Sales discrepancy:
- Revenue file Net Rev Jan: Rs.1,77,60,978 (excl SC)
- Revenue file Net Rev + SC Jan: Rs.1,92,19,587
- COGS file Net Sales Jan: Rs.1,92,28,870
- Gap: Rs.9,283 — small, rounding. Acceptable.
- Feb gap: Rs.1,50,807 — COGS file uses separate Pivot Sales Data sheet
- DECISION: Dashboard always uses Revenue file as source of truth for Net Sales denominator

COGS % discrepancy with source file:
- Source file SUMMARY shows 37.0% Jan (Net Sales incl SC denominator)
- Our dashboard shows 40.07% Jan (Net Rev excl SC denominator)
- Both shown side by side with clear labels

---

## 13. BUILD PHASES

Phase 1 (COMPLETE — enhancements pending):
Built: Overview, Monthly Detail, Comparison, Item Analysis, COGS & Margin, Inventory Intel, Menu Engineering, Admin, stub pages
File: Pizza4PS_MIS_Dashboard_Phase1.html (254KB)

Phase 1 enhancements to implement (ALL from this session):
1. Scrollable main content
2. Collapsible sidebar toggle
3. Collapsible filter panel on every page
4. Year + Country/State/Location hierarchy in filter bar
5. All filters fully interactive (currently static)
6. Fix AM/PM time conversion (critical bug)
7. Gross Revenue KPI card (Net Rev + SC)
8. Alerts panel on Overview
9. Comparison page -> full pivot rebuild
10. Item Analysis -> 6 sub-tabs
11. COGS -> multi-period support
12. Inventory -> fix Feb data + Item-wise Consumption sub-tab
13. Menu Engineering -> multi-month + Actual COG toggle + validation export
14. Premium sidebar redesign with proper icons
15. Visual category icon cards
16. Chart type toggle on every chart card

Phase 2:
Sales Register, Peak Hours & Days (fixed), Product Analysis, Discount Analysis, Void & Cancellations, GST Summary, Table Performance, Top Invoices, Cover Analytics, Daily Flash, Targets & Budget, Month-End Checklist, Sales vs COGS profitability matrix, browser upload engine, Save & Embed button

Phase 3:
P&L Statement, Balance Sheet, Cash Flow, Python build script documentation, JSON folder hosting setup

---

## 14. HOW TO RESUME IN A NEW CONVERSATION

1. Upload this file: PIZZA4PS_MIS_REQUIREMENTS.md
2. Say: "Read this requirements doc and resume the Pizza 4P's MIS dashboard build"
3. Claude will have full context — no need to re-explain anything
4. Also mention which phase/feature to work on next
5. Source Excel files available at /mnt/user-data/uploads/ if re-processing needed
6. Python build script at /home/claude/build_data.py

Key files to keep safe:
- PIZZA4PS_MIS_REQUIREMENTS.md (this file)
- build_data.py (data extraction script)
- Pizza4PS_MIS_Dashboard_Phase1.html (current built dashboard)
- All source Excel files

---

Document generated by Claude | Pizza 4P's India MIS Dashboard Project
All requirements, data contracts and design decisions captured as of March 2026
