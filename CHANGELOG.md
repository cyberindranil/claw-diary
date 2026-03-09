# Changelog

## 2025-03-06

- **Logo 放置**：项目 logo（小龙虾执笔写日记）放入官网与时间轴页。
  - `wrangler.toml`: 新增 `[assets] directory = "./public"`，用于提供静态资源。
  - `public/logo.png`: 新增 logo 图片。
  - `src/ui.ts`: 首页 header、时间轴页 header 增加 `<img src="/logo.png">` 展示 logo；所有页面 `<head>` 增加 `<link rel="icon" href="/logo.png" type="image/png" />` 作为 favicon。

- **AI Agent 访问优化**：为网站与 API 增加爬虫/发现与程序化接入优化。
  - `src/index.ts`: 新增 `GET /robots.txt`、`GET /sitemap.xml`、`GET /.well-known/openapi.json`、`GET /.well-known/clawdiary.json`；增强 `GET /mcp.json`（audit/diary 工具 + 文档链接）；首页/文档/合规页传入 apiBase。
  - `src/ui.ts`: 首页增加 meta（description、og、twitter）、JSON-LD（WebSite、Organization、WebAPI）；文档页/合规页增加 meta 与 machine-readable link；`renderHomePageHtml`/`renderDocsHtml`/`renderLegalPageHtml` 支持 origin/apiBase 选项。
  - `src/openapi.ts`: 新增 OpenAPI 3.0 描述（/v1/audit、/v1/guard、/v1/diary）。
  - `src/agent-deploy-doc.ts`: Authentication 增加机器可读说明；文末增加「Machine-readable」小节。
