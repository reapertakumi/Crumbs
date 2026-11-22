# Configuration

Settings go in a file called `.env` next to `docker-compose.yml` (start from `.env.example`). After changing it run
`docker compose up -d --force-recreate` – a plain `restart` does **not** read `.env` again.

| Variable | Default | What it does |
| -------- | ------- | ------------ |
| `CRUMBS_DB_KEY` | *(empty)* | Database key. Empty = type it on the Unlock page after each start. See [encryption.md](encryption.md). |
| `TLS_HOSTS` | *(empty)* | Names/IPs for the self-signed certificate, comma separated, e.g. `pi5.local,192.168.1.50` |
| `HTTP_REDIRECT` | `0` | `1` sends `http://` visitors to `https://` |
| `HTTPS_PUBLIC_PORT` | `9443` | The HTTPS port people use (for the redirect), if you changed it in `ports:` |

These can be set in the `environment:` section of `docker-compose.yml` (they're rarely needed):

| Variable | Default | What it does |
| -------- | ------- | ------------ |
| `ADDR` | `:9099` | HTTP address inside the container |
| `HTTPS_ADDR` | `:9443` | HTTPS address inside the container, `off` turns HTTPS off |
| `TLS_CERT`, `TLS_KEY` | *(empty)* | Your own certificate and key files instead of the self-signed one |
| `DATA_DIR` | `/data` | Where Crumbs keeps its data inside the container |

## Ports

The left side of `ports:` is the port on the Pi. To use other ports, change only the left side:

```yaml
    ports:
      - "8080:9099"   # http://pi:8080
      - "8443:9443"   # https://pi:8443
```

## Memory

`docker-compose.yml` caps Crumbs at 128 MB. On Raspberry Pi OS Docker prints *"Your kernel does not support memory
limit capabilities"* and ignores the cap – harmless. To make it work, add `cgroup_enable=memory cgroup_memory=1` to the
end of the line in `/boot/firmware/cmdline.txt` and reboot, or delete the `deploy:` block.

## Settings inside the app

- **Settings** (per browser): theme, card size, layout, background, new tab, sort; plus *Maintenance* (refresh all
  previews, check for broken links), *Duplicates* (saved to your account) and *Reset*.
- **Admin**: require login, registration, users, storage limits, backups.
