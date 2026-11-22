# Using Crumbs

## First start

If no database key is set yet, Crumbs first asks you to **choose a database key** (see [encryption.md](encryption.md)).
Then the **Welcome** screen appears. The account you create there is the **admin**.
There is no public sign-up: the admin adds everyone else under **profile picture → Admin → Users**.

## Adding a crumb

1. Click **+ Add → Add bookmark** (or **Add tab** in the sidebar).
2. Paste a URL. Crumbs fetches the title, description, favicon and preview image.
3. Change the name or description if you want, and pick a folder (or **+ New folder…**).
4. No good preview? Click **Upload image**, or paste or drop a screenshot onto the preview.
5. **Save**.

To edit or delete a crumb, hover over its card (or its row in the sidebar) and click the pencil. On phones the pencil is always visible.

## The header

| Where | What |
| ----- | ---- |
| ☰ + logo (left) | Opens the folder sidebar. On wide screens it stays open next to the grid. |
| Search (middle) | Click it and it grows. Press `/` to jump to it, `Esc` to clear it. |
| **+ Add** | Add bookmark or Add folder. |
| **Sort** | Pick a sort order. Click the active one again to flip it. |
| Name + picture (right) | **Admin** (admins only), **Profile** (name, picture, password), **Import / export**, **Settings** (theme, size, layout, background), **Sign out**. |

Deleting a folder never deletes bookmarks: its bookmarks and subfolders move up one level.

## Browser extension

The [Crumbs extension for Chrome](https://github.com/reapertakumi/Crumbs-Extension) saves the page you're on to
Crumbs with one click: thumbnail, favicon, name, URL, folder and description. Download it from the
[latest release](https://github.com/reapertakumi/Crumbs-Extension/releases/latest) and follow the install steps there.

The extension signs in with your Crumbs username and password and gets an **API token** (`POST /api/token`) instead of
a cookie. A token lasts a year and ends when you press **Disconnect** in the extension or change your password.

## Bookmarklet (save the page you're on with one click)

Make a new bookmark in your browser's bookmarks bar and paste this as its URL.
Replace the address with your Pi's address:

```text
javascript:window.open('http://raspberrypi.local:9099/?add='+encodeURIComponent(location.href))
```

Click it on any page and Crumbs opens with that link already filled in.

## Turning login off

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

