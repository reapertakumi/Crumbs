# API


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
| `PUT` | `/api/me/avatar` | `{"avatar": ""` or `"icon:cat"}` |
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


While the database is locked, every endpoint except `GET /api/state` (returns `{"locked": true, "setup", "plain"}`) and `POST /api/unlock` (`{"key"}`, plus `{"username","password"}` of an admin when an older unencrypted database is converted) answers `423 Locked`.
