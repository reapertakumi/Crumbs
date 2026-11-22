# Install Crumbs on a Raspberry Pi 5

This guide takes you from a fresh Pi to a running, encrypted Crumbs in about ten minutes.

**You need:** a Raspberry Pi 5 with Raspberry Pi OS (64-bit), connected to your home network, and a way to type
commands on it (a keyboard and screen, or `ssh` from your computer).

## 1. Install Docker

Skip this if `docker --version` already works.

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out and back in (or reboot) so the second line takes effect.

## 2. Make a folder for Crumbs

Pick any folder; everything Crumbs stores ends up in `data/` inside it. For example:

```bash
mkdir -p ~/crumbs && cd ~/crumbs
```

Then get the two setup files. Either clone the whole project (easiest to update later):

```bash
git clone https://github.com/reapertakumi/Crumbs.git ~/crumbs && cd ~/crumbs
```

or download just what you need:

```bash
curl -fsSLO https://raw.githubusercontent.com/reapertakumi/Crumbs/main/docker-compose.yml
curl -fsSL  https://raw.githubusercontent.com/reapertakumi/Crumbs/main/.env.example -o .env.example
```

## 3. Choose your database key

Crumbs keeps everything in an **encrypted database**. You choose its key. Decide how Crumbs gets the key after
each start (see [encryption.md](encryption.md) for the details):

- **Automatic** – the key sits in a `.env` file and Crumbs unlocks itself. Easiest.
- **By hand** – you type the key on an Unlock page after every restart. Safest: the key never touches the SD card.

For **automatic**, create `.env` with a strong random key:

```bash
KEY=$(openssl rand -base64 32)
printf 'CRUMBS_DB_KEY=%s\nTLS_HOSTS=%s.local\nHTTP_REDIRECT=0\n' "$KEY" "$(hostname)" > .env
chmod 600 .env
echo "Your database key: $KEY"
```

**Save the printed key in your password manager now.** Without it nobody – not even you – can open your
bookmarks or your backups.

For **by hand**, skip this step; Crumbs will ask you for a key in the browser.

## 4. Start Crumbs

```bash
docker compose pull
docker compose up -d
docker compose logs --tail 20 crumbs
```

The log should end with `database unlocked` (automatic key) or `the database is locked: open Crumbs in a
browser and enter the key` (by hand).

> **`pull` says "denied"?** The image on GitHub is private. The owner of the repository opens their GitHub
> profile → **Packages → crumbs → Package settings → Change visibility → Public** once. Or keep it private and run
> `docker login ghcr.io` on the Pi with a token that has `read:packages`.

## 5. Open it

Find the Pi's address with `hostname -I`, then open one of these in a browser on your network:

- `http://<pi-address>:9099`
- `https://<pi-address>:9443` – encrypted connection. The browser warns once about the certificate; choose
  **Advanced → Continue**. See [https.md](https.md).

On a fresh install you'll see:

1. **Choose a database key** (only if you didn't put one in `.env`). Type it twice and write it down.
2. **Welcome**: create the first account. It becomes the **admin**.

That's it. Next: [using.md](using.md) shows the tour, [backups.md](backups.md) how to keep your data safe.

## Compile on the Pi instead

Normally the Pi downloads a ready-made image that GitHub builds on every push. To build it yourself, clone the
repository, open `docker-compose.yml`, comment out the `image:` line, uncomment `build: .` and run:

```bash
docker compose up -d --build
```

The first build takes a few minutes.
