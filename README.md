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
- **Folders.** Give a bookmark a folder and filter by it with one click.
- **Instant search.** Searches name, URL, description and folder as you type. Press `/` to jump to it.
- **Accounts.** Usernames and passwords. The first account is the admin, and each user has their own bookmarks.
  Passwords are stored as salted PBKDF2-SHA256 hashes, never in plain text.
- **Optional open mode.** The admin can turn login off so anyone on your network can use Crumbs without a password.
- **Black and white.** Rounded corners, no colors, and an automatic dark mode.
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
docker compose up -d --build
```

The first build compiles SQLite and takes a few minutes on the Pi. Later builds are much faster.

Now open **`http://<your-pi-ip>:9099`** in any browser on your network, for example
`http://raspberrypi.local:9099`. To find the Pi's IP, run `hostname -I` on the Pi.

## Using Crumbs

### First start

The first visit shows a **Welcome** screen. The account you create there is the **admin**.
There is no public sign-up: the admin adds everyone else under **Settings → Users**.

### Adding a crumb

1. Click **+ Add**.
2. Paste a URL. Crumbs fetches the title, description, favicon and preview image.
3. Change the name or description if you want, and pick a folder (or type a new one).
4. No good preview? Click **Upload image**, or paste or drop a screenshot onto the preview.
5. **Save**.

To edit or delete a crumb, hover over its card and click the pencil. On phones the pencil is always visible.

### Bookmarklet (save the page you're on with one click)

Make a new bookmark in your browser's bookmarks bar and paste this as its URL.
Replace the address with your Pi's address:

```text
javascript:window.open('http://raspberrypi.local:9099/?add='+encodeURIComponent(location.href))
```

Click it on any page and Crumbs opens with that link already filled in.

### Turning login off

Signed in as admin, open **Settings** and switch off **Require login**. Anyone who can reach the Pi
can then use Crumbs without a password. They see and edit the **first admin's** bookmarks.
Settings and user management still need a real sign-in, which is always available from the **Sign in** button.

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
| `DATA_DIR` | `/data` | Where the database and images are stored       |

To use another port, change the left side of `ports:` in `docker-compose.yml`, for example `"8080:9099"`.

## Backups and updates

Everything lives in the `./data` folder next to `docker-compose.yml`:

```text
data/
├── crumbs.db      # SQLite database: users, sessions, bookmarks, settings
└── img/           # thumbnails and favicons
```

**Backup:**

```bash
docker compose stop
tar czf crumbs-backup-$(date +%F).tgz data
docker compose start
```

**Update:**

```bash
git pull
docker compose up -d --build
```

**Forgot the admin password?** Ask another admin to reset it in **Settings → Users**. If you are the only
admin, stop Crumbs, move `data/crumbs.db` somewhere safe, and start again to get a fresh setup screen.

## Project layout

```text
main.go          server setup and routes
app.go           middleware, auth helpers, login rate limit
auth.go          accounts, password hashing, sessions, admin API
bookmarks.go     bookmark CRUD and image storage
meta.go          title, favicon and preview lookup, YouTube, image relay
db.go            SQLite schema
web/             the front end (plain HTML, CSS and JS, embedded into the binary)
```

## API

All endpoints are JSON and use the session cookie. `{id}` is a bookmark id.

| Method | Path | |
| ------ | ---- | - |
| `GET` | `/api/state` | Who am I, is setup needed, is login required |
| `POST` | `/api/setup` | Create the first (admin) account |
| `POST` | `/api/login` · `/api/logout` | Sign in / out |
| `GET` `POST` | `/api/bookmarks` | List / create |
| `PUT` `DELETE` | `/api/bookmarks/{id}` | Update / delete |
| `PUT` `DELETE` | `/api/bookmarks/{id}/thumb` · `/icon` | Upload / remove an image (raw JPEG/PNG body) |
| `GET` | `/api/meta?url=` | Title, description, image and icon candidates |
| `GET` | `/api/fetch?url=` | Image relay used by the browser |
| `GET` `POST` | `/api/users` | Admin: list / add users |
| `DELETE` | `/api/users/{id}` | Admin: delete a user |
| `PUT` | `/api/users/{id}/password` | Admin: reset a password |
| `PUT` | `/api/settings` | Admin: `{"loginRequired": true\|false}` |

---

<p align="center"><sub>Made for people with too many tabs.</sub></p>
