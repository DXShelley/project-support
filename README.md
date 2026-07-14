# Project Support

通用项目支持页，包含通用付款二维码、按项目隔离的使用问题/功能建议/服务支持记录，以及仅展示已审核记录的公开列表。API 与静态站点均运行在 Docker Compose 中。

## 链接契约

项目页面必须显式传入项目 slug，不依赖 `Referer`：

```text
https://macosx.kooldns.cn/support/obsidian-media-claim/
```

嵌入场景可使用：

```text
https://macosx.kooldns.cn/embed/support.html?project=obsidian-media-claim
```

`GET /api/admin/feedback?status=pending` 和 `PATCH /api/admin/feedback/{id}` 使用 `Authorization: Bearer $ADMIN_TOKEN` 管理审核状态。公开页面只读取 `published` 与 `resolved`。

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
