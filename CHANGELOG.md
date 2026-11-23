# Changelog

## v1.1.0 – colors, a new sidebar and a right-click menu

**Update:** `docker compose pull && docker compose up -d`. Image: `ghcr.io/reapertakumi/crumbs:1.1.0` (also `:latest`).
Your crumbs, folders and settings carry over; the database gets two new columns by itself.

### Look
- **Day / Night / System** button at the far right of the header, with a circle animation that spreads from the button.
- **18 color themes** in Settings → Colors: Black & white, Cappuccino, Paper, Forest, Ocean, Nord, Rose, Midnight, Matcha,
  Lavender, Sakura, Sand, Slate, Solarized, Gruvbox, Dracula, High contrast and AMOLED black, each with a day and night look.
- **Accent color** for buttons, selection, toggles and focus rings.
- **Color rows** everywhere (accent, folders, tags): no color, a color picker for any color, then your 9 recent colors.
- **Folder colors on cards:** a thin stripe in the folder's color (can be turned off).
- Search links (Google, YouTube, Bing, DuckDuckGo, Amazon, Reddit, GitHub, …) show a search card with the site's icon and
  the words searched instead of a blank tile.

### Sidebar
- One big **Add** button: bookmark, folder or tag.
- **Folders / Tags** switch with a sliding underline. The top stays pinned; only the list scrolls.
- **Resize** the sidebar by dragging its right edge (double-click resets).
- With the sidebar closed, resting the mouse at the left edge **slides it out** for a moment.
- **Tags** can exist before any crumb has them, and get **colors** like folders (shown in the sidebar and on cards).
- Edit folder: the icon sits next to the name and opens a small icon menu. Clicking outside the folder or tag window closes it.

### Crumbs
- **View** menu in the header: layout, card size and **visible fields** (image, title, URL, folder, tags, description,
  created and updated date). Layout and card size moved here from Settings.
- **Right-click menu** on crumbs: open in new tab, copy link, edit, move, add tag, refresh, select, delete (restore and
  delete forever in the Trash). Works on a whole selection too.
- Titles come from the page's own `<title>`, the one the browser tab shows. YouTube titles end in " - YouTube".

### Fixes
- Opening a window (Settings, Profile, Admin, …) no longer makes the cards behind it jump.
- Accent swatches and folder stripes now show their colors with the page's security policy on.
- Icons in the folder window no longer show up black.

**Going back:** the tag `restore-before-sidebar-tabs` is the version before the new sidebar; `v1.0.0` is the first release.

## v1.0.0 – first release

Crumbs is a visual, black-and-white bookmark manager that runs on a Raspberry Pi 5 in one small Docker container.

**Install:** see [docs/install.md](docs/install.md). Image: `ghcr.io/reapertakumi/crumbs:1.0.0` (also `:latest`),
for the Pi (arm64) and x86.

### Bookmarks
- Visual grid with thumbnails, favicons, names, sites, descriptions and tags; four layouts (Grid, Gallery, List,
  Compact) and a card scale slider (or Ctrl + scroll).
- Paste a link and the title, description, favicon and preview picture are filled in; YouTube links get the video
  title, channel and thumbnail. Your browser makes the thumbnails, the Pi stores them.
- Upload, paste or drop your own picture.
- Folders and subfolders with colors and icons, drag to reorder; **Uncategorized** for the rest.
- Tags with their own sidebar list, rename and remove; search with `#tag`.
- Instant search, sorting by title, created, updated, URL, description or folder.
- Select several crumbs (drag a box, check boxes, Shift-click, Ctrl+A) and move, tag, refresh, export or trash them;
  drag selected crumbs onto folders, tags or the Trash.
- Trash with Undo; emptied after 30 days.
- Optional duplicate rule: a link only once everywhere, or only once per folder.
- Broken link checker and *Refresh all previews* (keeps thumbnails you set yourself); refresh the preview, title
  or description of selected crumbs.

### Import & export
- Browser bookmark files (.html), Crumbs / Chrome / Firefox .json, .csv (Pocket, Raindrop, …), Markdown and plain
  link lists, keeping folders and tags. Export to the same formats.
- After an import, thumbnails and favicons are fetched automatically (failed ones retried 3 times), and skipped links
  can be reviewed: save a copy of a duplicate in any folder, or fix links that aren't web links.
- A Chrome extension saves the page you're on: [Crumbs-Extension](https://github.com/reapertakumi/Crumbs-Extension).

### Accounts & admin
- Usernames and passwords (salted PBKDF2-SHA256), display names, profile pictures (29 icons or your own photo,
  positioned in a circle).
- The first account is the admin. Optional open registration, optional "no login" mode.
- Per user: rename, change picture, storage limit, make admin, block, reset password, import/export, delete.

### Security
- **Encrypted database** (Adiantum, pure Go): the key comes from `.env` or is typed on an Unlock page after each
  start. Older unencrypted databases are converted after an admin sign-in, with the row counts checked.
- **HTTP and HTTPS side by side** (`:9099` and `:9443`), self-signed certificate or your own, optional redirect to
  HTTPS.
- API tokens for the browser extension (one year, revoked on Disconnect or a password change); cross-site requests
  are refused.

### Running it
- Nightly encrypted backups at 3:00 (newest 7), *Back up now* and downloads in Admin.
- Settings to reset everything or delete all crumbs, folders and tags.
- Image built by GitHub Actions on every push; `docker compose pull` to update.

**Going back:** the tag `restore-before-encryption` is the last version before the encrypted database.
