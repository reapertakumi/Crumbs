package main

import (
	"context"
	"errors"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Broken link checker. Runs only when a user presses "Check links now":
// the Pi visits each of their links (4 at a time) and stores the result.

type linkJob struct {
	Running  bool  `json:"running"`
	Done     int   `json:"done"`
	Total    int   `json:"total"`
	Broken   int   `json:"broken"`
	Finished int64 `json:"finished,omitempty"`
}

type linkJobs struct {
	mu   sync.Mutex
	jobs map[int64]*linkJob
}

func (j *linkJobs) get(uid int64) linkJob {
	j.mu.Lock()
	defer j.mu.Unlock()
	if job := j.jobs[uid]; job != nil {
		return *job
	}
	return linkJob{}
}

const (
	linkUnknown = 0
	linkOK      = 1
	linkBroken  = 2
)

// checkLink returns linkOK or linkBroken with a short reason.
func checkLink(raw string) (int, string) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	do := func(method string) (*http.Response, error) {
		req, err := http.NewRequestWithContext(ctx, method, raw, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("User-Agent", userAgent)
		req.Header.Set("Accept", "text/html,*/*;q=0.8")
		return fetchClient.Do(req)
	}
	resp, err := do(http.MethodHead)
	// Many sites don't answer HEAD properly; ask again with GET (body not read).
	if err != nil || resp.StatusCode == 400 || resp.StatusCode == 403 || resp.StatusCode == 404 ||
		resp.StatusCode == 405 || resp.StatusCode == 501 || resp.StatusCode >= 500 {
		if resp != nil {
			resp.Body.Close()
		}
		resp, err = do(http.MethodGet)
	}
	if err != nil {
		return linkBroken, linkErrorText(err)
	}
	resp.Body.Close()
	switch c := resp.StatusCode; {
	case c == 404 || c == 410:
		return linkBroken, "Page not found (" + resp.Status + ")"
	case c >= 500:
		return linkBroken, "Server error (" + resp.Status + ")"
	default:
		// 2xx/3xx work; 401/403/429 mean "the site is there but won't talk to bots".
		return linkOK, ""
	}
}

func linkErrorText(err error) string {
	var dns *net.DNSError
	switch {
	case errors.As(err, &dns):
		return "Site not found"
	case errors.Is(err, context.DeadlineExceeded) || strings.Contains(err.Error(), "Timeout"):
		return "No answer (timed out)"
	case strings.Contains(err.Error(), "refused"):
		return "Connection refused"
	case strings.Contains(err.Error(), "redirects"):
		return "Too many redirects"
	case strings.Contains(err.Error(), "certificate"):
		return "Bad security certificate"
	}
	return "Can't connect"
}

func (a *App) handleLinkStatus(w http.ResponseWriter, r *http.Request, who *Who) {
	writeJSON(w, http.StatusOK, a.links.get(who.ID))
}

func (a *App) handleLinkCheck(w http.ResponseWriter, r *http.Request, who *Who) {
	uid := who.ID
	a.links.mu.Lock()
	if job := a.links.jobs[uid]; job != nil && job.Running {
		a.links.mu.Unlock()
		writeJSON(w, http.StatusOK, a.links.get(uid))
		return
	}
	list := a.activeBookmarks(uid)
	job := &linkJob{Running: true, Total: len(list)}
	a.links.jobs[uid] = job
	a.links.mu.Unlock()

	go func() {
		queue := make(chan dupRow)
		var wg sync.WaitGroup
		for i := 0; i < 4; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for b := range queue {
					status, msg := checkLink(b.url)
					a.db.Exec(`UPDATE bookmarks SET link_status = ?, link_error = ?, link_checked = ? WHERE id = ?`,
						status, msg, time.Now().Unix(), b.id)
					a.links.mu.Lock()
					job.Done++
					if status == linkBroken {
						job.Broken++
					}
					a.links.mu.Unlock()
				}
			}()
		}
		for _, b := range list {
			queue <- b
		}
		close(queue)
		wg.Wait()
		a.links.mu.Lock()
		job.Running = false
		job.Finished = time.Now().Unix()
		a.links.mu.Unlock()
	}()
	writeJSON(w, http.StatusOK, a.links.get(uid))
}
