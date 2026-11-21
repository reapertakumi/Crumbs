package main

import (
	"database/sql"
	"encoding/json"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type App struct {
	db            *sql.DB
	imgDir        string
	loginRequired atomic.Bool
	setupMu       sync.Mutex
	limiter       *limiter
}

const appCSP = "default-src 'self'; " +
	"img-src 'self' data: blob: http: https:; " +
	"connect-src 'self' http: https:; " +
	"style-src 'self'; script-src 'self'; object-src 'none'; " +
	"base-uri 'none'; form-action 'self'; frame-ancestors 'none'"

// secure adds security headers and blocks cross-site writes (CSRF).
func (a *App) secure(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Content-Security-Policy", appCSP)
		if r.Method != http.MethodGet && r.Method != http.MethodHead && !sameOrigin(r) {
			jsonErr(w, http.StatusForbidden, "cross-site request blocked")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func sameOrigin(r *http.Request) bool {
	if s := r.Header.Get("Sec-Fetch-Site"); s != "" {
		return s == "same-origin" || s == "none"
	}
	if o := r.Header.Get("Origin"); o != "" {
		u, err := url.Parse(o)
		return err == nil && strings.EqualFold(u.Host, r.Host)
	}
	return true
}

// Who is the person behind a request. Guest means "login is disabled and
// this visitor is browsing the owner's bookmarks without signing in".
type Who struct {
	User
	Guest bool
}

func (a *App) who(r *http.Request) *Who {
	if c, err := r.Cookie(cookieName); err == nil && c.Value != "" {
		if u := a.sessionUser(c.Value); u != nil {
			return &Who{User: *u}
		}
	}
	if !a.loginRequired.Load() {
		if u := a.ownerUser(); u != nil {
			return &Who{User: *u, Guest: true}
		}
	}
	return nil
}

type whoHandler func(http.ResponseWriter, *http.Request, *Who)

func (a *App) user(h whoHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		who := a.who(r)
		if who == nil {
			jsonErr(w, http.StatusUnauthorized, "please sign in")
			return
		}
		h(w, r, who)
	}
}

func (a *App) admin(h whoHandler) http.HandlerFunc {
	return a.user(func(w http.ResponseWriter, r *http.Request, who *Who) {
		if who.Guest || !who.IsAdmin {
			jsonErr(w, http.StatusForbidden, "admins only")
			return
		}
		h(w, r, who)
	})
}

func (a *App) janitor() {
	t := time.NewTicker(time.Hour)
	defer t.Stop()
	for {
		a.db.Exec(`DELETE FROM sessions WHERE expires_at <= ?`, time.Now().Unix())
		a.limiter.sweep()
		<-t.C
	}
}

// ---- helpers ----

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func jsonErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

func readJSON(w http.ResponseWriter, r *http.Request, v any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	return json.NewDecoder(r.Body).Decode(v)
}

func pathID(r *http.Request) (int64, error) {
	return strconv.ParseInt(r.PathValue("id"), 10, 64)
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func isHTTPS(r *http.Request) bool {
	return r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

// ---- login rate limiter ----

type attempts struct {
	n     int
	first time.Time
	until time.Time
}

type limiter struct {
	mu sync.Mutex
	m  map[string]*attempts
}

func newLimiter() *limiter { return &limiter{m: map[string]*attempts{}} }

func (l *limiter) blocked(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	at := l.m[ip]
	return at != nil && time.Now().Before(at.until)
}

func (l *limiter) fail(ip string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	at := l.m[ip]
	if at == nil || now.Sub(at.first) > 15*time.Minute {
		at = &attempts{first: now}
		l.m[ip] = at
	}
	at.n++
	if at.n >= 5 {
		at.until = now.Add(10 * time.Minute)
		at.n = 0
		at.first = now
	}
}

func (l *limiter) reset(ip string) {
	l.mu.Lock()
	delete(l.m, ip)
	l.mu.Unlock()
}

func (l *limiter) sweep() {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	for ip, at := range l.m {
		if now.After(at.until) && now.Sub(at.first) > 15*time.Minute {
			delete(l.m, ip)
		}
	}
}
