package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Meta is what the browser needs to build a bookmark preview. The Pi only
// reads the page's <head>; the browser downloads the images itself.
type Meta struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Images      []string `json:"images"` // thumbnail candidates, best first
	Icons       []string `json:"icons"`  // favicon candidates, best first
	Error       string   `json:"error,omitempty"`
}

var fetchClient = &http.Client{
	Timeout: 10 * time.Second,
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 5 {
			return errors.New("too many redirects")
		}
		return nil
	},
}

const userAgent = "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Crumbs/1.0"

func newGet(ctx context.Context, rawURL, accept string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", accept)
	req.Header.Set("Accept-Language", "en-US,en;q=0.8")
	return req, nil
}

func (a *App) handleMeta(w http.ResponseWriter, r *http.Request, who *Who) {
	u, err := parseHTTPURL(r.URL.Query().Get("url"))
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, fetchMeta(r.Context(), u))
}

func fetchMeta(ctx context.Context, u *url.URL) *Meta {
	m := &Meta{Images: []string{}, Icons: []string{}}
	if id := youtubeID(u); id != "" {
		youtubeMeta(ctx, id, m)
		return m
	}
	base, err := fetchPage(ctx, u, m)
	if err != nil {
		m.Error = err.Error()
	}
	if base == nil {
		base = u
	}
	m.Icons = appendUnique(m.Icons, base.Scheme+"://"+base.Host+"/favicon.ico")
	return m
}

func fetchPage(ctx context.Context, u *url.URL, m *Meta) (*url.URL, error) {
	req, err := newGet(ctx, u.String(), "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8")
	if err != nil {
		return nil, err
	}
	resp, err := fetchClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	final := resp.Request.URL
	if resp.StatusCode >= 400 {
		return final, fmt.Errorf("site answered %s", resp.Status)
	}
	ct := resp.Header.Get("Content-Type")
	if strings.HasPrefix(strings.ToLower(ct), "image/") {
		// A direct link to an image: the image is its own thumbnail.
		m.Images = append(m.Images, final.String())
		m.Title = path.Base(final.Path)
		return final, nil
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil && len(body) == 0 {
		return final, err
	}
	parseHTML(decodeBody(body, ct), final, m)
	return final, nil
}

var (
	reHeadEnd = regexp.MustCompile(`(?i)</head\s*>`)
	reTitle   = regexp.MustCompile(`(?is)<title[^>]*>(.*?)</title>`)
	reTag     = regexp.MustCompile(`(?is)<(meta|link|base)\b([^>]*)>`)
	reAttr    = regexp.MustCompile(`(?s)([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))`)
	reSize    = regexp.MustCompile(`(\d+)x\d+`)
)

func parseAttrs(s string) map[string]string {
	out := map[string]string{}
	for _, m := range reAttr.FindAllStringSubmatch(s, -1) {
		key := strings.ToLower(m[1])
		if _, seen := out[key]; seen {
			continue
		}
		out[key] = html.UnescapeString(m[2] + m[3] + m[4])
	}
	return out
}

func parseHTML(doc string, base *url.URL, m *Meta) {
	if loc := reHeadEnd.FindStringIndex(doc); loc != nil {
		doc = doc[:loc[0]]
	}
	type icon struct {
		href  string
		score int
	}
	var (
		ogTitle, twTitle, ogDesc, desc string
		images                         []string
		icons                          []icon
	)
	for _, t := range reTag.FindAllStringSubmatch(doc, -1) {
		attrs := parseAttrs(t[2])
		switch strings.ToLower(t[1]) {
		case "base":
			if href := attrs["href"]; href != "" {
				if b, err := base.Parse(href); err == nil {
					base = b
				}
			}
		case "meta":
			key := strings.ToLower(firstNonEmpty(attrs["property"], attrs["name"], attrs["itemprop"]))
			val := strings.TrimSpace(attrs["content"])
			if val == "" {
				continue
			}
			switch key {
			case "og:title":
				ogTitle = val
			case "twitter:title":
				twTitle = val
			case "og:description":
				ogDesc = val
			case "description", "twitter:description":
				if desc == "" {
					desc = val
				}
			case "og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src", "image", "thumbnailurl":
				images = append(images, val)
			}
		case "link":
			href := strings.TrimSpace(attrs["href"])
			if href == "" || strings.HasPrefix(href, "data:") {
				continue
			}
			rels := strings.Fields(strings.ToLower(attrs["rel"]))
			switch {
			case slices.Contains(rels, "apple-touch-icon"), slices.Contains(rels, "apple-touch-icon-precomposed"):
				icons = append(icons, icon{href, 180})
			case slices.Contains(rels, "icon"):
				icons = append(icons, icon{href, iconScore(attrs["sizes"], attrs["type"], href)})
			case slices.Contains(rels, "image_src"):
				images = append(images, href)
			}
		}
	}

	title := ""
	if tm := reTitle.FindStringSubmatch(doc); tm != nil {
		title = tm[1]
	}
	m.Title = clip(oneLine(html.UnescapeString(firstNonEmpty(ogTitle, title, twTitle))), 300)
	m.Description = clip(oneLine(html.UnescapeString(firstNonEmpty(ogDesc, desc))), 600)

	for _, img := range images {
		if abs := resolve(base, img); abs != "" {
			m.Images = appendUnique(m.Images, abs)
		}
	}
	sort.SliceStable(icons, func(i, j int) bool { return icons[i].score > icons[j].score })
	for _, ic := range icons {
		if abs := resolve(base, ic.href); abs != "" {
			m.Icons = appendUnique(m.Icons, abs)
		}
	}
}

func iconScore(sizes, typ, href string) int {
	if strings.Contains(typ, "svg") || strings.HasSuffix(strings.ToLower(href), ".svg") || strings.EqualFold(sizes, "any") {
		return 256
	}
	best := 0
	for _, s := range reSize.FindAllStringSubmatch(strings.ToLower(sizes), -1) {
		if n, err := strconv.Atoi(s[1]); err == nil && n > best {
			best = n
		}
	}
	if best == 0 {
		return 32
	}
	return best
}

func resolve(base *url.URL, ref string) string {
	u, err := base.Parse(strings.TrimSpace(ref))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return ""
	}
	return u.String()
}

