package main

import (
	"database/sql"
	"errors"
	"net/http"
	"regexp"
	"time"
)

type Folder struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	ParentID *int64 `json:"parentId"`
	Color    string `json:"color"`    // "" or "#rrggbb"
	Icon     string `json:"icon"`     // "" (plain folder) or an icon name the front end knows
	Position int64  `json:"position"` // order among siblings
	Created  int64  `json:"created"`
}

type folderIn struct {
	Name     string `json:"name"`
	ParentID *int64 `json:"parentId"`
	Color    string `json:"color"`
	Icon     string `json:"icon"`
}

var (
	reColor      = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
	reFolderIcon = regexp.MustCompile(`^[a-z0-9-]{1,24}$`)
)

func (a *App) listFolders(uid int64) ([]*Folder, error) {
	rows, err := a.db.Query(`SELECT id, name, parent_id, color, icon, position, created_at FROM folders
		WHERE user_id = ? ORDER BY position, name COLLATE NOCASE, id`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []*Folder{}
	for rows.Next() {
		var f Folder
		var parent sql.NullInt64
		if err := rows.Scan(&f.ID, &f.Name, &parent, &f.Color, &f.Icon, &f.Position, &f.Created); err != nil {
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
	if in.Color != "" && !reColor.MatchString(in.Color) {
		return errors.New("unknown folder color")
	}
	if in.Icon != "" && !reFolderIcon.MatchString(in.Icon) {
		return errors.New("unknown folder icon")
	}
	return nil
}

// nextPosition puts a folder after its new siblings.
func (a *App) nextPosition(uid int64, parent *int64) int64 {
	var n int64
	a.db.QueryRow(`SELECT COALESCE(MAX(position), -1) + 1 FROM folders WHERE user_id = ? AND parent_id IS ?`,
		uid, nullID(parent)).Scan(&n)
	return n
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
	pos := a.nextPosition(who.ID, in.ParentID)
	res, err := a.db.Exec(`INSERT INTO folders(user_id, parent_id, name, color, icon, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		who.ID, nullID(in.ParentID), in.Name, in.Color, in.Icon, pos, now)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	id, _ := res.LastInsertId()
	writeJSON(w, http.StatusCreated, &Folder{ID: id, Name: in.Name, ParentID: in.ParentID, Color: in.Color, Icon: in.Icon, Position: pos, Created: now})
}

func (a *App) handleUpdateFolder(w http.ResponseWriter, r *http.Request, who *Who) {
	id, err := pathID(r)
	var oldParent sql.NullInt64
	if err == nil {
		err = a.db.QueryRow(`SELECT parent_id FROM folders WHERE id = ? AND user_id = ?`, id, who.ID).Scan(&oldParent)
	}
	if err != nil {
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
	moved := (in.ParentID == nil) != !oldParent.Valid || (in.ParentID != nil && *in.ParentID != oldParent.Int64)
	if moved {
		a.db.Exec(`UPDATE folders SET position = ? WHERE id = ?`, a.nextPosition(who.ID, in.ParentID), id)
	}
	if _, err := a.db.Exec(`UPDATE folders SET name = ?, parent_id = ?, color = ?, icon = ? WHERE id = ? AND user_id = ?`,
		in.Name, nullID(in.ParentID), in.Color, in.Icon, id, who.ID); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// handleOrderFolders puts the given folders, in this order, inside parentId
// (null = top level). Used when folders are dragged around in the sidebar.
func (a *App) handleOrderFolders(w http.ResponseWriter, r *http.Request, who *Who) {
	var in struct {
		ParentID *int64  `json:"parentId"`
		IDs      []int64 `json:"ids"`
	}
	if err := readJSON(w, r, &in); err != nil || len(in.IDs) > 5000 {
		jsonErr(w, http.StatusBadRequest, "bad request")
		return
	}
	for _, id := range in.IDs {
		if !a.folderOwned(who.ID, id) {
			jsonErr(w, http.StatusNotFound, "no such folder")
			return
		}
		if err := a.checkParent(who.ID, id, in.ParentID); err != nil {
			jsonErr(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	tx, err := a.db.Begin()
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback()
	for i, id := range in.IDs {
		if _, err := tx.Exec(`UPDATE folders SET parent_id = ?, position = ? WHERE id = ? AND user_id = ?`,
			nullID(in.ParentID), i, id, who.ID); err != nil {
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
