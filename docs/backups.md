# Backups, restore and updates

## Where your data lives

Everything is in `data/` next to `docker-compose.yml`:

```text
data/
├── crumbs.db       # the encrypted database: users, sign-ins, folders, bookmarks, tags, settings
├── crumbs.db.salt  # needed together with your key to open the database
├── avatars/        # uploaded profile photos
├── img/            # thumbnails and favicons
├── tls/            # the self-signed HTTPS certificate
└── backups/        # nightly backups (the newest 7)
```

## Automatic backups

Every night at **3:00** (the Pi's time zone) Crumbs writes `data/backups/crumbs-YYYY-MM-DD-HHMMSS.zip` with the
encrypted database, its salt, thumbnails, favicons and profile photos, and keeps the newest 7.
In the app: **Admin → Backups** shows them, **Back up now** makes one, **Download** saves one to your computer.

A backup on the same SD card / disk won't survive that card dying. Download one now and then, or copy
`data/backups` to another machine:

```bash
scp -r pi@pi5.local:/path/to/crumbs/data/backups ./crumbs-backups
```

Restoring needs your **database key** – the backups are encrypted with it.

With the key typed by hand (no `CRUMBS_DB_KEY`), backups only run while Crumbs is unlocked.

## Restore a backup

```bash
cd /path/to/crumbs
docker compose stop
mkdir restore && cd restore && unzip ../data/backups/crumbs-YYYY-MM-DD-HHMMSS.zip && cd ..
cp restore/crumbs.db restore/crumbs.db.salt data/
rm -f data/crumbs.db-wal data/crumbs.db-shm
cp -r restore/img restore/avatars data/
docker compose start
```

No `unzip`? `sudo apt install unzip`.

## Export instead of backup

**Import / export** (menu under your picture) saves your bookmarks and folders as a browser bookmark file,
JSON, CSV, Markdown or a list of links. Exports are **not encrypted** – they're meant to move bookmarks to another
app. Each user exports their own; admins can export anyone's.

## Update Crumbs

```bash
cd /path/to/crumbs
git pull                 # only if you cloned the repository
docker compose pull
docker compose up -d
```

To stay on one version instead of `latest`, put it in `docker-compose.yml`:
`image: ghcr.io/reapertakumi/crumbs:1.1.0` (or `:1.0.0`).

## Go back to an older version

Every release is tagged. To go back:

```bash
git checkout v1.0.0                  # or any tag/commit
docker compose up -d --build         # with build: . enabled in docker-compose.yml
```

or pin the image tag as shown above. The tag `restore-before-encryption` is the last version without the
encrypted database; it only opens backups made before encryption was turned on.

## Forgot something?

- **Admin password:** another admin resets it in *Admin → ⋯ → Reset password*. If you're the only admin, stop
  Crumbs, move `data/crumbs.db` and `data/crumbs.db.salt` away, and start fresh (you lose the data unless you can
  restore a backup and still know the admin password).
- **Database key:** the database and its backups can't be opened without it. That's what encryption means.
