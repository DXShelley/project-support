import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const dataDir = process.env.DATA_DIR ?? './data';
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(join(dataDir, 'support.sqlite'));
const adminToken = process.env.ADMIN_TOKEN ?? '';
const initialProjects = [
  { slug: 'obsidian-2026', name: 'Obsidian 2026' },
  { slug: 'ai-translate', name: 'AI Translate' },
  { slug: 'obsidian-cli-plugins-skill', name: 'Obsidian CLI Plugins Skill' },
  { slug: 'obsidian-image-manager', name: 'Obsidian Image Manager' },
  { slug: 'obsidian-media-claim', name: 'Obsidian Media Claim' },
  { slug: 'railpilot-12306', name: 'RailPilot 12306' }
];
const rateLimits = new Map();

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS projects (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    project_slug TEXT NOT NULL REFERENCES projects(slug),
    kind TEXT NOT NULL CHECK(kind IN ('question', 'feature', 'service')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    contact TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'published', 'resolved', 'hidden')),
    reply TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS feedback_public_idx ON feedback(project_slug, status, updated_at DESC);
`);

const insertProject = db.prepare('INSERT OR IGNORE INTO projects (slug, name, created_at) VALUES (?, ?, ?)');
for (const project of initialProjects) {
  insertProject.run(project.slug, project.name, new Date().toISOString());
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(body));
}

function sendError(response, status, message) {
  sendJson(response, status, { error: message });
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 32_768) throw new Error('Request body is too large');
  }
  return body ? JSON.parse(body) : {};
}

function projectBySlug(slug) {
  return db.prepare('SELECT slug, name FROM projects WHERE slug = ? AND enabled = 1').get(slug);
}

function requireAdmin(request, response) {
  const authorization = request.headers.authorization ?? '';
  const basicCredentials = authorization.startsWith('Basic ')
    ? Buffer.from(authorization.slice(6), 'base64').toString('utf8')
    : '';
  const authorized = authorization === `Bearer ${adminToken}` || basicCredentials === `admin:${adminToken}`;
  if (!adminToken || !authorized) {
    sendError(response, 401, 'Administrator authorization is required');
    return false;
  }
  return true;
}

function isValidSlug(slug) {
  return /^[a-z0-9][a-z0-9-]{1,62}$/.test(slug);
}

function normalizeProjectSlug(value) {
  return decodeURIComponent(String(value)).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
}

function isRateLimited(request) {
  const now = Date.now();
  const ip = request.socket.remoteAddress ?? 'unknown';
  const state = rateLimits.get(ip) ?? { count: 0, resetAt: now + 3_600_000 };
  if (state.resetAt < now) {
    state.count = 0;
    state.resetAt = now + 3_600_000;
  }
  state.count += 1;
  rateLimits.set(ip, state);
  return state.count > 8;
}

function publicFeedback(slug, limit) {
  return db
    .prepare(`SELECT id, kind, title, content, status, reply, created_at, updated_at
      FROM feedback
      WHERE project_slug = ? AND status IN ('published', 'resolved')
      ORDER BY updated_at DESC LIMIT ?`)
    .all(slug, limit);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
  const feedbackMatch = pathname.match(/^\/api\/projects\/([^/]+)\/feedback$/);
  const adminFeedbackMatch = pathname.match(/^\/api\/admin\/feedback\/([\w-]+)$/);

  try {
    if (request.method === 'GET' && projectMatch) {
      const project = projectBySlug(normalizeProjectSlug(projectMatch[1]));
      return project ? sendJson(response, 200, project) : sendError(response, 404, 'Project not found');
    }

    if (request.method === 'GET' && feedbackMatch) {
      const project = projectBySlug(normalizeProjectSlug(feedbackMatch[1]));
      if (!project) return sendError(response, 404, 'Project not found');
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 50);
      return sendJson(response, 200, { items: publicFeedback(project.slug, limit) });
    }

    if (request.method === 'POST' && feedbackMatch) {
      const project = projectBySlug(normalizeProjectSlug(feedbackMatch[1]));
      if (!project) return sendError(response, 404, 'Project not found');
      if (isRateLimited(request)) return sendError(response, 429, 'Too many submissions. Please try again later.');
      const payload = await readJson(request);
      const kind = String(payload.kind ?? '');
      const title = String(payload.title ?? '').trim();
      const content = String(payload.content ?? '').trim();
      const contact = String(payload.contact ?? '').trim();
      if (payload.website) return sendJson(response, 201, { trackingId: randomUUID() });
      if (!['question', 'feature', 'service'].includes(kind)) return sendError(response, 400, 'Invalid feedback type');
      if (title.length < 3 || title.length > 120 || content.length < 5 || content.length > 4_000 || contact.length > 200) {
        return sendError(response, 400, 'Please provide a concise title and description');
      }
      const id = randomUUID();
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO feedback (id, project_slug, kind, title, content, contact, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, project.slug, kind, title, content, contact, now, now);
      return sendJson(response, 201, { trackingId: id });
    }

    if (request.method === 'GET' && pathname === '/api/admin/feedback') {
      if (!requireAdmin(request, response)) return;
      const status = url.searchParams.get('status') ?? 'pending';
      const slug = url.searchParams.get('project');
      const rows = slug
        ? db.prepare(`SELECT feedback.*, projects.name AS project_name
          FROM feedback JOIN projects ON projects.slug = feedback.project_slug
          WHERE feedback.project_slug = ? AND feedback.status = ?
          ORDER BY feedback.updated_at DESC`).all(slug, status)
        : db.prepare(`SELECT feedback.*, projects.name AS project_name
          FROM feedback JOIN projects ON projects.slug = feedback.project_slug
          WHERE feedback.status = ?
          ORDER BY feedback.updated_at DESC`).all(status);
      return sendJson(response, 200, { items: rows });
    }

    if (request.method === 'GET' && pathname === '/api/admin/projects') {
      if (!requireAdmin(request, response)) return;
      const projects = db.prepare('SELECT slug, name, enabled FROM projects ORDER BY name').all();
      return sendJson(response, 200, { items: projects });
    }

    if (request.method === 'PATCH' && adminFeedbackMatch) {
      if (!requireAdmin(request, response)) return;
      const payload = await readJson(request);
      const status = String(payload.status ?? '');
      const reply = String(payload.reply ?? '').trim();
      if (!['pending', 'published', 'resolved', 'hidden'].includes(status) || reply.length > 4_000) {
        return sendError(response, 400, 'Invalid record update');
      }
      const result = db.prepare('UPDATE feedback SET status = ?, reply = ?, updated_at = ? WHERE id = ?')
        .run(status, reply, new Date().toISOString(), adminFeedbackMatch[1]);
      return result.changes ? sendJson(response, 200, { ok: true }) : sendError(response, 404, 'Record not found');
    }

    if (request.method === 'POST' && pathname === '/api/admin/projects') {
      if (!requireAdmin(request, response)) return;
      const payload = await readJson(request);
      const slug = String(payload.slug ?? '');
      const name = String(payload.name ?? '').trim();
      if (!isValidSlug(slug) || name.length < 2 || name.length > 100) return sendError(response, 400, 'Invalid project');
      db.prepare('INSERT INTO projects (slug, name, created_at) VALUES (?, ?, ?)').run(slug, name, new Date().toISOString());
      return sendJson(response, 201, { slug, name });
    }

    return sendError(response, 404, 'Not found');
  } catch (error) {
    console.error(error);
    return sendError(response, error instanceof SyntaxError ? 400 : 500, 'Request could not be processed');
  }
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
server.listen(port, host, () => console.log(`project-support API listening on ${host}:${port}`));
