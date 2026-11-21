package main

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const (
	cookieName = "crumbs_session"
	sessionTTL = 30 * 24 * time.Hour
	pbkdf2Iter = 600_000 // OWASP recommendation for PBKDF2-HMAC-SHA256
	minPassLen = 6
)

type User struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	IsAdmin  bool   `json:"isAdmin"`
	// Avatar is "" (first letter), "icon:<name>" or an image URL.
	Avatar string `json:"avatar"`
}

const userCols = `id, username, is_admin, avatar`

func scanUser(s scanner) (*User, error) {
	var u User
	var admin int
	var av string
	if err := s.Scan(&u.ID, &u.Username, &admin, &av); err != nil {
		return nil, err
	}
	u.IsAdmin = admin == 1
	u.Avatar = avatarURL(u.ID, av)
	return &u, nil
}

func avatarURL(id int64, stored string) string {
	if v, ok := strings.CutPrefix(stored, "img:"); ok {
		return fmt.Sprintf("/avatar/%d?v=%s", id, v)
	}
	return stored
}

var (
	b64         = base64.RawStdEncoding
	reUsername  = regexp.MustCompile(`^[A-Za-z0-9._-]{1,32}$`)
	errTaken    = errors.New("that username is already taken")
	dummyHash   string // used to keep login timing equal for unknown users
)

func init() {
	dummyHash, _ = hashPassword("crumbs-dummy-password")
}

// ---- password hashing (salted PBKDF2-SHA256, Go standard library) ----

func hashPassword(pw string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key, err := pbkdf2.Key(sha256.New, pw, salt, pbkdf2Iter, 32)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("pbkdf2-sha256$%d$%s$%s", pbkdf2Iter, b64.EncodeToString(salt), b64.EncodeToString(key)), nil
}

func checkPassword(pw, stored string) bool {
	parts := strings.Split(stored, "$")
	if len(parts) != 4 || parts[0] != "pbkdf2-sha256" {
		return false
	}
	iter, err := strconv.Atoi(parts[1])
	if err != nil || iter < 1 {
		return false
	}
	salt, err1 := b64.DecodeString(parts[2])
	want, err2 := b64.DecodeString(parts[3])
	if err1 != nil || err2 != nil || len(want) == 0 {
		return false
	}
	got, err := pbkdf2.Key(sha256.New, pw, salt, iter, len(want))
	if err != nil {
		return false
	}
	return subtle.ConstantTimeCompare(got, want) == 1
}

func validCreds(username, password string) error {
	if !reUsername.MatchString(username) {
		return errors.New("username: 1-32 letters, numbers, dots, dashes or underscores")
	}
	if len(password) < minPassLen {
		return fmt.Errorf("password must be at least %d characters", minPassLen)
	}
	if len(password) > 256 {
		return errors.New("password is too long")
	}
	return nil
}

// ---- users ----

func (a *App) insertUser(username, password string, admin bool) (*User, error) {
	hash, err := hashPassword(password)
	if err != nil {
		return nil, err
	}
	res, err := a.db.Exec(`INSERT INTO users(username, pass_hash, is_admin, created_at) VALUES (?, ?, ?, ?)`,
		username, hash, boolInt(admin), time.Now().Unix())
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return nil, errTaken
		}
		return nil, err
	}
	id, _ := res.LastInsertId()
	return &User{ID: id, Username: username, IsAdmin: admin}, nil
}

func (a *App) userCount() int {
	var n int
	a.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n)
	return n
}

// ownerUser is the first admin. Guests use this account when login is off.
func (a *App) ownerUser() *User {
	u, err := scanUser(a.db.QueryRow(`SELECT ` + userCols + ` FROM users WHERE is_admin = 1 ORDER BY id LIMIT 1`))
	if err != nil {
		return nil
	}
	return u
}

// ---- sessions ----

func newToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func tokenHash(t string) string {
	s := sha256.Sum256([]byte(t))
	return hex.EncodeToString(s[:])
}

func (a *App) startSession(w http.ResponseWriter, r *http.Request, uid int64) error {
	token := newToken()
	exp := time.Now().Add(sessionTTL)
	if _, err := a.db.Exec(`INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)`,
		tokenHash(token), uid, exp.Unix()); err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name: cookieName, Value: token, Path: "/",
		Expires: exp, MaxAge: int(sessionTTL.Seconds()),
		HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: isHTTPS(r),
	})
	return nil
}

func (a *App) sessionUser(token string) *User {
	u, err := scanUser(a.db.QueryRow(`
		SELECT u.id, u.username, u.is_admin, u.avatar
		FROM sessions s JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = ? AND s.expires_at > ?`, tokenHash(token), time.Now().Unix()))
	if err != nil {
		return nil
	}
	return u
}

func (a *App) getUser(id int64) *User {
	u, err := scanUser(a.db.QueryRow(`SELECT `+userCols+` FROM users WHERE id = ?`, id))
	if err != nil {
		return nil
	}
	return u
}

// ---- handlers ----

type credsIn struct {
	Username string `json:"username"`
	Password string `json:"password"`
	IsAdmin  bool   `json:"isAdmin"`
}

