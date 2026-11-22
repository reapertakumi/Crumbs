package main

import (
	"bytes"
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
)

// Encrypted database.
//
// crumbs.db is encrypted with a key derived from a passphrase. Crumbs gets the
// passphrase either from CRUMBS_DB_KEY (set in .env, Crumbs starts by itself)
// or from an admin typing it on the Unlock page after each start. Until then
// the database stays closed and only the Unlock page works.
//
// The passphrase is stretched with PBKDF2-SHA256 and a random salt kept in
// crumbs.db.salt next to the database (the salt isn't secret, but without it
// the key can't be rebuilt, so it goes into every backup too).

const (
	keyIter      = 600_000
	minKeyLength = 8
)

var errWrongKey = errors.New("wrong key")

type dbState string

const (
	dbFresh     dbState = "fresh"     // no database yet
	dbPlain     dbState = "plain"     // an older, unencrypted database
	dbEncrypted dbState = "encrypted" // needs the key
)

func (a *App) dbPath() string   { return a.dataDir + "/crumbs.db" }
func (a *App) saltPath() string { return a.dbPath() + ".salt" }

// state looks at the file on disk: a plain SQLite file starts with a fixed header.
func (a *App) state() dbState {
	f, err := os.Open(a.dbPath())
	if err != nil {
		return dbFresh
	}
	defer f.Close()
	head := make([]byte, 16)
	if n, _ := io.ReadFull(f, head); n == 0 {
		return dbFresh
	}
	if bytes.Equal(head, []byte("SQLite format 3\x00")) {
		return dbPlain
	}
	return dbEncrypted
}

func (a *App) deriveKey(pass string, createSalt bool) (string, error) {
	salt, err := os.ReadFile(a.saltPath())
	if errors.Is(err, os.ErrNotExist) && createSalt {
		salt = make([]byte, 16)
		rand.Read(salt)
		if err := os.WriteFile(a.saltPath(), salt, 0o600); err != nil {
			return "", err
		}
	} else if err != nil {
		return "", fmt.Errorf("can't read %s (needed to rebuild the key): %w", a.saltPath(), err)
	}
	key, err := pbkdf2.Key(sha256.New, pass, salt, keyIter, 32)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(key), nil
}

// unlock opens (and if needed creates or encrypts) the database with the
// passphrase, then starts everything that needs the database.
func (a *App) unlock(pass string) error {
	a.unlockMu.Lock()
	defer a.unlockMu.Unlock()
	if a.ready.Load() {
		return nil
	}
	st := a.state()
	if st != dbEncrypted && len(pass) < minKeyLength {
		return fmt.Errorf("the key must be at least %d characters", minKeyLength)
	}
	hexKey, err := a.deriveKey(pass, st != dbEncrypted)
	if err != nil {
		return err
	}
	if st == dbPlain {
		if err := a.encryptExisting(hexKey); err != nil {
			return fmt.Errorf("encrypting the database failed (nothing was changed): %w", err)
		}
	}
	db, err := openDB(dsnFor(a.dbPath(), hexKey))
	if err != nil {
		if st == dbEncrypted {
			return errWrongKey
		}
		return err
	}
	a.db = db
	a.ready.Store(true)
	a.afterUnlock.Do(func() {
		a.loadSettings()
		a.backfillSizes()
		go a.janitor()
		go a.backupLoop()
	})
	log.Printf("database unlocked (%s)", a.dbPath())
	return nil
}

// encryptExisting copies an older unencrypted database into a new encrypted
// file, checks it, and only then swaps the files and removes the plain copy.
func (a *App) encryptExisting(hexKey string) error {
	plain := a.dbPath()
	tmp := plain + ".encrypting"
	for _, f := range []string{tmp, tmp + "-wal", tmp + "-shm"} {
		os.Remove(f)
	}
	enc, err := openDB(dsnFor(tmp, hexKey)) // creates the encrypted file with today's schema
	if err != nil {
		return err
	}
	fail := func(err error) error {
		enc.Close()
		for _, f := range []string{tmp, tmp + "-wal", tmp + "-shm"} {
			os.Remove(f)
		}
		return err
	}
	stmts := []string{`PRAGMA foreign_keys = OFF`, `ATTACH DATABASE 'file:` + plain + `?mode=ro' AS old`}
	for _, s := range stmts {
		if _, err := enc.Exec(s); err != nil {
			return fail(err)
		}
	}
	counts := map[string][2]int{}
	for _, t := range []string{"users", "sessions", "folders", "bookmarks", "settings"} {
		cols, err := sharedColumns(enc, t)
		if err != nil {
			return fail(err)
		}
		if len(cols) == 0 {
			continue
		}
		list := strings.Join(cols, ", ")
		if _, err := enc.Exec(`DELETE FROM main.` + t); err != nil {
			return fail(err)
		}
		if _, err := enc.Exec(`INSERT INTO main.` + t + ` (` + list + `) SELECT ` + list + ` FROM old.` + t); err != nil {
			return fail(fmt.Errorf("copying %s: %w", t, err))
		}
		var oldN, newN int
		enc.QueryRow(`SELECT count(*) FROM old.` + t).Scan(&oldN)
		enc.QueryRow(`SELECT count(*) FROM main.` + t).Scan(&newN)
		counts[t] = [2]int{oldN, newN}
		if oldN != newN {
			return fail(fmt.Errorf("%s: copied %d of %d rows", t, newN, oldN))
		}
	}
	// Keep ids counting on from where they were.
	var hasSeq int
	enc.QueryRow(`SELECT count(*) FROM old.sqlite_master WHERE name = 'sqlite_sequence'`).Scan(&hasSeq)
	if hasSeq > 0 {
		enc.Exec(`DELETE FROM main.sqlite_sequence`)
		if _, err := enc.Exec(`INSERT INTO main.sqlite_sequence(name, seq) SELECT name, seq FROM old.sqlite_sequence`); err != nil {
			return fail(err)
		}
	}
	for _, s := range []string{`DETACH DATABASE old`, `PRAGMA foreign_keys = ON`, `PRAGMA wal_checkpoint(TRUNCATE)`} {
		if _, err := enc.Exec(s); err != nil {
			return fail(err)
		}
	}
	if err := enc.Close(); err != nil {
		return fail(err)
	}

	// Swap: keep the plain file aside until the encrypted one opens fine.
	aside := plain + ".unencrypted"
	if err := os.Rename(plain, aside); err != nil {
		return fail(err)
	}
	if err := os.Rename(tmp, plain); err != nil {
		os.Rename(aside, plain)
		return fail(err)
	}
	check, err := openDB(dsnFor(plain, hexKey))
	if err != nil {
		os.Rename(plain, tmp)
		os.Rename(aside, plain)
		return fail(err)
	}
	check.Close()
	for _, f := range []string{aside, plain + "-wal", plain + "-shm", aside + "-wal", aside + "-shm", tmp + "-wal", tmp + "-shm"} {
		os.Remove(f)
	}
	log.Printf("database encrypted: %v (rows old/new per table)", counts)
	return nil
}

