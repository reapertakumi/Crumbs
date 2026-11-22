<p align="center">
  <img src="web/icon.svg" width="96" alt="Crumbs logo: a bitten cookie and its crumbs">
</p>

<h1 align="center">Crumbs</h1>

<p align="center">
  Your bookmarks as a wall of pictures, kept safe on your own Raspberry Pi 5.<br>
  One small Docker container · encrypted database · <b>http :9099</b> and <b>https :9443</b>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#browser-extension">Browser extension</a> ·
  <a href="#android-app">Android app</a> ·
  <a href="#features">Features</a> ·
  <a href="#documentation">Documentation</a> ·
  <a href="#how-to-find-crumbs-on-the-internet">The crumb story</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

---

## Quick start

On a Raspberry Pi 5 with Raspberry Pi OS (64-bit) and Docker installed:

```bash
git clone https://github.com/reapertakumi/Crumbs.git && cd Crumbs

# Optional: a database key so Crumbs unlocks itself at start (save the printed key!)
KEY=$(openssl rand -base64 32); printf 'CRUMBS_DB_KEY=%s\n' "$KEY" > .env; chmod 600 .env; echo "$KEY"

docker compose pull
docker compose up -d
```

Then open `https://<pi-address>:9443` (accept the certificate warning once) or `http://<pi-address>:9099`.
If you skipped the key, choose one on the Unlock page. The first account you create is the admin.

**Updating:** `docker compose pull && docker compose up -d`. The step-by-step guide is in
**[docs/install.md](docs/install.md)**.

---

## Browser extension

Save the page you're on with one click: thumbnail, favicon, name, link, folder and description.

<p>
  <a href="https://chromewebstore.google.com/detail/crumbs/jaibbgbglgbajgpdafmfnfjebjomhobo"><b>Add to Chrome</b></a> (Chrome Web Store) ·
  <a href="https://github.com/reapertakumi/Crumbs-Extension">Source code</a> ·
  <a href="https://github.com/reapertakumi/Crumbs-Extension/releases/latest">Latest release</a>
</p>

