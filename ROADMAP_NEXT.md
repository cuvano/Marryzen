# Marryzen — Roadmap & Status

Last updated: **2026-06-13** (post-day-after-overnight session — Phase 38 through Phase 41d shipped)
Soft launch: **2026-07-01** (18 days away)
Hard launch: **2026-09-15** (was Aug 15, extended Jun 12)

---

## Status snapshot

| Stack | State |
|---|---|
| Frontend (Vercel) | Green on commit `4cce360` (Phase 41c — Step5 deal-breaker MatchPreferencesCard). All 11 commits from this session live (Phase 38 5x, Phase 44 1x, Phase 41/a/b/c/d 6x). |
| Backend (Supabase Edge Functions) | didit-webhook v12, email-cadence-tick, send-verification-result, storage-backup-tick all deployed and tested. PostHog dynamic surveys.js disabled (Phase 44 iOS fix). |
| DB | Migrations through 2026-06-13 04:00. 3 new migrations awaiting `supabase db push`: `matchmaking_v15_faith_reweight`, `phase41a_dealbreaker_columns`, `phase41d_faith_align_acknowledged_at`. |
| Backups | Daily Supabase DB backups + nightly Storage→S3 sync (operational; 65 photos in `marryzen-backups-eu-west-1`). PITR deferred per board. |
| Email | 11 transactional emails operational. Behavioral cadence (T+1h/24h/48h/10d) wired. Founding-500 founder welcome wired. Verification result emails wired with 60-min delay queue. |
| Compliance | ROPA v1.0.5, DPIA v1.0.4, TOMs v1.0 (uploaded to Prighter slot, 2026-06-12). Prighter EU+UK reps Active. **Pending bumps:** ROPA v1.0.6 + DPIA v1.0.5 + Termly Section 14 — all drafted in `Phase41d_Compliance_Updates_Pack_2026-06-13.md`, awaiting founder application. |
| Public OG / Social previews | Working — `og-image.png` (1200x630, wordmark + tagline + gold border) live at `/og-image.png`. Twitter card validator + FB debugger should both render. |

---

## Just shipped — this session (2026-06-13 afternoon)

### Code commits live on Vercel master

| Phase | SHA | Description |
|---|---|---|
| 38 | `5dd08ca` | public/ bundle: og-image.png + og-image-square.png + og-image.svg + og-image-square.svg + maintenance.html + sitemap.xml refresh |
| 38 | `4f387e2` | NotFoundPage 404 refresh ("This page doesn't exist — but your match might.") + new PressKitPage at /press |
| 38 | `e31a886` | App.jsx wires /press route |
| 38 | `e42a468` | Footer adds Press link |
| 38 | `12314b5` | index.html OG/Twitter meta points to og-image.png + alt + secure_url |
| 44 | `7fe5fd6` | iOS Chrome Mobile RangeError fix: defer PostHog init via requestIdleCallback + `disable_surveys: true` — breaks Termly autoBlock × PostHog surveys.js × react-helmet trampoline on WebKit |
| 41 | `fd47a93` | matchmaking.js v1.5: faith weight 15→28, group bonus 0.6→0.4, + 3 reviewer-caught drift fixes (smoking 'Never'→'No', canonical seriousGoals + eduLevels) |
| 41 | `c22c1ba` | matching_config seeded row updated to v1.5 weights via idempotent migration |
| 41a | `ecb2c56` | 4 dealbreaker boolean columns on profiles + comments |
| 41a/b | `d76eb0c` | matchmaking.js Phase 41a hard filters + Phase 41b intent matrix + relationshipGoals.js canonical constants + analytics.js new events |
| 41a | `8ffdc59` | Reusable MatchPreferencesCard component (4 toggles, "Currently: X" hints, compact + card modes) |
| 41a | `62f2eb8` | AccountSettingsPage integrates MatchPreferencesCard with supabase persistence + PostHog telemetry |
| 41b | `e5f379e` | Step5 uses canonical relationshipGoals constants + renamed TMM display label to "Marriage-bound, family-introduced" |
| 41d | `50c3d90` | faith_align_acknowledged_at audit column on profiles |
| 41d | `eef8ca7` | FaithAlignedInterstitial component + Step5 conditional rendering |
| 41c | `4cce360` | Step5 deal-breaker MatchPreferencesCard with direct supabase persistence |

Plus the audit_logs column rename migration `5dd08ca`-era (`fix(audit): rename audit_logs columns to match log_admin_* RPC contract`) for Phase 60.

### Verified live in production JS bundle (post-deploy grep)

`/assets/index-44b54418.js` contains:
- ✅ "Continue with faith-aligned matches" (interstitial primary CTA)
- ✅ "Show me all faiths" (interstitial secondary CTA)
- ✅ "Marriage-bound, family-introduced" (TMM rename)
- ✅ "Your must-haves" (MatchPreferencesCard heading)
- ✅ "faith_align_acknowledged_at" (Phase 41d audit column reference)

