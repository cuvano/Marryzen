# Marryzen — Roadmap & Status

Last updated: **2026-06-15** (Day 3 — morning of)
Soft launch: **2026-07-01** (16 days away)
Hard launch: **2026-08-15** (60 days away — per CLAUDE.md identity record)

---

## Status snapshot

| Stack | State |
|---|---|
| Frontend (Vercel) | Green. Bundle Z (perf code-splitting) committed 2026-06-15 — App.jsx React.lazy on every route + ChunkErrorBoundary + vite.config manualChunks + index.html async Termly. Expecting -150ms first-paint and -200KB landing chunk on next deploy. |
| Backend (Supabase Edge Functions) | didit-webhook v12, email-cadence-tick with CAN-SPAM-compliant unsubscribe footer + UNSUB_TOKEN_SECRET HMAC verification, send-verification-result, storage-backup-tick, unsubscribe (new) all operational. CRON_SECRET rotated 2026-06-14 from literal to 32-byte random. |
| DB | All Phase 41 series + marketing_emails_opt_out + marketing_emails_opt_out_at columns applied. CHECK constraints on marital_status/drinking/smoking enforced. No outstanding migrations. |
| Backups | Supabase Pro daily snapshots ACTIVE (7-day rolling retention) + nightly Storage→S3 sync via storage-backup-tick. **PITR add-on NOT enabled** ($100/mo, deferred per cost-benefit; trigger criteria in TOMs v1.2 §2.9). Procedural drill executed 2026-06-15 with baseline snapshot + WAL position evidence. Full in-place drill committed by 2026-11-15 (ticket COMP-PITR-001). |
| Email | 12 transactional emails operational. Marketing-cadence emails carry signed unsubscribe footer + CUVAN postal address. Founding-500 founder welcome live. |
| Compliance binder | **ROPA v1.0.7** + **TOMs v1.2** in Prighter Compliance Documents. **DPIA v1.0.5** on disk (no Prighter slot). PITR Restore Runbook v1.1 + drill evidence filed at `C:\Marryzen\compliance\pitr_drill_2026-06-15\`. Prighter EU+UK reps Active. **TOMs v1.1 was withdrawn same day as v1.2 for PITR/snapshot conflation correction** — lesson logged in CLAUDE.md "Fact-checking platform features" section. |
| SEO | Bundle X (canonical URLs + main landmark on 5 public pages + press underlines) + Bundle SEO-1 (AuthenticatedLayout noindex + SafetyDisclaimer canonical) shipped. GSC "Validate Fix" running on 6 indexing reasons since 2026-06-15. |
| A11y | Bundle Y (Tailwind palette tokens + WCAG AA contrast pass via codemod, 52 files) + Bundle Y hotfix ('pink-strong' kebab-case Tailwind v3 JIT fix). Header bell + AccountSettings eye-button a11y patches shipped. |

---

## Just shipped — 2026-06-14 → 2026-06-15

### P0a — Compliance binder updates (DONE)

- Termly Privacy Policy Section 14 published live with Faith-aligned matchmaking + Article 22(3) clause + Marketing emails clause
- DPIA v1.0.4 → v1.0.5, ROPA v1.0.5 → v1.0.7 (two bumps — Phase 41 matchmaking + marketing opt-out)
- Both PDFs uploaded to Prighter Compliance Documents → Controller-RoPA slot
- ROPA §3.10 PA-10 "Behavioral Marketing Email Cadence" added

### P0b — Vendor DPA chases (sent, awaiting reply)

- Joan Colomé (Didit) — 2nd chase 2026-06-14; 3rd escalation 2026-06-21; switch to Didit Identity Spain SL by 2026-06-28 if silent
- Vercel — 2nd chase 2026-06-14; 3rd escalation 2026-06-21; support ticket 2026-06-28 if silent
- Segpay + CCBill — DROPPED 2026-06-14 (non-responsive)
- PaymentCloud — founder handling intake directly

### P0c — CRON_SECRET rotation (DONE)

- Rotated 2026-06-14 ~21:30 UTC. Supabase Edge Function secrets only. Literal fallback stripped from 4 Edge Functions.

### MEDIUM #1 — Marketing-emails opt-out (DONE)

- DB columns + unsubscribe Edge Function with HMAC-SHA-256 + Settings UI + ROPA v1.0.7 §3.10 + Termly Section 14 (2nd Additional Clause) live

### MEDIUM #2 — Mobile QA + Lighthouse + a11y audit (DONE)

- Bundle X: canonical URLs on 5 public pages, `<main>` landmark, press underlines
- Bundle Y: Tailwind brand-color tokens (52 files via codemod) — WCAG AA contrast pass (was 4.06:1 → now 4.5:1)
- Bundle Y hotfix: `pinkStrong` camelCase didn't compile in Tailwind v3 JIT; fixed to quoted `'pink-strong'` kebab-case
- A11y hotfix: Header bell aria-label + AccountSettings eye-toggle aria + Premium-icon Crown
- Bundle SEO-1: AuthenticatedLayout `noindex,nofollow` + SafetyDisclaimer canonical
- GSC "Validate Fix" triggered on all 6 indexing reasons

### MEDIUM #3 — Backup/restore drill (DONE procedurally)

- PITR Restore Runbook v1.1 (9-section in-place procedure, PITR-add-on forward-compatibility §5)
- Baseline snapshot SQL captured 2026-06-15 18:35:10 UTC (WAL LSN `48/2E004538`, 12-table row counts, sample row hashes)
- TOMs v1.2 corrects PITR/snapshot conflation (RPO 24h not 2min, RTO 60min internal)
- Compliance ticket COMP-PITR-001 = full in-place drill by 2026-11-15

### Bundle Z — perf code-splitting (DONE)

- App.jsx React.lazy on every route + Suspense + ChunkErrorBoundary
- ChunkErrorBoundary.jsx (new) — Chrome/Vite/Safari/Firefox/ChunkLoadError matching, branded reload UI
- vite.config manualChunks: react-vendor + supabase-vendor + framer-vendor + generic vendor (lucide intentionally per-icon)
- index.html `async` on Termly (NOT `defer`)
- Bug log: initial autonomous commit at SHA `4ba1cc3` duplicated content (CodeMirror 6 select-all failure); user re-committed clean via Notepad path

---

## What's next

### 🔴 P0a/b leftovers (external blockers)

- **Joan Colomé reply** (third chase 2026-06-21 if silent)
- **Vercel DPA reply** (third chase 2026-06-21 if silent)
- **PaymentCloud intake completion** (founder-driven)

### 🟡 MEDIUM (next 1-2 weeks)

- **Verify Bundle Z Vercel deploy green + Lighthouse delta** — confirm landing chunk dropped + LCP improved on `/`
- **Backup admin account** — single super_admin on believerfellow@gmail.com is a SPOF. Create a second admin email or grant admin to a trusted second account.
- **Founding-500 invite list curation** — strategy + actual invite list. Gated on "system A-Z first" per founder.

### 🟢 LOW (post-launch)

- **Phase 41h:** marital-status tooltip on DiscoveryPage ProfileCard breakdown (T&S deferred)
- **Phase 41i:** telemetry post-launch — score distribution shift after Phase 41e refinements
- **Phase 41j:** dynamic denominator extended to other dimensions
- Onboarding: surface Phase 41a dealbreakers more prominently
- Press kit: real product screenshots to add week of July 1
- Customer support email triage flow (support@marryzen.com)
- Facebook Ads — application pending per founder
- Stripe DPA revisit (Q1 2027)

### ⚪ Strategic decisions worth founder time later

- Joan Colomé response review (if Joan replies)
- PaymentCloud terms review
- Post-launch retention telemetry baseline + dashboards
- PITR add-on cost-benefit revisit per TOMs v1.2 §2.9 triggers

---

## Launch sequence

**T-16 days (now)** → External blockers (Joan/Vercel/PaymentCloud). Bundle Z verify.
**T-7 days (Jun 24)** → Final QA pass, founding-500 invite list locked, Sandra UAT
**T-3 days (Jun 28)** → Feature freeze, monitoring drill
**T-1 day (Jun 30)** → Founder pre-flight checklist
**T-0 (Jul 1)** → Soft launch — Founding-500 only
**T+45 days (Aug 15)** → Hard launch, public signup opens
**T+90 days post-launch (Nov 15)** → Full measured PITR drill (ticket COMP-PITR-001)

---

## Operational runbook references

- Brand voice rules: `CLAUDE.md` § "Brand naming convention"
- File-delivery format ("the usual way"): `CLAUDE.md` § "Critical #1"
- Canonical enum values for profiles.*: `CLAUDE.md` § "Canonical profiles.* enum values"
- Canonical relationship_goal values + 4x4 matrix: `src/lib/relationshipGoals.js`
- Faith-aligned interstitial decision: `Muslim_Women_Filter_Decision_2026-06-13.md`
- Prighter portal: `https://app.prighter.com/portal/marryzen` (business ID 11024664158)
- AWS S3 backup bucket: `marryzen-backups-eu-west-1` (eu-west-1)
- Supabase project: `adufstvmmzpqdcmpinqd`
- PITR Restore Runbook: `C:\Marryzen\compliance\pitr_drill_2026-06-15\PITR_RUNBOOK_v1.1.md`
- TOMs v1.2: `C:\Marryzen\handoff\toms_doc_v1.2\TOMs_v1.2_2026-06-15.pdf` (uploaded to Prighter TOM slot)

---

## Session changelog

**2026-06-15 (Day 3):** P0a/b/c completed. MEDIUM #1 + #2 + #3 done. TOMs v1.0 → v1.1 → v1.2 (v1.1 withdrawn for PITR/snapshot conflation). Bundle Z (perf code-splitting) shipped 4 commits. CLAUDE.md PITR drill log + plan-feature locked-fact added.

**2026-06-14 (Day 2):** Phase 41e + 41f + 41g. 4 commits. Live UAT pass.

**2026-06-13 (Day 1):** Phase 38 + 40 + 41 + 41a + 41b + 41c + 41d + 42 + 44 + 60 + compliance pack drafts. 18 commits + 9 decision docs.

**2026-06-12 → 2026-06-13 overnight:** Phase 29-58. Admin UI dispatcher, didit-webhook v12, email infrastructure, mobile/a11y, storage backup, audit_logs rename.