Connect it to your Pi once with your Crumbs address and sign-in. See
[docs/using.md](docs/using.md#browser-extension).

---

## Android app

Your Crumbs in an app, plus **Share → Crumbs** from any app on your phone (Chrome, YouTube, Reddit, …).

<p>
  <a href="https://github.com/reapertakumi/Crumbs-Android/releases/latest"><b>Download the APK</b></a> (latest release) ·
  <a href="https://github.com/reapertakumi/Crumbs-Android">Source code</a>
</p>

- Saves offline first and syncs to your Pi when it's reachable, at home or over Tailscale.
- Quick editor with thumbnail, folder, tags and description, or instant save with one tap.
- Works with the encrypted database and HTTPS, stays signed in for a year, and updates itself from GitHub.
- About 70 KB, with no tracking and no Google services.

---

## Features

### Your crumbs
- **A visual grid.** Every bookmark is a card with a thumbnail, favicon, name, site, description and tags.
- **Filled in for you.** Paste a link and Crumbs takes the page's title (the one on the browser tab), description,
  favicon and preview picture. YouTube links get the video title, channel and thumbnail.
- **Search links look like searches.** A saved Google, YouTube, Bing, DuckDuckGo, Amazon, Reddit or GitHub search
  shows the site's icon and name with the words you searched.
- **Your own pictures.** Upload, paste (Ctrl+V) or drag in any image, like a screenshot.
- **Refresh.** Get a new preview, title or description for one crumb, a selection, or everything. Pictures you set
  yourself are kept.

### Keeping them tidy
- **Folders and subfolders** in a sidebar tree, each with its own color and icon. Drag to reorder or nest them.
  Crumbs without a folder sit in **Uncategorized**.
- **Tags** with their own sidebar list. Rename or remove them, and search with `#tag`.
- **Select many at once.** Drag a box, tick cards, Shift-click a range or press Ctrl+A. Then move, tag, refresh,
  export or trash them, or drag them onto a folder, tag or the Trash.
- **Instant search** (press `/`) across name, link, description and folder. **Sort** by title, created, updated,
  link, description or folder.
- **Trash** with Undo, emptied after 30 days.
- **No duplicates** (optional): a link only once everywhere, or only once per folder.
- **Broken link checker** that marks dead links with a **Broken** badge.

### Bringing them in and out
- **Import** from any browser's bookmark file (.html), Chrome or Crumbs .json, .csv (Pocket, Raindrop, …),
  Markdown or a plain list of links. Folders and tags are kept.
- After an import, thumbnails and favicons are fetched for you, with 3 retries. You can review anything that
  was skipped and keep it anyway.
- **Export** to the same formats.

### Your look
- Black and white by default, with **light, dark or system** theme.
- Four **layouts**: Grid, Gallery, List and Compact. A **size slider** (or Ctrl + scroll) makes cards bigger or
  smaller.
- **Backgrounds:** plain, dots, grid, lines, paper or your own photo.
- **Profiles** with a display name and a picture: a letter, one of 29 icons, or your own photo.

### Accounts and admin
- Usernames and passwords, stored as salted PBKDF2-SHA256 hashes. Every user has their own crumbs.
- The first account is the admin. Admins can open **registration**, turn on **no-login mode** for a home network,
  and for each user rename them, change their picture, set a **storage limit**, make them admin, **block** them,
  reset their password, import or export their crumbs, or delete them.

### Safe on your Pi
- **Encrypted database** (Adiantum). The key lives in `.env`, or you type it after each start.
  See [docs/encryption.md](docs/encryption.md).
- **HTTP and HTTPS side by side**, with a self-made or your own certificate. See [docs/https.md](docs/https.md).
- **Nightly encrypted backups** at 3:00 (the newest 7 are kept), plus **Back up now** and downloads in Admin.
- **Light:** one Go binary and SQLite in a `scratch` container, capped at 128 MB of RAM. Thumbnails are made by
  your browser, stored on the Pi and cached by the browser for fast loading.

---

## Documentation

| Guide | What's in it |
| ----- | ------------ |
| [Install](docs/install.md) | Docker, the folder, the database key, first start |
| [Using Crumbs](docs/using.md) | Adding crumbs, the header, browser extension, bookmarklet, no-login mode, thumbnails |
| [Encryption](docs/encryption.md) | What's encrypted, the key, `.env` or unlocking by hand, converting an older database |
| [HTTPS](docs/https.md) | HTTP and HTTPS side by side, the certificate, HTTPS only |
| [Backups & updates](docs/backups.md) | Nightly backups, restoring, exporting, updating, going back to an older version |
| [Configuration](docs/configuration.md) | `.env` settings, ports, memory limit |
| [Troubleshooting](docs/troubleshooting.md) | Key not picked up, can't connect, pull denied, missing thumbnails |
| [API](docs/api.md) | Every endpoint, for scripts and the browser extension |

---

## How to find crumbs on the internet

Hansel and Gretel dropped breadcrumbs so they could find their way home.
Then the birds ate them. You know how that story goes.

The internet works the same way. Every day you walk through the forest and
drop crumbs everywhere:

- a recipe you will *definitely* cook on Sunday,
- a three-hour video essay about doorknobs,
- a GitHub repo with four stars that fixes exactly your problem,
- the one Stack Overflow answer that actually worked, in 2019,
- forty-seven open tabs, each one “for later”.

And then the birds come. The birds are called *“Restore pages?”*, *“Clear
browsing data”*, and the dreaded *“Your browser has been updated”*. By Monday
the trail is gone and you are lost in the woods again, googling the same
thing for the third time.

**Crumbs is the jar.** When you spot a crumb worth keeping, pick it up, drop
it in the jar, and it stays there. Each one gets its picture, its name and a
note. Your Pi keeps the jar on the shelf, so the birds can't get to it.

Finding crumbs is easy. Keeping them is the hard part. Now it isn't.

---

## Project layout

```text
main.go          server start, HTTP + HTTPS, routes
app.go           middleware, who is signed in, login rate limit
crypt.go         the encrypted database: key, unlock, converting older databases
tls.go           HTTPS certificate (self-signed or your own)
db.go            SQLite schema and upgrades
auth.go          sign-in, registration, tokens, password hashing, sessions
users.go         admin user management, storage limits, blocking
bookmarks.go     bookmark CRUD, trash and image storage
folders.go       nested folders, colors, icons, order
bulk.go          actions on many crumbs, tags, delete everything
transfer.go      import / export
dedupe.go        duplicate rules
linkcheck.go     broken link checker
backup.go        nightly backups
profile.go       profile pictures
meta.go          title, favicon and preview lookup, YouTube, image relay
web/             the front end (plain HTML, CSS and JS, embedded into the binary)
docs/            the guides
.github/         GitHub Actions: builds the Pi image
```

---

<p align="center"><sub>Made for people with too many tabs.</sub></p>
