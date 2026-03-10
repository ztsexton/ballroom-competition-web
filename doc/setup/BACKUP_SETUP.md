# Backup & Restore

Ballroom Scorer supports full data backup and restore through the Admin Dashboard. Backups are compressed JSON files that capture all competitions, people, couples, judges, events, scores, schedules, users, and site settings.

## How It Works

1. Admin clicks **Download** in the Backups card on the Admin Dashboard
2. The server exports all data via the data service (works with both JSON and PostgreSQL backends)
3. The export is gzip-compressed and downloaded as a `.json.gz` file
4. To restore, admin clicks **Restore** and uploads a previously downloaded backup file
5. The server decompresses, validates, and re-imports all data

Backups are portable across storage backends — you can back up from PostgreSQL and restore to JSON file storage (or vice versa).

## Usage

### Download a Backup

1. Go to the Admin Dashboard (`/dashboard`)
2. Find the **Backups** card in the Site Administration section
3. Click **Download**
4. Save the `.json.gz` file somewhere safe (Google Drive, external drive, etc.)

### Restore from a Backup

1. Go to the Admin Dashboard
2. Click **Restore** in the Backups card
3. Select a `.json.gz` backup file (or plain `.json`)
4. Confirm the restore — this **replaces all existing data**
5. The page reloads with restored data

### Via API

```bash
# Download backup
curl -H "Authorization: Bearer $TOKEN" \
  https://your-app/api/database/backup -o backup.json.gz

# Restore backup
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -F "backup=@backup.json.gz" \
  https://your-app/api/database/restore
```

## What's Included

A backup contains everything needed to fully recreate the application state:

- All competitions (settings, pricing, levels, validation rules)
- All people, couples, and judges per competition
- All events with heats and round structure
- All scores and judge scores
- Schedules and heat statuses
- Competition admin assignments
- User accounts and profiles
- Studios and organizations
- Judge profiles
- Site settings

## Recommended Backup Schedule

Since backups download to your browser, set a recurring reminder to back up regularly:

- **During a competition**: Back up before and after each session (morning, lunch, end of day)
- **Normal operations**: Weekly backups are sufficient
- **Before major changes**: Always back up before bulk imports, data migrations, or server upgrades
