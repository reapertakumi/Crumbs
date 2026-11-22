# Troubleshooting

First look at what Crumbs says:

```bash
cd /path/to/crumbs
docker compose logs --tail 40 crumbs
```

## Database key

**The page keeps asking for a database key although it's in `.env`.**

```bash
docker compose config | grep CRUMBS_DB_KEY
```

- Shows `CRUMBS_DB_KEY: ""` → `.env` isn't read. Check that it's a **file** named exactly `.env` (not a folder, not
  `.env.txt`) in the **same folder** as `docker-compose.yml` (`ls -la`), and that the line reads
  `CRUMBS_DB_KEY=yourkey` with no spaces around `=`. Also make sure your `docker-compose.yml` is current – it must
  have the `CRUMBS_DB_KEY: ${CRUMBS_DB_KEY:-}` line.
- Shows your key → recreate the container: `docker compose up -d --force-recreate` (`restart` isn't enough).

**Log says `CRUMBS_DB_KEY didn't open the database (wrong key)`.** The database is encrypted with a different key –
often one you typed on the web page earlier. Use that one, in `.env` or on the Unlock page.

**Log says `can't read …/crumbs.db.salt`.** The salt file is missing. Put back `crumbs.db.salt` from the same backup
as the database; without it the key can't be rebuilt.

**Log says `encrypting the database failed (nothing was changed)`.** The old unencrypted database is untouched.
Send the full message to whoever maintains your Crumbs (or open an issue), together with
`ls -la data/`.

## Can't reach it

- `docker compose ps` should show `crumbs` as `running`.
- Use the Pi's address from `hostname -I`, with the port: `:9099` (http) or `:9443` (https).
- **https warning "not private"**: expected with the self-signed certificate; choose *Advanced → Continue*. See
  [https.md](https.md).

## `docker compose pull` says denied / unauthorized

The image package on GitHub is private. Owner of the repository: GitHub profile → **Packages → crumbs → Package
settings → Change visibility → Public**. Or `docker login ghcr.io` on the Pi with a token that has `read:packages`.

## "Your kernel does not support memory limit capabilities"

Harmless – see [configuration.md](configuration.md#memory).

## No thumbnails

Your **browser** fetches thumbnails, then stores them on the Pi. Some sites have no preview picture or block
requests. Try *Edit → Refetch preview*, *Settings → Maintenance → Refresh all previews*, or upload / paste your own
screenshot in the editor.

## Locked out

- Forgot your password: another admin resets it (*Admin → ⋯ → Reset password*).
- Blocked: an admin unblocks you (*Admin → ⋯ → Unblock access*).
- Too many wrong tries: wait 10 minutes.
