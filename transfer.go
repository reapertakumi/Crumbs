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
}

func (a *App) exportFor(w http.ResponseWriter, uid int64) {
	u := a.getUser(uid)
	if u == nil {
		jsonErr(w, http.StatusNotFound, "no such user")
		return
	}
	rows, err := a.db.Query(`SELECT name, url, description, folder_id, created_at, updated_at
		FROM bookmarks WHERE user_id = ? AND deleted_at = 0 ORDER BY created_at, id`, uid)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	list := []exportBookmark{}
	for rows.Next() {
		var b exportBookmark
		var f *int64
		if err := rows.Scan(&b.Name, &b.URL, &b.Description, &f, &b.Created, &b.Updated); err != nil {
			rows.Close()
			jsonErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		b.FolderID = f
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
	Created     int64    `json:"created"`
}

type importReq struct {
	Items          []importItem `json:"items"`
	SkipDuplicates bool         `json:"skipDuplicates"`
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
	for _, f := range folders {
		var p int64
		if f.ParentID != nil {
			p = *f.ParentID
		}
		folderID[key(p, f.Name)] = f.ID
	}
	seen := map[string]bool{}
	if in.SkipDuplicates {
		rows, err := a.db.Query(`SELECT url FROM bookmarks WHERE user_id = ? AND deleted_at = 0`, uid)
		if err == nil {
			for rows.Next() {
				var u string
				if rows.Scan(&u) == nil {
					seen[u] = true
				}
			}
			rows.Close()
		}
	}

	// Clean everything up front and check the storage limit once.
	type clean struct {
		bookmarkIn
		path    []string
		created int64
	}
	var items []clean
	skipped := 0
	var textBytes int64
	for _, it := range in.Items {
		c := clean{bookmarkIn: bookmarkIn{Name: it.Name, URL: it.URL, Description: it.Description}, created: it.Created}
		if err := a.cleanBookmark(uid, &c.bookmarkIn); err != nil {
			skipped++
			continue
		}
		if in.SkipDuplicates && seen[c.URL] {
			skipped++
			continue
		}
		seen[c.URL] = true
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
	for _, it := range items {
		var parent int64
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
				newFolders++
			}
			parent = id
		}
		created := it.created
		if created <= 0 || created > now {
			created = now
		}
		if _, err := tx.Exec(`INSERT INTO bookmarks(user_id, folder_id, name, url, description, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)`, uid, nullID(ptrIf(parent)), it.Name, it.URL, it.Description, created, now); err != nil {
			jsonErr(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	if err := tx.Commit(); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"added": len(items), "skipped": skipped, "folders": newFolders})
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
