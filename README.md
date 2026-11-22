<p align="center">
  <img src="web/icon.svg" width="96" alt="Crumbs logo: a bitten cookie and its crumbs">
</p>

<h1 align="center">Crumbs</h1>

<p align="center">
  A tiny, visual, black-and-white bookmark manager for your Raspberry Pi 5.<br>
  Go + SQLite in one small Docker container. Open it in any browser on port <b>9099</b>.
</p>

<p align="center">
  <a href="#how-to-find-crumbs-on-the-internet">The crumb story</a> ·
  <a href="#features">Features</a> ·
  <a href="#install-on-a-raspberry-pi-5">Install</a> ·
  <a href="#using-crumbs">Using it</a> ·
  <a href="#how-thumbnails-work">Thumbnails</a> ·
  <a href="#backups-and-updates">Backups</a>
</p>

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
  description. See [Browser extension](#browser-extension).
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
- **Lightweight.** One Go binary plus SQLite, in a `scratch` container capped at 128 MB of RAM.

## Install on a Raspberry Pi 5

You need Raspberry Pi OS (64-bit) with Docker installed. If you don't have Docker yet:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out and back in afterwards
```

Then get Crumbs and start it:

```bash
git clone https://github.com/reapertakumi/Crumbs.git
cd Crumbs
docker compose pull
docker compose up -d
```

There's nothing to compile: GitHub builds a ready-made image for the Pi (and for x86) on every push and publishes it as
`ghcr.io/reapertakumi/crumbs:latest`. `docker compose pull` just downloads it.

> **One-time step on GitHub:** the first time the image is published it is private. Open your GitHub profile →
> **Packages → crumbs → Package settings → Change visibility → Public**, so the Pi can download it without logging in.
> (Or keep it private and run `docker login ghcr.io` on the Pi with a token that has `read:packages`.)

Prefer to compile on the Pi? In `docker-compose.yml`, comment out the `image:` line, uncomment `build: .` and run
`docker compose up -d --build` (the first build takes a few minutes).

Now open **`http://<your-pi-ip>:9099`** or **`https://<your-pi-ip>:9443`** in any browser on your network, for
example `https://raspberrypi.local:9443`. To find the Pi's IP, run `hostname -I` on the Pi.

## Security: encrypted database and HTTPS

### The database is encrypted

`data/crumbs.db` (accounts, sessions, folders, bookmarks, tags, settings) is encrypted with a key only you know.
Passwords inside it are additionally stored as salted hashes. Thumbnails, favicons and profile photos in
`data/img` and `data/avatars` are not encrypted.

**The first time** Crumbs starts with encryption, the page asks you to choose the **database key**:

- On a new install, just pick a key (at least 8 characters).
- If you already had Crumbs, sign in with an admin account and pick a key. Crumbs copies everything into a new
  encrypted file, checks that nothing is missing, and only then removes the old unencrypted file.

**Write the key down.** Without it nobody, not even you, can open your bookmarks or your backups.

**After each start** Crumbs needs the key again. Pick one:

- **Unlock in the browser** (safest): open Crumbs and type the key on the Unlock page. The key never touches the SD
  card, so a stolen card is useless. Until someone unlocks it, Crumbs and its nightly backup wait.
- **Automatic**: copy `.env.example` to `.env` next to `docker-compose.yml` and set `CRUMBS_DB_KEY=your key`. Crumbs
  then unlocks itself at every start. Convenient, but someone with the whole SD card has the key too.

Backups made after the switch are encrypted with the same key. Older backups from before are not encrypted;
delete them from `data/backups` once you have a new one.

### HTTP and HTTPS

Crumbs answers on both at the same time, so everyone can choose:

- `http://<pi>:9099` (plain)
- `https://<pi>:9443` (encrypted connection)

The first time, Crumbs makes its own **self-signed certificate** (`data/tls`). Browsers warn about it once
("not private"); choose *Advanced → Continue* for your Pi. Put the names and IPs you use in `.env` as
`TLS_HOSTS=raspberrypi.local,192.168.1.50`, then delete `data/tls` and restart to get a matching certificate.
Have a real certificate? Mount it and set `TLS_CERT` and `TLS_KEY`. Set `HTTP_REDIRECT=1` to send everyone from
`http://` to `https://`.

## Using Crumbs

### First start

The first visit shows a **Welcome** screen. The account you create there is the **admin**.
There is no public sign-up: the admin adds everyone else under **profile picture → Admin → Users**.

### Adding a crumb

1. Click **+ Add → Add bookmark** (or **Add tab** in the sidebar).
2. Paste a URL. Crumbs fetches the title, description, favicon and preview image.
3. Change the name or description if you want, and pick a folder (or **+ New folder…**).
4. No good preview? Click **Upload image**, or paste or drop a screenshot onto the preview.
5. **Save**.

To edit or delete a crumb, hover over its card (or its row in the sidebar) and click the pencil. On phones the pencil is always visible.

### The header

| Where | What |
| ----- | ---- |
| ☰ + logo (left) | Opens the folder sidebar. On wide screens it stays open next to the grid. |
| Search (middle) | Click it and it grows. Press `/` to jump to it, `Esc` to clear it. |
| **+ Add** | Add bookmark or Add folder. |
| **Sort** | Pick a sort order. Click the active one again to flip it. |
| Name + picture (right) | **Admin** (admins only), **Profile** (name, picture, password), **Import / export**, **Settings** (theme, size, layout, background), **Sign out**. |

Deleting a folder never deletes bookmarks: its bookmarks and subfolders move up one level.

### Browser extension

The [Crumbs extension for Chrome](https://github.com/reapertakumi/Crumbs-Extension) saves the page you're on to
Crumbs with one click: thumbnail, favicon, name, URL, folder and description. Download it from the
[latest release](https://github.com/reapertakumi/Crumbs-Extension/releases/latest) and follow the install steps there.

The extension signs in with your Crumbs username and password and gets an **API token** (`POST /api/token`) instead of
a cookie. A token lasts a year and ends when you press **Disconnect** in the extension or change your password.

### Bookmarklet (save the page you're on with one click)

Make a new bookmark in your browser's bookmarks bar and paste this as its URL.
Replace the address with your Pi's address:

```text
javascript:window.open('http://raspberrypi.local:9099/?add='+encodeURIComponent(location.href))
```

Click it on any page and Crumbs opens with that link already filled in.

### Turning login off

Signed in as admin, open **profile picture → Admin** and switch off **Require login**. Anyone who can reach the Pi
can then use Crumbs without a password. They see and edit the **first admin's** bookmarks.
Admin and Profile still need a real sign-in, which is always available from the **Sign in** button.

> Only turn login off on a network you trust. Never expose port 9099 to the internet without login.

## How thumbnails work

1. The Pi reads only the page's `<head>` (title, description, `og:image`, favicon links). For YouTube it asks
   YouTube's oEmbed API for the video title and uses the video's thumbnail.
2. **Your browser** downloads the preview image and favicon. It tries the site directly first. Most sites
   block that (CORS), so the browser then gets the raw bytes through a small relay on the Pi.
3. **Your browser** crops the image to a 640×360 JPEG thumbnail and a 64×64 PNG favicon,
   then uploads both to the Pi.
4. The Pi stores the files in `./data/img/` and serves them from there. Your grid never loads images
   from other websites.

The Pi doesn't resize or decode any images, so the server stays tiny.

## Configuration

| Variable   | Default | What it does                                   |
| ---------- | ------- | ---------------------------------------------- |
| `ADDR`     | `:9099` | Address and port to listen on inside the container |
| `HTTPS_ADDR` | `:9443` | HTTPS address inside the container (`off` turns HTTPS off) |
| `DATA_DIR` | `/data` | Where the database and images are stored       |
| `CRUMBS_DB_KEY` | (empty) | Database key; empty means "unlock in the browser" |
| `TLS_HOSTS` | (empty) | Extra names/IPs for the self-signed certificate |
| `TLS_CERT`, `TLS_KEY` | (empty) | Your own certificate and key files instead of the self-signed one |
| `HTTP_REDIRECT` | `0` | `1` sends `http://` visitors to `https://` |

These go in `.env` next to `docker-compose.yml` (see `.env.example`).

To use another port, change the left side of `ports:` in `docker-compose.yml`, for example `"8080:9099"`.

## Backups and updates

Everything lives in the `./data` folder next to `docker-compose.yml`:

```text
data/
├── crumbs.db      # SQLite database (encrypted): users, sessions, folders, bookmarks, settings
├── crumbs.db.salt # needed with your key to open the database: keep it with the database
├── avatars/       # uploaded profile pictures
├── img/           # thumbnails and favicons
├── tls/           # the self-signed HTTPS certificate
└── backups/       # nightly backups (newest 7)
```

**Backups** happen by themselves every night at 3:00 (the Pi's time zone). Each one is a `.zip` with the encrypted
database and its salt, thumbnails, favicons and profile photos. Restoring needs your database key. Download them from **Admin → Backups**, or copy `data/backups` off the Pi
from time to time, since a backup on the same SD card won't survive the card dying.

**Restore a backup:**

```bash
docker compose stop
mkdir restore && cd restore && unzip ../data/backups/crumbs-YYYY-MM-DD-HHMMSS.zip && cd ..
cp restore/crumbs.db restore/crumbs.db.salt data/ && rm -f data/crumbs.db-wal data/crumbs.db-shm
cp -r restore/img restore/avatars data/
docker compose start
```

**Update:**

```bash
git pull
docker compose pull
docker compose up -d
```

**Forgot the admin password?** Ask another admin to reset it in **Admin → Users**. If you are the only
admin, stop Crumbs, move `data/crumbs.db` and `data/crumbs.db.salt` somewhere safe, and start again to get a fresh
setup screen. **Forgot the database key?** Then the database can't be opened; that's the point of encrypting it.

**Going back to before encryption:** the git tag `restore-before-encryption` is the last version without it. Your
data from before is in the backups made before the switch (`git checkout restore-before-encryption`, build with
`docker compose up -d --build`, and restore one of those backups).

## Project layout

```text
main.go          server setup and routes
app.go           middleware, auth helpers, login rate limit
auth.go          sign-in, registration, password hashing, sessions
users.go         admin user management, storage limits, blocking
transfer.go      import / export
bookmarks.go     bookmark CRUD and image storage
folders.go       nested folders
profile.go       profile pictures
dedupe.go        duplicate rules
bulk.go          actions on many crumbs, tags
linkcheck.go     broken link checker
backup.go        nightly backups
.github/         GitHub Actions: builds the Pi image
meta.go          title, favicon and preview lookup, YouTube, image relay
db.go            SQLite schema
web/             the front end (plain HTML, CSS and JS, embedded into the binary)
```

## API

All endpoints are JSON and use the session cookie, or an `Authorization: Bearer <token>` header from `/api/token`.
Requests from other sites are refused, except ones that carry an `X-Crumbs-Client` header (only an app or browser
extension can send that; a web page can't). `{id}` is a bookmark id.

| Method | Path | |
| ------ | ---- | - |
| `GET` | `/api/state` | Who am I, is setup needed, is login required |
| `POST` | `/api/setup` | Create the first (admin) account |
| `POST` | `/api/login` · `/api/logout` | Sign in / out (logout with a Bearer token deletes that token) |
| `POST` | `/api/token` | `{"username","password"}` → `{"token","user"}`, an API token that lasts a year |
| `GET` `POST` | `/api/bookmarks` | List / create |
| `PUT` `DELETE` | `/api/bookmarks/{id}` | Update / move to trash (`?forever=1` deletes for good) |
| `POST` | `/api/bookmarks/{id}/restore` | Take a crumb out of the trash |
| `DELETE` | `/api/trash` | Empty the trash |
| `PUT` `DELETE` | `/api/bookmarks/{id}/thumb` · `/icon` | Upload / remove an image (raw JPEG/PNG body) |
| `POST` | `/api/register` | Create an account (only while registration is open) |
| `PUT` | `/api/me` | Change your display name and/or duplicate rule `{"displayName", "dedupe": ""\|"all"\|"folder"}` |
| `POST` | `/api/dedupe` | `{"mode": "all"\|"folder"}` moves extra copies to the trash (`?dry=1` only counts them) |
| `POST` | `/api/bookmarks/bulk` | `{"ids":[...], "action":"move\|trash\|restore\|delete\|addTag\|removeTag", "folderId", "tag"}` |
| `POST` | `/api/tags` | Rename a tag everywhere `{"from","to"}`, or remove it with an empty `"to"` |
| `GET` `POST` | `/api/linkcheck` | Progress of / start the broken link check |
| `GET` | `/api/export` | Your folders and bookmarks as JSON |
| `POST` | `/api/import` | Add many bookmarks `{"items":[{"name","url","description","path":["Folder","Sub"]}],"skipDuplicates":true}` |
| `POST` | `/api/folders` | Create a folder `{"name", "parentId"}` |
| `PUT` `DELETE` | `/api/folders/{id}` | Edit `{"name","parentId","color","icon"}` / delete (contents move up one level) |
| `PUT` | `/api/folders/order` | Reorder: `{"parentId": null, "ids": [3, 1, 2]}` puts those folders there, in that order |
| `PUT` | `/api/me/avatar` | `{"avatar": "" | "icon:cat"}` |
| `PUT` | `/api/me/avatar/image` | Upload a profile photo (raw JPEG/PNG body) |
| `GET` | `/api/meta?url=` | Title, description, image and icon candidates |
| `GET` | `/api/fetch?url=` | Image relay used by the browser |
| `GET` `POST` | `/api/users` | Admin: list / add users |
| `DELETE` | `/api/users/{id}` | Admin: delete a user |
| `PATCH` | `/api/users/{id}` | Admin: any of `displayName`, `username`, `avatar`, `isAdmin`, `blocked`, `storageLimit` (bytes, 0 = no limit) |
| `GET` `POST` | `/api/users/{id}/export` · `/import` | Admin: export / import someone's bookmarks |
| `PUT` | `/api/users/{id}/password` | Admin: reset a password |
| `PUT` | `/api/settings` | Admin: `{"loginRequired": true\|false, "registration": true\|false}` |
| `GET` `POST` | `/api/backups` | Admin: list backups / make one now |
| `GET` | `/api/backups/{name}` | Admin: download a backup |

---

<p align="center"><sub>Made for people with too many tabs.</sub></p>
