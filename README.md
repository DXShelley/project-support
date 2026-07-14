# Project Support

通用项目支持页，包含通用付款二维码、按项目隔离的使用问题/功能建议/服务支持记录，以及仅展示已审核记录的公开列表。API 与静态站点均运行在 Docker Compose 中。

## 链接契约

项目页面必须显式传入项目 slug，不依赖 `Referer`：

```text
https://macosx.kooldns.cn/support/obsidian-media-claim/
```

slug 以 GitHub 仓库名称为准：转小写，空格替换为 `-`。例如 `Obsidian Image Manager` 映射为 `obsidian-image-manager`。

嵌入场景可使用：

```text
https://macosx.kooldns.cn/embed/support.html?project=obsidian-media-claim
```

`GET /api/admin/feedback?status=pending` 和 `PATCH /api/admin/feedback/{id}` 使用 `Authorization: Bearer $ADMIN_TOKEN` 管理审核状态。公开页面只读取 `published` 与 `resolved`。

审核页面：[https://macosx.kooldns.cn/support/admin/](https://macosx.kooldns.cn/support/admin/)，需要以用户名 `admin` 和 `ADMIN_TOKEN` 通过 HTTP Basic Auth 验证。

已预置的项目：`obsidian-2026`、`ai-translate`、`obsidian-cli-plugins-skill`、`obsidian-image-manager`、`obsidian-media-claim`。

## 启动

```bash
cp .env.example .env
# 编辑 .env，设置随机 ADMIN_TOKEN
docker pull docker.m.daocloud.io/library/node:24-alpine
docker tag docker.m.daocloud.io/library/node:24-alpine nodejs:24-alpine
docker compose up -d --build
```

静态服务监听 `127.0.0.1:18081`，API 仅在 Docker 内网监听。部署到现有宿主 nginx 时，将 [docker/host-nginx.conf](docker/host-nginx.conf) 合并为 `macosx.kooldns.cn` 的唯一站点配置。

## 新项目

管理员可调用：

```bash
curl -X POST http://127.0.0.1:18081/api/admin/projects \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"slug":"your-project","name":"Your Project"}'
```

然后在项目页面使用 `https://macosx.kooldns.cn/support/your-project/`。

## 审核流程

先加载本机管理员 token：

```bash
cd /Users/dxshelley/git/project-support
set -a; source .env; set +a
```

查看某个项目的待审核记录：

```bash
curl -fsS 'https://macosx.kooldns.cn/api/admin/feedback?status=pending&project=obsidian-media-claim' \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

从响应中取得记录 `id` 后，附带回复并公开：

```bash
curl -fsS -X PATCH "https://macosx.kooldns.cn/api/admin/feedback/RECORD_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"published","reply":"已确认，计划在后续版本处理。"}'
```

状态含义：`pending` 待审核，`published` 已公开，`resolved` 已解决且公开，`hidden` 不公开。公开页只显示 `published` 和 `resolved`。
