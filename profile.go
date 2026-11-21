package main

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"time"
)

// Profile pictures. A user's avatar is stored in users.avatar as:
//   ""            show the first letter of the username
//   "icon:<name>" one of the built-in icons (drawn by the front end)
//   "img:<ver>"   an uploaded picture in data/avatars/<user id>

var reAvatarIcon = regexp.MustCompile(`^icon:[a-z0-9-]{1,24}$`)

func (a *App) avatarPath(uid int64) string {
	return filepath.Join(a.avatarDir, fmt.Sprintf("%d", uid))
}

// handleSetAvatar switches to the letter ("") or a built-in icon.
func (a *App) handleSetAvatar(w http.ResponseWriter, r *http.Request, who *Who) {
	if who.Guest {
		jsonErr(w, http.StatusForbidden, "sign in to change your picture")
		return
	}
	var in struct {
		Avatar string `json:"avatar"`
	}
	if err := readJSON(w, r, &in); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if in.Avatar != "" && !reAvatarIcon.MatchString(in.Avatar) {
		jsonErr(w, http.StatusBadRequest, "unknown picture")
		return
	}
	if _, err := a.db.Exec(`UPDATE users SET avatar = ?, avatar_size = 0 WHERE id = ?`, in.Avatar, who.ID); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	os.Remove(a.avatarPath(who.ID))
	writeJSON(w, http.StatusOK, a.getUser(who.ID))
}

// handleUploadAvatar stores a picture the browser already cropped to a square.
func (a *App) handleUploadAvatar(w http.ResponseWriter, r *http.Request, who *Who) {
	if who.Guest {
		jsonErr(w, http.StatusForbidden, "sign in to change your picture")
		return
	}
	data, code, err := readImageUpload(w, r, 2<<20)
	if err != nil {
		jsonErr(w, code, err.Error())
		return
	}
	var oldSize int64
	a.db.QueryRow(`SELECT avatar_size FROM users WHERE id = ?`, who.ID).Scan(&oldSize)
	if err := a.checkStorage(who.ID, int64(len(data))-oldSize); err != nil {
		jsonErr(w, http.StatusInsufficientStorage, err.Error())
		return
	}
	if err := writeFileAtomic(a.avatarPath(who.ID), data); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	ver := fmt.Sprintf("img:%d", time.Now().UnixMilli())
	if _, err := a.db.Exec(`UPDATE users SET avatar = ?, avatar_size = ? WHERE id = ?`, ver, len(data), who.ID); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, a.getUser(who.ID))
}

// handleGetAvatar serves a user's uploaded picture to anyone who may use Crumbs.
func (a *App) handleGetAvatar(w http.ResponseWriter, r *http.Request, who *Who) {
	id, err := pathID(r)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	serveImageFile(w, r, a.avatarPath(id))
}
