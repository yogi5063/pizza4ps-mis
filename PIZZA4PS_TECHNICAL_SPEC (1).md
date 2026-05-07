# Pizza 4P's India — MIS Dashboard
## Technical Specification for Claude Code
### Version 1.0 | March 2026
### READ THIS ENTIRE FILE BEFORE WRITING ANY CODE

---

## WHAT YOU ARE BUILDING

A full-stack web application MIS Dashboard for Pizza 4P's India restaurant (Indiranagar, Bengaluru). This is a commercial product that will be sold to restaurant clients. The dashboard allows restaurant owners and management to upload their monthly Excel sales and COGS files and get instant visual analytics.

**The most important files to also read:**
- `PIZZA4PS_MIS_REQUIREMENTS.md` — complete page-by-page feature specs, data contracts, verified numbers
- All source Excel files in the uploads folder (for reference only — do not hardcode their data)

---

## TECH STACK — EXACTLY THIS, NO DEVIATION

### Frontend
- **React 18** with Vite
- **Tailwind CSS** for styling
- **Chart.js 4** for all charts
- **SheetJS (xlsx)** for Excel file parsing in browser
- **React Router** for page navigation
- **Zustand** for global state management
- **Font:** Cormorant Garamond (headings) + DM Sans (body) + DM Mono (numbers) — Google Fonts

### Backend
- **Python FastAPI** — REST API
- **SQLite** for development (easy, no setup) — swap to PostgreSQL for production
- **SQLAlchemy** ORM
- **Pandas + openpyxl + pyxlsb** for server-side Excel processing
- **JWT** for authentication (simple username/password for now)
- **Uvicorn** as ASGI server

### Project Structure
```
pizza4ps-mis/
├── frontend/                 # React + Vite app
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── KpiCard.jsx
│   │   │   ├── ChartCard.jsx
│   │   │   ├── DataTable.jsx
│   │   │   ├── FilterBar.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Topbar.jsx
│   │   │   ├── HeatmapCell.jsx
│   │   │   └── UploadZone.jsx
│   │   ├── pages/            # One file per dashboard page
│   │   │   ├── DailyFlash.jsx
│   │   │   ├── Overview.jsx
│   │   │   ├── MonthlyDetail.jsx
│   │   │   ├── Comparison.jsx
│   │   │   ├── ItemAnalysis.jsx
│   │   │   ├── CogsMargin.jsx
│   │   │   ├── Targets.jsx
│   │   │   ├── SalesVsCogs.jsx
│   │   │   ├── DiscountAnalysis.jsx
│   │   │   ├── VoidsCancels.jsx
│   │   │   ├── GstSummary.jsx
│   │   │   ├── TablePerformance.jsx
│   │   │   ├── TopInvoices.jsx
│   │   │   ├── CoverAnalytics.jsx
│   │   │   ├── InventoryIntel.jsx
│   │   │   ├── MenuEngineering.jsx
│   │   │   ├── Admin.jsx
│   │   │   └── MonthEndClose.jsx
│   │   ├── store/            # Zustand state
│   │   │   ├── dataStore.js  # Uploaded data, cubes
│   │   │   ├── filterStore.js # Global filters
│   │   │   └── settingsStore.js # Currency, FX rates, targets
│   │   ├── utils/
│   │   │   ├── parser.js     # Excel parsing logic (SheetJS)
│   │   │   ├── aggregator.js # Data cube building
│   │   │   ├── formatters.js # Currency, number formatting
│   │   │   └── colors.js     # Category/channel color constants
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/                  # FastAPI Python app
│   ├── main.py               # FastAPI app entry point
│   ├── routers/
│   │   ├── auth.py           # Login, JWT
│   │   ├── upload.py         # File upload endpoints
│   │   ├── data.py           # Data query endpoints
│   │   └── settings.py       # User settings endpoints
│   ├── models/
│   │   ├── user.py
│   │   ├── upload.py
│   │   └── settings.py
│   ├── services/
│   │   ├── excel_parser.py   # Revenue + COGS Excel parsing
│   │   ├── aggregator.py     # Build data cubes server-side
│   │   └── auth_service.py
│   ├── database.py           # SQLAlchemy setup
│   ├── requirements.txt
│   └── .env.example
│
├── README.md                 # Setup instructions
└── .gitignore
```

