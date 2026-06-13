# Marryzen — Roadmap & Status

Last updated: **2026-06-13** (post 16-hour overnight session)
Soft launch: **2026-07-01** (18 days away)
Hard launch: **2026-09-15** (was Aug 15, extended Jun 12)

---

## Status snapshot

| Stack | State |
|---|---|
| Frontend (Vercel) | Green on commit `aceb682` (post ProfilePage truncation rescue). All today's 5-file a11y + analytics work live. |
| Backend (Supabase Edge Functions) | didit-webhook v12, email-cadence-tick, send-verification-result, storage-backup-tick all deployed and tested. |
| DB | Migrations through 2026-06-13. Founding-500 trigger active. Pending verification queue table live. Storage backup tracking live. |
| Backups | Daily Supabase DB backups + nightly Storage→S3 sync (operational; 65 photos verified in `marryzen-backups-eu-west-1`). PITR deferred per board. |
| Email | 11 transactional emails operational. Behavioral cadence (T+1h/24h/48h/10d) wired. Founding-500 founder welcome wired. Verification result emails wired with 60-min delay queue. |
| Compliance | ROPA v1.0.5, DPIA v1.0.4, TOMs v1.0 (uploaded to Prighter slot, 2026-06-12). Prighter EU+UK reps Active. |

---

## Just shipped — overnight session 2026-06-12 → 2026-06-13

### P0 launch blockers cleared (18 phases)

| Phase | Description |
|---|---|
| 29-32 | Admin UI dispatcher fix — role/status/verified/notes/identity writes now route through `log_admin_*` RPCs (audit logs land atomically) |
| 33-34 | Verified didit-webhook v11 deployed + PostHog/Sentry events flowing |
| 35 | Backup posture decision (PITR deferred → DIY S3 mirror) |
| 36-37 | Email infrastructure audit + a11y/mobile audit (two deep agent passes) |
| 39 | Annual compliance review scheduled (June 1 each year) |
| 43 | FileReader fallback for iOS in-app webviews (closes 27 Sentry events / 14 users) |
| 45 | PostHog `identify()` + Sentry `setUser()` actually wired — events now attributed to auth.uid instead of anonymous device IDs |
| 46 | Storage backup to AWS S3 (3-file build + AWS console setup + RLS diagnosis: 65 photos confirmed in S3) |
| 48 | Mojibake fix in Stripe receipts + dunning emails (every paying customer was seeing `Ã¢ÂÂ`) |
| 49 | Gold-button WCAG contrast (Landing + Onboarding) |
| 50 | email-cadence-tick Edge Function — was a 9-line stub, now full state machine with race-safe locking |
| 51 | Founding-500 founder-signature welcome email (replaces institutional T+1h for cohort) |
| 52 | Verification approved/rejected emails — instant approval, 60-min delay queue on rejection |
| 53-55 | Mobile/a11y fixes — ProfilePage hover-only photo edit, Discovery carousel 300% overflow, filter-tag X buttons |
| 56 | Dashboard Premium-locked blur a11y (CSS blur was being read by screen readers) |
| 57 | Recovered truncated ProfilePage.jsx that froze prod for 7 hours |
| 58 | Storage backup RPC diagnosis (tracking table shows 65, S3 verified — system in steady state) |

### New infrastructure live

- `pending_verification_rejections` table + 5-min cron processor (60-min delay queue, cancels on later verification)
- `storage_backup_tracking` table + 03:00 UTC cron (nightly Storage→S3 sync)
- `founding_member` column + atomic INSERT trigger (cohort closes at 500 OR 2026-09-15)
- `email_cadence_state` jsonb on profiles (state machine: signup → welcomed → profile_nudged → verify_nudged → re_engaged → dormant/done)
- AWS S3 bucket `marryzen-backups-eu-west-1` (eu-west-1) with lifecycle policy: 30d→Standard-IA, 90d→Glacier Flexible Retrieval
- IAM policy `marryzen-storage-backup-write` attached to existing `marryzen-rekognition` user
- Annual compliance review scheduled task (next: June 1, 2027)

### Strategic decisions locked