// sharedColumns lists the columns a table has in both the old and the new
// file (older databases got some columns later, in a different order).
func sharedColumns(db *sql.DB, table string) ([]string, error) {
	cols := func(schema string) (map[string]bool, []string, error) {
		rows, err := db.Query(`SELECT name FROM pragma_table_info(?, ?)`, table, schema)
		if err != nil {
			return nil, nil, err
		}
		defer rows.Close()
		set := map[string]bool{}
		var order []string
		for rows.Next() {
			var n string
			if rows.Scan(&n) == nil {
				set[n] = true
				order = append(order, n)
			}
		}
		return set, order, rows.Err()
	}
	oldSet, _, err := cols("old")
	if err != nil {
		return nil, err
	}
	_, newOrder, err := cols("main")
	if err != nil {
		return nil, err
	}
	var out []string
	for _, c := range newOrder {
		if oldSet[c] {
			out = append(out, c)
		}
	}
	return out, nil
}

// ---- HTTP: locked mode ----

// lockGate keeps everything except the page itself, /api/state and
// /api/unlock closed while the database is locked.
func (a *App) lockGate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !a.ready.Load() {
			p := r.URL.Path
			if strings.HasPrefix(p, "/api/") && p != "/api/state" && p != "/api/unlock" ||
				strings.HasPrefix(p, "/img/") || strings.HasPrefix(p, "/avatar/") {
				writeJSON(w, http.StatusLocked, map[string]any{"error": "Crumbs is locked", "locked": true})
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func (a *App) lockedState(w http.ResponseWriter) {
	st := a.state()
	writeJSON(w, http.StatusOK, map[string]any{
		"locked": true,
		"setup":  st != dbEncrypted, // the key is being chosen now
		"plain":  st == dbPlain,     // an existing database gets encrypted (asks for an admin login)
	})
}

// handleUnlock: {"key"} for an encrypted database; to encrypt an existing
// one also {"username","password"} of an admin, so no stranger on the
// network can pick the key first.
func (a *App) handleUnlock(w http.ResponseWriter, r *http.Request) {
	if a.ready.Load() {
		jsonErr(w, http.StatusConflict, "already unlocked")
		return
	}
	ip := clientIP(r)
	if a.limiter.blocked(ip) {
		jsonErr(w, http.StatusTooManyRequests, "too many attempts, try again in a few minutes")
		return
	}
	var in struct {
		Key      string `json:"key"`
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := readJSON(w, r, &in); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if a.state() == dbPlain && !plainAdminOK(a.dbPath(), in.Username, in.Password) {
		a.limiter.fail(ip)
		jsonErr(w, http.StatusUnauthorized, "sign in with an admin account to encrypt the existing database")
		return
	}
	if err := a.unlock(in.Key); err != nil {
		if errors.Is(err, errWrongKey) {
			a.limiter.fail(ip)
			jsonErr(w, http.StatusUnauthorized, "that key doesn't open the database")
			return
		}
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	a.limiter.reset(ip)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// plainAdminOK checks an admin login against an older unencrypted database.
func plainAdminOK(path, username, password string) bool {
	db, err := sql.Open("sqlite3", "file:"+path+"?mode=ro&_pragma=busy_timeout(5000)")
	if err != nil {
		return false
	}
	defer db.Close()
	var hash string
	var admin int
	err = db.QueryRow(`SELECT pass_hash, is_admin FROM users WHERE username = ? COLLATE NOCASE`, strings.TrimSpace(username)).Scan(&hash, &admin)
	if err != nil {
		checkPassword(password, dummyHash)
		return false
	}
	return admin == 1 && checkPassword(password, hash)
}

