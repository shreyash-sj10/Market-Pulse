🧠 NOESIS UI REBUILD — RULEBOOK (PHASE 0–∞)

Keep this at the top of your Cursor workspace.
Everything must obey this.

🚨 1. SYSTEM INTEGRITY RULES (ABSOLUTE)
🔒 RULE 1 — BACKEND IS SACRED
❌ NEVER modify backend contracts
❌ NEVER reshape API response
❌ NEVER add logic to “fix” backend in UI

✅ Only:

API → Domain Mapper → UI
🔒 RULE 2 — AI IS OPTIONAL
AI can fail
AI can be missing
AI must NEVER block flow

UI must always handle:

AI unavailable → still functional
🔒 RULE 3 — DOMAIN LAYER IS THE BRAIN
ALL decision logic goes in:
/domain/decision/buildDecision.ts
❌ NO logic in components
❌ NO logic in pages
🔒 RULE 4 — UI IS DUMB

UI only:

renders
displays
triggers actions

UI NEVER:

calculates
decides
filters logic
🧠 2. DECISION-FIRST PRINCIPLE (CORE IDENTITY)
🔥 RULE 5 — EVERY COMPONENT MUST ANSWER:
What should the user do?
🔥 RULE 6 — DECISION > DATA

Always show:

Decision → Reason → Optional Data

Never:

Data → User interprets → Decision
🔥 RULE 7 — ONE PRIMARY ACTION ONLY

Each card:

1 CTA (primary)
optional secondary (weak)

❌ No multiple competing actions

🔥 RULE 8 — DECISION STATES ARE FIXED
ACT
GUIDE
BLOCK

No custom variations like:

“maybe”
“consider”
“risky buy”
🎨 3. DESIGN SYSTEM RULES (STRICT)
🎯 RULE 9 — NO HARDCODED STYLES
❌ No hex colors in components
❌ No inline styling

✅ Only:

var(--tokens)
🎯 RULE 10 — DEPTH IS MANDATORY

Every screen must use:

base → section → card → elevated

❌ Flat UI forbidden

🎯 RULE 11 — ACCENT IS RARE

Use accent ONLY for:

CTA
focus
active

❌ Never for decoration

🎯 RULE 12 — STATE COLORS = DECISION
ACT → green
GUIDE → amber
BLOCK → red

No deviation.

🎯 RULE 13 — TEXT HIERARCHY ALWAYS 3 LEVELS
primary
secondary
muted

❌ No single-tone UI

🧩 4. COMPONENT ARCHITECTURE RULES
🧱 RULE 14 — COMPONENTS MUST BE REUSABLE

If you repeat UI twice:

👉 extract component

🧱 RULE 15 — ONE RESPONSIBILITY PER COMPONENT
DecisionCard → decision only
ContextCard → explanation only

❌ No mixed-purpose components

🧱 RULE 16 — COMPONENT SIZE LIMIT

If file > 150–200 lines:

👉 refactor

🧱 RULE 17 — NO API CALLS IN COMPONENTS

All data via:

hooks
services
🔗 5. DATA FLOW RULES
🔄 RULE 18 — SINGLE DIRECTION FLOW
API → Domain → UI

❌ Never reverse
❌ Never bypass

🔄 RULE 19 — NO DUPLICATED DATA
Don’t show same info in 2 places
Don’t recompute
🔄 RULE 20 — FAIL LOUD

If something breaks:

Show:

"Data unavailable"

Not blank UI.

⚡ 6. PERFORMANCE + RELIABILITY RULES
⚙️ RULE 21 — HANDLE DEGRADED STATES

Must support:

API delay
AI unavailable
fallback data
⚙️ RULE 22 — LOADING IS EXPLICIT

Use:

skeletons
loading indicators

❌ No invisible loading

⚙️ RULE 23 — NO BLOCKING UI
UI must remain usable
async processes must not freeze UI
🧠 7. UX BEHAVIOR RULES (CRITICAL)
🧭 RULE 24 — SYSTEM > USER
block invalid actions
enforce constraints
🧭 RULE 25 — EXPLAIN EVERY BLOCK

