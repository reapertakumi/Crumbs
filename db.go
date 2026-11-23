package main

import (
	"database/sql"
	"strings"
	"time"

	// Pure-Go SQLite (no CGO needed on the Pi) with an encrypting VFS.
	_ "github.com/ncruces/go-sqlite3/driver"
	_ "github.com/ncruces/go-sqlite3/vfs/adiantum"
)

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash  TEXT    NOT NULL,
  is_admin   INTEGER NOT NULL DEFAULT 0,
  avatar     TEXT    NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  display_name  TEXT    NOT NULL DEFAULT '',
  blocked       INTEGER NOT NULL DEFAULT 0,
  storage_limit INTEGER NOT NULL DEFAULT 0,
  avatar_size   INTEGER NOT NULL DEFAULT 0,
  dedupe        TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id  INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  color      TEXT    NOT NULL DEFAULT '',
  icon       TEXT    NOT NULL DEFAULT '',
  position   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id);

CREATE TABLE IF NOT EXISTS bookmarks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id   INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  name        TEXT    NOT NULL,
  url         TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  thumb_ver   INTEGER NOT NULL DEFAULT 0,
  icon_ver    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  thumb_size  INTEGER NOT NULL DEFAULT 0,
  icon_size   INTEGER NOT NULL DEFAULT 0,
  deleted_at  INTEGER NOT NULL DEFAULT 0,
  tags         TEXT    NOT NULL DEFAULT '',
  thumb_manual INTEGER NOT NULL DEFAULT 0,
  link_status  INTEGER NOT NULL DEFAULT 0,
  link_error   TEXT    NOT NULL DEFAULT '',
  link_checked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO settings(key, value) VALUES ('login_required', '1');
INSERT OR IGNORE INTO settings(key, value) VALUES ('registration', '0');
`

// dsnFor builds the connection string. With a key the file is encrypted with
// the adiantum VFS (the whole file: tables, indexes, the write-ahead log).
// The key is set first, then busy timeout and locking, as the driver asks.
func dsnFor(path, hexKey string) string {
	q := "file:" + path + "?"
	if hexKey != "" {
		q += "vfs=adiantum&hexkey=" + hexKey + "&"
	}
	return q + "_pragma=busy_timeout(5000)" +
		"&_pragma=journal_mode(WAL)" +
		"&_pragma=foreign_keys(1)" +
		"&_pragma=synchronous(NORMAL)" +
		"&_pragma=temp_store(memory)" // keeps temp data in RAM, not in unencrypted temp files
}

func openDB(dsn string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}
	// One connection is plenty for a home server and avoids SQLITE_BUSY.
	// Never run a query while iterating rows from another one.
	db.SetMaxOpenConns(1)
	// The first real read fails here when the key is wrong.
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM sqlite_master`).Scan(&n); err != nil {
		db.Close()
		return nil, err
	}
	for _, stmt := range strings.Split(schema, ";\n") {
		if stmt = strings.TrimSpace(stmt); stmt != "" {
			if _, err := db.Exec(stmt); err != nil {
				db.Close()
				return nil, err
			}
		}
	}
	if err := migrate(db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

// migrate upgrades databases created by older versions of Crumbs.
func migrate(db *sql.DB) error {
	add := []struct{ table, column, def string }{
		{"users", "avatar", "TEXT NOT NULL DEFAULT ''"},
		{"users", "display_name", "TEXT NOT NULL DEFAULT ''"},
		{"users", "blocked", "INTEGER NOT NULL DEFAULT 0"},
		{"users", "storage_limit", "INTEGER NOT NULL DEFAULT 0"},
		{"users", "avatar_size", "INTEGER NOT NULL DEFAULT 0"},
		{"users", "dedupe", "TEXT NOT NULL DEFAULT ''"},
		{"users", "saved_tags", "TEXT NOT NULL DEFAULT ''"},
		{"bookmarks", "thumb_size", "INTEGER NOT NULL DEFAULT 0"},
		{"bookmarks", "icon_size", "INTEGER NOT NULL DEFAULT 0"},
		{"bookmarks", "deleted_at", "INTEGER NOT NULL DEFAULT 0"},
		{"bookmarks", "tags", "TEXT NOT NULL DEFAULT ''"},
		{"bookmarks", "thumb_manual", "INTEGER NOT NULL DEFAULT 0"},
		{"bookmarks", "link_status", "INTEGER NOT NULL DEFAULT 0"},
		{"bookmarks", "link_error", "TEXT NOT NULL DEFAULT ''"},
		{"bookmarks", "link_checked", "INTEGER NOT NULL DEFAULT 0"},
		{"folders", "color", "TEXT NOT NULL DEFAULT ''"},
		{"folders", "icon", "TEXT NOT NULL DEFAULT ''"},
		{"folders", "position", "INTEGER NOT NULL DEFAULT 0"},
	}
	for _, c := range add {
		if !hasColumn(db, c.table, c.column) {
			if _, err := db.Exec("ALTER TABLE " + c.table + " ADD COLUMN " + c.column + " " + c.def); err != nil {
				return err
			}
		}
	}
	if !hasColumn(db, "bookmarks", "folder_id") {
		if _, err := db.Exec(`ALTER TABLE bookmarks ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL`); err != nil {
			return err
		}
	}
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_bookmarks_folder ON bookmarks(folder_id)`); err != nil {
		return err
	}
	// v1 stored the folder as plain text on each bookmark. Turn those into real folders.
	if hasColumn(db, "bookmarks", "folder") {
		type pair struct {
			uid  int64
			name string
		}
		var pairs []pair
		rows, err := db.Query(`SELECT DISTINCT user_id, folder FROM bookmarks WHERE folder <> '' AND folder_id IS NULL`)
		if err != nil {
			return err
		}
		for rows.Next() {
			var p pair
			if rows.Scan(&p.uid, &p.name) == nil {
				pairs = append(pairs, p)
			}
		}
		rows.Close()
		for _, p := range pairs {
			res, err := db.Exec(`INSERT INTO folders(user_id, name, created_at) VALUES (?, ?, ?)`, p.uid, p.name, time.Now().Unix())
			if err != nil {
				return err
			}
			fid, _ := res.LastInsertId()
			if _, err := db.Exec(`UPDATE bookmarks SET folder_id = ?, folder = '' WHERE user_id = ? AND folder = ?`, fid, p.uid, p.name); err != nil {
				return err
			}
		}
	}
	return nil
}

func hasColumn(db *sql.DB, table, column string) bool {
	var n int
	db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = ?`, table, column).Scan(&n)
	return n > 0
}

func (a *App) loadSettings() {
	var v string
	if err := a.db.QueryRow(`SELECT value FROM settings WHERE key = 'login_required'`).Scan(&v); err != nil {
		v = "1"
	}
	a.loginRequired.Store(v != "0")
	if err := a.db.QueryRow(`SELECT value FROM settings WHERE key = 'registration'`).Scan(&v); err != nil {
		v = "0"
	}
	a.registration.Store(v == "1")
}

func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
