# HTTP and HTTPS

Crumbs answers on both at the same time, so each person can choose:

| Address | Connection |
| ------- | ---------- |
| `http://<pi>:9099` | plain – anyone on the same network could read it |
| `https://<pi>:9443` | encrypted |

## The certificate

The first time it starts, Crumbs makes its own **self-signed certificate** in `data/tls/`. Browsers don't know it,
so they warn once ("Your connection is not private"). Choose **Advanced → Continue to …** – after that the
connection is encrypted like any other HTTPS site.

Tell Crumbs the names and addresses you use, so the certificate matches them. In `.env`:

```text
TLS_HOSTS=pi5.local,192.168.1.50
```

Then make a new certificate:

```bash
rm -r data/tls
docker compose up -d --force-recreate
```

### Your own certificate

If you have a real certificate (for example from a reverse proxy or your own CA), put the files next to
`docker-compose.yml`, mount them and point Crumbs at them:

```yaml
    volumes:
      - ./certs:/certs:ro
    environment:
      TLS_CERT: /certs/fullchain.pem
      TLS_KEY: /certs/privkey.pem
```

## HTTPS only

To send everyone from `http://` to `https://`, set in `.env`:

```text
HTTP_REDIRECT=1
```

If you changed the HTTPS port on the left side of `ports:` (for example `"443:9443"`), also set
`HTTPS_PUBLIC_PORT=443` so the redirect goes to the right place.

To turn HTTPS off completely: `HTTPS_ADDR=off` in the `environment:` section and remove the `9443` port line.

## Bookmarklet and extension

Use the same address you open Crumbs with. The browser extension works with both `http://` and `https://`
(for the self-signed certificate, open the HTTPS address in Chrome once and accept the warning first).