### New compliance binder files (in C:\Marryzen)

| File | Purpose |
|---|---|
| `Matchmaking_v1.5_Decision_2026-06-13.md` | Board-approved v1.5 scope + faith re-weighting decision |
| `Marriage_Intent_Matrix_Decision_2026-06-13.md` | 4x4 compatibility matrix decision (replaces flat 70% bothSerious) |
| `Muslim_Women_Filter_Decision_2026-06-13.md` | Why P2 (strong default + interstitial), not P1 (hard rule). UK Equality Act §13 + GDPR Art. 22(3) reasoning. |
| `Phase41d_Compliance_Updates_Pack_2026-06-13.md` | DPIA v1.0.5 + ROPA v1.0.6 + Termly Section 14 + admin SOP — ready to apply |
| `Art34_Breach_Notification_Templates_v1.0.md` | 5 founder-signed templates (full breach / credentials / sub-processor / Art.9 / integrity-availability) |
| `Payment_Processor_Decision_2026-06-13.md` | Engage PaymentCloud today + parallel deadline-anchored escalation |
| `Segpay_CCBill_Escalation_Email_2026-06-13.md` | Ready-to-send chase email with June 16 deadline |
| `DPA_Chase_Email_Pack_2026-06-13.md` | Didit (Joan Colomé) + Vercel + generic template |
| `Prighter_Intake_Datamap_Checklist_2026-06-13.md` | Sub-processor list + Trust Center alignment + outstanding actions tracker |

### Strategic decisions locked

- **Matchmaking v1.5 faith re-weight**: ship the soft brand fix (faith weight up, group bonus tightened) **before** the deal-breaker hard filters. Both now live.
- **Marriage intent matrix**: 4x4 tiered (TMM↔FSC = 0.9, TMM↔SRM = 0.3, etc.) replaces flat 70% bothSerious branch. TMM display label renamed; stored value unchanged.
- **Muslim women filter posture**: P2 (strongly-defaulted opt-in + interstitial), NOT P1 (hard system rule). Board unanimous. The hard rule was rejected on UK §13 + GDPR Art. 22(3) grounds + because classical Islamic scholarship asks the woman to choose freely, not the platform to override.
- **PaymentCloud**: engage TODAY in parallel with the Segpay/CCBill escalation. Decision doc covers branching logic.
- **OG image**: cream + gold border + rose period wordmark + tagline. Twitter card + FB debugger should validate.
- **404 page**: institutional voice, dual CTAs (Join + Home), no founder voice (low-stakes surfaces).
- **Press kit**: stub route live at /press, factsheet + logo downloads + founder bio. Real screenshots to be added week of July 1.

---

## Open carryovers

### Should-do before launch (18 days) — compliance application

- [ ] **Apply 3 Supabase migrations** in this order via SQL editor (Supabase dashboard hydrates Monaco editor only when foregrounded):
  1. `20260613030000_matchmaking_v15_faith_reweight.sql` (idempotent — refresh seeded weights)
  2. `20260613040000_phase41a_dealbreaker_columns.sql` (add 4 boolean columns)
  3. `20260613050000_phase41d_faith_align_acknowledged_at.sql` (add timestamptz audit column)
- [ ] **Bump DPIA → v1.0.5** with §6.5 Matchmaking automated processing (full text in `Phase41d_Compliance_Updates_Pack_2026-06-13.md`). Export PDF, upload to Prighter DPIA slot. ~30 min.
- [ ] **Bump ROPA → v1.0.6** with new processing-activity row (drafted in same pack). Export PDF, upload to Prighter Controller RoPA slot. ~20 min.
- [ ] **Update Termly privacy policy Section 14** (Automated decision-making) — add the one paragraph drafted. Republish + verify green Prighter indicator. ~15 min.
- [ ] **File Admin Art. 22(3) Human-Intervention SOP** to `C:\Marryzen\Admin_Art22_Human_Intervention_SOP_2026-06-13.md`. ~5 min.

### Vendor outreach (ready to send — copy-paste emails)

- [ ] **Send PaymentCloud intake form** at paymentcloudinc.com — TODAY per decision doc
- [ ] **Send Segpay + CCBill escalation email** (ready in `Segpay_CCBill_Escalation_Email_2026-06-13.md`) — TODAY, June 16 deadline anchor
- [ ] **Send Didit chase email to Joan Colomé** (Template A in `DPA_Chase_Email_Pack_2026-06-13.md`) — TODAY. Escalate to compliance@didit.me if silent past June 15.
- [ ] **Send Vercel DPA confirmation email** (Template B in same pack) — fire-and-forget

### Live verification (low-effort smoke tests)

