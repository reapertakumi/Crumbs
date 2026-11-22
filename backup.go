package main

import (
	"archive/zip"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

// Automatic backups: every night at 3:00 (the Pi's time zone) Crumbs writes
// data/backups/crumbs-YYYY-MM-DD-HHMMSS.zip with the database, thumbnails,
// favicons and profile photos, and keeps the newest 7.

const (
	backupHour = 3
	backupKeep = 7
)

var (
	reBackupName = regexp.MustCompile(`^crumbs-\d{4}-\d{2}-\d{2}-\d{6}\.zip$`)
	backupMu     sync.Mutex
)

func (a *App) backupDir() string { return filepath.Join(a.dataDir, "backups") }

// backupLoop sleeps until the next 3:00 and makes a backup, forever.
func (a *App) backupLoop() {
	for {
		now := time.Now()
		next := time.Date(now.Year(), now.Month(), now.Day(), backupHour, 0, 0, 0, now.Location())
		if !next.After(now) {
			next = next.AddDate(0, 0, 1)
		}
		time.Sleep(time.Until(next))
		if name, err := a.makeBackup(); err != nil {
			log.Printf("nightly backup failed: %v", err)
		} else {
			log.Printf("nightly backup written: %s", name)
		}
	}
}

func (a *App) makeBackup() (string, error) {
	backupMu.Lock()
	defer backupMu.Unlock()
	dir := a.backupDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	// A consistent copy of the live database (safe while Crumbs is running).
	snap := filepath.Join(dir, ".snapshot.db")
	os.Remove(snap)
	if _, err := a.db.Exec(`VACUUM INTO ?`, snap); err != nil {
		return "", err
	}
	defer os.Remove(snap)

	name := "crumbs-" + time.Now().Format("2006-01-02-150405") + ".zip"
	partial := filepath.Join(dir, ".partial.zip")
	f, err := os.Create(partial)
	if err != nil {
		return "", err
	}
	zw := zip.NewWriter(f)
	err = addToZip(zw, snap, "crumbs.db", zip.Deflate)
	for _, sub := range []string{"img", "avatars"} {
		entries, _ := os.ReadDir(filepath.Join(a.dataDir, sub))
		for _, e := range entries {
			if err != nil {
				break
			}
			if e.Type().IsRegular() && !strings.HasPrefix(e.Name(), ".") {
				// Images are already compressed: store them as they are.
				err = addToZip(zw, filepath.Join(a.dataDir, sub, e.Name()), sub+"/"+e.Name(), zip.Store)
			}
		}
	}
	if cerr := zw.Close(); err == nil {
		err = cerr
	}
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err == nil {
		err = os.Rename(partial, filepath.Join(dir, name))
	}
	if err != nil {
		os.Remove(partial)
		return "", err
	}
	a.pruneBackups()
	return name, nil
}

func addToZip(zw *zip.Writer, path, name string, method uint16) error {
	src, err := os.Open(path)
	if err != nil {
		return err
	}
	defer src.Close()
	st, err := src.Stat()
	if err != nil {
		return err
	}
	hdr, err := zip.FileInfoHeader(st)
	if err != nil {
		return err
	}
	hdr.Name = name
	hdr.Method = method
	dst, err := zw.CreateHeader(hdr)
	if err != nil {
		return err
	}
	_, err = io.Copy(dst, src)
	return err
}

type backupInfo struct {
	Name    string `json:"name"`
	Size    int64  `json:"size"`
	Created int64  `json:"created"`
}

func (a *App) listBackups() []backupInfo {
	out := []backupInfo{}
	entries, _ := os.ReadDir(a.backupDir())
	for _, e := range entries {
		if !reBackupName.MatchString(e.Name()) {
			continue
		}
		if st, err := e.Info(); err == nil {
			out = append(out, backupInfo{Name: e.Name(), Size: st.Size(), Created: st.ModTime().Unix()})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name > out[j].Name }) // newest first
	return out
}

func (a *App) pruneBackups() {
	for i, b := range a.listBackups() {
		if i >= backupKeep {
			os.Remove(filepath.Join(a.backupDir(), b.Name))
		}
	}
}

func (a *App) handleListBackups(w http.ResponseWriter, r *http.Request, who *Who) {
	writeJSON(w, http.StatusOK, map[string]any{"backups": a.listBackups(), "keep": backupKeep, "hour": backupHour})
}

func (a *App) handleMakeBackup(w http.ResponseWriter, r *http.Request, who *Who) {
	if _, err := a.makeBackup(); err != nil {
		jsonErr(w, http.StatusInternalServerError, "backup failed: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"backups": a.listBackups(), "keep": backupKeep, "hour": backupHour})
}

func (a *App) handleDownloadBackup(w http.ResponseWriter, r *http.Request, who *Who) {
	name := r.PathValue("name")
	if !reBackupName.MatchString(name) {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Disposition", `attachment; filename="`+name+`"`)
	w.Header().Set("Content-Type", "application/zip")
	http.ServeFile(w, r, filepath.Join(a.backupDir(), name))
}