// decodeBody handles the common non-UTF-8 case (Latin-1 / Windows-1252).
func decodeBody(b []byte, contentType string) string {
	_, params, _ := mime.ParseMediaType(contentType)
	switch strings.ToLower(params["charset"]) {
	case "iso-8859-1", "latin1", "windows-1252", "cp1252":
		r := make([]rune, len(b))
		for i, c := range b {
			r[i] = rune(c)
		}
		return string(r)
	}
	return string(b)
}

// ---- YouTube ----

var reYTID = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)

func youtubeID(u *url.URL) string {
	host := strings.ToLower(u.Hostname())
	host = strings.TrimPrefix(host, "www.")
	host = strings.TrimPrefix(host, "m.")
	parts := strings.Split(strings.Trim(u.Path, "/"), "/")
	id := ""
	switch host {
	case "youtu.be":
		id = parts[0]
	case "youtube.com", "music.youtube.com", "youtube-nocookie.com":
		if v := u.Query().Get("v"); v != "" {
			id = v
		} else if len(parts) >= 2 {
			switch parts[0] {
			case "shorts", "embed", "live", "v":
				id = parts[1]
			}
		}
	}
	if reYTID.MatchString(id) {
		return id
	}
	return ""
}

func youtubeMeta(ctx context.Context, id string, m *Meta) {
	m.Images = []string{
		"https://i.ytimg.com/vi/" + id + "/maxresdefault.jpg",
		"https://i.ytimg.com/vi/" + id + "/hqdefault.jpg",
	}
	m.Icons = []string{"https://www.youtube.com/favicon.ico"}

	watch := "https://www.youtube.com/watch?v=" + id
	req, err := newGet(ctx, "https://www.youtube.com/oembed?format=json&url="+url.QueryEscape(watch), "application/json")
	if err != nil {
		m.Error = err.Error()
		return
	}
	resp, err := fetchClient.Do(req)
	if err != nil {
		m.Error = err.Error()
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		m.Error = "YouTube answered " + resp.Status
		return
	}
	var o struct {
		Title  string `json:"title"`
		Author string `json:"author_name"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(&o); err != nil {
		m.Error = "could not read YouTube info"
		return
	}
	m.Title = o.Title
	if o.Author != "" {
		m.Description = "YouTube video by " + o.Author
	}
}

// ---- image relay ----
//
// Browsers can't read images from most sites because of CORS. The browser
// tries the site directly first and only falls back to this relay, which
// passes the raw image bytes through. Resizing still happens in the browser.

func (a *App) handleFetch(w http.ResponseWriter, r *http.Request, who *Who) {
	u, err := parseHTTPURL(r.URL.Query().Get("url"))
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	req, err := newGet(r.Context(), u.String(), "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8")
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	resp, err := fetchClient.Do(req)
	if err != nil {
		jsonErr(w, http.StatusBadGateway, err.Error())
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		jsonErr(w, http.StatusBadGateway, "image answered "+resp.Status)
		return
	}
	const maxImg = 8 << 20
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxImg+1))
	if err != nil {
		jsonErr(w, http.StatusBadGateway, err.Error())
		return
	}
	if len(body) > maxImg {
		jsonErr(w, http.StatusRequestEntityTooLarge, "image is larger than 8 MB")
		return
	}
	ct, _, _ := mime.ParseMediaType(resp.Header.Get("Content-Type"))
	if sniff := http.DetectContentType(body); strings.HasPrefix(sniff, "image/") {
		ct = sniff
	}
	if !strings.HasPrefix(ct, "image/") {
		jsonErr(w, http.StatusUnsupportedMediaType, "that is not an image")
		return
	}
	h := w.Header()
	h.Set("Content-Type", ct)
	h.Set("Cache-Control", "private, max-age=3600")
	// Remote SVGs must never run scripts on our origin.
	h.Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
	w.Write(body)
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func appendUnique(list []string, v string) []string {
	if slices.Contains(list, v) {
		return list
	}
	return append(list, v)
}