- [ ] **Walk Sandra account through onboarding as Muslim woman** to visually confirm Faith-aligned interstitial renders at Step5. Verify both buttons persist correctly to `dealbreaker_faith` + `faith_align_acknowledged_at`.
- [ ] **Walk Sandra account through Settings** to confirm MatchPreferencesCard renders, all 4 toggles work, "Currently: X" hints display correct profile values.
- [ ] **Smoke-test Discovery with dealbreakers enabled** — toggle on `dealbreaker_marital_status`, confirm Discovery hides candidates whose marital_status differs.
- [ ] **Twitter Card validator** + **Facebook Sharing Debugger** on https://www.marryzen.com/ — both should render the new OG image.
- [ ] **Watch Sentry 48h** for Phase 44 RangeError recurrence. If no new events from iOS Chrome Mobile, mark resolved.

### Pre-launch operational (carried over from prior roadmap)

- [ ] Backup admin account — single super_admin on believerfellow@gmail.com is a single point of failure
- [ ] Onboarding email sequence — Phase 50 cadence is wired; consider adding more drips beyond T+1h/24h/48h/10d
- [ ] Final mobile responsive QA pass on key flows
- [ ] Lighthouse + a11y audit on `/`, `/discovery`, `/profile`, `/onboarding`, `/press` (new)
- [ ] Backup/restore drill — verify Supabase PITR-equivalent restore from a daily backup actually works
- [ ] Customer support email triage flow (support@marryzen.com exists)
- [ ] Founding-500 outreach strategy + invite list curation
- [ ] Facebook Ads — application pending

### Compliance / TOMs follow-ups

- [ ] Rotate `CRON_SECRET` from literal `marryzen-cron-2026` to a random 32-byte value before launch (env vars in send-verification-result, email-cadence-tick, storage-backup-tick must all match)
- [ ] Confirm `marketing_emails_opt_out` column added to profiles (referenced by email-cadence-tick suppression check but column doesn't exist yet)
- [ ] Bump TOMs to v1.1 with explicit RPO 24h / RTO 24h documented
- [ ] One tested-restore drill documented (Art. 32 evidence)

### Future product polish (post-launch)

- [ ] Phase 41e (next session candidate): Discovery EmptyState enhancement — when feed is empty AND `dealbreaker_*` is enabled, show "loosen a must-have in Settings" hint
- [ ] Phase 41f: Daily-matches email + server-side scoring RPC (defer until daily-matches feature is greenlit — was rejected as standalone v1.5 work)
- [ ] Phase 41g: Behavioral learning (likes/passes adjust scores) — REJECTED at <5k MAU; revisit then
- [ ] Phase 41h: Full mutual-preference filtering — REJECTED at <2k users (empties feeds); revisit then
- [ ] Stripe DPA revisit (Q1 2027) — 6 months of clean transaction history + zero chargebacks changes their underwriting math

---

## Launch sequence (2026-07-01 soft / 2026-09-15 hard)

**T-18 days (NOW):** Pre-launch P1 items above + 3 Supabase migrations + 3 compliance bumps
**T-7 days:** Final QA pass, rotate secrets, founding-500 invite list locked, walk Sandra through full onboarding
**T-3 days:** Feature freeze, monitoring drill (Sentry + PostHog event-flow verification)
**T-1 day:** Founder pre-flight (Vercel envs, Supabase env vars, Edge Functions deployed)
**T-0 (July 1):** Soft launch — first 500 invited only
**T+45 days (Aug 15):** Original hard-launch date — now extended
**T+76 days (Sept 15):** Hard launch — founding cohort closes regardless of 500 count, public signup opens

---

## Operational runbook references

- Brand voice rules: `CLAUDE.md` § "Brand naming convention"
- File-delivery format (the "usual way"): `CLAUDE.md` § "Critical #1"
- Canonical enum values for profiles.*: `CLAUDE.md` § "Canonical profiles.* enum values"
- Canonical relationship_goal values + 4x4 matrix: `src/lib/relationshipGoals.js`
- Faith-aligned interstitial decision basis: `Muslim_Women_Filter_Decision_2026-06-13.md`
- Phase 41 series decision corpus: `Matchmaking_v1.5_Decision_*.md` + `Marriage_Intent_Matrix_Decision_*.md`
- Prighter portal: `https://app.prighter.com/portal/marryzen` (business ID 11024664158)
- AWS S3 backup bucket: `marryzen-backups-eu-west-1` (eu-west-1)
- Supabase project: `adufstvmmzpqdcmpinqd`

---

## Session changelog

**2026-06-13 (this update):** Shipped Phase 38, Phase 40 docs, Phase 41, Phase 41a, Phase 41b, Phase 41c, Phase 41d, Phase 42 docs, Phase 44, plus compliance work pack (Phase 28, Phase 27, Phase 31 escalation, Phase 60 audit_logs migration). 16 commits across Vercel. 9 new compliance / decision docs in C:\Marryzen.

**2026-06-12 → 2026-06-13 overnight (prior session):** Phase 29-58 (admin UI dispatcher, didit-webhook v12, email infrastructure, mobile/a11y fixes, storage backup, ProfilePage truncation rescue, audit_logs rename).
