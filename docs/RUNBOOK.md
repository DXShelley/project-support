# Runbook

## Health Checks

```bash
cd /Users/dxshelley/git/project-support
docker compose ps
curl -fsSI https://macosx.kooldns.cn/support/obsidian-media-claim/
curl -fsS https://macosx.kooldns.cn/api/projects/obsidian-media-claim
```

The public support page and project API must return HTTP `200`. The administrator URL must return `401` without credentials.

```bash
source .env
curl -fsSI -u "admin:$ADMIN_TOKEN" https://macosx.kooldns.cn/support/admin/
```

## Deploy

```bash
docker compose up -d --build
docker compose ps
```

Use the DaoCloud mirror to prepare the required local base image on a new machine:

```bash
docker pull docker.m.daocloud.io/library/node:24-alpine
docker tag docker.m.daocloud.io/library/node:24-alpine nodejs:24-alpine
```

If the `api` service is recreated separately, recreate `web` too. nginx resolves the Docker service name when it starts and can retain the old API container IP.

```bash
docker compose up -d --force-recreate api web
```

## Rotate the Administrator Token

1. Generate a replacement value and update `ADMIN_TOKEN` in `.env`.
2. Rebuild the nginx password file and reload host nginx.
3. Recreate both Compose services.

```bash
source .env
htpasswd -bcm /opt/homebrew/etc/nginx/.project-support-admin.htpasswd admin "$ADMIN_TOKEN"
chmod 600 /opt/homebrew/etc/nginx/.project-support-admin.htpasswd
nginx -t && nginx -s reload
docker compose up -d --force-recreate api web
```

The old token is invalid after these steps. Never commit `.env` or the password file.

## Review Feedback

Open `https://macosx.kooldns.cn/support/admin/` and authenticate as `admin`. Filter by project and status, then save a status and optional reply for each record.

Status meanings: `pending` is waiting for review, `published` is public, `resolved` is public and complete, and `hidden` is not public.

## Troubleshooting

| Symptom | Check | Resolution |
| --- | --- | --- |
| Public page says it is unavailable | `curl` the public project API | Recreate `api` and `web` together. |
| Admin page loops or returns `401` | Test with `curl -u "admin:$ADMIN_TOKEN"` | Regenerate the password file and reload nginx. |
| New project returns `404` | Check the normalized GitHub repository slug | Add it through the authenticated admin project API, then use its lowercase hyphenated slug. |
