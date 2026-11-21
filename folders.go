package main

import (
	"database/sql"
	"errors"
	"net/http"
	"time"
)

type Folder struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	ParentID *int64 `json:"parentId"`
	Created  int64  `json:"created"`
}

type folderIn struct {
	Name     string `json:"name"`
	ParentID *int64 `json:"parentId"`
}

func (a *App) listFolders(uid int64) ([]*Folder, error) {
	rows, err := a.db.Query(`SELECT id, name, parent_id, created_at FROM folders WHERE user_id = ? ORDER BY name COLLATE NOCASE, id`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []*Folder{}
	for rows.Next() {
		var f Folder
		var parent sql.NullInt64
		if err := rows.Scan(&f.ID, &f.Name, &parent, &f.Created); err != nil {
			return nil, err
		}
		if parent.Valid {
			p := parent.Int64
			f.ParentID = &p
		}
		list = append(list, &f)
	}
	return list, rows.Err()
}

func (a *App) folderOwned(uid, id int64) bool {
	var n int
	a.db.QueryRow(`SELECT COUNT(*) FROM folders WHERE id = ? AND user_id = ?`, id, uid).Scan(&n)
	return n > 0
}

// checkParent makes sure parent belongs to the user and that moving folder
// `self` under it would not create a loop. self is 0 for a new folder.
func (a *App) checkParent(uid, self int64, parent *int64) error {
	if parent == nil {
		return nil
	}
	folders, err := a.listFolders(uid)
	if err != nil {
		return err
	}
	parentOf := map[int64]*int64{}
	for _, f := range folders {
		parentOf[f.ID] = f.ParentID
	}
	if _, ok := parentOf[*parent]; !ok {
		return errors.New("that parent folder does not exist")
	}
	for cur, depth := parent, 0; cur != nil && depth < 1000; cur, depth = parentOf[*cur], depth+1 {
		if *cur == self {
			return errors.New("a folder can't go inside itself")
		}
	}
	return nil
}

func (in *folderIn) clean() error {
	in.Name = clip(oneLine(in.Name), 100)
	if in.Name == "" {
		return errors.New("give the folder a name")
	}
	return nil
}

func (a *App) handleCreateFolder(w http.ResponseWriter, r *http.Request, who *Who) {
	var in folderIn
	if err := readJSON(w, r, &in); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if err := in.clean(); err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := a.checkParent(who.ID, 0, in.ParentID); err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	now := time.Now().Unix()
	res, err := a.db.Exec(`INSERT INTO folders(user_id, parent_id, name, created_at) VALUES (?, ?, ?, ?)`,
		who.ID, nullID(in.ParentID), in.Name, now)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	id, _ := res.LastInsertId()
	writeJSON(w, http.StatusCreated, &Folder{ID: id, Name: in.Name, ParentID: in.ParentID, Created: now})
}

func (a *App) handleUpdateFolder(w http.ResponseWriter, r *http.Request, who *Who) {
	id, err := pathID(r)
	if err != nil || !a.folderOwned(who.ID, id) {
		jsonErr(w, http.StatusNotFound, "no such folder")
		return
	}
	var in folderIn
	if err := readJSON(w, r, &in); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if err := in.clean(); err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := a.checkParent(who.ID, id, in.ParentID); err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if _, err := a.db.Exec(`UPDATE folders SET name = ?, parent_id = ? WHERE id = ? AND user_id = ?`,
		in.Name, nullID(in.ParentID), id, who.ID); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// handleDeleteFolder removes a folder. Its bookmarks and subfolders move up
// one level (to the parent folder, or to Uncategorized).
func (a *App) handleDeleteFolder(w http.ResponseWriter, r *http.Request, who *Who) {
	id, err := pathID(r)
	if err != nil {
		jsonErr(w, http.StatusNotFound, "no such folder")
		return
	}
	var parent sql.NullInt64
	if err := a.db.QueryRow(`SELECT parent_id FROM folders WHERE id = ? AND user_id = ?`, id, who.ID).Scan(&parent); err != nil {
		jsonErr(w, http.StatusNotFound, "no such folder")
		return
	}
	var newParent *int64
	if parent.Valid {
		p := parent.Int64
		newParent = &p
	}
	tx, err := a.db.Begin()
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback()
	steps := []struct {
		q    string
		args []any
	}{
		{`UPDATE folders SET parent_id = ? WHERE parent_id = ? AND user_id = ?`, []any{nullID(newParent), id, who.ID}},
		{`UPDATE bookmarks SET folder_id = ? WHERE folder_id = ? AND user_id = ?`, []any{nullID(newParent), id, who.ID}},
		{`DELETE FROM folders WHERE id = ? AND user_id = ?`, []any{id, who.ID}},
	}
	for _, s := range steps {
		if _, err := tx.Exec(s.q, s.args...); err != nil {
			jsonErr(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	if err := tx.Commit(); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// nullID turns an optional id into a value SQLite accepts (NULL or the number).
func nullID(p *int64) any {
	if p == nil {
		return nil
	}
	return *p
}
