<p align="center">
  <img src="web/icon.svg" width="96" alt="Crumbs logo: a bitten cookie and its crumbs">
</p>

<h1 align="center">Crumbs</h1>

<p align="center">
  A tiny, visual, black-and-white bookmark manager for your Raspberry Pi 5.<br>
  Go + an encrypted SQLite database in one small Docker container, on <b>http :9099</b> and <b>https :9443</b>.
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#documentation">Documentation</a> ·
  <a href="#features">Features</a> ·
  <a href="#how-to-find-crumbs-on-the-internet">The crumb story</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="https://github.com/reapertakumi/Crumbs-Extension">Chrome extension</a>
</p>

---

## Quick start

On a Raspberry Pi 5 with Raspberry Pi OS (64-bit) and Docker:

```bash
git clone https://github.com/reapertakumi/Crumbs.git && cd Crumbs

# Optional: a database key so Crumbs unlocks itself at start (save the printed key!)
KEY=$(openssl rand -base64 32); printf 'CRUMBS_DB_KEY=%s\n' "$KEY" > .env; chmod 600 .env; echo "$KEY"

docker compose pull
docker compose up -d
```

Open `https://<pi-address>:9443` (accept the certificate warning once) or `http://<pi-address>:9099`, choose a
database key if you didn't set one, and create the first account – it becomes the admin.

The full walk-through, with what each step does: **[docs/install.md](docs/install.md)**.

## Documentation

| Guide | What's in it |
| ----- | ------------ |
| [Install](docs/install.md) | Docker, the folder, the database key, first start |
| [Encryption](docs/encryption.md) | What's encrypted, the key, `.env` or unlock by hand, converting an older database |
| [HTTPS](docs/https.md) | HTTP and HTTPS side by side, the certificate, HTTPS only |
| [Backups & updates](docs/backups.md) | Nightly backups, restore, export, updating, going back to an older version |
| [Using Crumbs](docs/using.md) | Tour: adding crumbs, the header, browser extension, bookmarklet, open mode, thumbnails |
| [Configuration](docs/configuration.md) | `.env` settings, ports, memory limit |
| [Troubleshooting](docs/troubleshooting.md) | Key not picked up, can't connect, pull denied, missing thumbnails |
| [API](docs/api.md) | Every endpoint, for scripts and the browser extension |

**Browser extension:** save the page you're on with one click using [Crumbs-Extension](https://github.com/reapertakumi/Crumbs-Extension) for Chrome ([download the latest release](https://github.com/reapertakumi/Crumbs-Extension/releases/latest)).

---

## Features

- **Visual grid.** Every bookmark is a card with a thumbnail, favicon, name, site and description.
- **Smart previews.** Paste a link and Crumbs fills in the page title, description, favicon and preview image.
  YouTube links get the real video title, channel name and video thumbnail.
- **Thumbnails are made in your browser.** Your browser downloads and resizes the images, then stores
  them on the Pi. Thumbnails always load from the Pi, never from the original site.
- **Your own images.** You can upload, paste (Ctrl+V) or drag in any image, for example a screenshot.
- **Folders and subfolders.** The sidebar (the ☰ button) shows every folder as a tree with its bookmarks inside.
  Hover a folder to collapse or expand it, add a subfolder or edit it. Give each folder its own color and icon, and
  drag folders to reorder them: drop on the top or bottom edge of another folder to go above or below it, or in the
  middle to go inside it. Bookmarks without a folder live in **Uncategorized**.
- **Browser extension.** Save the page you're on with one click from Chrome: thumbnail, favicon, name, URL, folder and
  description. See [docs/using.md](docs/using.md#browser-extension).
- **Tags.** Give a crumb any number of tags in the editor (type, then Enter). Tags show on the cards and get their own
  list in the sidebar, where you can rename or remove them. Search `#recipes` to find a tag.
- **Select several crumbs.** Click and drag across the cards to draw a selection box (start anywhere, even on a card), tick the box in a card's corner
  (Shift-click for a range), or press Ctrl+A for everything shown,
  then move, tag, refresh, export or trash them all at once from the bar at the bottom.
- **Drag & drop.** Select cards first, then drag them (or a sidebar row) onto a folder, **Uncategorized**, a tag or the **Trash**. Dragging a
  selected crumb takes the whole selection along.
- **Broken link checker.** **Settings → Maintenance → Check now**: the Pi visits every link once and marks the ones
  that are gone (404, site not found, server errors) with a **Broken** badge and a **Broken links** view. It only runs
  when you press the button.
- **Refresh all previews.** **Settings → Maintenance → Refresh**: fresh thumbnails and icons for everything. Thumbnails
  you uploaded or pasted yourself are kept.
- **Automatic backups.** Every night at 3:00 the database, thumbnails and photos are zipped into `data/backups`, and the
  newest 7 are kept. Admins can **Back up now** and download any backup from **Admin → Backups**.
- **Trash.** Deleting a crumb moves it to the **Trash** (with Undo). Restore it or delete it forever from there.
  The trash empties itself after 30 days.
- **No duplicates (optional).** Turn on **Settings → Duplicates → Remove duplicates** and pick **Everywhere** (a link
  is saved only once) or **Not across folders** (the same link may sit in different folders, but only once per
  folder). Crumbs then refuses new duplicates, skips them on import, and offers to move existing extra copies to the
  Trash. The copy with a thumbnail, or else the oldest one, is kept. Links count as the same even with or without
  `www.`, `https`, a trailing `/` or a `#section`.
- **Sorting.** Sort by title, date created, last updated, URL, description or folder. Click the same option again to flip
  between ascending and descending.
- **Profiles.** Pick a display name and a picture: the first letter of your name, one of 29 built-in icons, or your own photo,
  which you drag and zoom into place inside a circle.
- **Import & export.** Bring bookmarks in from any browser (bookmark .html file), Chrome or Crumbs .json, .csv (Pocket,
  Raindrop and others), Markdown or a plain list of links. Folders are kept. Export to the same formats. Right after an
  import your browser fetches thumbnails and favicons for the new crumbs, retrying the ones that fail up to 3 times.
  If anything was skipped, **Show** lists it: links you already have (skip them or save a copy in any folder) and
  links that aren't web links (fix them to keep them, or remove them).
- **Instant search.** The small search pill in the header grows when you click it. It searches name, URL, description and folder as you type. Press `/` to jump to it.
- **Accounts.** Usernames and passwords. The first account is the admin, and each user has their own bookmarks.
  Passwords are stored as salted PBKDF2-SHA256 hashes, never in plain text.
- **Optional open mode.** The admin can turn login off so anyone on your network can use Crumbs without a password.
- **Admin tools.** Open **registration** so people can sign themselves up, or keep adding users yourself. Every user has a
  ⋯ menu: change their name or picture, set a **storage limit**, make them admin, **block** them, reset their password,
  import/export their bookmarks or delete them.
- **Black and white.** Rounded corners, no colors. In Settings: light, dark or system theme, three card sizes, four layouts
  (Grid, Gallery, List, Compact) and backgrounds (plain, dots, grid, lines, paper or your own photo, black & white if you like).
- **Encrypted database.** Accounts, sign-ins, folders, bookmarks and tags are stored encrypted with a key only you
  know, and backups are encrypted too. Unlock automatically from `.env` or by typing the key after each start.
  See [docs/encryption.md](docs/encryption.md).
- **HTTP and HTTPS.** Both at once; Crumbs makes its own certificate or uses yours. See [docs/https.md](docs/https.md).
- **Lightweight.** One Go binary plus SQLite, in a `scratch` container capped at 128 MB of RAM.

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
