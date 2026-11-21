package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

// Duplicate handling. Each user picks a mode (users.dedupe):
//   ""       off: duplicates are allowed
//   "all"    a link may exist only once, anywhere
//   "folder" a link may exist only once per folder (copies in different folders are fine)
// When a mode is on, adding a duplicate is refused and imports skip them.

func validDedupe(mode string) bool { return mode == "" || mode == "all" || mode == "folder" }

// normURL makes small differences not count: http vs https, "www.", a
// trailing slash, upper-case host, and #fragments.
func normURL(raw string) string {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return strings.ToLower(strings.TrimSpace(raw))
	}
	s := strings.TrimPrefix(strings.ToLower(u.Host), "www.") + strings.TrimRight(u.EscapedPath(), "/")
	if u.RawQuery != "" {
		s += "?" + u.RawQuery
	}
	return s
}

func dupKey(mode, rawURL string, folder *int64) string {
	k := normURL(rawURL)
	if mode == "folder" {
		if folder != nil {
			k += fmt.Sprintf("\x00%d", *folder)
		} else {
			k += "\x00-"
		}
	}
	return k
}

func (a *App) userDedupe(uid int64) string {
	var m string
	a.db.QueryRow(`SELECT dedupe FROM users WHERE id = ?`, uid).Scan(&m)
	return m
}

type dupRow struct {
	id      int64
	url     string
	name    string
	folder  *int64
	thumb   int64
	created int64
}

func (a *App) activeBookmarks(uid int64) []dupRow {
	var out []dupRow
	rows, err := a.db.Query(`SELECT id, url, name, folder_id, thumb_ver, created_at FROM bookmarks
		WHERE user_id = ? AND deleted_at = 0`, uid)
	if err != nil {
		return nil
	}
	for rows.Next() {
		var d dupRow
		var f sql.NullInt64
		if rows.Scan(&d.id, &d.url, &d.name, &f, &d.thumb, &d.created) == nil {
			if f.Valid {
				v := f.Int64
				d.folder = &v
			}
			out = append(out, d)
		}
	}
	rows.Close()
	return out
}

// duplicateOf returns an error describing the existing copy, or nil.
// `except` is the bookmark being edited (0 when adding).
func (a *App) duplicateOf(uid int64, rawURL string, folder *int64, except int64) error {
	mode := a.userDedupe(uid)
	if mode == "" {
		return nil
	}
	key := dupKey(mode, rawURL, folder)
	for _, d := range a.activeBookmarks(uid) {
		if d.id == except || dupKey(mode, d.url, d.folder) != key {
			continue
		}
		where := "Uncategorized"
		if d.folder != nil {
			var n string
			if a.db.QueryRow(`SELECT name FROM folders WHERE id = ?`, *d.folder).Scan(&n) == nil {
				where = n
			}
		}
		return fmt.Errorf("this link is already saved as “%s” in %s (duplicates are turned off in Settings)", d.name, where)
	}
	return nil
}

// handleDedupe finds duplicates and, unless ?dry=1, moves the extra copies
// to the trash. The copy with a thumbnail wins, then the oldest one.
func (a *App) handleDedupe(w http.ResponseWriter, r *http.Request, who *Who) {
	var in struct {
		Mode string `json:"mode"`
	}
	if err := readJSON(w, r, &in); err != nil || in.Mode == "" || !validDedupe(in.Mode) {
		jsonErr(w, http.StatusBadRequest, "pick “all” or “folder”")
		return
	}
	groups := map[string][]dupRow{}
	for _, d := range a.activeBookmarks(who.ID) {
		k := dupKey(in.Mode, d.url, d.folder)
		groups[k] = append(groups[k], d)
	}
	var extra []int64
	for _, g := range groups {
		if len(g) < 2 {
			continue
		}
		sort.Slice(g, func(i, j int) bool {
			if (g[i].thumb > 0) != (g[j].thumb > 0) {
				return g[i].thumb > 0
			}
			if g[i].created != g[j].created {
				return g[i].created < g[j].created
			}
			return g[i].id < g[j].id
		})
		for _, d := range g[1:] {
			extra = append(extra, d.id)
		}
	}
	if r.URL.Query().Get("dry") != "1" && len(extra) > 0 {
		now := time.Now().Unix()
		tx, err := a.db.Begin()
		if err != nil {
			jsonErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer tx.Rollback()
		for _, id := range extra {
			tx.Exec(`UPDATE bookmarks SET deleted_at = ? WHERE id = ? AND user_id = ?`, now, id, who.ID)
		}
		if err := tx.Commit(); err != nil {
			jsonErr(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]int{"count": len(extra)})
}