func (a *App) handleState(w http.ResponseWriter, r *http.Request) {
	resp := struct {
		Setup         bool  `json:"setup"`
		LoginRequired bool  `json:"loginRequired"`
		User          *User `json:"user"`
		Guest         bool  `json:"guest"`
	}{Setup: a.userCount() == 0, LoginRequired: a.loginRequired.Load()}
	if who := a.who(r); who != nil {
		u := who.User
		resp.User = &u
		resp.Guest = who.Guest
	}
	writeJSON(w, http.StatusOK, resp)
}

// handleSetup creates the very first account, which becomes the admin.
func (a *App) handleSetup(w http.ResponseWriter, r *http.Request) {
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
	a.setupMu.Lock()
	defer a.setupMu.Unlock()
	if a.userCount() > 0 {
		jsonErr(w, http.StatusConflict, "setup is already done, please sign in")
		return
	}
	u, err := a.insertUser(in.Username, in.Password, true)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := a.startSession(w, r, u.ID); err != nil {
		jsonErr(w, http.StatusInternalServerError, "could not start session")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (a *App) handleLogin(w http.ResponseWriter, r *http.Request) {
	ip := clientIP(r)
	if a.limiter.blocked(ip) {
		jsonErr(w, http.StatusTooManyRequests, "too many attempts, try again in a few minutes")
		return
	}
	var in credsIn
	if err := readJSON(w, r, &in); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad request")
		return
	}
	var id int64
	var hash string
	err := a.db.QueryRow(`SELECT id, pass_hash FROM users WHERE username = ?`, strings.TrimSpace(in.Username)).Scan(&id, &hash)
	if err != nil {
		checkPassword(in.Password, dummyHash) // same work as a real check
		a.limiter.fail(ip)
		jsonErr(w, http.StatusUnauthorized, "wrong username or password")
		return
	}
	if !checkPassword(in.Password, hash) {
		a.limiter.fail(ip)
		jsonErr(w, http.StatusUnauthorized, "wrong username or password")
		return
	}
	a.limiter.reset(ip)
	if err := a.startSession(w, r, id); err != nil {
		jsonErr(w, http.StatusInternalServerError, "could not start session")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *App) handleLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(cookieName); err == nil {
		a.db.Exec(`DELETE FROM sessions WHERE token_hash = ?`, tokenHash(c.Value))
	}
	http.SetCookie(w, &http.Cookie{Name: cookieName, Value: "", Path: "/", MaxAge: -1,
		HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: isHTTPS(r)})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *App) handlePassword(w http.ResponseWriter, r *http.Request, who *Who) {
	if who.Guest {
		jsonErr(w, http.StatusForbidden, "sign in to change your password")
		return
	}
	var in struct {
		Current string `json:"current"`
		New     string `json:"new"`
	}
	if err := readJSON(w, r, &in); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if err := validCreds(who.Username, in.New); err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	var hash string
	if err := a.db.QueryRow(`SELECT pass_hash FROM users WHERE id = ?`, who.ID).Scan(&hash); err != nil || !checkPassword(in.Current, hash) {
		jsonErr(w, http.StatusBadRequest, "current password is wrong")
		return
	}
	nh, err := hashPassword(in.New)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, "could not hash password")
		return
	}
	a.db.Exec(`UPDATE users SET pass_hash = ? WHERE id = ?`, nh, who.ID)
	// Sign out every other device, keep this one.
	keep := ""
	if c, err := r.Cookie(cookieName); err == nil {
		keep = tokenHash(c.Value)
	}
	a.db.Exec(`DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?`, who.ID, keep)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// ---- admin ----

func (a *App) handleListUsers(w http.ResponseWriter, r *http.Request, who *Who) {
	rows, err := a.db.Query(`
		SELECT u.id, u.username, u.is_admin, u.avatar, u.created_at,
		       (SELECT COUNT(*) FROM bookmarks b WHERE b.user_id = u.id)
		FROM users u ORDER BY u.id`)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	type adminUser struct {
		User
		Created   int64 `json:"created"`
		Bookmarks int   `json:"bookmarks"`
	}
	users := []adminUser{}
	for rows.Next() {
		var u adminUser
		var admin int
		var av string
		if err := rows.Scan(&u.ID, &u.Username, &admin, &av, &u.Created, &u.Bookmarks); err != nil {
			rows.Close()
			jsonErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		u.IsAdmin = admin == 1
		u.Avatar = avatarURL(u.ID, av)
		users = append(users, u)
	}
	rows.Close()
	owner := ""
	if o := a.ownerUser(); o != nil {
		owner = o.Username
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"users": users, "loginRequired": a.loginRequired.Load(), "owner": owner,
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
	u, err := a.insertUser(in.Username, in.Password, in.IsAdmin)
	if errors.Is(err, errTaken) {
		jsonErr(w, http.StatusConflict, err.Error())
		return
	} else if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, u)
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

func (a *App) handleSettings(w http.ResponseWriter, r *http.Request, who *Who) {
	var in struct {
		LoginRequired *bool `json:"loginRequired"`
	}
	if err := readJSON(w, r, &in); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if in.LoginRequired != nil {
		v := "0"
		if *in.LoginRequired {
			v = "1"
		}
		if _, err := a.db.Exec(`INSERT INTO settings(key, value) VALUES ('login_required', ?)
			ON CONFLICT(key) DO UPDATE SET value = excluded.value`, v); err != nil {
			jsonErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		a.loginRequired.Store(*in.LoginRequired)
	}
	writeJSON(w, http.StatusOK, map[string]bool{"loginRequired": a.loginRequired.Load()})
}
