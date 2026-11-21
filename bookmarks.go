package main

import (
	"database/sql"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Bookmark struct {
	ID          int64  `json:"id"`
	FolderID    *int64 `json:"folderId"`
	Name        string `json:"name"`
	URL         string `json:"url"`
	Description string `json:"description"`
	Thumb       string `json:"thumb"`
	Icon        string `json:"icon"`
	Created     int64  `json:"created"`
	Updated     int64  `json:"updated"`
}

const bmCols = `id, folder_id, name, url, description, thumb_ver, icon_ver, created_at, updated_at`

type scanner interface{ Scan(dest ...any) error }

func scanBookmark(s scanner) (*Bookmark, error) {
	var b Bookmark
	var folder sql.NullInt64
	var tv, iv int64
	if err := s.Scan(&b.ID, &folder, &b.Name, &b.URL, &b.Description, &tv, &iv, &b.Created, &b.Updated); err != nil {
		return nil, err
	}
	if folder.Valid {
		f := folder.Int64
		b.FolderID = &f
	}
	if tv > 0 {
		b.Thumb = fmt.Sprintf("/img/%d/thumb?v=%d", b.ID, tv)
	}
	if iv > 0 {
		b.Icon = fmt.Sprintf("/img/%d/icon?v=%d", b.ID, iv)
	}
	return &b, nil
}

func (a *App) getBookmark(uid, id int64) (*Bookmark, error) {
	return scanBookmark(a.db.QueryRow(`SELECT `+bmCols+` FROM bookmarks WHERE id = ? AND user_id = ?`, id, uid))
}

type bookmarkIn struct {
	Name        string `json:"name"`
	URL         string `json:"url"`
	Description string `json:"description"`
	FolderID    *int64 `json:"folderId"`
}

func (a *App) cleanBookmark(uid int64, in *bookmarkIn) error {
	u, err := parseHTTPURL(in.URL)
	if err != nil {
		return err
	}
	in.URL = clip(u.String(), 4096)
	in.Name = clip(oneLine(in.Name), 300)
	if in.Name == "" {
		in.Name = strings.TrimPrefix(u.Hostname(), "www.")
	}
	in.Description = clip(strings.TrimSpace(in.Description), 2000)
	if in.FolderID != nil && !a.folderOwned(uid, *in.FolderID) {
		return errors.New("that folder does not exist")
	}
	return nil
}

func parseHTTPURL(raw string) (*url.URL, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, errors.New("a URL is required")
	}
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return nil, errors.New("please enter a valid http(s) URL")
	}
	return u, nil
}

func oneLine(s string) string { return strings.Join(strings.Fields(s), " ") }

func clip(s string, n int) string {
	r := []rune(s)
	if len(r) > n {
		return string(r[:n])
	}
	return s
}

// ---- CRUD ----

func (a *App) handleListBookmarks(w http.ResponseWriter, r *http.Request, who *Who) {
	rows, err := a.db.Query(`SELECT `+bmCols+` FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC, id DESC`, who.ID)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	list := []*Bookmark{}
	for rows.Next() {
		b, err := scanBookmark(rows)
		if err != nil {
			rows.Close()
			jsonErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		list = append(list, b)
	}
	rows.Close()
	folders, err := a.listFolders(who.ID)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"bookmarks": list, "folders": folders})
}

func (a *App) handleCreateBookmark(w http.ResponseWriter, r *http.Request, who *Who) {
	var in bookmarkIn
	if err := readJSON(w, r, &in); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if err := a.cleanBookmark(who.ID, &in); err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	now := time.Now().Unix()
	res, err := a.db.Exec(`INSERT INTO bookmarks(user_id, folder_id, name, url, description, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`, who.ID, nullID(in.FolderID), in.Name, in.URL, in.Description, now, now)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	id, _ := res.LastInsertId()
	b, err := a.getBookmark(who.ID, id)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, b)
}

func (a *App) handleUpdateBookmark(w http.ResponseWriter, r *http.Request, who *Who) {
	id, err := pathID(r)
	if err != nil {
		jsonErr(w, http.StatusNotFound, "no such bookmark")
		return
	}
	var in bookmarkIn
	if err := readJSON(w, r, &in); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if err := a.cleanBookmark(who.ID, &in); err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	res, err := a.db.Exec(`UPDATE bookmarks SET folder_id = ?, name = ?, url = ?, description = ?, updated_at = ?
		WHERE id = ? AND user_id = ?`, nullID(in.FolderID), in.Name, in.URL, in.Description, time.Now().Unix(), id, who.ID)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		jsonErr(w, http.StatusNotFound, "no such bookmark")
		return
	}
	b, err := a.getBookmark(who.ID, id)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, b)
}