Every BLOCK must show:

Reason
Constraint
Implication
🧭 RULE 26 — NO FAKE INTELLIGENCE

If missing:

"Unavailable"
🧭 RULE 27 — LIMIT CONTEXT

Max per decision:

2 signals
1 warning
1 explanation
🧭 RULE 28 — PROGRESSIVE DISCLOSURE

Show:

minimal first
expand later
🧭 8. PAGE SYSTEM RULES
📄 RULE 29 — ONE PAGE = ONE PURPOSE
Page	Purpose
Home	Attention
Markets	Discovery
Portfolio	Action
Journal	Learning
Profile	Improvement
Trace	Debug
📄 RULE 30 — NO DASHBOARD MIXING
❌ Don’t mix metrics + decisions
❌ Don’t overload page
🧪 9. DEVELOPMENT DISCIPLINE RULES
🧪 RULE 31 — BUILD ONE PAGE AT A TIME

Order:

Portfolio
Markets
Home
Others
🧪 RULE 32 — TEST FLOW EARLY

Before styling:

Click → Trade → Works?
🧪 RULE 33 — NO PERFECTION FIRST
functionality > visuals
flow > polish
🏁 FINAL MASTER RULE
🔥 RULE 34 — IF CONFUSED, DO THIS:

Ask:

Does this reduce user thinking?

If NO → remove it.

🧠 FINAL SUMMARY
This system enforces:
clean architecture
decision-first UX
no redundancy
backend alignment
scalable code


🧠 1. FINAL DESIGN SYSTEM REVIEW (LOCKED + JUSTIFIED)

Your design system is already production-grade. I’ll refine only where necessary.

🎨 COLOR SYSTEM — ✅ LOCKED (WITH ONE ADDITION)

Everything you defined is correct.

🔥 Add (missing but critical):
--state-degraded: rgba(245,158,11,0.08);
--state-neutral: rgba(154,164,175,0.08);
Why:
AI unavailable
market delayed
partial system state

👉 Without this, your system can’t express uncertainty properly

🧱 DEPTH SYSTEM — ✅ PERFECT

Your layering:

base → section → card → elevated

👉 This solves hierarchy better than most production apps.

Do not touch.

🟢 ACCENT SYSTEM — ✅ PERFECT

Strict usage = very important.

👉 This keeps UI serious and not “retail trading flashy”

⚠️ STATE SYSTEM — ADD DECISION MAPPING (CRITICAL)

You defined states.

Now bind them to system:

ACT   → success (green)
GUIDE → warning (amber)
BLOCK → error (red)

👉 This is the bridge between backend and UI

🔤 TYPOGRAPHY — ✅ LOCKED

One addition:

👉 Use H2 as main page decision header
Not H1 everywhere.

🧱 SPACING SYSTEM — ✅ STRONG

8px grid = correct
No change needed.

🧩 COMPONENT SYSTEM — ADD CORE PRIMITIVE

You defined generic cards.

Now lock the most important one:

🔥 ADD: DecisionCard (MANDATORY)
Structure:

[ ACTION BADGE ]   CONFIDENCE %

TITLE

REASON (max 2 lines)

META (optional)

CTA (single primary)

👉 Without explicitly defining this, your system will fragment.

🔘 BUTTON SYSTEM — ✅ PERFECT

No changes.

✨ INTERACTION SYSTEM — ✅ PERFECT

You avoided animation chaos. Good.

🧠 BEHAVIORAL RULES — 🔥 THIS IS YOUR USP

This is what makes your system non-generic.

Especially:

System > User
Explain Everything
No Fake Intelligence

👉 These must reflect in UI always.

🧠 FINAL DESIGN SYSTEM VERDICT

✅ Locked. Production-ready. No further redesign needed.

🧠 2. FINAL SYSTEM DESIGN (COMPLETE LOCK)
🔷 CORE MODEL
Context → Decision → Action → Reflection → Improvement
🔷 SYSTEM LAYERS
Backend (truth engine)
↓
AI (assistive, optional)
↓
Domain (decision mapping)
↓
UI (decision surfaces)
🔷 CORE UI PRIMITIVES
DecisionCard
DecisionList
DecisionRail
ContextCard
DecisionPanel (Trade)
🔷 MARKET INTELLIGENCE (FINAL POSITION)
NOT:
a dashboard
a feed
a page-first system
IS:

