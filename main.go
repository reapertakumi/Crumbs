// Crumbs: a tiny visual bookmark manager for the Raspberry Pi 5.
package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

//go:embed web
var webFS embed.FS

func main() {
	dataDir := envOr("DATA_DIR", "/data")
	addr := envOr("ADDR", ":9099")

	imgDir := filepath.Join(dataDir, "img")
	avatarDir := filepath.Join(dataDir, "avatars")
	for _, d := range []string{imgDir, avatarDir} {
		if err := os.MkdirAll(d, 0o755); err != nil {
			log.Fatalf("create data dir: %v", err)
		}
	}

	db, err := openDB(filepath.Join(dataDir, "crumbs.db"))
	if err != nil {
		log.Fatalf("open database: %v", err)
	}

	app := &App{db: db, dataDir: dataDir, imgDir: imgDir, avatarDir: avatarDir, limiter: newLimiter(),
		links: &linkJobs{jobs: map[int64]*linkJob{}}}
	app.loadSettings()
	app.backfillSizes()
	go app.janitor()
	go app.backupLoop()

	static, err := fs.Sub(webFS, "web")
	if err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()
	app.routes(mux, static)

	srv := &http.Server{
		Addr:              addr,
		Handler:           app.secure(mux),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	log.Printf("Crumbs is listening on %s (data in %s)", addr, dataDir)
	log.Fatal(srv.ListenAndServe())
}

func (a *App) routes(mux *http.ServeMux, static fs.FS) {
	files := http.FileServerFS(static)
	mux.Handle("GET /", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		files.ServeHTTP(w, r)
	}))

	// Session and accounts
	mux.HandleFunc("GET /api/state", a.handleState)
	mux.HandleFunc("POST /api/setup", a.handleSetup)
	mux.HandleFunc("POST /api/login", a.handleLogin)
	mux.HandleFunc("POST /api/token", a.handleToken)
	mux.HandleFunc("POST /api/register", a.handleRegister)
	mux.HandleFunc("POST /api/logout", a.handleLogout)
	mux.HandleFunc("POST /api/password", a.user(a.handlePassword))

	// Bookmarks
	mux.HandleFunc("GET /api/bookmarks", a.user(a.handleListBookmarks))
	mux.HandleFunc("POST /api/bookmarks", a.user(a.handleCreateBookmark))
	mux.HandleFunc("PUT /api/bookmarks/{id}", a.user(a.handleUpdateBookmark))
	mux.HandleFunc("DELETE /api/bookmarks/{id}", a.user(a.handleDeleteBookmark))
	mux.HandleFunc("POST /api/bookmarks/{id}/restore", a.user(a.handleRestoreBookmark))
	mux.HandleFunc("DELETE /api/trash", a.user(a.handleEmptyTrash))
	mux.HandleFunc("POST /api/dedupe", a.user(a.handleDedupe))
	mux.HandleFunc("POST /api/bookmarks/bulk", a.user(a.handleBulk))
	mux.HandleFunc("POST /api/tags", a.user(a.handleTagEdit))
	mux.HandleFunc("POST /api/wipe", a.user(a.handleWipe))
	mux.HandleFunc("GET /api/linkcheck", a.user(a.handleLinkStatus))
	mux.HandleFunc("POST /api/linkcheck", a.user(a.handleLinkCheck))
	mux.HandleFunc("PUT /api/bookmarks/{id}/{kind}", a.user(a.handlePutImage))
	mux.HandleFunc("DELETE /api/bookmarks/{id}/{kind}", a.user(a.handleDeleteImage))
	mux.HandleFunc("GET /img/{id}/{kind}", a.user(a.handleGetImage))

	// Folders (nested)
	mux.HandleFunc("POST /api/folders", a.user(a.handleCreateFolder))
	mux.HandleFunc("PUT /api/folders/order", a.user(a.handleOrderFolders))
	mux.HandleFunc("PUT /api/folders/{id}", a.user(a.handleUpdateFolder))
	mux.HandleFunc("DELETE /api/folders/{id}", a.user(a.handleDeleteFolder))

	// Profile picture
	mux.HandleFunc("PUT /api/me", a.user(a.handleUpdateMe))
	mux.HandleFunc("PUT /api/me/avatar", a.user(a.handleSetAvatar))
	mux.HandleFunc("PUT /api/me/avatar/image", a.user(a.handleUploadAvatar))
	mux.HandleFunc("GET /avatar/{id}", a.user(a.handleGetAvatar))

	// Import / export
	mux.HandleFunc("GET /api/export", a.user(a.handleExportMe))
	mux.HandleFunc("POST /api/import", a.user(a.handleImportMe))

	// Link previews
	mux.HandleFunc("GET /api/meta", a.user(a.handleMeta))
	mux.HandleFunc("GET /api/fetch", a.user(a.handleFetch))

	// Admin
	mux.HandleFunc("GET /api/users", a.admin(a.handleListUsers))
	mux.HandleFunc("POST /api/users", a.admin(a.handleCreateUser))
	mux.HandleFunc("DELETE /api/users/{id}", a.admin(a.handleDeleteUser))
	mux.HandleFunc("PATCH /api/users/{id}", a.admin(a.handlePatchUser))
	mux.HandleFunc("GET /api/users/{id}/export", a.admin(a.handleExportUser))
	mux.HandleFunc("POST /api/users/{id}/import", a.admin(a.handleImportUser))
	mux.HandleFunc("PUT /api/users/{id}/password", a.admin(a.handleResetPassword))
	mux.HandleFunc("PUT /api/settings", a.admin(a.handleSettings))
	mux.HandleFunc("GET /api/backups", a.admin(a.handleListBackups))
	mux.HandleFunc("POST /api/backups", a.admin(a.handleMakeBackup))
	mux.HandleFunc("GET /api/backups/{name}", a.admin(a.handleDownloadBackup))
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
