# Marryzen — Roadmap & Status

Last updated: **2026-06-14** (day after 16-hour overnight + Day 2 morning)
Soft launch: **2026-07-01** (17 days away)
Hard launch: **2026-09-15**

---

## Status snapshot

| Stack | State |
|---|---|
| Frontend (Vercel) | Green on commit `f99e32e` (Phase 41g scorer hygiene). 22 commits this 2-day block, all built green. |
| Backend (Supabase Edge Functions) | didit-webhook v12, email-cadence-tick, send-verification-result, storage-backup-tick all operational. PostHog dynamic surveys.js disabled (Phase 44 iOS fix). |
| DB | All Phase 41 series migrations applied to live: 4 dealbreaker columns, faith_align_acknowledged_at, preferred_age_min/max + CHECK constraints. No outstanding migrations. |
| Backups | Daily Supabase DB backups + nightly Storage→S3 sync. PITR deferred. |
| Email | 11 transactional emails operational. Behavioral cadence wired. Founding-500 founder welcome live. Verification result emails with 60-min delay queue. |
| Compliance binder | ROPA v1.0.5, DPIA v1.0.4, TOMs v1.0 uploaded to Prighter. Prighter EU+UK reps Active. **Bumps pending application:** DPIA v1.0.5 (§6.5 matchmaking automated processing) + ROPA v1.0.6 + Termly Section 14 — all drafted in `Phase41d_Compliance_Updates_Pack_2026-06-13.md`. |
| Live UAT (2026-06-14) | /account-settings + /press + /404 all verified working as Omer. AgePreferencesCard save+clear functional end-to-end. |

---

## Just shipped — 2026-06-13 → 2026-06-14

### 22 GitHub commits, all Vercel-green

| Phase | SHA | Scope |
|---|---|---|
| 38 | `5dd08ca` | public/ bundle: og-image PNG+SVG + maintenance.html + sitemap refresh |
| 38 | `4f387e2` | NotFoundPage 404 refresh + new PressKitPage at /press |
| 38 | `e31a886` | App.jsx wires /press route |
| 38 | `e42a468` | Footer adds Press link |
| 38 | `12314b5` | index.html OG/Twitter meta -> og-image.png + alt + secure_url |
| 44 | `7fe5fd6` | iOS Chrome Mobile RangeError fix (defer PostHog + disable_surveys) |
| 41 | `fd47a93` | matchmaking.js v1.5: faith weight 15→28, group bonus 0.6→0.4, drift fixes |
| 41 | `c22c1ba` | matching_config seeded weights migration (idempotent) |
| 41a | `ecb2c56` | 4 dealbreaker boolean columns on profiles + comments |
| 41a/b | `d76eb0c` | matchmaking.js Phase 41a hard filters + Phase 41b intent matrix + relationshipGoals.js + analytics events |
| 41a | `8ffdc59` | MatchPreferencesCard reusable component |
| 41a | `62f2eb8` | AccountSettingsPage integrates MatchPreferencesCard |
| 41b | `e5f379e` | Step5 uses canonical relationshipGoals constants + TMM display rename |
| 41d | `50c3d90` | faith_align_acknowledged_at audit column |
| 41d | `eef8ca7` | FaithAlignedInterstitial + Step5 conditional rendering |
| 41c | `4cce360` | Step5 deal-breaker MatchPreferencesCard with direct supabase persistence |
| 60 | (earlier) | audit_logs column rename migration |
| ROADMAP | `71893ba` | Post-session 2026-06-13 update |
| 41e | `3def494` | preferred_age_min/max columns + CHECK constraints |
| 41e | `0a9f2b1` | matchmaking.js Phase 41e: age preference + heavier children + marital matrix |
| 41f | `52bbc67` | AgePreferencesCard component |
| 41f | `7eed243` | AccountSettingsPage mounts AgePreferencesCard above MatchPreferencesCard |
| 41g | `f99e32e` | Scorer hygiene: dynamic lifestyle denominator + education tier map + empty-string education guard |

### Live DB state (verified via Monaco)

Three migrations applied today. Live `profiles` table now has all 5 new columns:
- `dealbreaker_faith`, `dealbreaker_marital_status`, `dealbreaker_has_children`, `dealbreaker_relationship_goal` (boolean, NOT NULL, default false)
- `faith_align_acknowledged_at` (timestamptz, nullable)
- `preferred_age_min`, `preferred_age_max` (integer, nullable, CHECK 18-99 + min<=max)

### Matchmaking scorer state (Phase 41 series complete)

- **Headline weights** (admin tune): age 15, distance 15, intent 10, faith 25, values 10, cultures 10, lifestyle 10, completeness 5 — sum 100
- **Faith**: 4 religion-group fallback (Christianity sub-denoms, Islam, Judaism, NonReligious). Group bonus 0.4 (v1.5 fix from 0.6).
- **Intent**: 4x4 marriage-intent compatibility matrix (Phase 41b). TMM-FSC=0.9, M12-SRM=0.7, TMM-SRM=0.3, etc.
- **Age**: preferred-range scoring when set (Phase 41e/f), v1.5 symmetric tier fallback otherwise.
- **Lifestyle**: dynamic denominator (Phase 41g) — 19 when children data available on both sides, 13 when not. Marital status matrix (Phase 41e) + tripled children weight + empty-string education guard.
- **4 user opt-in dealbreaker hard filters** (Phase 41a). Reversible via Settings or onboarding Step5 card.
- **Muslim-women faith-aligned interstitial** (Phase 41d) — strong default at Step5 onboarding, full audit trail.

### Strategic decisions locked