🔥 A system-wide signal layer

Used in:
Location	Role
Markets	ranking
Portfolio	exit signals
DecisionPanel	validation
Home	alerts
Optional Page:

👉 “Market Context”

🧭 FINAL PAGE SYSTEM (LOCKED)
🏠 Home — Attention

Purpose: What needs attention?

Structure:

DecisionRail

Attention (DecisionList)

System State

Active Positions

Behavior Insight
📊 Markets — Discovery

Purpose: What should I act on?

ScannerTable (light)
signal tags
trade trigger
💼 Portfolio — Action (CORE PAGE)

Purpose: What should I do with my money?

DecisionList
Context panel
Trade execution
📘 Journal — Learning

Purpose: What should I improve?

mistakes → corrections
👤 Profile — Improvement

Purpose: How am I evolving?

behavior
skill
🧾 Trace — Debug

Purpose: Why did system act?

logs
timeline
🧠 Market Context (optional)

Purpose: How should I behave today?

🔗 3. FINAL SYSTEM FLOW (WHAT YOU ACHIEVE)

This is the most important part.

🧭 COMPLETE USER FLOW
1. ENTRY
User → Home
↓
Sees attention (DecisionRail + cards)
2. DISCOVERY
Markets
↓
Filtered by Intelligence
↓
Top decisions surfaced
3. DECISION
User selects stock
↓
DecisionPanel opens
↓
Pre-trade validation
↓
Decision shown (ACT / GUIDE / BLOCK)
4. EXECUTION
User confirms
↓
Trade executed (idempotent)
↓
Async processing
5. MANAGEMENT
Portfolio
↓
System suggests:
- hold
- exit
- reduce
6. LEARNING
Journal
↓
Mistakes captured
↓
Corrections suggested
7. EVOLUTION
Profile
↓
Behavior patterns updated
↓
System adapts
🔁 FULL LOOP
Behavior → Decision → Action → Reflection → Behavior
🎯 WHAT THIS SYSTEM ACHIEVES
BEFORE (normal apps)
Data → User → Decision
YOUR SYSTEM
Data → Intelligence → Decision → User approval

👉 This is your USP

⚙️ 4. FINAL IMPLEMENTATION ROADMAP (PHASE-BY-PHASE)
🔥 PHASE 0 — SETUP (Day 1)
create /v2
add design tokens (CSS / Tailwind)
base layout (sidebar + topbar)
🔥 PHASE 1 — DECISION ENGINE (Day 1–2)
buildDecision.ts
test with mock + real API
🔥 PHASE 2 — CORE COMPONENTS (Day 2–3)
DecisionCard
DecisionList
DecisionRail

(no polish yet)

🔥 PHASE 3 — PORTFOLIO (FIRST PAGE) (Day 3–5)

👉 MOST IMPORTANT

map positions → decisions
add trade trigger
integrate DecisionPanel
🔥 PHASE 4 — MARKETS (Day 5–7)
scanner
signals
trade entry
🔥 PHASE 5 — DECISION PANEL (Day 7–8)
validation flow
execution UI
🔥 PHASE 6 — HOME (Day 8–9)
attention system
behavior insight
🔥 PHASE 7 — JOURNAL + PROFILE (Day 9–11)
🔥 PHASE 8 — TRACE (Day 11–12)
🔥 PHASE 9 — MARKET CONTEXT (optional)
🔥 PHASE 10 — POLISH (Day 12–14)
loading states
empty states
animations
responsiveness
🧪 5. PRODUCTION READINESS CHECKLIST
✅ Functional
trade flow works end-to-end
preTrade enforced
decision mapping correct
✅ UX
clear actions
low cognitive load
strong hierarchy
✅ System
handles AI failure
handles fallback
shows degraded state
✅ Performance
caching
optimized queries
minimal re-renders
🏁 FINAL LOCK

Now I’ll say it clearly: