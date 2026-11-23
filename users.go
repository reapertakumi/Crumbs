package main

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
)

// ---- storage accounting ----
//
// A user's storage is the size of their thumbnails, favicons and profile
// photo, plus the text of their bookmarks. storage_limit 0 means unlimited.

var errStorageFull = errors.New("storage limit reached: delete some crumbs or ask an admin for more space")

const usageSQL = `(SELECT COALESCE(SUM(b.thumb_size + b.icon_size + length(b.name) + length(b.url) + length(b.description)), 0)
	FROM bookmarks b WHERE b.user_id = u.id) + u.avatar_size`

func (a *App) storageUsed(uid int64) int64 {
	var n int64
	a.db.QueryRow(`SELECT `+usageSQL+` FROM users u WHERE u.id = ?`, uid).Scan(&n)
	return n
}

// perCrumbReserve is the space a new crumb is expected to need for its
// thumbnail and favicon, which the browser uploads right after saving it:
// the user's own average, or 30 KB before they have any pictures.
func (a *App) perCrumbReserve(uid int64) int64 {
	var total, n int64
	a.db.QueryRow(`SELECT COALESCE(SUM(thumb_size + icon_size), 0), COUNT(*) FROM bookmarks
		WHERE user_id = ? AND (thumb_size + icon_size) > 0`, uid).Scan(&total, &n)
	if n == 0 {
		return 30 << 10
	}
	avg := total / n
	if avg < 8<<10 {
		avg = 8 << 10
	}
	return avg
}

// storageFull answers 507 with what is needed, so the app can offer to ask an
// admin for more space. It returns false when there is room.
func (a *App) storageFull(w http.ResponseWriter, uid, extra int64) bool {
	if a.checkStorage(uid, extra) == nil {
		return false
	}
	var limit, request int64
	a.db.QueryRow(`SELECT storage_limit, limit_request FROM users WHERE id = ?`, uid).Scan(&limit, &request)
	used := a.storageUsed(uid)
	writeJSON(w, http.StatusInsufficientStorage, map[string]any{
		"error": errStorageFull.Error(), "storageFull": true,
		"used": used, "limit": limit, "needed": used + extra, "requested": request,
	})
	return true
}

// handleLimitRequest: a user asks for a bigger storage limit ({"bytes"}),
// or clears the admin's answer after reading it ({"seen": true}).
func (a *App) handleLimitRequest(w http.ResponseWriter, r *http.Request, who *Who) {
	if who.Guest {
		jsonErr(w, http.StatusForbidden, "sign in to ask for more space")
		return
	}
	var in struct {
		Bytes int64 `json:"bytes"`
		Seen  bool  `json:"seen"`
	}
	if err := readJSON(w, r, &in); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if in.Seen {
		a.db.Exec(`UPDATE users SET limit_answer = '' WHERE id = ?`, who.ID)
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		return
	}
	var limit int64
	a.db.QueryRow(`SELECT storage_limit FROM users WHERE id = ?`, who.ID).Scan(&limit)
	if limit <= 0 {
		jsonErr(w, http.StatusBadRequest, "you have no storage limit")
		return
	}
	if in.Bytes <= limit || in.Bytes > 1<<40 {
		jsonErr(w, http.StatusBadRequest, "ask for more than your current limit")
		return
	}
	a.db.Exec(`UPDATE users SET limit_request = ?, limit_answer = '' WHERE id = ?`, in.Bytes, who.ID)
	writeJSON(w, http.StatusOK, map[string]int64{"requested": in.Bytes})
}

