package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// Import and export. The browser converts between file formats (browser
// HTML, JSON, CSV, Markdown, plain text); the Pi speaks one simple JSON shape.

type exportBookmark struct {
	Name        string `json:"name"`
	URL         string `json:"url"`
	Description string `json:"description"`
	FolderID    *int64 `json:"folderId"`
	Created     int64  `json:"created"`
	Updated     int64  `json:"updated"`
	Tags        []string `json:"tags"`
}

func (a *App) exportFor(w http.ResponseWriter, uid int64) {
	u := a.getUser(uid)
	if u == nil {
		jsonErr(w, http.StatusNotFound, "no such user")
		return
	}
	rows, err := a.db.Query(`SELECT name, url, description, folder_id, created_at, updated_at, tags
		FROM bookmarks WHERE user_id = ? AND deleted_at = 0 ORDER BY created_at, id`, uid)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	list := []exportBookmark{}
	for rows.Next() {
		var b exportBookmark
		var f *int64
		var tags string
		if err := rows.Scan(&b.Name, &b.URL, &b.Description, &f, &b.Created, &b.Updated, &tags); err != nil {
			rows.Close()
			jsonErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		b.FolderID = f
		b.Tags = splitTags(tags)
		list = append(list, b)
	}
	rows.Close()
	folders, err := a.listFolders(uid)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"app": "crumbs", "version": 2, "exported": time.Now().Unix(),
		"user": u.Username, "folders": folders, "bookmarks": list,
	})
}

type importItem struct {
	Name        string   `json:"name"`
	URL         string   `json:"url"`
	Description string   `json:"description"`
	Path        []string `json:"path"` // folder names from the top, e.g. ["Work", "Projects"]
	FolderID    *int64   `json:"folderId"` // an existing folder; wins over Path (used by "save a copy in…")
	Created     int64    `json:"created"`
	Tags        []string `json:"tags"`
}

type importReq struct {
	Items          []importItem `json:"items"`
	SkipDuplicates bool         `json:"skipDuplicates"`
	// AllowDuplicates: the user reviewed these and wants them saved even if
	// the link is already there (the "save a copy" choice).
	AllowDuplicates bool `json:"allowDuplicates"`
}

// skippedItem tells the browser why an item was not imported, so the user
// can review it ("Show" next to "skipped 6").
type skippedItem struct {
	Index          int    `json:"index"`  // position in the request's items
	Reason         string `json:"reason"` // "invalid" or "duplicate"
	Message        string `json:"message,omitempty"`
	ExistingName   string `json:"existingName,omitempty"`
	ExistingFolder string `json:"existingFolder,omitempty"` // "" = Uncategorized
	InImport       bool   `json:"inImport,omitempty"`       // the other copy is earlier in this same import
}

