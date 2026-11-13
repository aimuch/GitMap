/**
 * 本地存储服务：把每个页面保存为 data/pages/<id>.json，
 * 上传的文件保存在 data/uploads/。只用 Node 内置模块。
 */
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { DatabaseDef, PageKind, PageMeta, PageRecord, PropValue, SearchHit } from "../shared/types.ts";
import { notesContent, sampleDatabase, sampleRows, welcomeContent } from "./seed.ts";

const ID_RE = /^[a-f0-9]{16}$/;
const UPLOAD_RE = /^[a-f0-9]{16}(\.[a-z0-9]{1,8})?$/;
const MAX_JSON = 32 * 1024 * 1024;
const MAX_UPLOAD = 200 * 1024 * 1024;

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  pdf: "application/pdf",
};

const newId = () => crypto.randomBytes(8).toString("hex");

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function cleanDatabase(v: unknown): DatabaseDef | null {
  if (!v || typeof v !== "object") return null;
  const d = v as Partial<DatabaseDef>;
  if (!Array.isArray(d.properties) || !Array.isArray(d.views)) return null;
  return { properties: d.properties, views: d.views };
}

function cleanProps(v: unknown): Record<string, PropValue> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, PropValue>;
}

function toMeta(p: PageRecord): PageMeta {
  const { content: _content, ...meta } = p;
  return meta;
}

/** 从 BlockNote 文档里抽出纯文本，用于搜索。 */
function extractText(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const n of node) extractText(n, out);
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (typeof obj.text === "string") out.push(obj.text);
    for (const key of ["content", "children", "rows", "cells"]) {
      const v = obj[key];
      if (typeof v === "string") out.push(v);
      else if (v) extractText(v, out);
    }
  } else if (typeof node === "string") {
    out.push(node);
  }
  return out;
}

class Store {
  private pages = new Map<string, PageRecord>();
  private text = new Map<string, string>();
  private writes = new Map<string, Promise<void>>();
  private ready: Promise<void> | null = null;
  readonly pagesDir: string;
  readonly uploadsDir: string;

  constructor(dir: string) {
    this.pagesDir = path.join(dir, "pages");
    this.uploadsDir = path.join(dir, "uploads");
  }

  init(): Promise<void> {
    this.ready ??= this.load();
    return this.ready;
  }

