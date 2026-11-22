# Encryption

## What is protected

| What | How |
| ---- | --- |
| Database `data/crumbs.db`: accounts, sign-ins, folders, bookmarks, tags, settings | **Encrypted** with your database key (Adiantum, whole file incl. its write-ahead log) |
| Passwords inside the database | Additionally stored as salted **PBKDF2-SHA256** hashes, never as text |
| Sign-ins and API tokens | Stored only as hashes |
| Backups made by Crumbs | **Encrypted** with the same key (they contain the encrypted database) |
| Connection between your browser and the Pi | Encrypted when you use `https://…:9443` – see [https.md](https.md) |
| Thumbnails, favicons, profile photos (`data/img`, `data/avatars`) | **Not** encrypted |

## The database key

You choose the key once. Crumbs stretches it (PBKDF2-SHA256, 600,000 rounds) with a random salt stored in
`data/crumbs.db.salt`. The salt isn't secret, but **the database can't be opened without it** – keep it next to the
database (backups include it automatically).

> **Lose the key and the data is gone.** There is no reset and no back door; that's the point of encryption. Keep the
> key in a password manager.

### Getting the key at start: two ways

**Automatic (`.env`)** – Crumbs unlocks itself whenever the Pi starts.

```bash
cd /path/to/crumbs            # the folder with docker-compose.yml
KEY=$(openssl rand -base64 32)
printf 'CRUMBS_DB_KEY=%s\n' "$KEY" >> .env
chmod 600 .env
echo "$KEY"                   # save this in your password manager
docker compose up -d --force-recreate
```

Convenient, but whoever holds the whole SD card / disk also has `.env` and so the key. It still protects backups
and database copies that leave the Pi.

**By hand (Unlock page)** – leave `CRUMBS_DB_KEY` empty. After every start Crumbs shows **Crumbs is locked**; an
admin types the key and Crumbs opens. Nothing else works until then (the nightly backup waits too). Safest: the key
never touches the disk.

You can switch between the two at any time: add or remove the line in `.env` and run
`docker compose up -d --force-recreate`.

## First start after updating from an older Crumbs

Older versions stored the database unencrypted. The first time the new version starts:

1. **Download a backup first:** *Admin → Backups → Back up now → Download*.
2. Open Crumbs. It shows **Choose a database key** and asks you to **sign in with an admin account** (so nobody else
   on your network can pick the key first). With `CRUMBS_DB_KEY` in `.env` this happens automatically at start.
3. Crumbs copies every table into a new encrypted file, compares the row counts, and only then removes the old
   unencrypted file. If anything fails, nothing is changed and you see the error.

Backups made **before** the switch are still unencrypted: delete them from `data/backups` once a new backup exists.

## Checking it works

```bash
docker compose config | grep CRUMBS_DB_KEY   # shows your key if .env is read ("" means it isn't)
docker compose logs --tail 20 crumbs          # "database unlocked" / "database encrypted"
head -c 16 data/crumbs.db | od -c | head -1   # an unencrypted file starts with "SQLite format 3"
```

## Changing the key

Not built in yet. Workaround: *Import / export → Crumbs backup (.json)* to export everything, stop Crumbs, move
`data/crumbs.db*` away, start with the new key, and import the file again (thumbnails are fetched again).

## Problems

See [troubleshooting.md](troubleshooting.md#database-key).
