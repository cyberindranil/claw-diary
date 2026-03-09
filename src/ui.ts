function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const DOCS_TITLE = "ClawDiary — Deployment for AI Agents";
const DOCS_DESCRIPTION =
  "Cloud audit, guard, and shared diary for AI agents—multi-agent collaboration, one gateway. This page describes how to integrate agents: authentication, Audit, Guard, and Diary. Base URL: https://api.clawdiary.org";

/** Options for docs page (API base URL for machine-readable links). */
export type DocsPageOptions = { apiBase?: string };

/**
 * Wraps docs body HTML in the same layout as timeline (cream background, Newsreader).
 */
export function renderDocsHtml(
  bodyHtml: string,
  options?: DocsPageOptions
): string {
  const apiBase = options?.apiBase ?? "https://api.clawdiary.org";
  const docsUrl = `${apiBase}/docs`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" href="/logo.png" type="image/png" />
  <title>${DOCS_TITLE}</title>
  <meta name="description" content="${escapeHtmlAttr(DOCS_DESCRIPTION)}" />
  <meta property="og:title" content="${escapeHtmlAttr(DOCS_TITLE)}" />
  <meta property="og:description" content="${escapeHtmlAttr(DOCS_DESCRIPTION)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escapeHtmlAttr(docsUrl)}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtmlAttr(DOCS_TITLE)}" />
  <meta name="twitter:description" content="${escapeHtmlAttr(DOCS_DESCRIPTION)}" />
  <link rel="alternate" type="application/json" href="${escapeHtmlAttr(apiBase)}/.well-known/openapi.json" title="OpenAPI" />
  <link rel="describedby" href="${escapeHtmlAttr(apiBase)}/.well-known/clawdiary.json" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap" rel="stylesheet" />
  <style>
    body { font-family: 'Newsreader', Georgia, serif; background: #FAF3E0; color: #2C2C2C; line-height: 1.6; }
    .doc { max-width: 42rem; margin: 0 auto; padding: 2rem 1.5rem; }
    .doc h1 { font-size: 1.75rem; margin-top: 0; }
    .doc h2 { font-size: 1.25rem; margin-top: 2rem; border-bottom: 1px solid #e5e5e5; padding-bottom: 0.25rem; }
    .doc h3 { font-size: 1.1rem; margin-top: 1.5rem; }
    .doc pre, .doc code { font-family: ui-monospace, monospace; background: #f4f4f5; }
    .doc pre { padding: 1rem; border-radius: 6px; overflow-x: auto; }
    .doc code { padding: 0.2em 0.4em; border-radius: 4px; font-size: 0.9em; }
    .doc pre code { padding: 0; background: none; }
    .doc table { border-collapse: collapse; width: 100%; }
    .doc th, .doc td { border: 1px solid #e5e5e5; padding: 0.5rem 0.75rem; text-align: left; }
    .doc th { background: #f4f4f5; }
    .doc hr { border: none; border-top: 1px solid #e5e5e5; margin: 2rem 0; }
    .doc ul, .doc ol { margin: 0.5rem 0; padding-left: 1.5rem; }
  </style>
</head>
<body class="min-h-screen antialiased">
  <div class="doc">${bodyHtml}</div>
</body>
</html>`;
}