---

## DESIGN SYSTEM — EXACTLY THIS

### Colors (CSS variables)
```css
--P: #6958C2          /* Primary purple */
--PL: #8878D8         /* Purple light */
--PBG: #f0eefb        /* Purple background */
--SBG: #0d0c18        /* Sidebar dark */
--CBG: #f5f4fb        /* Content background */
--CRD: #ffffff        /* Card background */
--BDR: #e8e6f0        /* Border */
--T1: #1a1830         /* Text primary */
--T2: #6b6890         /* Text secondary */
--T3: #a8a6c0         /* Text muted */
--GR: #22c55e         /* Green */
--RD: #ef4444         /* Red */
--AM: #f59e0b         /* Amber */
--BL: #3b82f6         /* Blue */
```

### Category Colors (consistent everywhere)
```js
Pizza:   '#6958C2'
Food:    '#22c55e'
Drink:   '#3b82f6'
Dessert: '#ec4899'
Add-on:  '#f59e0b'
Retail:  '#8b5cf6'
Other:   '#94a3b8'
```

### Channel Colors
```js
Handy: '#6958C2'
TTO:   '#22c55e'
POS:   '#f59e0b'
BYOD:  '#3b82f6'
```

### Theme
- **Sidebar:** Dark (#0d0c18) — 256px wide, collapsible to 64px
- **Content area:** Light (#f5f4fb)
- **Cards:** White with subtle border
- **Topbar:** White, fixed, 56px height

---

## CRITICAL DATA RULES

### Time Zone Fix (CRITICAL — get this wrong and all charts are wrong)
The POS system stores `order_time` in **UTC**. Restaurant is in **India (IST = UTC+5:30)**.

```python
# Convert Excel time fraction to IST hour
def utc_frac_to_ist_hour(time_fraction):
    utc_minutes = time_fraction * 24 * 60
    ist_minutes = utc_minutes + 330  # +5h30m
    ist_minutes = ist_minutes % 1440
    return int(ist_minutes // 60)
```

Restaurant operating hours: **11:00 AM to 11:00 PM IST**
Valid hour range in data: **11–23**. Any hours outside this range are system entries — filter them out of charts but keep in data.

### Revenue File Parsing
```
File naming: upload_revenue_[Month]_[Year].xlsx
Sheet name:  Revenue_Data (user must rename before uploading)
Header row:  Index 2 (row 3 in Excel)
Data starts: Row index 3

Key columns (exact names):
- item_name, category_name, class_name
- order_channel, table_type, table_name
- Status (Active / Cancelled)
- GST Rate (POS)
- quantity
- Net amount\n[3]=[1] - [2]   → NET REVENUE (primary metric)
- Discount\n[2]                → Discount
- Service charge\n[4] = [3] x 10%  → Service Charge
- Total GST amount\n[7] = [5] + [6] → GST
- order_time  → Excel fraction, convert to IST hour
- date        → Excel serial, convert to YYYY-MM-DD
```

### COGS File Parsing
```
File naming: upload_cogs_[Month]_[Year].xlsx
Sheet name:  COGS_Report (user must rename before uploading)
Header row:  Index 6 (row 7 in Excel)
Data starts: Row index 7
Grand totals: Row index 4

Key columns (0-based index):
Col 1  (B) = Category_2       → Filter: 'food','alcohol drink','non alcohol' (case-insensitive)
Col 2  (C) = Group Item        → Ingredient group
Col 5  (F) = Item Description  → Ingredient name
Col 6  (G) = Min UOM           → Unit of measure
Col 7  (H) = Qty OB            → Opening balance qty
Col 9  (J) = Qty purchase      → Purchase qty
Col 13 (N) = Qty stock count   → Closing stock qty
Col 15 (P) = Qty actual        → Actual consumed qty
Col 17 (R) = Amt actual        → ACCOUNTING COG
Col 20 (U) = COG std           → STANDARD COG
Col 28 (AC)= Amt Other period  → Adjustment (other period)
Col 32 (AG)= Amt Food loss     → FOOD WASTAGE
Col 34 (AI)= Amt Training      → Adjustment (training)
Col 36 (AK)= Amt Tasting       → Adjustment (tasting)
Col 40 (AO)= Amt Gift          → Adjustment (gift)

COGS Calculations:
Accounting COG  = SUM(col R) WHERE Category_2 in ('food','alcohol drink','non alcohol') case-insensitive
Standard COG    = SUM(col U) same filter
Adjustment      = Other_period + Training + Tasting + Gift (from grand total row 4)
Material COG    = Accounting COG - Adjustment
Food Wastage    = grand_total_row[32]
COG Variance    = Material COG - Standard COG
Store Variance  = COG Variance - Food Wastage
Gross Margin    = Net Revenue - Accounting COG

COG % denominator: ALWAYS Net Revenue excluding Service Charge (user can toggle to include SC)
```

---

## ARCHITECTURE: HOW DATA FLOWS

### Option A — Browser-Only (Phase 1)
1. User uploads Excel file via drag-and-drop
2. SheetJS reads file in browser (no server needed)
3. JavaScript parses and aggregates into data cubes
4. All charts and tables update from in-memory cubes
5. User can "Save Session" — downloads HTML with embedded data

### Option B — Full Web App (Phase 2, build this)
1. User logs in (JWT auth)
2. User uploads Excel file via Admin page
3. File sent to FastAPI backend
4. Python parses Excel (pandas/openpyxl/pyxlsb) — server-side
5. Aggregated data saved to SQLite/PostgreSQL
6. Frontend fetches data via REST API
7. Charts and tables render from API responses
8. Data persists between sessions — no re-upload needed

**BUILD OPTION B (Full Web App)**

---

## DATA CUBES TO BUILD (server-side aggregation)

After parsing, build these aggregated cubes and save to database:

```python
# 1. KPI per month
kpi[month] = {
    nr, disc, sc, gst, qty, inv_count,
    avg_bill, canc_count, canc_value, gross_rev
}

# 2. Daily totals
daily[month|date] = {nr, disc, sc, gst, qty, inv_count, dow}

# 3. Hourly summary (IST hours)
hr_sum[month|ist_hour] = {nr, qty, inv_count}

# 4. Category x Channel
cat_ch[month|category|channel] = {nr, qty, inv_count}

# 5. Hour x Day-of-Week heatmap
dow_hr[month|dow|ist_hour] = {nr, qty, inv_count}

# 6. Table x Hour
table_hr[month|table_name|ist_hour] = {nr, qty}

# 7. Item totals
items[month|item_name] = {nr, qty, disc, sc, cat, cls}

# 8. Discount analysis
disc_ch[month|channel] = {disc, nr}
disc_item[month|item_name] = {disc, nr, qty}

# 9. Cancellations
canc_hr[month|ist_hour] = {count, nr}
canc_ch[month|channel] = {count, nr}

# 10. GST by slab
gst_slab[month|gst_rate] = {nr, gst, qty}

# 11. Top invoices (proxy: group by date|hour|table|channel)
top_invoices = sorted by nr desc, top 100, with line items
```

---

## ALL 25 PAGES — WHAT EACH MUST DO

### 1. Daily Flash (Home)
- Latest month KPI cards: Net Revenue, Gross Revenue, Invoices, Avg Bill, Cancellations
- Auto-generated alerts: revenue down >2% MoM → red flag, etc.
- Charts: Monthly revenue trend line, Top 5 items bar, Category donut, Channel bar, Peak hours bar

### 2. Revenue Overview
- 8 KPI cards: Net Revenue + MoM%, Gross Revenue, Invoices, Avg Bill, Discount, SC, GST, Cancellations
- Category icon cards (clickable, filters page)
- Charts: Daily trend (line/bar toggle), Category donut/bar toggle, Channel bar, Peak hours (IST), DOW bar

### 3. Monthly Detail
- Tab per loaded month
- 8 KPI cards per month
- Charts: Daily bar+line overlay (revenue + invoices dual axis), DOW avg, Category bar, Channel donut
- Daily summary table with CSV export

### 4. Comparison
- Last 2 months side-by-side KPI cards with % change
- Charts: Daily overlay line, Category bar grouped, Channel bar grouped, DOW grouped, Hour grouped, COGS % comparison

### 5. Item Analysis — 5 tabs
- **Revenue Ranking:** sortable table, Top N filter, search, Rev Share %, CSV
- **Period Compare:** item × month matrix with variance columns
- **Trend Analysis:** select items, line chart across months
- **Category Deep Dive:** category cards, drill to items
- **Combo Analysis:** frequently ordered together (from top invoices data)

### 6. COGS & Margin
- COGS local toggles: % base (excl/incl SC), period selector, group filter
- 8 KPI cards: Accounting COG %, Standard COG %, COG Variance, Food Wastage, Store Variance, Adjustments, Gross Margin, MoM change
- Charts: Actual vs Standard by category bar, COG Waterfall, COG% trend line, Food Wastage + Store Variance bar
- Ingredient group table: sortable, flagged (>10% over = red, >5% under = amber)
- Top variance ingredients table with Top N selector

### 7. Targets & Budget
- Input: monthly target per month
- Progress bar: actual vs target %
- Projected month-end (daily run rate × days)
- Chart: Actual vs Target bar with target line

### 8. Sales vs COGS — Category Profitability Matrix
- Table: Category | Sales | COG | Gross Profit | GP% | Contribution% | Margin Bar
- Margin bar: red <50%, amber 50-65%, green >65%
- Charts: Sales vs COG stacked bar, GP% contribution donut

### 9. Discount Analysis
- KPIs: Total discount, Disc % of revenue, Highest channel
- Charts: Discount by channel bar, Discount % of channel revenue bar
- Table: Top discounted items with disc % column

### 10. Voids & Cancellations
- KPIs: Total cancellations, Cancelled value, Cancel rate
- Charts: By channel bar, By hour bar (red for end-of-shift hours), By month bar
- Flag: hours 21-23 highlighted in red (end-of-shift theft risk)

### 11. GST Summary
- KPIs: Total GST, CGST, SGST, Taxable turnover
- Charts: GST by slab donut, Taxable revenue by slab bar
- Table: Slab | Taxable Value | GST | CGST | SGST | Effective Rate | Qty
- Export button: "GSTR-1 Export" (CSV format matching GST portal)

### 12. Table Performance
- Hour × Day-of-Week heatmap (gold/dark colour scheme — dark=low, bright gold=peak)
- Table × Hour heatmap (top 24 tables)
- Table ranking bar chart
- Cell value toggle: Revenue / Invoice Count / Avg Bill

### 13. Top Invoices
- Top N selector: 10/20/30/50/100
- KPI cards: Highest bill, Avg of top N, Top N as % of total
- Table with click-to-expand line items
- Charts: by channel donut, by hour bar, by DOW bar
- CSV export

### 14. Cover Analytics
- Lunch (11am-3pm) vs Dinner (6pm-11pm) revenue split
- Revenue by hour full bar chart (colour coded: lunch=amber, dinner=blue)
- Cards per month showing lunch/dinner split

### 15. Inventory Intelligence — 2 tabs
- **Variance Analysis:**
  - KPIs: Ingredients flagged over/under, Total COG variance, Variance %
  - Top 10 over-consumed horizontal bar
  - Ingredient group heatmap (colour = variance %)
  - Full variance table: Group | Ingredient | Actual | Standard | Variance ₹ | Var% | Flag
  - Thresholds: >10% over = 🔴, >5% under = 🟡
  
- **Item-wise Consumption:**
  - Table: Ingredient | Unit | Opening | Purchased | Total Available | Consumed | Closing | Waste | Cost ₹ | Waste%
  - Waste% colour coded: red if high

### 16. Menu Engineering
- 4-quadrant scatter plot (Star/Plow Horse/Puzzle/Dog)
  - X axis = Qty Sold, Y axis = GP%
  - Threshold lines at avg GP% and avg qty
  - Colour by quadrant, click dot = dish detail popup
- Target GP% input (default 65%) — changes quadrant classification live
- GP% distribution bar chart
- Table: Dish | Category | Selling Price | Std COG | COG% | GP% | Qty | Recommended Price | Flag
  - Recommended price = Std COG / (1 - target GP%)
  - Flag dishes where actual COG drifted >10% above standard

### 17. Admin — Data Upload & Settings
- Module upload cards: Revenue, COGS, P&L, BS, CFS
- Per-module: drag & drop zone, month tag, loaded months as green pills
- Exchange rate table: 15 currencies (INR base), manual entry
- Location hierarchy display
- File naming convention shown clearly

### 18. Month-End Close Checklist
- Tickable checklist items (stored in localStorage)
- Progress bar
- Items: Revenue reconciled, COGS uploaded, GST exported, Inventory done, P&L uploaded, Report sent

---

## AUTHENTICATION SYSTEM

Simple JWT auth for now:

```python
# Backend
POST /api/auth/login    → {username, password} → {access_token, token_type}
GET  /api/auth/me       → current user info

# Frontend
- Login page at /login
- JWT stored in localStorage
- All API calls include Authorization: Bearer {token}
- Protected routes redirect to /login if no token
- Default admin: admin / pizza4ps2024 (change in .env)
```

---

## API ENDPOINTS

```
# Auth
POST   /api/auth/login
GET    /api/auth/me

# Upload
POST   /api/upload/revenue          → upload revenue Excel, returns month processed
POST   /api/upload/cogs             → upload COGS Excel, returns month processed
GET    /api/upload/status           → list all uploaded months per module

# Data
GET    /api/data/kpi?months=        → KPI cards
GET    /api/data/daily?months=      → daily aggregates
GET    /api/data/hourly?months=     → hourly aggregates (IST)
GET    /api/data/cat-ch?months=     → category x channel
GET    /api/data/items?months=      → item totals
GET    /api/data/heatmap?months=    → DOW x hour heatmap
GET    /api/data/table-perf?months= → table x hour heatmap
GET    /api/data/cogs?months=       → COGS summary + groups + ingredients + consumption
GET    /api/data/discount?months=   → discount analysis
GET    /api/data/voids?months=      → cancellation analysis
GET    /api/data/gst?months=        → GST by slab
GET    /api/data/top-invoices?months= → top 100 invoices
GET    /api/data/menu               → menu engineering data (from COGS Cost Decomposition)

# Settings
GET    /api/settings/fx-rates       → exchange rates
PUT    /api/settings/fx-rates       → update exchange rates
GET    /api/settings/targets        → monthly targets
PUT    /api/settings/targets        → update targets
```

---

## CURRENCY SYSTEM

15 currencies. INR is base (=1). All data stored in INR. Convert at display time.

```js
const FX_RATES = {
  INR:1, VND:305, USD:0.012, EUR:0.011, SGD:0.016,
  JPY:1.78, CNY:0.086, GBP:0.0095, AUD:0.018,
  HKD:0.093, MYR:0.056, THB:0.41, AED:0.044, CAD:0.016, KRW:16.1
}
const FX_SYMBOLS = {
  INR:'₹', VND:'₫', USD:'$', EUR:'€', SGD:'S$', JPY:'¥',
  CNY:'¥', GBP:'£', AUD:'A$', HKD:'HK$', MYR:'RM',
  THB:'฿', AED:'AED ', CAD:'C$', KRW:'₩'
}

// Format function
function fc(value, compact=false, currency='INR') {
  const rate = FX_RATES[currency] || 1
  const sym = FX_SYMBOLS[currency] || ''
  const converted = value * rate
  if (compact) {
    if (Math.abs(converted) >= 1e7) return sym + (converted/1e7).toFixed(2) + 'Cr'
    if (Math.abs(converted) >= 1e5) return sym + (converted/1e5).toFixed(2) + 'L'
    if (Math.abs(converted) >= 1e3) return sym + (converted/1e3).toFixed(1) + 'K'
    return sym + Math.round(converted)
  }
  return sym + Math.round(converted).toLocaleString('en-IN')
}
```

Currency selector in topbar — changes ALL numbers across ALL pages instantly via Zustand store.

---

## FILTER SYSTEM

Global filters (affect all pages):
- Year (multi-select)
- Month (multi-select)
- Country → State → City → Location (hierarchy)
- Category (multi-select)
- Channel (multi-select)
- Status (Active / All including cancelled)

Filter bar behaviour:
- Collapsed by default — shows "⚡ Filters & Slicers" button + active filter tags
- Expands on click showing all filter selects
- Apply button updates all pages
- Clear button resets all filters
- Active filters shown as removable purple pills

---

## SIDEBAR STRUCTURE

```
OVERVIEW
  ⚡ Daily Flash

REVENUE INTELLIGENCE
  📊 Overview
  📅 Monthly Detail
  ⚖️  Comparison
  🍽️  Item Analysis
  📦 COGS & Margin
  🎯 Targets & Budget

FINANCIAL STATEMENTS
  📄 P&L Statement      [stub - Phase 3]
  ⚖️  Balance Sheet      [stub - Phase 3]
  💸 Cash Flow          [stub - Phase 3]

SALES ANALYTICS
  📈 Sales vs COGS
  🏷️  Discount Analysis
  ❌ Voids & Cancels
  🧾 GST Summary

OPERATIONS
  🪑 Table Performance
  🏆 Top Invoices
  👥 Cover Analytics

INVENTORY
  🔍 Inventory Intel
  ⭐ Menu Engineering

ADMIN
  ⚙️  Data Upload
  ✅ Month-End Close
```

Sidebar features:
- Collapse toggle button (shows icons only when collapsed)
- Active page highlighted with gradient background
- Section labels hidden when collapsed
- Smooth transition animation

---

## HEATMAP — GOLD/DARK COLOUR SCHEME

This is critical for Table Performance and DOW×Hour pages.

```js
// Gold colour based on intensity (0-1)
function goldColor(intensity) {
  const r = Math.round(18 + intensity * 210)
  const g = Math.round(15 + intensity * 165)
  const b = Math.round(8 + intensity * 15)
  return `rgb(${r},${g},${b})`
}

// Usage:
const maxValue = Math.max(...allValues)
cells.forEach(cell => {
  const intensity = cell.value / maxValue
  cell.background = cell.value ? goldColor(intensity) : '#1a1830'
})
```

---

## WHAT TO BUILD FIRST (Build in this order)

1. **Project scaffolding** — Create all folders, install dependencies, get dev servers running
2. **Backend** — FastAPI app, database models, auth, file upload endpoint, Excel parser (revenue first)
3. **Frontend shell** — Vite+React, Tailwind, routing, Sidebar, Topbar, Filter bar (no data yet)
4. **Connect upload** — Admin page upload zone → backend → parse → store → return success
5. **Daily Flash page** — First page with real data, proves end-to-end works
6. **Overview page** — KPI cards, category icons, 5 charts
7. **All remaining pages** — follow the specs above, one by one

---

## HOW TO RUN LOCALLY

```bash
# Terminal 1 - Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev

# Open browser at http://localhost:5173
# API runs at http://localhost:8000
# API docs at http://localhost:8000/docs
```

---

## COMMERCIAL DEPLOYMENT (Phase 2 - after local works)

When ready to deploy:
- Frontend: Vercel or Netlify (free tier works)
- Backend: Railway.app or Render.com (Python FastAPI, ~$5/month)
- Database: Supabase (PostgreSQL, free tier)
- Domain: Any registrar
- Auth: Add proper user management, licence keys per client

---

## IMPORTANT NOTES FOR CLAUDE CODE

1. **Do not hardcode any data** — everything comes from uploaded files
2. **The time conversion is critical** — UTC to IST (+5:30) for all hour-based charts
3. **Category colours must be consistent** across all pages and charts
4. **Every table needs a CSV export button**
5. **Every chart card needs chart-type toggle** (at minimum bar/line or bar/donut)
6. **The filter bar must actually filter** — not just look good
7. **Mobile responsive** — at least usable on tablet
8. **Error handling** — if file parse fails, show clear error message
9. **Loading states** — show spinner while processing large files
10. **The sidebar collapse must be smooth** — CSS transition, not instant

---

## FILES TO REFERENCE (in the uploads folder)
- `4PS_Revenue_working_of_Jan_26.xlsb` — Jan 2026 revenue (Detail sheet has transactions)
- `4PS_Revenue_working_of_Feb_26.xlsb` — Feb 2026 revenue
- `Copy_of_4PS_IDN___COGS_report_in_Jan_2026.xlsx` — Jan COGS
- `Copy_of_4PS_IDN___COGS_report_in_Feb_2026.xlsx` — Feb COGS

Read these to understand the actual file structure. Use them for testing.

---

*End of Technical Specification*
*Build the complete application. Do not skip pages. Do not use placeholder data.*
*When in doubt, refer to PIZZA4PS_MIS_REQUIREMENTS.md for detailed specs.*