// handleAnswerLimit: an admin approves ({"approve": true}: the limit becomes
// the requested amount) or denies a user's request.
func (a *App) handleAnswerLimit(w http.ResponseWriter, r *http.Request, who *Who) {
	id, err := pathID(r)
	if err != nil {
		jsonErr(w, http.StatusNotFound, "no such user")
		return
	}
	var in struct {
		Approve bool `json:"approve"`
	}
	if err := readJSON(w, r, &in); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad request")
		return
	}
	var request int64
	if a.db.QueryRow(`SELECT limit_request FROM users WHERE id = ?`, id).Scan(&request) != nil {
		jsonErr(w, http.StatusNotFound, "no such user")
		return
	}
	if request <= 0 {
		jsonErr(w, http.StatusBadRequest, "there is no request to answer")
		return
	}
	if in.Approve {
		a.db.Exec(`UPDATE users SET storage_limit = limit_request, limit_request = 0, limit_answer = 'approved' WHERE id = ?`, id)
	} else {
		a.db.Exec(`UPDATE users SET limit_request = 0, limit_answer = 'denied' WHERE id = ?`, id)
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// checkStorage fails if adding `extra` bytes would go over the user's limit.
func (a *App) checkStorage(uid, extra int64) error {
	if extra <= 0 {
		return nil
	}
	var limit int64
	a.db.QueryRow(`SELECT storage_limit FROM users WHERE id = ?`, uid).Scan(&limit)
	if limit > 0 && a.storageUsed(uid)+extra > limit {
		return errStorageFull
	}
	return nil
}

// backfillSizes records file sizes for images saved by older versions.
func (a *App) backfillSizes() {
	type row struct {
		id     int64
		tv, iv int64
	}
	var rows []row
	q, err := a.db.Query(`SELECT id, thumb_ver, icon_ver FROM bookmarks
		WHERE (thumb_ver > 0 AND thumb_size = 0) OR (icon_ver > 0 AND icon_size = 0)`)
	if err == nil {
		for q.Next() {
			var r row
			if q.Scan(&r.id, &r.tv, &r.iv) == nil {
				rows = append(rows, r)
			}
		}
		q.Close()
	}
	size := func(p string) int64 {
		if st, err := os.Stat(p); err == nil {
			return st.Size()
		}
		return 0
	}
	for _, r := range rows {
		a.db.Exec(`UPDATE bookmarks SET thumb_size = ?, icon_size = ? WHERE id = ?`,
			size(a.imgPath(r.id, "thumb")), size(a.imgPath(r.id, "icon")), r.id)
	}
	var uids []int64
	q, err = a.db.Query(`SELECT id FROM users WHERE avatar LIKE 'img:%' AND avatar_size = 0`)
	if err == nil {
		for q.Next() {
			var id int64
			if q.Scan(&id) == nil {
				uids = append(uids, id)
			}
		}
		q.Close()
	}
	for _, id := range uids {
		a.db.Exec(`UPDATE users SET avatar_size = ? WHERE id = ?`, size(a.avatarPath(id)), id)
	}
}

// ---- admin: users ----

type adminUser struct {
	User
	Blocked      bool  `json:"blocked"`
	StorageUsed  int64 `json:"storageUsed"`
	StorageLimit int64 `json:"storageLimit"`
	LimitRequest int64 `json:"limitRequest"`
	Created      int64 `json:"created"`
	Bookmarks    int   `json:"bookmarks"`
}

func (a *App) handleListUsers(w http.ResponseWriter, r *http.Request, who *Who) {
	rows, err := a.db.Query(`
		SELECT u.id, u.username, u.display_name, u.is_admin, u.avatar, u.blocked, u.storage_limit, u.limit_request, u.created_at,
		       (SELECT COUNT(*) FROM bookmarks b WHERE b.user_id = u.id AND b.deleted_at = 0), ` + usageSQL + `
		FROM users u ORDER BY u.id`)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	users := []adminUser{}
	for rows.Next() {
		var u adminUser
		var admin, blocked int
		var av string
		if err := rows.Scan(&u.ID, &u.Username, &u.DisplayName, &admin, &av, &blocked, &u.StorageLimit, &u.LimitRequest,
			&u.Created, &u.Bookmarks, &u.StorageUsed); err != nil {
			rows.Close()
			jsonErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		u.IsAdmin = admin == 1
		u.Blocked = blocked == 1
		u.Avatar = avatarURL(u.ID, av)
		users = append(users, u)
	}
	rows.Close()
	owner := ""
	if o := a.ownerUser(); o != nil {
		owner = firstNonEmpty(o.DisplayName, o.Username)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"users": users, "owner": owner,
		"loginRequired": a.loginRequired.Load(), "registration": a.registration.Load(),
	})
}

func (a *App) handleCreateUser(w http.ResponseWriter, r *http.Request, who *Who) {
	var in credsIn
	if err := readJSON(w, r, &in); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad request")
		return
	}
	in.Username = strings.TrimSpace(in.Username)
	if err := validCreds(in.Username, in.Password); err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	u, err := a.insertUser(in.Username, in.DisplayName, in.Password, in.IsAdmin)
	if errors.Is(err, errTaken) {
		jsonErr(w, http.StatusConflict, err.Error())
		return
	} else if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, u)
}