- **Matchmaking v1.5 faith re-weight**: faith is highest non-intent dim. Brand wedge encoded.
- **Marriage intent matrix**: 4x4 tiered, not flat 70%. TMM display label renamed to "Marriage-bound, family-introduced".
- **Muslim women filter**: P2 (strong default + interstitial), board-rejected P1 hard rule on UK §13 + GDPR Art. 22 grounds.
- **PaymentCloud**: engage TODAY per board decision (chase docs ready).
- **Stripe DPA revisit**: deferred to Q1 2027 post-clean-history.

### New compliance / decision docs (in C:\Marryzen)

- `Matchmaking_v1.5_Decision_2026-06-13.md`
- `Marriage_Intent_Matrix_Decision_2026-06-13.md`
- `Muslim_Women_Filter_Decision_2026-06-13.md`
- `Phase41d_Compliance_Updates_Pack_2026-06-13.md` — contains DPIA + ROPA + Termly + admin SOP all ready to apply
- `Art34_Breach_Notification_Templates_v1.0.md`
- `Payment_Processor_Decision_2026-06-13.md`
- `Segpay_CCBill_Escalation_Email_2026-06-13.md` — deadline Jun 16
- `DPA_Chase_Email_Pack_2026-06-13.md` — Didit (Joan) + Vercel + generic templates
- `Prighter_Intake_Datamap_Checklist_2026-06-13.md`

---

## What's waiting — organized by urgency

### 🔴 URGENT this week (3 founder actions, ~2 hours total)

**P0a — Apply compliance binder updates (~70 min founder)**
1. Bump DPIA → v1.0.5 with §6.5 matchmaking automated processing. Export PDF, upload to Prighter DPIA slot.
2. Bump ROPA → v1.0.6 with new processing-activity row. Export PDF, upload to Prighter Controller RoPA slot.
3. Update Termly privacy policy Section 14 with the one paragraph drafted. Republish + verify green in Prighter.
4. File `Admin_Art22_Human_Intervention_SOP_2026-06-13.md` to `C:\Marryzen`.

All text drafted in `Phase41d_Compliance_Updates_Pack_2026-06-13.md` — copy-paste ready.

**P0b — Send vendor escalation emails (~30 min founder)**
- Today: PaymentCloud intake form at paymentcloudinc.com (board flagged this as urgent)
- Today: Segpay + CCBill escalation (deadline Monday June 16 — TOMORROW)
- Today: Didit chase to Joan Colomé
- Today: Vercel DPA confirmation

Templates in `Segpay_CCBill_Escalation_Email_2026-06-13.md` + `DPA_Chase_Email_Pack_2026-06-13.md`.

**P0c — Rotate CRON_SECRET before launch**
- Currently the literal `marryzen-cron-2026`. Change to a random 32-byte value in 3 Edge Function env vars: send-verification-result, email-cadence-tick, storage-backup-tick. Must all match.

### 🟡 MEDIUM next 1-2 weeks (5 items)

**Backup admin account** — single super_admin on believerfellow@gmail.com is a SPOF. Create a second admin email or grant admin to a trusted second account.

**Confirm `marketing_emails_opt_out` column added** — referenced by email-cadence-tick suppression check but column doesn't exist yet. Verify or add via migration.

**Founding-500 invite list curation** — strategy + actual invite list. Gated on "system A-Z first" per founder.

**Final mobile responsive QA + Lighthouse + a11y audit** — `/`, `/discovery`, `/profile`, `/onboarding`, `/press` (new).

**Backup/restore drill** — test that Supabase daily backup restore actually works. Document one tested restore (Art. 32 evidence).

### 🟢 LOW post-launch (8 items)

- TOMs v1.1 with explicit RPO 24h / RTO 24h documented (board recommendation)
- Phase 41h: marital-status tooltip on DiscoveryPage ProfileCard breakdown (T&S deferred)
- Phase 41i: telemetry post-launch — check score distribution shift after Phase 41e refinements
- Phase 41j: dynamic denominator extended to other dimensions (lifestyle pattern proven)
- Onboarding: surface Phase 41a dealbreakers more prominently (currently buried under Marriage Promise)
- Press kit: real product screenshots to add week of July 1
- Customer support email triage flow (support@marryzen.com)
- Facebook Ads — application pending per founder
- Stripe DPA revisit (Q1 2027)

### ⚪ Strategic decisions worth founder time later

- Joan Colomé response review (if Joan replies with Module 2 annexes + UK IDTA + TIA)
- PaymentCloud terms review (if PaymentCloud quotes within 48h)
- Founding-500 founder welcome email finalization
- Post-launch retention telemetry baseline + dashboards

---

## Launch sequence

**T-17 days (now)** → P0a + P0b + P0c. Compliance + vendor + secret rotation.
**T-7 days (Jun 24)** → Final QA pass, founding-500 invite list locked, Sandra UAT
**T-3 days (Jun 28)** → Feature freeze, monitoring drill
**T-1 day (Jun 30)** → Founder pre-flight checklist
**T-0 (Jul 1)** → Soft launch — Founding-500 only
**T+76 days (Sep 15)** → Hard launch, founding cohort closes, public signup

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

---

## Session changelog

**2026-06-14 (morning) — Day 2:** Phase 41e applied + Phase 41f age preference UI + Phase 41g scorer hygiene. 4 commits. Live UAT pass on /account-settings + /press + /404.

**2026-06-13 (afternoon) — Day 1:** Phase 38 + Phase 40 + Phase 41 + Phase 41a + Phase 41b + Phase 41c + Phase 41d + Phase 42 + Phase 44 + Phase 60 + compliance pack drafts. 18 commits + 9 decision docs.

**2026-06-12 → 2026-06-13 overnight (prior session):** Phase 29-58. Admin UI dispatcher, didit-webhook v12, email infrastructure, mobile/a11y fixes, storage backup, ProfilePage rescue, audit_logs rename.