func (a *App) handleDeleteBookmark(w http.ResponseWriter, r *http.Request, who *Who) {
	id, err := pathID(r)
	if err != nil {
		jsonErr(w, http.StatusNotFound, "no such bookmark")
		return
	}
	res, err := a.db.Exec(`DELETE FROM bookmarks WHERE id = ? AND user_id = ?`, id, who.ID)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		jsonErr(w, http.StatusNotFound, "no such bookmark")
		return
	}
	a.removeImages(id)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// ---- images (thumbnails and favicons, stored on the Pi) ----
//
// The browser downloads, crops and compresses the images, then uploads the
// finished JPEG/PNG here. The Pi only stores and serves the bytes.

func imgCol(kind string) string {
	switch kind {
	case "thumb":
		return "thumb_ver"
	case "icon":
		return "icon_ver"
	}
	return ""
}

func (a *App) imgPath(id int64, kind string) string {
	return filepath.Join(a.imgDir, fmt.Sprintf("%d_%s", id, kind))
}

func (a *App) removeImages(ids ...int64) {
	for _, id := range ids {
		os.Remove(a.imgPath(id, "thumb"))
		os.Remove(a.imgPath(id, "icon"))
	}
}

// readImageUpload reads a request body and accepts only JPEG, PNG or WebP.
func readImageUpload(w http.ResponseWriter, r *http.Request, max int64) ([]byte, int, error) {
	r.Body = http.MaxBytesReader(w, r.Body, max)
	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, http.StatusRequestEntityTooLarge, fmt.Errorf("image is too large (max %d MB)", max>>20)
	}
	switch http.DetectContentType(data) {
	case "image/jpeg", "image/png", "image/webp":
		return data, 0, nil
	}
	return nil, http.StatusUnsupportedMediaType, errors.New("only JPEG, PNG or WebP images")
}

// writeFileAtomic writes to a temp file next to dst and renames it into place.
func writeFileAtomic(dst string, data []byte) error {
	tmp, err := os.CreateTemp(filepath.Dir(dst), ".upload-*")
	if err != nil {
		return err
	}
	_, werr := tmp.Write(data)
	cerr := tmp.Close()
	if werr != nil || cerr != nil {
		os.Remove(tmp.Name())
		return errors.New("could not save image")
	}
	if err := os.Rename(tmp.Name(), dst); err != nil {
		os.Remove(tmp.Name())
		return err
	}
	return nil
}

// serveImageFile serves a stored image. URLs carry a version (?v=...), so
// the browser may cache them forever.
func serveImageFile(w http.ResponseWriter, r *http.Request, path string) {
	f, err := os.Open(path)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	head := make([]byte, 512)
	n, _ := io.ReadFull(f, head)
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		http.Error(w, "read error", http.StatusInternalServerError)
		return
	}
	st, err := f.Stat()
	if err != nil {
		http.Error(w, "read error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", http.DetectContentType(head[:n]))
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	http.ServeContent(w, r, "", st.ModTime(), f)
}

func (a *App) handlePutImage(w http.ResponseWriter, r *http.Request, who *Who) {
	id, err := pathID(r)
	kind := r.PathValue("kind")
	col := imgCol(kind)
	if err != nil || col == "" {
		jsonErr(w, http.StatusNotFound, "not found")
		return
	}
	if _, err := a.getBookmark(who.ID, id); err != nil {
		jsonErr(w, http.StatusNotFound, "no such bookmark")
		return
	}
	data, code, err := readImageUpload(w, r, 3<<20)
	if err != nil {
		jsonErr(w, code, err.Error())
		return
	}
	if err := writeFileAtomic(a.imgPath(id, kind), data); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	a.db.Exec(`UPDATE bookmarks SET `+col+` = ? WHERE id = ? AND user_id = ?`, time.Now().UnixMilli(), id, who.ID)
	b, err := a.getBookmark(who.ID, id)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, b)
}

func (a *App) handleDeleteImage(w http.ResponseWriter, r *http.Request, who *Who) {
	id, err := pathID(r)
	kind := r.PathValue("kind")
	col := imgCol(kind)
	if err != nil || col == "" {
		jsonErr(w, http.StatusNotFound, "not found")
		return
	}
	res, err := a.db.Exec(`UPDATE bookmarks SET `+col+` = 0 WHERE id = ? AND user_id = ?`, id, who.ID)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		jsonErr(w, http.StatusNotFound, "no such bookmark")
		return
	}
	os.Remove(a.imgPath(id, kind))
	b, _ := a.getBookmark(who.ID, id)
	writeJSON(w, http.StatusOK, b)
}

func (a *App) handleGetImage(w http.ResponseWriter, r *http.Request, who *Who) {
	id, err := pathID(r)
	kind := r.PathValue("kind")
	if err != nil || imgCol(kind) == "" {
		http.NotFound(w, r)
		return
	}
	b, err := a.getBookmark(who.ID, id)
	if err != nil || (kind == "thumb" && b.Thumb == "") || (kind == "icon" && b.Icon == "") {
		http.NotFound(w, r)
		return
	}
	serveImageFile(w, r, a.imgPath(id, kind))
}