  private async load() {
    await fs.mkdir(this.pagesDir, { recursive: true });
    await fs.mkdir(this.uploadsDir, { recursive: true });
    const files = await fs.readdir(this.pagesDir);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(this.pagesDir, f), "utf8");
        const page = JSON.parse(raw) as PageRecord;
        if (!ID_RE.test(page.id) || `${page.id}.json` !== f) continue;
        page.content = Array.isArray(page.content) ? page.content : [];
        // 兼容没有数据库字段的旧文件
        page.kind = page.kind === "database" ? "database" : "page";
        page.database = page.kind === "database" ? (cleanDatabase(page.database) ?? { properties: [], views: [] }) : null;
        page.props = cleanProps(page.props) ?? {};
        this.pages.set(page.id, page);
      } catch (err) {
        console.warn(`[storage] 跳过无法读取的文件 ${f}:`, err);
      }
    }
    // 只在第一次启动时写入示例页面；之后即使删光所有页面也不会再生成
    const marker = path.join(this.pagesDir, ".initialized");
    const seeded = await fs.stat(marker).catch(() => null);
    if (!seeded) {
      if (this.pages.size === 0) await this.seed();
      await fs.writeFile(marker, new Date().toISOString());
    }
  }

  private async seed() {
    const welcome = this.create({ title: "欢迎使用", icon: "👋", content: welcomeContent });
    this.create({ parentId: welcome.id, title: "我的第一篇笔记", icon: "📝", content: notesContent });
    const tasks = this.create({ title: "任务看板", icon: "✅", kind: "database", database: sampleDatabase });
    for (const row of sampleRows) this.create({ parentId: tasks.id, ...row });
    await Promise.all(this.writes.values());
  }

  private persist(page: PageRecord) {
    // 数据库的选项改名会影响所有行的搜索文本
    if (page.kind === "database") this.text.clear();
    else this.text.delete(page.id);
    const file = path.join(this.pagesDir, `${page.id}.json`);
    const data = JSON.stringify(page, null, 2);
    const prev = this.writes.get(page.id) ?? Promise.resolve();
    const next = prev
      .catch(() => {})
      .then(async () => {
        const tmp = `${file}.${crypto.randomBytes(4).toString("hex")}.tmp`;
        await fs.writeFile(tmp, data);
        await fs.rename(tmp, file);
      });
    this.writes.set(page.id, next);
    next.catch((err) => console.error(`[storage] 写入 ${page.id} 失败:`, err));
    return next;
  }

  private unlink(id: string) {
    this.text.delete(id);
    const file = path.join(this.pagesDir, `${id}.json`);
    const prev = this.writes.get(id) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(() => fs.rm(file, { force: true }));
    this.writes.set(id, next);
    return next;
  }

  /** 等所有排队中的磁盘写入完成（退出前调用） */
  async settled(): Promise<void> {
    await Promise.allSettled([...this.writes.values()]);
  }

  metas(): PageMeta[] {
    return [...this.pages.values()].map(toMeta);
  }

  get(id: string): PageRecord {
    const page = this.pages.get(id);
    if (!page) throw new HttpError(404, "页面不存在");
    return page;
  }

  private siblings(parentId: string | null, excludeId?: string): PageRecord[] {
    return [...this.pages.values()]
      .filter((p) => p.parentId === parentId && !p.trashed && p.id !== excludeId)
      .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  }

  private descendants(id: string): PageRecord[] {
    const out: PageRecord[] = [];
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const p of this.pages.values()) {
        if (p.parentId === cur) {
          out.push(p);
          stack.push(p.id);
        }
      }
    }
    return out;
  }

  create(input: {
    parentId?: string | null;
    title?: string;
    icon?: string | null;
    cover?: string | null;
    content?: unknown[];
    kind?: PageKind;
    database?: DatabaseDef | null;
    props?: Record<string, PropValue>;
  }): PageRecord {
    const kind: PageKind = input.kind === "database" ? "database" : "page";
    const parentId = input.parentId ?? null;
    if (parentId !== null) {
      const parent = this.get(parentId);
      if (parent.trashed) throw new HttpError(400, "不能在回收站中的页面下新建页面");
    }
    const sibs = this.siblings(parentId);
    const now = Date.now();
    const page: PageRecord = {
      id: newId(),
      title: typeof input.title === "string" ? input.title : "",
      icon: input.icon ?? null,
      cover: input.cover ?? null,
      parentId,
      order: sibs.length ? sibs[sibs.length - 1].order + 1 : 0,
      favorite: false,
      fullWidth: false,
      trashed: false,
      trashedAt: null,
      createdAt: now,
      updatedAt: now,
      kind,
      database: kind === "database" ? (cleanDatabase(input.database) ?? { properties: [], views: [] }) : null,
      props: cleanProps(input.props) ?? {},
      content: Array.isArray(input.content) ? input.content : [],
    };
    this.pages.set(page.id, page);
    void this.persist(page);
    return page;
  }

  update(id: string, patch: Record<string, unknown>): PageRecord {
    const page = this.get(id);
    if (typeof patch.title === "string") page.title = patch.title.slice(0, 2000);
    if (patch.icon === null || typeof patch.icon === "string") page.icon = patch.icon;
    if (patch.cover === null || typeof patch.cover === "string") page.cover = patch.cover;
    if (typeof patch.favorite === "boolean") page.favorite = patch.favorite;
    if (patch.kind === "page" || patch.kind === "database") page.kind = patch.kind;
    const database = cleanDatabase(patch.database);
    if (database) page.database = database;
    if (page.kind === "database") page.database ??= { properties: [], views: [] };
    else page.database = null;
    const props = cleanProps(patch.props);
    if (props) page.props = props;
    if (typeof patch.fullWidth === "boolean") page.fullWidth = patch.fullWidth;
    if (Array.isArray(patch.content)) page.content = patch.content;
    page.updatedAt = Date.now();
    void this.persist(page);
    return page;
  }

  move(id: string, parentId: string | null, index: number) {
    const page = this.get(id);
    if (parentId !== null) {
      const parent = this.get(parentId);
      if (parent.trashed) throw new HttpError(400, "目标页面在回收站中");
      if (parentId === id || this.descendants(id).some((d) => d.id === parentId)) {
        throw new HttpError(400, "不能把页面移动到它自己的子页面下");
      }
    }
    const sibs = this.siblings(parentId, id);
    const at = Math.max(0, Math.min(Number.isFinite(index) ? index : sibs.length, sibs.length));
    sibs.splice(at, 0, page);
    page.parentId = parentId;
    sibs.forEach((p, i) => {
      if (p.order !== i || p === page) {
        p.order = i;
        void this.persist(p);
      }
    });
  }

  trash(id: string) {
    const page = this.get(id);
    if (page.trashed) return;
    const now = Date.now();
    for (const p of [page, ...this.descendants(id)]) {
      if (p.trashed) continue;
      p.trashed = true;
      p.trashedAt = now;
      void this.persist(p);
    }
  }

  restore(id: string) {
    const page = this.get(id);
    if (!page.trashed) return;
    const stamp = page.trashedAt;
    const parent = page.parentId ? this.pages.get(page.parentId) : null;
    if (page.parentId && (!parent || parent.trashed)) page.parentId = null;
    const sibs = this.siblings(page.parentId, id);
    page.order = sibs.length ? sibs[sibs.length - 1].order + 1 : 0;
    for (const p of [page, ...this.descendants(id)]) {
      // 只恢复当初随它一起删除的子页面
      if (p !== page && p.trashedAt !== stamp) continue;
      p.trashed = false;
      p.trashedAt = null;
      void this.persist(p);
    }
  }

  remove(id: string) {
    const page = this.get(id);
    for (const p of [page, ...this.descendants(id)]) {
      this.pages.delete(p.id);
      void this.unlink(p.id);
    }
  }

  emptyTrash() {
    for (const p of [...this.pages.values()]) {
      if (p.trashed && this.pages.has(p.id)) this.remove(p.id);
    }
  }

  duplicate(id: string): PageRecord {
    const src = this.get(id);
    /** 原页面 id → 它的副本 */
    const copies = new Map<string, PageRecord>();
    const copyTree = (from: PageRecord, parentId: string | null, title: string): PageRecord => {
      // 先取子页面列表，免得把刚建出来的副本也算进去
      const children = this.siblings(from.id);
      const copy = this.create({
        parentId,
        title,
        icon: from.icon,
        cover: from.cover,
        content: structuredClone(from.content),
        kind: from.kind,
        database: structuredClone(from.database),
        props: structuredClone(from.props),
      });
      copy.fullWidth = from.fullWidth;
      copies.set(from.id, copy);
      for (const child of children) copyTree(child, copy.id, child.title);
      return copy;
    };
    const copy = copyTree(src, src.parentId, `${src.title || "无标题"}（副本）`);

    // 副本正文里指向“被一起复制的页面”的引用（子页面链接、内嵌数据库）改指向对应的副本，
    // 否则副本里的内嵌数据库仍然是原来那一个，改一处两边都变
    for (const page of copies.values()) {
      let json = JSON.stringify(page.content);
      let changed = false;
      for (const [oldId, fresh] of copies) {
        if (!json.includes(oldId)) continue;
        json = json.replaceAll(oldId, fresh.id);
        changed = true;
      }
      if (changed) {
        page.content = JSON.parse(json);
        void this.persist(page);
      }
    }

    // 放到原页面的正后方
    const sibs = this.siblings(src.parentId, copy.id);
    this.move(copy.id, src.parentId, sibs.findIndex((p) => p.id === src.id) + 1);
    return copy;
  }

  /** 行的属性值也参与搜索：文本原样，单选/多选换成选项名 */
  private propsText(p: PageRecord): string[] {
    const defs = (p.parentId ? this.pages.get(p.parentId)?.database?.properties : null) ?? [];
    const out: string[] = [];
    for (const [key, value] of Object.entries(p.props ?? {})) {
      const options = defs.find((d) => d.id === key)?.options;
      for (const v of Array.isArray(value) ? value : [value]) {
        if (typeof v !== "string") continue;
        out.push(options?.find((o) => o.id === v)?.name ?? v);
      }
    }
    return out;
  }

  search(query: string): SearchHit[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: (SearchHit & { score: number; updatedAt: number })[] = [];
    for (const p of this.pages.values()) {
      if (p.trashed) continue;
      let body = this.text.get(p.id);
      if (body === undefined) {
        body = [...extractText(p.content), ...this.propsText(p)].join(" ").replace(/\s+/g, " ");
        this.text.set(p.id, body);
      }
      const inTitle = p.title.toLowerCase().includes(q);
      const at = body.toLowerCase().indexOf(q);
      if (!inTitle && at < 0) continue;
      let snippet = "";
      if (at >= 0) {
        const start = Math.max(0, at - 30);
        snippet = (start > 0 ? "…" : "") + body.slice(start, at + q.length + 60);
        if (at + q.length + 60 < body.length) snippet += "…";
      } else {
        snippet = body.slice(0, 90);
      }
      hits.push({
        id: p.id,
        title: p.title,
        icon: p.icon,
        snippet,
        score: inTitle ? 2 : 1,
        updatedAt: p.updatedAt,
      });
    }
    hits.sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);
    return hits.slice(0, 30).map(({ score: _s, updatedAt: _u, ...hit }) => hit);
  }
}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, "内容过大"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!String(req.headers["content-type"] ?? "").includes("application/json")) {
    throw new HttpError(415, "需要 application/json");
  }
  const buf = await readBody(req, MAX_JSON);
  if (buf.length === 0) return {};
  try {
    const data = JSON.parse(buf.toString("utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return data;
  } catch {
    throw new HttpError(400, "JSON 格式错误");
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(data);
}

type Next = (err?: unknown) => void;

export function createApiMiddleware(dataDir: string) {
  const store = new Store(dataDir);

  async function serveUpload(name: string, res: ServerResponse) {
    if (!UPLOAD_RE.test(name)) throw new HttpError(404, "文件不存在");
    const file = path.join(store.uploadsDir, name);
    const stat = await fs.stat(file).catch(() => null);
    if (!stat?.isFile()) throw new HttpError(404, "文件不存在");
    const ext = name.split(".")[1] ?? "";
    const type = MIME[ext];
    res.writeHead(200, {
      "Content-Type": type ?? "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // 上传的文件即使被直接打开也不允许执行脚本
      "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      ...(type ? {} : { "Content-Disposition": "attachment" }),
    });
    createReadStream(file).pipe(res);
  }

  async function handle(req: IncomingMessage, res: ServerResponse, url: URL) {
    const method = req.method ?? "GET";
    const parts = url.pathname.split("/").filter(Boolean);

    if (parts[0] === "uploads") {
      if (method !== "GET" && method !== "HEAD") throw new HttpError(405, "不支持的方法");
      await store.init();
      return serveUpload(parts[1] ?? "", res);
    }

    // 只接受同源请求，避免其他网站向本地服务发起写操作
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) {
      throw new HttpError(403, "跨域请求被拒绝");
    }
    await store.init();

    const [, resource, id, action] = parts;
    const all = () => send(res, 200, { pages: store.metas() });

    if (resource === "pages" && !id) {
      if (method === "GET") return all();
      if (method === "POST") {
        const body = await readJson(req);
        const parentId = typeof body.parentId === "string" ? body.parentId : null;
        const page = store.create({
          parentId,
          title: typeof body.title === "string" ? body.title : "",
          icon: typeof body.icon === "string" ? body.icon : null,
          kind: body.kind === "database" ? "database" : "page",
          database: cleanDatabase(body.database),
          props: cleanProps(body.props) ?? {},
        });
        return send(res, 201, { id: page.id, pages: store.metas() });
      }
    }

    if (resource === "pages" && id) {
      if (!ID_RE.test(id)) throw new HttpError(404, "页面不存在");
      if (!action) {
        if (method === "GET") return send(res, 200, { page: store.get(id) });
        if (method === "PATCH") {
          const page = store.update(id, await readJson(req));
          return send(res, 200, { page: toMeta(page) });
        }
        if (method === "DELETE") {
          store.remove(id);
          return all();
        }
      } else if (method === "POST") {
        const body = await readJson(req);
        if (action === "trash") {
          store.trash(id);
          return all();
        }
        if (action === "restore") {
          store.restore(id);
          return all();
        }
        if (action === "duplicate") {
          const copy = store.duplicate(id);
          return send(res, 201, { id: copy.id, pages: store.metas() });
        }
        if (action === "move") {
          const parentId = typeof body.parentId === "string" ? body.parentId : null;
          store.move(id, parentId, typeof body.index === "number" ? body.index : Infinity);
          return all();
        }
      }
    }

    if (resource === "trash" && method === "DELETE") {
      store.emptyTrash();
      return all();
    }

    if (resource === "search" && method === "GET") {
      return send(res, 200, { hits: store.search(url.searchParams.get("q") ?? "") });
    }

    if (resource === "upload" && method === "POST") {
      // 自定义请求头会触发 CORS 预检，跨站表单无法伪造
      if (req.headers["x-upload"] !== "1") throw new HttpError(400, "缺少上传标记");
      const original = url.searchParams.get("name") ?? "";
      const ext = /\.([a-zA-Z0-9]{1,8})$/.exec(original)?.[1]?.toLowerCase();
      const name = newId() + (ext ? `.${ext}` : "");
      const buf = await readBody(req, MAX_UPLOAD);
      await fs.writeFile(path.join(store.uploadsDir, name), buf);
      return send(res, 201, { url: `/uploads/${name}` });
    }

    throw new HttpError(404, "接口不存在");
  }

  const middleware = (req: IncomingMessage, res: ServerResponse, next: Next) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith("/api/") && !url.pathname.startsWith("/uploads/")) {
      return next();
    }
    handle(req, res, url).catch((err) => {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error("[api]", err);
      if (res.headersSent) return res.end();
      send(res, status, { error: err instanceof Error ? err.message : "服务器错误" });
    });
  };

  return Object.assign(middleware, { flush: () => store.settled() });
}