- **PITR**: deferred. DIY S3 sync at ~$2/mo instead of $100/mo. Trigger to revisit: first paying customer OR 1,000 active users OR first bad-migration incident.
- **Founding cohort**: closes at 500 OR 2026-09-15 (extended from Aug 15)
- **Sender for Founding-500 founder welcome**: `hello@marryzen.com` (signed "Omer" — first name only). Reply opt-in, not blanket.
- **Voice rules**: institutional default ("Marryzen", "we at Marryzen") — never "our team". Founder voice only for Founding-500 welcome + crisis comms.

---

## Open carryovers

### Should-do before launch (18 days)

- [ ] Phase 38 — 404 + maintenance pages + OG tags audit + press kit folder structure
- [ ] Phase 40 — Art. 34 customer-facing breach notification templates (paired with IR Runbook v1.1)
- [ ] Phase 44 — Homepage RangeError stack overflow (5 events in 6 days — diagnose root cause)

### Strategic decisions worth board consult

- [ ] Phase 41 — Matchmaking v1.5 scope (full v2 too big for launch; recommend weighting-only layer)
- [ ] Phase 42 — PaymentCloud fallback if CCBill + Segpay don't respond (user said PaymentCloud is third-tier option)

### Vendor follow-ups (waiting on humans, not code)

- [ ] Joan Colomé / Didit second chase — silent since June 7 on SCC Module 2 annexes + UK IDTA + TIA (recommend Mon June 15 ping)
- [ ] Vercel DPA chase email — drafted June 9, may not have been sent
- [ ] Segpay + CCBill quote requests (Phase 31, long-pending)

### Pre-launch operational

- [ ] Backup admin account — single super_admin on believerfellow@gmail.com is a single point of failure
- [ ] Onboarding email sequence — Phase 50 cadence is wired; consider adding more drips beyond T+1h/24h/48h/10d
- [ ] Final mobile responsive QA pass on key flows
- [ ] Lighthouse + a11y audit on `/`, `/discovery`, `/profile`, `/onboarding`
- [ ] Backup/restore drill — verify Supabase PITR-equivalent restore from a daily backup actually works
- [ ] PostHog + Sentry smoke verify post-identify-wiring (confirm new events show user UUIDs not device IDs)
- [ ] Press kit folder structure (logos, screenshots, copy, founder bio)
- [ ] Customer support email triage flow (support@marryzen.com exists per user)
- [ ] Founding-500 outreach strategy + invite list curation (user gated this on "running system A to Z first")
- [ ] Facebook Ads — application pending per user

### Compliance / TOMs follow-ups

- [ ] Rotate `CRON_SECRET` from literal `marryzen-cron-2026` to a random 32-byte value before launch (env vars in send-verification-result, email-cadence-tick, storage-backup-tick must all match)
- [ ] Confirm `marketing_emails_opt_out` column added to profiles (referenced by email-cadence-tick suppression check but column doesn't exist yet)
- [ ] Bump TOMs to v1.1 with explicit RPO 24h / RTO 24h documented (per board recommendation)
- [ ] One tested-restore drill documented (Art. 32 evidence for any audit)

---

## Launch sequence (2026-07-01 soft / 2026-09-15 hard)

**T-18 days (NOW):** Pre-launch P1 items above
**T-7 days:** Final QA pass, rotate secrets, founding-500 invite list locked
**T-3 days:** Feature freeze, monitoring drill
**T-1 day:** Founder pre-flight (verify all Vercel envs, all Supabase env vars, all Edge Functions deployed)
**T-0 (July 1):** Soft launch — first 500 invited only
**T+45 days (Aug 15):** Original hard launch date — now extended
**T+76 days (Sept 15):** Hard launch — founding cohort closes regardless of 500 count, public signup opens

---

## Operational runbook references

- Brand voice rules: `CLAUDE.md` § "Brand naming convention"
- File-delivery format (the "usual way"): `CLAUDE.md` § "Critical #1"
- Canonical enum values for profiles.*: `CLAUDE.md` § "Canonical profiles.* enum values"
- Prighter portal: `https://app.prighter.com/portal/marryzen` (business ID 11024664158)
- AWS S3 backup bucket: `marryzen-backups-eu-west-1` (eu-west-1)
- Supabase project: `adufstvmmzpqdcmpinqd`
