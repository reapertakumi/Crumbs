package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
)

// Actions on many bookmarks at once (multi-select, drag & drop) and on tags.

type bulkRow struct {
	id      int64
	url     string
	folder  *int64
	tags    []string
	deleted int64
}

func (a *App) ownedRows(uid int64, ids []int64) map[int64]*bulkRow {
	want := map[int64]bool{}
	for _, id := range ids {
		want[id] = true
	}
	out := map[int64]*bulkRow{}
	rows, err := a.db.Query(`SELECT id, url, folder_id, tags, deleted_at FROM bookmarks WHERE user_id = ?`, uid)
	if err != nil {
		return out
	}
	for rows.Next() {
		var b bulkRow
		var f sql.NullInt64
		var tags string
		if rows.Scan(&b.id, &b.url, &f, &tags, &b.deleted) != nil || !want[b.id] {
			continue
		}
		if f.Valid {
			v := f.Int64
			b.folder = &v
		}
		b.tags = splitTags(tags)
		out[b.id] = &b
	}
	rows.Close()
	return out
}

// handleBulk: {"ids":[...], "action":"move|trash|restore|delete|addTag|removeTag", "folderId":n|null, "tag":"x"}
func (a *App) handleBulk(w http.ResponseWriter, r *http.Request, who *Who) {
	var in struct {
		IDs      []int64 `json:"ids"`
		Action   string  `json:"action"`
		FolderID *int64  `json:"folderId"`
		Tag      string  `json:"tag"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 2<<20)
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || len(in.IDs) == 0 || len(in.IDs) > 50000 {
		jsonErr(w, http.StatusBadRequest, "bad request")
		return
	}
	rows := a.ownedRows(who.ID, in.IDs)
	tag := cleanTag(in.Tag)
	switch in.Action {
	case "move":
		if in.FolderID != nil && !a.folderOwned(who.ID, *in.FolderID) {
			jsonErr(w, http.StatusBadRequest, "that folder does not exist")
			return
		}
	case "addTag", "removeTag":
		if tag == "" {
			jsonErr(w, http.StatusBadRequest, "give the tag a name")
			return
		}
	case "trash", "restore", "delete":
	default:
		jsonErr(w, http.StatusBadRequest, "unknown action")
		return
	}

	// Moving into a folder must respect "Not across folders" duplicates.
	mode := a.userDedupe(who.ID)
	taken := map[string]bool{}
	if in.Action == "move" && mode == "folder" {
		for _, d := range a.activeBookmarks(who.ID) {
			if rows[d.id] == nil {
				taken[dupKey(mode, d.url, d.folder)] = true
			}
		}
	}

	now := time.Now().Unix()
	changed, skipped := 0, 0
	var gone []int64
	tx, err := a.db.Begin()
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback()
	for _, id := range in.IDs {
		b := rows[id]
		if b == nil {
			skipped++
			continue
		}
		var err error
		switch in.Action {
		case "move":
			if mode == "folder" {
				k := dupKey(mode, b.url, in.FolderID)
				if taken[k] {
					skipped++
					continue
				}
				taken[k] = true
			}
			_, err = tx.Exec(`UPDATE bookmarks SET folder_id = ?, updated_at = ? WHERE id = ?`, nullID(in.FolderID), now, id)
		case "trash":
			_, err = tx.Exec(`UPDATE bookmarks SET deleted_at = ? WHERE id = ? AND deleted_at = 0`, now, id)
		case "restore":
			_, err = tx.Exec(`UPDATE bookmarks SET deleted_at = 0 WHERE id = ?`, id)
		case "delete":
			_, err = tx.Exec(`DELETE FROM bookmarks WHERE id = ?`, id)
			gone = append(gone, id)
		case "addTag", "removeTag":
			var next []string
			if in.Action == "addTag" {
				next = cleanTags(append(append([]string{}, b.tags...), tag))
			} else {
				for _, t := range b.tags {
					if t != tag {
						next = append(next, t)
					}
				}
			}
			_, err = tx.Exec(`UPDATE bookmarks SET tags = ? WHERE id = ?`, joinTags(next), id)
		}
		if err != nil {
			jsonErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		changed++
	}
	if err := tx.Commit(); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	a.removeImages(gone...)
	writeJSON(w, http.StatusOK, map[string]int{"changed": changed, "skipped": skipped})
}

// handleTagEdit makes a new, empty tag ({"add"}), renames a tag ({"from","to"})
// or removes it everywhere ({"from"} with an empty "to").
func (a *App) handleTagEdit(w http.ResponseWriter, r *http.Request, who *Who) {
	var in struct {
		Add  string `json:"add"`
		From string `json:"from"`
		To   string `json:"to"`
	}
	if err := readJSON(w, r, &in); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad request")
		return
	}
	var saved string
	a.db.QueryRow(`SELECT saved_tags FROM users WHERE id = ?`, who.ID).Scan(&saved)
	savedTags := splitTags(saved)
	if in.Add != "" {
		add := cleanTag(in.Add)
		if add == "" {
			jsonErr(w, http.StatusBadRequest, "type a tag name")
			return
		}
		if len(savedTags) >= 500 {
			jsonErr(w, http.StatusBadRequest, "too many tags")
			return
		}
		next := append(savedTags, add)
		if _, err := a.db.Exec(`UPDATE users SET saved_tags = ? WHERE id = ?`, joinSavedTags(next), who.ID); err != nil {
			jsonErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"tag": add})
		return
	}
	from, to := cleanTag(in.From), cleanTag(in.To)
	if from == "" {
		jsonErr(w, http.StatusBadRequest, "which tag?")
		return
	}
	type row struct {
		id   int64
		tags []string
	}
	var list []row
	q, err := a.db.Query(`SELECT id, tags FROM bookmarks WHERE user_id = ? AND tags LIKE ?`, who.ID, "%,"+from+",%")
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	for q.Next() {
		var rw row
		var t string
		if q.Scan(&rw.id, &t) == nil {
			rw.tags = splitTags(t)
			list = append(list, rw)
		}
	}
	q.Close()
	for _, rw := range list {
		var next []string
		for _, t := range rw.tags {
			switch {
			case t != from:
				next = append(next, t)
			case to != "":
				next = append(next, to)
			}
		}
		a.db.Exec(`UPDATE bookmarks SET tags = ? WHERE id = ?`, joinTags(cleanTags(next)), rw.id)
	}
	// The saved (possibly empty) tags follow the rename or removal too.
	var keep []string
	for _, t := range savedTags {
		switch {
		case t != from:
			keep = append(keep, t)
		case to != "":
			keep = append(keep, to)
		}
	}
	a.db.Exec(`UPDATE users SET saved_tags = ? WHERE id = ?`, joinSavedTags(keep), who.ID)
	writeJSON(w, http.StatusOK, map[string]int{"changed": len(list)})
}

// joinSavedTags stores a user's own tag list: cleaned and without doubles,
// but not cut at 20 like the tags on one crumb.
func joinSavedTags(in []string) string {
	out := []string{}
	seen := map[string]bool{}
	for _, t := range in {
		if t = cleanTag(t); t != "" && !seen[t] {
			seen[t] = true
			out = append(out, t)
		}
	}
	return joinTags(out)
}


// handleWipe deletes every bookmark (trash included), every folder and with
// them every tag of the signed-in user, for good. The account stays.
func (a *App) handleWipe(w http.ResponseWriter, r *http.Request, who *Who) {
	if who.Guest {
		jsonErr(w, http.StatusForbidden, "sign in to delete everything")
		return
	}
	var ids []int64
	rows, err := a.db.Query(`SELECT id FROM bookmarks WHERE user_id = ?`, who.ID)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	for rows.Next() {
		var id int64
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	rows.Close()
	tx, err := a.db.Begin()
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback()
	var folders int64
	if _, err := tx.Exec(`DELETE FROM bookmarks WHERE user_id = ?`, who.ID); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	tx.Exec(`UPDATE users SET saved_tags = '' WHERE id = ?`, who.ID)
	res, err := tx.Exec(`DELETE FROM folders WHERE user_id = ?`, who.ID)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	folders, _ = res.RowsAffected()
	if err := tx.Commit(); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	a.removeImages(ids...)
	writeJSON(w, http.StatusOK, map[string]int64{"bookmarks": int64(len(ids)), "folders": folders})
}
