# Architecture

## Purpose

Project Support is a shared support surface. Every project sends visitors to `https://macosx.kooldns.cn/support/{repository-name}/`; the service normalizes the repository name to a lowercase, hyphenated slug and isolates feedback by that slug.

## Runtime

```text
Browser -> host nginx (TLS, Basic Auth for admin) -> web container (nginx)
                                                    -> api container (Node 24 + SQLite)
```

- `web` binds `127.0.0.1:18081` and serves the public support page plus the browser-based review UI.
- `api` is only reachable on the Docker network at port `3000`.
- `project_support_data` is the persistent Docker volume containing `support.sqlite`.
- The API image is built from the locally tagged `nodejs:24-alpine` image.

## Routes

| Route | Purpose | Access |
| --- | --- | --- |
| `/support/{slug}/` | Payment methods, feedback form, approved records | Public |
| `/support/admin/` | Feedback review UI | HTTP Basic Auth |
| `/api/projects/{name}` | Resolve a normalized project slug | Public |
| `/api/projects/{name}/feedback` | List approved records or submit a new record | Public |
| `/api/admin/*` | Project and feedback administration | HTTP Basic Auth plus API credential validation |

`{name}` is normalized by converting to lowercase, replacing spaces with `-`, and removing unsupported characters. For example, `Obsidian Image Manager` becomes `obsidian-image-manager`.

## Data Model

`projects` stores `slug`, display `name`, enablement flag, and creation time.

`feedback` stores project slug, type (`question`, `feature`, `service`), title, content, optional contact, review status, reply, and timestamps.

Only `published` and `resolved` feedback records are returned to the public page. `pending` is the default on submission; `hidden` is never public.

## Authentication

The administrator user is `admin`; its password is `ADMIN_TOKEN` from `.env`. Host nginx reads an APR1 password file at `/opt/homebrew/etc/nginx/.project-support-admin.htpasswd` and protects both `/support/admin/` and `/api/admin/`.

The API accepts the same Basic Auth credentials for browser requests. It also accepts `Authorization: Bearer $ADMIN_TOKEN` for command-line administration.