// activeAdmins counts admins who are not blocked.
func (a *App) activeAdmins() int {
	var n int
	a.db.QueryRow(`SELECT COUNT(*) FROM users WHERE is_admin = 1 AND blocked = 0`).Scan(&n)
	return n
}

// handlePatchUser changes another user's name, picture, role, access or storage limit.
func (a *App) handlePatchUser(w http.ResponseWriter, r *http.Request, who *Who) {
	id, err := pathID(r)
	target := (*User)(nil)
	if err == nil {
		target = a.getUser(id)
	}
	if target == nil {
		jsonErr(w, http.StatusNotFound, "no such user")
		return
	}
	var in struct {
		Username     *string `json:"username"`
		DisplayName  *string `json:"displayName"`
		Avatar       *string `json:"avatar"`
		IsAdmin      *bool   `json:"isAdmin"`
		Blocked      *bool   `json:"blocked"`
		StorageLimit *int64  `json:"storageLimit"`
	}
	if err := readJSON(w, r, &in); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad request")
		return
	}
	bad := func(msg string) { jsonErr(w, http.StatusBadRequest, msg) }

	// Validate everything first so a bad field changes nothing.
	if in.Username != nil {
		*in.Username = strings.TrimSpace(*in.Username)
		if err := validUsername(*in.Username); err != nil {
			bad(err.Error())
			return
		}
	}
	if in.Avatar != nil && *in.Avatar != "" && !reAvatarIcon.MatchString(*in.Avatar) {
		bad("unknown picture")
		return
	}
	if in.IsAdmin != nil && !*in.IsAdmin && target.IsAdmin {
		if id == who.ID {
			bad("you can't remove your own admin rights")
			return
		}
		if a.activeAdmins() <= 1 {
			bad("Crumbs needs at least one admin")
			return
		}
	}
	if in.Blocked != nil && *in.Blocked {
		if id == who.ID {
			bad("you can't block yourself")
			return
		}
		if target.IsAdmin && a.activeAdmins() <= 1 {
			bad("you can't block the last admin")
			return
		}
	}
	if in.StorageLimit != nil && *in.StorageLimit < 0 {
		bad("the storage limit can't be negative")
		return
	}

	if in.Username != nil && *in.Username != target.Username {
		if _, err := a.db.Exec(`UPDATE users SET username = ? WHERE id = ?`, *in.Username, id); err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				jsonErr(w, http.StatusConflict, errTaken.Error())
			} else {
				jsonErr(w, http.StatusInternalServerError, err.Error())
			}
			return
		}
	}
	if in.DisplayName != nil {
		a.db.Exec(`UPDATE users SET display_name = ? WHERE id = ?`, cleanDisplayName(*in.DisplayName), id)
	}
	if in.Avatar != nil {
		a.db.Exec(`UPDATE users SET avatar = ?, avatar_size = 0 WHERE id = ?`, *in.Avatar, id)
		os.Remove(a.avatarPath(id))
	}
	if in.IsAdmin != nil {
		a.db.Exec(`UPDATE users SET is_admin = ? WHERE id = ?`, boolInt(*in.IsAdmin), id)
	}
	if in.Blocked != nil {
		a.db.Exec(`UPDATE users SET blocked = ? WHERE id = ?`, boolInt(*in.Blocked), id)
		if *in.Blocked {
			a.db.Exec(`DELETE FROM sessions WHERE user_id = ?`, id)
		}
	}
	if in.StorageLimit != nil {
		a.db.Exec(`UPDATE users SET storage_limit = ? WHERE id = ?`, *in.StorageLimit, id)
		// A limit raised by hand (or removed) to cover a waiting request answers it.
		a.db.Exec(`UPDATE users SET limit_request = 0, limit_answer = 'approved'
			WHERE id = ? AND limit_request > 0 AND (storage_limit = 0 OR storage_limit >= limit_request)`, id)
	}
	writeJSON(w, http.StatusOK, a.getUser(id))
}