func (a *App) importFor(w http.ResponseWriter, r *http.Request, uid int64) {
	if a.getUser(uid) == nil {
		jsonErr(w, http.StatusNotFound, "no such user")
		return
	}
	var in importReq
	r.Body = http.MaxBytesReader(w, r.Body, 32<<20)
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		jsonErr(w, http.StatusBadRequest, "could not read the import (max 32 MB)")
		return
	}
	if len(in.Items) > 50000 {
		jsonErr(w, http.StatusBadRequest, "too many bookmarks in one import (max 50,000)")
		return
	}

	// Existing folders, keyed by parent + lower-case name, so imports merge into them.
	folders, err := a.listFolders(uid)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	key := func(parent int64, name string) string { return fmt.Sprintf("%d\x00%s", parent, strings.ToLower(name)) }
	folderID := map[string]int64{}
	folderName := map[int64]string{}
	folderParent := map[int64]int64{}
	for _, f := range folders {
		var p int64
		if f.ParentID != nil {
			p = *f.ParentID
		}
		folderID[key(p, f.Name)] = f.ID
		folderName[f.ID] = f.Name
		folderParent[f.ID] = p
	}
	pathOf := func(id *int64) string {
		if id == nil {
			return ""
		}
		var parts []string
		for cur, n := *id, 0; cur != 0 && n < 100; cur, n = folderParent[cur], n+1 {
			parts = append([]string{folderName[cur]}, parts...)
		}
		return strings.Join(parts, " / ")
	}

	// Duplicates: the user's own rule wins; the "skip" checkbox alone means "same link anywhere".
	mode := a.userDedupe(uid)
	if mode == "" && in.SkipDuplicates {
		mode = "all"
	}
	if in.AllowDuplicates {
		mode = ""
	}
	type dupInfo struct {
		name     string
		folder   *int64
		inImport bool
	}
	seen := map[string]dupInfo{}
	if mode != "" {
		for _, d := range a.activeBookmarks(uid) {
			seen[dupKey(mode, d.url, d.folder)] = dupInfo{name: d.name, folder: d.folder}
		}
	}

	// Clean everything up front and check the storage limit once.
	type clean struct {
		bookmarkIn
		index   int
		path    []string
		folder  *int64
		created int64
	}
	var items []clean
	var skipped []skippedItem
	var textBytes int64
	for i, it := range in.Items {
		c := clean{bookmarkIn: bookmarkIn{Name: it.Name, URL: it.URL, Description: it.Description, Tags: it.Tags}, index: i, created: it.Created}
		if err := a.cleanBookmark(uid, &c.bookmarkIn); err != nil {
			skipped = append(skipped, skippedItem{Index: i, Reason: "invalid", Message: err.Error()})
			continue
		}
		if it.FolderID != nil {
			if _, ok := folderName[*it.FolderID]; ok {
				c.folder = it.FolderID
			}
		}
		for _, p := range it.Path {
			if p = clip(oneLine(p), 100); p != "" {
				c.path = append(c.path, p)
			}
		}
		if len(c.path) > 20 {
			c.path = c.path[:20]
		}
		textBytes += int64(len(c.Name) + len(c.URL) + len(c.Description))
		items = append(items, c)
	}
	if err := a.checkStorage(uid, textBytes); err != nil {
		jsonErr(w, http.StatusInsufficientStorage, err.Error())
		return
	}

	tx, err := a.db.Begin()
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback()
	now := time.Now().Unix()
	newFolders := 0
	ids := []int64{}
	for _, it := range items {
		var parent int64
		if it.folder != nil {
			parent = *it.folder
		} else {
			for _, name := range it.path {
				k := key(parent, name)
				id, ok := folderID[k]
				if !ok {
					res, err := tx.Exec(`INSERT INTO folders(user_id, parent_id, name, created_at) VALUES (?, ?, ?, ?)`,
						uid, nullID(ptrIf(parent)), name, now)
					if err != nil {
						jsonErr(w, http.StatusInternalServerError, err.Error())
						return
					}
					id, _ = res.LastInsertId()
					folderID[k] = id
					folderName[id] = name
					folderParent[id] = parent
					newFolders++
				}
				parent = id
			}
		}
		if mode != "" {
			k := dupKey(mode, it.URL, ptrIf(parent))
			if d, dup := seen[k]; dup {
				skipped = append(skipped, skippedItem{
					Index: it.index, Reason: "duplicate",
					ExistingName: d.name, ExistingFolder: pathOf(d.folder), InImport: d.inImport,
				})
				continue
			}
			seen[k] = dupInfo{name: it.Name, folder: ptrIf(parent), inImport: true}
		}
		created := it.created
		if created <= 0 || created > now {
			created = now
		}
		res, err := tx.Exec(`INSERT INTO bookmarks(user_id, folder_id, name, url, description, tags, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, uid, nullID(ptrIf(parent)), it.Name, it.URL, it.Description, joinTags(it.Tags), created, now)
		if err != nil {
			jsonErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		id, _ := res.LastInsertId()
		ids = append(ids, id)
	}
	if err := tx.Commit(); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if skipped == nil {
		skipped = []skippedItem{}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"added": len(ids), "ids": ids, "folders": newFolders,
		"skipped": len(skipped), "skippedItems": skipped,
	})
}

// ptrIf returns nil for 0 (no folder) and a pointer otherwise.
func ptrIf(id int64) *int64 {
	if id == 0 {
		return nil
	}
	return &id
}

func (a *App) handleExportMe(w http.ResponseWriter, r *http.Request, who *Who) { a.exportFor(w, who.ID) }
func (a *App) handleImportMe(w http.ResponseWriter, r *http.Request, who *Who) { a.importFor(w, r, who.ID) }

func (a *App) handleExportUser(w http.ResponseWriter, r *http.Request, who *Who) {
	id, err := pathID(r)
	if err != nil {
		jsonErr(w, http.StatusNotFound, "no such user")
		return
	}
	a.exportFor(w, id)
}

func (a *App) handleImportUser(w http.ResponseWriter, r *http.Request, who *Who) {
	id, err := pathID(r)
	if err != nil {
		jsonErr(w, http.StatusNotFound, "no such user")
		return
	}
	a.importFor(w, r, id)
}
