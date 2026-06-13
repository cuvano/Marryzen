# Storage backup setup (Phase 46, 2026-06-12)

Board-recommended DIY alternative to Supabase PITR. Total cost: ~$1-3/mo on AWS S3 vs $100/mo PITR add-on.

## What you're building

A nightly job that copies every Supabase Storage object (profile photos, selfies) to an AWS S3 bucket. Independent restore path from Supabase's daily DB backups. Together they give a defensible Art. 32 backup posture for the GDPR auditor — daily DB + nightly Storage, both tested-restorable.

## One-time AWS setup

### 1. Create an S3 bucket

In the AWS Console (region: **eu-west-1** to match your Supabase region — avoid cross-region transfer costs):

1. **S3 → Create bucket**
2. Name: `marryzen-backups-eu-west-1` (or anything globally-unique)
3. Region: **EU (Ireland) eu-west-1**
4. Block all public access: **ON** (default)
5. Bucket versioning: **Enable** (protects against accidental delete + ransomware)
6. Default encryption: **SSE-S3** (free, automatic)
7. Click **Create bucket**

### 2. Add a lifecycle policy (auto-cheaper over time)

On the bucket → **Management** tab → **Create lifecycle rule**:

- Name: `transition-to-glacier`
- Apply to: **All objects in the bucket**
- Transitions:
  - Day **30**: Move to **Standard-IA** (~$0.0125/GB-month)
  - Day **90**: Move to **Glacier Flexible Retrieval** (~$0.0036/GB-month)
- Expiration: leave OFF (you want long retention for compliance)

This means hot recent backups stay fast/cheap; cold compliance copies move to Glacier. At ~9 GB total (500 users × 6 photos × 3MB), monthly storage cost is well under $1.

### 3. Create an IAM user for the backup job

**IAM → Users → Create user**

1. Name: `marryzen-storage-backup`
2. Access type: **Programmatic access** (no console)
3. Attach policy: **Create policy** → JSON tab → paste this minimal scope:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:PutObjectAcl"],
         "Resource": "arn:aws:s3:::marryzen-backups-eu-west-1/*"
       }
     ]
   }
   ```

   Save it as `marryzen-storage-backup-write`. Attach to the user.

4. After creation, **download the CSV** with the Access Key ID + Secret Access Key. Keep it safe — Secret only shown once.

### 4. Set the Edge Function env vars in Supabase

Supabase Dashboard → Edge Functions → **Secrets** (left sidebar) → **Add new secret**. Add these one at a time:

| Name | Value |
|---|---|
| `S3_BACKUP_BUCKET` | `marryzen-backups-eu-west-1` (or your chosen bucket name) |
| `S3_BACKUP_REGION` | `eu-west-1` |
| `S3_BACKUP_PREFIX` | `supabase-storage` (folder prefix inside the bucket — keep clean separation if you ever back up other things to the same bucket) |
| `AWS_ACCESS_KEY_ID` | from the CSV |
| `AWS_SECRET_ACCESS_KEY` | from the CSV |
| `BACKUP_BUCKETS` | `profile-photos,selfies` (comma-separated list of Supabase Storage buckets to back up — verify these match your actual bucket names in Supabase → Storage) |

Optional:
| Name | Default | Notes |
|---|---|---|
| `CRON_SECRET` | `marryzen-cron-2026` | Match what the migration uses |
| `BATCH_SIZE` | `200` | Max objects per nightly tick. Increase if your nightly diff exceeds 200 files. |

**Note:** `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` may already be set if you've been using AWS Rekognition for biometric face match (didit-webhook). If so, those creds need PutObject permission on the backup bucket too — easier to give the existing IAM user the new policy. Or, cleaner: use a separate dedicated IAM user for the backup job to keep concerns separated.

## Apply the SQL migration

Paste `20260612230000_storage_backup.sql` into the Supabase SQL Editor and Run. This creates:

- `storage_backup_tracking` table (records what's been backed up)
- `pg_cron` job `storage-backup-tick` (runs nightly at 03:00 UTC)

## Deploy the Edge Function

Create a new Edge Function in the Supabase dashboard named exactly `storage-backup-tick`. Paste the contents of `storage-backup-tick-index.ts`. Deploy.

## First run + verification

The cron only fires at 03:00 UTC, so to test sooner:

1. Click **Test** in the Edge Function dashboard. POST with no body.
2. Watch the response. First run will scan all Storage objects and back them up — could be slow for the initial bulk.
3. Check the response JSON's `summary` for each bucket: `{scanned, backed_up, skipped, errors}`.
4. In AWS S3 console, browse the bucket. You should see `supabase-storage/profile-photos/...` with your photos.
5. Re-run. Second run should show `backed_up: 0` (nothing new since last run).

## Verifying the first restore

Don't actually delete anything in Supabase. Instead, simulate by downloading one S3 object and confirming it matches the Supabase original by file size + MD5. Document this drill in your TOMs as the "tested-restore" requirement (Art. 32 evidence).

## When to add DB-level pg_dump backup

Daily Supabase backups (Pro tier default) cover the DB for 7 days. That's the floor and is defensible.

Add a separate pg_dump → S3 nightly job if/when:
- First paid customer
- 1,000+ active users
- A DPA negotiation requires a documented sub-hour RPO

Until then, this Storage sync + the existing Supabase daily DB backup is the right posture.

## Cost monitoring

After first run, check AWS Cost Explorer monthly. Expected:
- Storage: $0.10-1/mo (depends on user count + photo volume)
- Requests (PUT + LIST): ~$0.50/mo
- Data transfer OUT: $0 (Supabase → S3 in same region is free)
- Glacier transitions: pennies

Total: should stay under $3/mo for the first 1000 users.

## Troubleshooting

- **"missing_s3_env" 500 error** → secrets not set in Edge Function. Check Supabase → Edge Functions → Secrets.
- **"S3 PUT 403"** → IAM policy doesn't grant PutObject on the bucket. Check the policy JSON above is attached.
- **"S3 PUT 301"** → wrong region. Confirm `S3_BACKUP_REGION` matches where the bucket actually lives.
- **`backed_up` always 0** → tracking table thinks everything is already backed up. To force a re-sync, `DELETE FROM storage_backup_tracking;` then re-run.
- **Edge Function times out (60s)** → reduce `BATCH_SIZE` to 50 or 100. Cron will pick up the rest on the next tick.