func (a *App) handleDeleteUser(w http.ResponseWriter, r *http.Request, who *Who) {
	id, err := pathID(r)
	if err != nil {
		jsonErr(w, http.StatusNotFound, "no such user")
		return
	}
	if id == who.ID {
		jsonErr(w, http.StatusBadRequest, "you can't delete your own account")
		return
	}
	var ids []int64
	rows, err := a.db.Query(`SELECT id FROM bookmarks WHERE user_id = ?`, id)
	if err == nil {
		for rows.Next() {
			var bid int64
			if rows.Scan(&bid) == nil {
				ids = append(ids, bid)
			}
		}
		rows.Close()
	}
	res, err := a.db.Exec(`DELETE FROM users WHERE id = ?`, id)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		jsonErr(w, http.StatusNotFound, "no such user")
		return
	}
	a.removeImages(ids...)
	os.Remove(a.avatarPath(id))
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *App) handleResetPassword(w http.ResponseWriter, r *http.Request, who *Who) {
	id, err := pathID(r)
	if err != nil {
		jsonErr(w, http.StatusNotFound, "no such user")
		return
	}
	var in struct {
		Password string `json:"password"`
	}
	if err := readJSON(w, r, &in); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if len(in.Password) < minPassLen || len(in.Password) > 256 {
		jsonErr(w, http.StatusBadRequest, fmt.Sprintf("password must be at least %d characters", minPassLen))
		return
	}
	hash, err := hashPassword(in.Password)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, "could not hash password")
		return
	}
	res, err := a.db.Exec(`UPDATE users SET pass_hash = ? WHERE id = ?`, hash, id)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		jsonErr(w, http.StatusNotFound, "no such user")
		return
	}
	if id != who.ID {
		a.db.Exec(`DELETE FROM sessions WHERE user_id = ?`, id)
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// ---- admin: site settings ----

func (a *App) saveSetting(key string, on bool) error {
	_, err := a.db.Exec(`INSERT INTO settings(key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, fmt.Sprint(boolInt(on)))
	return err
}

func (a *App) handleSettings(w http.ResponseWriter, r *http.Request, who *Who) {
	var in struct {
		LoginRequired *bool `json:"loginRequired"`
		Registration  *bool `json:"registration"`
	}
	if err := readJSON(w, r, &in); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if in.LoginRequired != nil {
		if err := a.saveSetting("login_required", *in.LoginRequired); err != nil {
			jsonErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		a.loginRequired.Store(*in.LoginRequired)
	}
	if in.Registration != nil {
		if err := a.saveSetting("registration", *in.Registration); err != nil {
			jsonErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		a.registration.Store(*in.Registration)
	}
	writeJSON(w, http.StatusOK, map[string]bool{
		"loginRequired": a.loginRequired.Load(), "registration": a.registration.Load(),
	})
}
