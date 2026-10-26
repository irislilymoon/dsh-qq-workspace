import { randomUUID } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createSecurityLock } from './security.js';
import { createContextManager } from './context.js';
import { commandPatchState, ensureCommandPatch, installCommandHook } from './qq-commands.js';

export const name = 'qq-workspace';
export const inject = ['webServer', 'workspaceRegistry', 'sessionPersistence', 'sessions', 'agents', 'tools', 'sandboxPolicy'];

const PLUGIN_NAME = 'dsh-qq-workspace';
const ROUTE = '/qq-workspace';
const QQ_PLUGIN_ID = 'im-qqbot';
const QQ_PACKAGE = '@tencent-connect/dsh-qqbot';
const MAX_BODY_BYTES = 512 * 1024;
const SESSION_ID_RE = /^[A-Za-z0-9._-]{6,128}$/;
const API_HEADER = 'x-dsh-qq-workspace';
const QQ_MARKER_RE = /(?:^|\n)\s*\[[^\]\n]{1,120}\]\s*<@[0-9A-Z]{8,}>|\(@you\)|\.dsh-qqbot[\\/]media[\\/]/i;
const QQ_MEDIA_DIR = 'qq-uploads';
const QQ_MEDIA_ROOT = join(homedir(), '.dsh-qqbot', 'media');

let cleanupTimer = null;
let cleanupInFlight = null;
let securityLock = null;
let contextManager = null;
let contextInitError = '';
let commandPatchChanged = false;
let mediaLinkState = { dir: QQ_MEDIA_DIR, linked: false, error: '' };

function log(ctx, message, level = 'info') {
  try {
    const logger = ctx?.logger;
    if (typeof logger?.[level] === 'function') {
      logger[level](message);
      return;
    }
  } catch {
  }
  try {
    (level === 'error' ? console.error : console.log)(message);
  } catch {
  }
}

function service(ctx, key) {
  try {
    if (typeof ctx.get === 'function') return ctx.get(key) ?? ctx[key];
    return ctx[key];
  } catch {
    try {
      return ctx[key];
    } catch {
      return undefined;
    }
  }
}

function dshHome(ctx) {
  const profile = service(ctx, 'profileContext');
  if (typeof profile?.home === 'string' && profile.home !== '') return profile.home;
  const configured = typeof process.env.DSH_HOME === 'string' ? process.env.DSH_HOME.trim() : '';
  return configured !== '' ? resolve(configured) : join(homedir(), '.dsh');
}

function profileInfo(ctx) {
  const home = dshHome(ctx);
  const profile = service(ctx, 'profileContext');
  if (typeof profile?.dir === 'string' && profile.dir !== '') {
    return {
      dir: profile.dir,
      patchPath: typeof profile.patchPath === 'string' && profile.patchPath !== ''
        ? profile.patchPath
        : join(profile.dir, 'cordis.patch.yml'),
      home,
    };
  }
  const profilesRoot = join(home, 'profiles');
  let candidates = [];
  try {
    candidates = readdirSync(profilesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(profilesRoot, entry.name));
  } catch {
    candidates = [];
  }
  candidates.sort((left, right) => {
    const leftQQ = existsSync(join(left, 'node_modules', ...QQ_PACKAGE.split('/'), 'package.json')) ? 1 : 0;
    const rightQQ = existsSync(join(right, 'node_modules', ...QQ_PACKAGE.split('/'), 'package.json')) ? 1 : 0;
    return rightQQ - leftQQ;
  });
  const dir = candidates[0] ?? process.cwd();
  return { dir, patchPath: join(dir, 'cordis.patch.yml'), home };
}

function canonical(path) {
  try {
    return realpathSync.native(path);
  } catch {
    return resolve(path);
  }
}

function normPath(path) {
  const resolved = resolve(path);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isWithinPath(root, target) {
  const rel = relative(normPath(root), normPath(target));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function setMediaState(linked, error = '') {
  mediaLinkState = {
    dir: QQ_MEDIA_DIR,
    linked: linked === true,
    error: error === '' ? '' : String(error),
  };
  return mediaLinkState;
}

function removePathLink(path) {
  try {
    rmdirSync(path);
    return true;
  } catch {
    try {
      unlinkSync(path);
      return true;
    } catch {
      return false;
    }
  }
}

function mediaDestination(target, name) {
  const original = join(target, name);
  if (!existsSync(original)) return original;
  const extension = extname(name);
  const stem = basename(name, extension);
  for (let index = 1; index < 1000; index += 1) {
    const candidate = join(target, `${stem}-${index}${extension}`);
    if (!existsSync(candidate)) return candidate;
  }
  return join(target, `${stem}-${Date.now()}${extension}`);
}

function migrateMediaDirectory(source, target) {
  let entries;
  try {
    entries = readdirSync(source, { withFileTypes: true });
  } catch (error) {
    return { ok: false, error: `无法读取旧媒体目录：${error?.message ?? String(error)}` };
  }
  for (const entry of entries) {
    const from = join(source, entry.name);
    const to = mediaDestination(target, entry.name);
    try {
      renameSync(from, to);
      continue;
    } catch {
      try {
        if (entry.isDirectory()) cpSync(from, to, { recursive: true, errorOnExist: true, force: false });
        else copyFileSync(from, to);
        if (entry.isDirectory()) rmSync(from, { recursive: true, force: true });
        else unlinkSync(from);
      } catch (fallback) {
        return { ok: false, error: `无法移动旧媒体文件 ${entry.name}：${fallback?.message ?? String(fallback)}` };
      }
    }
  }
  try {
    rmdirSync(source);
  } catch (error) {
    return { ok: false, error: `旧媒体目录仍非空：${error?.message ?? String(error)}` };
  }
  return { ok: true, error: '' };
}

function ensureMediaLink(configuredCwd) {
  if (typeof configuredCwd !== 'string' || configuredCwd.trim() === '') {
    return setMediaState(false, 'QQ 工作目录未配置');
  }
  let workspace;
  try {
    workspace = canonical(configuredCwd);
  } catch (error) {
    return setMediaState(false, `无法解析 QQ 工作目录：${error?.message ?? String(error)}`);
  }
  let workspaceInfo;
  try {
    workspaceInfo = statSync(workspace);
  } catch {
    return setMediaState(false, 'QQ 工作目录不存在');
  }
  if (!workspaceInfo.isDirectory()) return setMediaState(false, 'QQ 工作目录不是文件夹');
  const target = join(workspace, QQ_MEDIA_DIR);
  try {
    mkdirSync(target, { recursive: true });
  } catch (error) {
    return setMediaState(false, `无法创建 ${QQ_MEDIA_DIR}：${error?.message ?? String(error)}`);
  }
  const targetReal = canonical(target);
  if (!isWithinPath(workspace, targetReal)) {
    return setMediaState(false, `${QQ_MEDIA_DIR} 指向工作区外，已拒绝`);
  }
  try {
    mkdirSync(dirname(QQ_MEDIA_ROOT), { recursive: true });
  } catch (error) {
    return setMediaState(false, `无法创建 QQ 媒体父目录：${error?.message ?? String(error)}`);
  }
  let info = null;
  try {
    info = lstatSync(QQ_MEDIA_ROOT);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      return setMediaState(false, `无法检查 QQ 媒体目录：${error?.message ?? String(error)}`);
    }
  }
  if (info !== null) {
    if (info.isSymbolicLink()) {
      let current = '';
      try {
        current = realpathSync.native(QQ_MEDIA_ROOT);
      } catch {
      }
      if (current !== '' && normPath(current) === normPath(targetReal)) {
        return setMediaState(true);
      }
      if (!removePathLink(QQ_MEDIA_ROOT)) {
        return setMediaState(false, '无法移除旧的 QQ 媒体目录联接');
      }
    } else if (info.isDirectory()) {
      const migration = migrateMediaDirectory(QQ_MEDIA_ROOT, targetReal);
      if (!migration.ok) return setMediaState(false, migration.error);
    } else {
      return setMediaState(false, 'QQ 媒体路径已被普通文件占用');
    }
  }
  try {
    symlinkSync(targetReal, QQ_MEDIA_ROOT, process.platform === 'win32' ? 'junction' : 'dir');
    return setMediaState(true);
  } catch (error) {
    try {
      mkdirSync(QQ_MEDIA_ROOT, { recursive: true });
    } catch {
    }
    return setMediaState(false, `无法创建 QQ 媒体目录联接：${error?.message ?? String(error)}`);
  }
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function requestHost(req) {
  const host = req.headers.host;
  if (typeof host !== 'string' || host.trim() === '') return null;
  try {
    return new URL(`http://${host.trim()}`);
  } catch {
    return null;
  }
}

function trustedRequest(ctx, req) {
  if (req.headers[API_HEADER] !== '1') return false;
  const hostUrl = requestHost(req);
  if (hostUrl === null) return false;
  // The host's own Host/Origin fence is authoritative: it already knows every
  // authority declared with --trusted-host (including LAN addresses the browser
  // actually dials). Only fall back to the loopback set when that service is
  // unavailable or predates isTrusted().
  const connection = service(ctx, 'connection');
  if (connection !== null && connection !== undefined && typeof connection.isTrusted === 'function') {
    if (!connection.isTrusted(req)) return false;
    return sameOriginOrAbsent(req, hostUrl);
  }
  const hostname = hostUrl.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const allowed = new Set(['127.0.0.1', '::1', 'localhost']);
  const addHost = (value) => {
    if (typeof value !== 'string' || value.trim() === '') return;
    try {
      const parsed = new URL(value);
      const name = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
      if (name !== '') allowed.add(name);
    } catch {
    }
  };
  const webServer = service(ctx, 'webServer');
  addHost(webServer?.host);
  try {
    addHost(webServer?.getOrigin?.());
  } catch {
  }
  try {
    addHost(service(ctx, 'webApp')?.getAdvertisedUrl?.());
  } catch {
  }
  if (!allowed.has(hostname)) return false;
  return sameOriginOrAbsent(req, hostUrl);
}

/** Reject cross-site requests and Origins that do not match the request Host. */
function sameOriginOrAbsent(req, hostUrl) {
  const site = req.headers['sec-fetch-site'];
  if (typeof site === 'string' && site.toLowerCase() === 'cross-site') return false;
  const origin = req.headers.origin;
  if (origin !== undefined) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.protocol !== 'http:' && originUrl.protocol !== 'https:') return false;
      if (originUrl.host.toLowerCase() !== hostUrl.host.toLowerCase()) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function isJsonRequest(req) {
  const contentType = req.headers['content-type'];
  return typeof contentType === 'string' && /^application\/json\b/i.test(contentType.trim());
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw httpError(413, '请求体过大');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw httpError(400, '请求体必须是 JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw httpError(400, '请求体必须是 JSON 对象');
  }
  return parsed;
}

function writeFileAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = join(dirname(path), `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(temp, content, 'utf8');
  try {
    renameSync(temp, path);
  } catch (error) {
    try {
      rmSync(temp, { force: true });
    } catch {
    }
    throw error;
  }
}

function yamlScalar(raw) {
  let value = String(raw ?? '').trim();
  if (value === '') return '';
  if (value.startsWith("'")) {
    const end = value.lastIndexOf("'");
    return end > 0 ? value.slice(1, end).replace(/''/g, "'") : value.slice(1);
  }
  if (value.startsWith('"')) {
    const end = value.lastIndexOf('"');
    if (end > 0) {
      try {
        return JSON.parse(value.slice(0, end + 1));
      } catch {
        return value.slice(1, end);
      }
    }
  }
  return value.replace(/\s+#.*$/, '').trim();
}

function yamlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function findEntry(lines, id) {
  const entryRe = /^(\s*)-\s+id:\s*(['"]?)([^'"\s#]+)\2\s*(?:#.*)?$/;
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(entryRe);
    if (match === null || match[3] !== id) continue;
    const indent = match[1] ?? '';
    let end = lines.length;
    for (let next = index + 1; next < lines.length; next += 1) {
      const sibling = lines[next].match(/^(\s*)-\s+/);
      if (sibling !== null && (sibling[1]?.length ?? 0) <= indent.length) {
        end = next;
        break;
      }
    }
    return { start: index, end, indent };
  }
  return null;
}

function readQQConfig(patchPath) {
  let text = '';
  try {
    text = readFileSync(patchPath, 'utf8');
  } catch {
    return {};
  }
  const lines = text.split(/\r?\n/);
  const entry = findEntry(lines, QQ_PLUGIN_ID);
  if (entry === null) return {};
  let configStart = -1;
  let configIndent = '';
  for (let index = entry.start + 1; index < entry.end; index += 1) {
    const match = lines[index].match(/^(\s*)config:\s*(?:#.*)?$/);
    if (match !== null && match[1].length > entry.indent.length) {
      configStart = index;
      configIndent = match[1];
      break;
    }
  }
  if (configStart === -1) return {};
  const values = {};
  let childIndent = '';
  let mediaIndent = -1;
  for (let index = configStart + 1; index < entry.end; index += 1) {
    const line = lines[index];
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const indent = line.match(/^(\s*)/)?.[1] ?? '';
    if (indent.length <= configIndent.length) break;
    if (childIndent === '') childIndent = indent;
    if (indent !== childIndent) {
      if (mediaIndent !== -1 && indent.length > mediaIndent) {
        const ttl = line.match(/^\s*ttlHours:\s*(.*)$/);
        if (ttl !== null) {
          const ttlHours = Number(yamlScalar(ttl[1]));
          if (Number.isFinite(ttlHours)) values.mediaTtlHours = ttlHours;
        }
      }
      continue;
    }
    const match = line.match(/^\s*(cwd|provider|model|preset|media):\s*(.*)$/);
    if (match === null) {
      mediaIndent = -1;
      continue;
    }
    if (match[1] === 'media') {
      mediaIndent = indent.length;
      const inline = yamlScalar(match[2]);
      const ttlInline = inline.match(/ttlHours\s*:\s*(-?\d+(?:\.\d+)?)/);
      if (ttlInline !== null) values.mediaTtlHours = Number(ttlInline[1]);
    } else {
      mediaIndent = -1;
      values[match[1]] = yamlScalar(match[2]);
    }
  }
  return values;
}

function setQQConfigCwd(patchPath, cwd) {
  const existed = existsSync(patchPath);
  const original = existed ? readFileSync(patchPath, 'utf8') : '';
  const lines = original.split(/\r?\n/);
  if (lines.length === 1 && lines[0] === '') lines.length = 0;
  const entry = findEntry(lines, QQ_PLUGIN_ID);
  if (entry === null) {
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
    if (lines.length > 0) lines.push('');
    lines.push(`- id: ${QQ_PLUGIN_ID}`);
    lines.push('  config:');
    lines.push(`    cwd: ${yamlQuote(cwd)}`);
  } else {
    let configStart = -1;
    let configIndent = '';
    for (let index = entry.start + 1; index < entry.end; index += 1) {
      const match = lines[index].match(/^(\s*)config:\s*(?:#.*)?$/);
      if (match !== null && match[1].length > entry.indent.length) {
        configStart = index;
        configIndent = match[1];
        break;
      }
    }
    if (configStart === -1) {
      let insertAt = entry.end;
      while (insertAt > entry.start + 1 && lines[insertAt - 1].trim() === '') insertAt -= 1;
      const configPad = `${entry.indent}  `;
      const valuePad = `${entry.indent}    `;
      lines.splice(insertAt, 0, `${configPad}config:`, `${valuePad}cwd: ${yamlQuote(cwd)}`);
    } else {
      let cwdIndex = -1;
      let cwdIndent = '';
      let childIndent = '';
      for (let index = configStart + 1; index < entry.end; index += 1) {
        const line = lines[index];
        if (line.trim() === '' || line.trim().startsWith('#')) continue;
        const indent = line.match(/^(\s*)/)?.[1] ?? '';
        if (indent.length <= configIndent.length) break;
        if (childIndent === '') childIndent = indent;
        if (/^\s*cwd:\s*/.test(line)) {
          cwdIndex = index;
          cwdIndent = indent;
          break;
        }
      }
      if (cwdIndex !== -1) {
        lines[cwdIndex] = `${cwdIndent}cwd: ${yamlQuote(cwd)}`;
      } else {
        const pad = childIndent !== '' ? childIndent : `${configIndent}  `;
        lines.splice(configStart + 1, 0, `${pad}cwd: ${yamlQuote(cwd)}`);
      }
    }
  }
  const output = `${lines.join('\n').replace(/\n+$/, '')}\n`;
  if (existed && original !== '') {
    try {
      copyFileSync(patchPath, `${patchPath}.qq-workspace.bak`);
    } catch {
    }
  }
  writeFileAtomic(patchPath, output);
  const readback = readQQConfig(patchPath);
  if (normPath(readback.cwd ?? '') !== normPath(cwd)) {
    if (existed) {
      writeFileAtomic(patchPath, original);
    } else {
      try {
        rmSync(patchPath, { force: true });
      } catch {
      }
    }
    throw new Error('写入 QQ 工作目录后校验失败，已恢复原配置');
  }
}

function setQQConfigMediaTtl(patchPath, ttlHours) {
  const value = Number.isFinite(Number(ttlHours)) ? Math.max(0, Math.floor(Number(ttlHours))) : 0;
  if (!existsSync(patchPath)) throw new Error('QQ 配置文件不存在，无法设置上传保留策略');
  const original = readFileSync(patchPath, 'utf8');
  const lines = original.split(/\r?\n/);
  if (lines.length === 1 && lines[0] === '') lines.length = 0;
  const entry = findEntry(lines, QQ_PLUGIN_ID);
  if (entry === null) throw new Error('QQ 插件配置未找到，无法设置上传保留策略');
  let configStart = -1;
  let configIndent = '';
  for (let index = entry.start + 1; index < entry.end; index += 1) {
    const match = lines[index].match(/^(\s*)config:\s*(?:#.*)?$/);
    if (match !== null && match[1].length > entry.indent.length) {
      configStart = index;
      configIndent = match[1];
      break;
    }
  }
  if (configStart === -1) {
    let insertAt = entry.end;
    while (insertAt > entry.start + 1 && lines[insertAt - 1].trim() === '') insertAt -= 1;
    const configPad = `${entry.indent}  `;
    const valuePad = `${entry.indent}    `;
    lines.splice(insertAt, 0, `${configPad}config:`, `${valuePad}media:`, `${valuePad}  ttlHours: ${value}`);
  } else {
    let childIndent = '';
    let mediaStart = -1;
    let mediaIndent = '';
    for (let index = configStart + 1; index < entry.end; index += 1) {
      const line = lines[index];
      if (line.trim() === '' || line.trim().startsWith('#')) continue;
      const indent = line.match(/^(\s*)/)?.[1] ?? '';
      if (indent.length <= configIndent.length) break;
      if (childIndent === '') childIndent = indent;
      if (indent.length !== childIndent.length) continue;
      const match = line.match(/^(\s*)media:\s*(.*)$/);
      if (match !== null) {
        if (yamlScalar(match[2]) !== '') {
          throw new Error('QQ 配置里的 media 是内联写法，暂不支持自动写入');
        }
        mediaStart = index;
        mediaIndent = match[1];
        break;
      }
    }
    if (childIndent === '') childIndent = `${configIndent}  `;
    if (mediaStart === -1) {
      let contentEnd = configStart;
      for (let index = configStart + 1; index < entry.end; index += 1) {
        const line = lines[index];
        if (line.trim() === '' || line.trim().startsWith('#')) continue;
        const indent = line.match(/^(\s*)/)?.[1] ?? '';
        if (indent.length > configIndent.length) contentEnd = index;
      }
      const insertAt = contentEnd + 1;
      lines.splice(insertAt, 0, `${childIndent}media:`, `${childIndent}  ttlHours: ${value}`);
    } else {
      let mediaEnd = entry.end;
      for (let index = mediaStart + 1; index < entry.end; index += 1) {
        const line = lines[index];
        if (line.trim() === '' || line.trim().startsWith('#')) continue;
        const indent = line.match(/^(\s*)/)?.[1] ?? '';
        if (indent.length <= mediaIndent.length) {
          mediaEnd = index;
          break;
        }
      }
      let mediaChildIndent = `${mediaIndent}  `;
      let ttlIndex = -1;
      for (let index = mediaStart + 1; index < mediaEnd; index += 1) {
        const line = lines[index];
        if (line.trim() === '' || line.trim().startsWith('#')) continue;
        const indent = line.match(/^(\s*)/)?.[1] ?? '';
        if (indent.length <= mediaIndent.length) continue;
        if (mediaChildIndent === `${mediaIndent}  `) mediaChildIndent = indent;
        if (indent.length === mediaChildIndent.length && /^\s*ttlHours:\s*/.test(line)) {
          ttlIndex = index;
          break;
        }
      }
      if (ttlIndex !== -1) {
        const indent = lines[ttlIndex].match(/^(\s*)/)?.[1] ?? mediaChildIndent;
        lines[ttlIndex] = `${indent}ttlHours: ${value}`;
      } else {
        lines.splice(mediaStart + 1, 0, `${mediaChildIndent}ttlHours: ${value}`);
      }
    }
  }
  const output = `${lines.join('\n').replace(/\n+$/, '')}\n`;
  try {
    copyFileSync(patchPath, `${patchPath}.qq-workspace.bak`);
  } catch {
  }
  writeFileAtomic(patchPath, output);
  const readback = readQQConfig(patchPath);
  if (Number(readback.mediaTtlHours) !== value) {
    writeFileAtomic(patchPath, original);
    throw new Error('写入 QQ 上传保留策略后校验失败，已恢复原配置');
  }
}

function prefsPath() {
  return join(homedir(), '.dsh-qqbot', 'model-prefs.json');
}

function readQQPrefs() {
  try {
    const data = JSON.parse(readFileSync(prefsPath(), 'utf8'));
    return typeof data === 'object' && data !== null ? data : {};
  } catch {
    return {};
  }
}

function resetQQPrefs() {
  const path = prefsPath();
  if (!existsSync(path)) return { ok: true, count: 0 };
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error('不是 JSON 对象');
  } catch (error) {
    return { ok: false, count: 0, error: `无法读取 ${path}: ${error.message}` };
  }
  const sessionIds = typeof data.sessionIds === 'object' && data.sessionIds !== null ? data.sessionIds : {};
  let count = 0;
  for (const key of Object.keys(sessionIds)) {
    sessionIds[key] = randomUUID();
    count += 1;
  }
  data.sessionIds = sessionIds;
  try {
    copyFileSync(path, `${path}.qq-workspace.bak`);
    writeFileAtomic(path, `${JSON.stringify(data, null, 2)}\n`);
  } catch (error) {
    return { ok: false, count: 0, error: error.message };
  }
  return { ok: true, count };
}

function pendingPath(home) {
  return join(home, 'qq-workspace', 'pending-cleanup.json');
}

function readPending(home) {
  try {
    const data = JSON.parse(readFileSync(pendingPath(home), 'utf8'));
    if (typeof data !== 'object' || data === null || !Array.isArray(data.items)) return null;
    return data;
  } catch {
    return null;
  }
}

function writePending(home, pending) {
  if (pending === null || pending.items.length === 0) {
    try {
      rmSync(pendingPath(home), { force: true });
    } catch {
    }
    return;
  }
  writeFileAtomic(pendingPath(home), `${JSON.stringify(pending, null, 2)}\n`);
}

function newTrashDir(home) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return join(home, 'qq-workspace', 'trash', stamp);
}

function queueCleanup(home, sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return 0;
  let pending = readPending(home);
  if (pending === null) {
    pending = {
      version: 1,
      createdAt: new Date().toISOString(),
      trashDir: newTrashDir(home),
      items: [],
    };
  }
  const known = new Set(pending.items.map((item) => item.id));
  for (const session of sessions) {
    if (typeof session?.id !== 'string' || !SESSION_ID_RE.test(session.id) || known.has(session.id)) continue;
    pending.items.push({
      id: session.id,
      cwd: typeof session.cwd === 'string' ? session.cwd : '',
      title: typeof session.title === 'string' ? session.title : '',
      source: session.source ?? 'qq',
    });
    known.add(session.id);
  }
  pending.updatedAt = new Date().toISOString();
  writePending(home, pending);
  return pending.items.length;
}

function readSessionCache(home, id) {
  const path = join(home, 'storages', 'session_projcache', 'sessions', `${id}.json`);
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    const rows = data?.record?.rows ?? {};
    const title = rows?.title?.val;
    const first = rows?.titleInput?.val?.first?.text;
    return {
      title: typeof title === 'string' ? title : '',
      first: typeof first === 'string' ? first : '',
    };
  } catch {
    return null;
  }
}

function isQQMarker(text) {
  return typeof text === 'string' && QQ_MARKER_RE.test(text);
}

async function listStoredSessions(ctx) {
  try {
    const persistence = service(ctx, 'sessionPersistence');
    const snapshots = await persistence.list();
    return Array.isArray(snapshots) ? snapshots : [];
  } catch (error) {
    log(ctx, `[${PLUGIN_NAME}] 读取会话列表失败：${error?.message ?? String(error)}`, 'warn');
    return [];
  }
}

async function detectQQSessions(ctx, options = {}) {
  const { home, dir } = profileInfo(ctx);
  const prefs = readQQPrefs();
  const prefIds = new Set(
    Object.values(typeof prefs.sessionIds === 'object' && prefs.sessionIds !== null ? prefs.sessionIds : {})
      .filter((value) => typeof value === 'string' && value !== ''),
  );
  const oldCwds = new Set();
  if (typeof dir === 'string' && dir !== '') oldCwds.add(normPath(dir));
  try {
    oldCwds.add(normPath(process.cwd()));
  } catch {
  }
  const configured = readQQConfig(profileInfo(ctx).patchPath).cwd;
  if (typeof configured === 'string' && configured !== '') oldCwds.add(normPath(configured));
  const target = typeof options.targetCwd === 'string' && options.targetCwd !== ''
    ? normPath(options.targetCwd)
    : '';
  const sessionsService = service(ctx, 'sessions');
  const snapshots = await listStoredSessions(ctx);
  const found = [];
  for (const snapshot of snapshots) {
    const header = snapshot?.header;
    const id = header?.id === undefined ? '' : String(header.id);
    if (id === '') continue;
    const cwd = typeof header?.cwd === 'string' ? header.cwd : '';
    const isPref = prefIds.has(id);
    const inOldCwd = cwd !== '' && oldCwds.has(normPath(cwd));
    if (!isPref && !inOldCwd) continue;
    const cache = readSessionCache(home, id);
    if (!isPref && !isQQMarker(cache?.first ?? '')) continue;
    if (target !== '' && cwd !== '' && normPath(cwd) === target) continue;
    let active = false;
    try {
      active = sessionsService?.get?.(id) !== undefined;
    } catch {
    }
    found.push({
      id,
      cwd,
      title: cache?.title || '(无标题)',
      active,
      source: isPref ? 'prefs' : 'detected',
      createdAt: typeof header.createdAt === 'number' ? header.createdAt : 0,
    });
  }
  found.sort((left, right) => right.createdAt - left.createdAt);
  return found;
}

function uniqueDestination(path) {
  if (!existsSync(path)) return path;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${path}-${index}`;
    if (!existsSync(candidate)) return candidate;
  }
  throw new Error(`无法为 ${path} 找到可用的回收站名称`);
}

function moveSessionToTrash(home, trashDir, id) {
  let moved = false;
  const sessionsRoot = join(home, 'sessions');
  let projects = [];
  try {
    projects = readdirSync(sessionsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  } catch {
    projects = [];
  }
  for (const project of projects) {
    const source = join(sessionsRoot, project.name, id);
    if (!existsSync(source)) continue;
    const destination = uniqueDestination(join(trashDir, 'sessions', id));
    mkdirSync(dirname(destination), { recursive: true });
    renameSync(source, destination);
    moved = true;
  }
  const cachePath = join(home, 'storages', 'session_projcache', 'sessions', `${id}.json`);
  if (existsSync(cachePath)) {
    const destination = uniqueDestination(join(trashDir, 'projcache', `${id}.json`));
    mkdirSync(dirname(destination), { recursive: true });
    renameSync(cachePath, destination);
    moved = true;
  }
  return moved;
}

async function detachAndUnpin(ctx, id) {
  const registry = service(ctx, 'workspaceRegistry');
  try {
    for (const workspace of registry.list()) {
      try {
        if (workspace.sessionIds.includes(id)) await workspace.detachSession(id);
      } catch {
      }
    }
    if (registry.pinnedSessionIds.includes(id)) await registry.unpinSession(id);
    if (registry.archivedSessionIds.includes(id)) await registry.unarchiveSession(id);
  } catch (error) {
    log(ctx, `[${PLUGIN_NAME}] 清理会话 ${id} 的工作区引用失败：${error?.message ?? String(error)}`, 'warn');
  }
}

async function cleanupPending(ctx) {
  const { home } = profileInfo(ctx);
  const pending = readPending(home);
  if (pending === null || pending.items.length === 0) {
    writePending(home, null);
    return { moved: 0, remaining: 0, trashDir: pending?.trashDir ?? '' };
  }
  const sessionsService = service(ctx, 'sessions');
  const remaining = [];
  let moved = 0;
  for (const item of pending.items) {
    const id = item?.id;
    if (typeof id !== 'string' || !SESSION_ID_RE.test(id)) continue;
    let live = false;
    try {
      live = sessionsService?.get?.(id) !== undefined;
    } catch {
    }
    if (live) {
      remaining.push(item);
      continue;
    }
    try {
      if (moveSessionToTrash(home, pending.trashDir, id)) moved += 1;
      await detachAndUnpin(ctx, id);
    } catch (error) {
      log(ctx, `[${PLUGIN_NAME}] 移动旧 QQ 会话 ${id} 失败：${error?.message ?? String(error)}`, 'warn');
      remaining.push(item);
    }
  }
  pending.items = remaining;
  pending.updatedAt = new Date().toISOString();
  writePending(home, pending);
  if (moved > 0) {
    log(ctx, `[${PLUGIN_NAME}] 已将 ${moved} 个旧 QQ 会话移入回收站：${pending.trashDir}`);
  }
  return { moved, remaining: remaining.length, trashDir: pending.trashDir };
}

function runCleanup(ctx) {
  if (cleanupInFlight !== null) return cleanupInFlight;
  cleanupInFlight = cleanupPending(ctx).finally(() => {
    cleanupInFlight = null;
  });
  return cleanupInFlight;
}

function scheduleCleanup(ctx, delay = 1500, attempt = 0) {
  if (cleanupTimer !== null) return;
  cleanupTimer = setTimeout(() => {
    cleanupTimer = null;
    void runCleanup(ctx)
      .then((result) => {
        if (result.remaining > 0 && attempt < 20) scheduleCleanup(ctx, 5000, attempt + 1);
      })
      .catch((error) => {
        log(ctx, `[${PLUGIN_NAME}] 清理旧 QQ 会话失败：${error?.message ?? String(error)}`, 'warn');
      });
  }, delay);
  cleanupTimer.unref?.();
}

async function ensureWorkspace(ctx, path) {
  const target = canonical(path);
  if (!existsSync(target)) mkdirSync(target, { recursive: true });
  if (!statSync(target).isDirectory()) throw new Error(`不是文件夹：${target}`);
  const registry = service(ctx, 'workspaceRegistry');
  const existing = await registry.resolveByPath(target);
  if (existing !== undefined) return existing;
  return await registry.create(target);
}

async function attachMatchingSessions(ctx, workspace) {
  if (workspace === undefined || workspace === null) return 0;
  const target = normPath(workspace.path);
  const sessions = await listStoredSessions(ctx);
  let attached = 0;
  for (const snapshot of sessions) {
    const id = snapshot?.header?.id === undefined ? '' : String(snapshot.header.id);
    const cwd = typeof snapshot?.header?.cwd === 'string' ? snapshot.header.cwd : '';
    if (id === '' || cwd === '' || normPath(cwd) !== target) continue;
    try {
      await workspace.attachSession(id);
      attached += 1;
    } catch (error) {
      log(ctx, `[${PLUGIN_NAME}] 会话 ${id} 加入工作区失败：${error?.message ?? String(error)}`, 'warn');
    }
  }
  return attached;
}

async function onSessionCreated(ctx, session) {
  const configured = readQQConfig(profileInfo(ctx).patchPath).cwd;
  if (typeof configured !== 'string' || configured === '') return;
  const cwd = session?.header?.cwd;
  if (typeof cwd !== 'string' || cwd === '' || normPath(cwd) !== normPath(configured)) return;
  const workspace = await ensureWorkspace(ctx, configured);
  const id = String(session.header.id);
  await workspace.attachSession(id);
}

async function bootstrap(ctx) {
  const { patchPath } = profileInfo(ctx);
  const configured = readQQConfig(patchPath).cwd;
  if (typeof configured === 'string' && configured !== '') {
    const media = ensureMediaLink(configured);
    if (!media.linked) {
      log(ctx, `[${PLUGIN_NAME}] QQ 上传目录未能映射到工作区：${media.error}`, 'warn');
    }
  }
  if (typeof configured === 'string' && configured !== '') {
    try {
      if (existsSync(configured) && statSync(configured).isDirectory()) {
        const workspace = await ensureWorkspace(ctx, configured);
        const attached = await attachMatchingSessions(ctx, workspace);
        if (attached > 0) {
          log(ctx, `[${PLUGIN_NAME}] 已将 ${attached} 个会话归入工作区 ${workspace.path}`);
        }
      }
    } catch (error) {
      log(ctx, `[${PLUGIN_NAME}] 初始化 QQ 工作区失败：${error?.message ?? String(error)}`, 'warn');
    }
  }
  scheduleCleanup(ctx, 1200);
}

async function buildState(ctx) {
  const profile = profileInfo(ctx);
  const qqConfig = readQQConfig(profile.patchPath);
  const configured = qqConfig.cwd ?? '';
  if (typeof configured === 'string' && configured !== '') {
    ensureMediaLink(configured);
  }
  const ttlHours = typeof qqConfig.mediaTtlHours === 'number' && Number.isFinite(qqConfig.mediaTtlHours)
    ? qqConfig.mediaTtlHours
    : 24;
  const target = typeof configured === 'string' && configured !== '' ? canonical(configured) : '';
  let workspace = null;
  if (target !== '') {
    try {
      const entity = await service(ctx, 'workspaceRegistry').resolveByPath(target);
      if (entity !== undefined) {
        workspace = {
          id: String(entity.id),
          path: entity.path,
          title: entity.title,
        };
      }
    } catch {
    }
  }
  const candidates = await detectQQSessions(ctx, { targetCwd: target });
  const pending = readPending(profile.home);
  const commandPatch = commandPatchState(profile);
  return {
    ok: true,
    qq: {
      installed: existsSync(join(profile.dir, 'node_modules', ...QQ_PACKAGE.split('/'), 'package.json')),
      configuredCwd: configured,
      effectiveCwd: configured !== '' ? configured : profile.dir,
    },
    workspace,
    targetExists: target !== '' && existsSync(target) && statSync(target).isDirectory(),
    candidates,
    pending: pending?.items?.length ?? 0,
    trashRoot: join(profile.home, 'qq-workspace', 'trash'),
    media: {
      ...mediaLinkState,
      ttlHours,
      retainForever: ttlHours <= 0,
      configured: typeof qqConfig.mediaTtlHours === 'number',
    },
    security: securityLock === null
      ? { enabled: false, lockedCount: 0, workspace: 'workspace', guardReady: false }
      : securityLock.state(),
    context: contextManager === null ? null : contextManager.state(),
    contextError: contextManager === null ? contextInitError : '',
    commandPatch: {
      patched: commandPatch.patched,
      changed: commandPatchChanged,
      ...(commandPatch.error === undefined ? {} : { error: commandPatch.error }),
    },
  };
}

async function handleState(ctx, res) {
  sendJson(res, 200, await buildState(ctx));
}

async function handleApply(ctx, req, res) {
  const body = await readJsonBody(req);
  const requested = typeof body.path === 'string' ? body.path.trim() : '';
  if (requested === '') throw httpError(400, '工作目录不能为空');
  if (/[\r\n\0]/.test(requested)) throw httpError(400, '工作目录包含非法字符');
  if (!isAbsolute(requested)) throw httpError(400, '请输入绝对路径（例如 D:\\qq-workspace）');
  if (!existsSync(requested)) mkdirSync(requested, { recursive: true });
  if (!statSync(requested).isDirectory()) throw httpError(400, '目标路径不是文件夹');
  const target = canonical(requested);
  const profile = profileInfo(ctx);
  const candidates = await detectQQSessions(ctx, { targetCwd: target });
  let workspace = null;
  let workspaceError = '';
  try {
    workspace = await ensureWorkspace(ctx, target);
  } catch (error) {
    workspaceError = error?.message ?? String(error);
    log(ctx, `[${PLUGIN_NAME}] 创建工作区失败：${workspaceError}`, 'warn');
  }
  let prefsResult = { ok: true, count: 0 };
  let queued = 0;
  if (body.reset !== false) {
    prefsResult = resetQQPrefs();
    queued = queueCleanup(profile.home, candidates);
    securityLock?.syncFromPrefs();
  }
  const media = ensureMediaLink(target);
  if (!media.linked) {
    log(ctx, `[${PLUGIN_NAME}] QQ 上传目录未能映射到新工作区：${media.error}`, 'warn');
  }
  // Write the profile patch last: it triggers HMR, so no await may follow before the response.
  setQQConfigCwd(profile.patchPath, target);
  scheduleCleanup(ctx, 1200);
  const message = prefsResult.ok
    ? `已切换到 ${target}。QQ 插件将自动重载；下一条 QQ 消息会新建会话。`
    : `已切换目录，但重置 QQ 会话失败：${prefsResult.error}`;
  sendJson(res, 200, {
    ok: true,
    applied: {
      path: target,
      queued,
      prefsReset: prefsResult.ok,
      prefsCount: prefsResult.count,
      prefsError: prefsResult.error ?? '',
      workspaceError,
      media,
      workspace: workspace === null ? null : { id: String(workspace.id), path: workspace.path, title: workspace.title },
      message,
    },
  });
}

async function handleContext(ctx, req, res) {
  if (contextManager === null) throw httpError(503, '上下文管理尚未加载');
  if (!isJsonRequest(req)) throw httpError(415, '请求体必须是 application/json');
  const body = await readJsonBody(req);
  const patch = {};
  for (const key of ['enabled', 'percentEnabled', 'turnsEnabled']) {
    if (Object.hasOwn(body, key)) {
      if (typeof body[key] !== 'boolean') throw httpError(400, `${key} 必须是布尔值`);
      patch[key] = body[key];
    }
  }
  for (const key of ['percent', 'turns', 'retainPercent']) {
    if (Object.hasOwn(body, key)) {
      if (typeof body[key] !== 'number' || !Number.isFinite(body[key])) {
        throw httpError(400, `${key} 必须是数字`);
      }
      patch[key] = body[key];
    }
  }
  if (Object.hasOwn(body, 'retainMode')) {
    if (body.retainMode !== 'default' && body.retainMode !== 'custom') {
      throw httpError(400, 'retainMode 必须是 default 或 custom');
    }
    patch.retainMode = body.retainMode;
  }
  if (Object.keys(patch).length === 0) throw httpError(400, '没有可更新的上下文设置');
  const state = contextManager.configure(patch);
  log(ctx, `[${PLUGIN_NAME}] 上下文管理设置已更新`);
  sendJson(res, 200, { ok: true, context: state });
}

async function handleFileSettings(ctx, req, res, kind, setting, label) {
  if (contextManager === null) throw httpError(503, '上下文管理尚未加载');
  if (!isJsonRequest(req)) throw httpError(415, '请求体必须是 application/json');
  const body = await readJsonBody(req);
  if (!Object.hasOwn(body, 'enabled') && !Object.hasOwn(body, 'content')) {
    throw httpError(400, `没有可更新的${label}设置`);
  }
  if (Object.hasOwn(body, 'enabled')) {
    if (typeof body.enabled !== 'boolean') throw httpError(400, 'enabled 必须是布尔值');
    contextManager.configure({ [setting]: body.enabled });
  }
  if (Object.hasOwn(body, 'content')) {
    if (typeof body.content !== 'string') throw httpError(400, 'content 必须是字符串');
    contextManager.writeFile(kind, body.content);
  }
  log(ctx, `[${PLUGIN_NAME}] ${label}设置已更新`);
  sendJson(res, 200, { ok: true, context: contextManager.state() });
}

async function handleSoul(ctx, req, res) {
  return handleFileSettings(ctx, req, res, 'soul', 'soulEnabled', '人格 SOUL.md');
}

async function handleMemory(ctx, req, res) {
  return handleFileSettings(ctx, req, res, 'memory', 'memoryEnabled', '长期记忆 MEMORY.md');
}

async function handleRoute(ctx, req, res) {
  const method = (req.method ?? 'GET').toUpperCase();
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (!trustedRequest(ctx, req)) {
      sendJson(res, 403, { ok: false, message: 'forbidden' });
      return;
    }
    if (url.pathname === `${ROUTE}/state` && method === 'GET') {
      await handleState(ctx, res);
      return;
    }
    if (url.pathname === `${ROUTE}/apply` && method === 'POST') {
      if (!isJsonRequest(req)) throw httpError(415, '请求体必须是 application/json');
      await handleApply(ctx, req, res);
      return;
    }
    if (url.pathname === `${ROUTE}/media` && method === 'POST') {
      if (!isJsonRequest(req)) throw httpError(415, '请求体必须是 application/json');
      const body = await readJsonBody(req);
      if (typeof body.retainForever !== 'boolean') throw httpError(400, 'retainForever 必须是布尔值');
      const { patchPath } = profileInfo(ctx);
      setQQConfigMediaTtl(patchPath, body.retainForever ? 0 : 24);
      log(ctx, `[${PLUGIN_NAME}] QQ 上传保留策略已更新：${body.retainForever ? '长期保留' : '24 小时自动清理'}`);
      sendJson(res, 200, {
        ok: true,
        media: { retainForever: body.retainForever, ttlHours: body.retainForever ? 0 : 24 },
      });
      return;
    }
    if (url.pathname === `${ROUTE}/security` && method === 'POST') {
      if (!isJsonRequest(req)) throw httpError(415, '请求体必须是 application/json');
      if (securityLock === null) throw httpError(503, '安全锁尚未加载');
      const body = await readJsonBody(req);
      const patch = {};
      for (const key of ['enabled', 'core', 'allowWeb', 'blockModelSwitch', 'blockPresetSwitch']) {
        if (typeof body[key] === 'boolean') patch[key] = body[key];
      }
      if (Object.keys(patch).length === 0) throw httpError(400, '没有可更新的安全锁开关');
      const state = securityLock.configure(patch);
      log(ctx, `[${PLUGIN_NAME}] 安全锁设置已更新：${JSON.stringify(patch)}`);
      sendJson(res, 200, { ok: true, security: state });
      return;
    }
    if (url.pathname === `${ROUTE}/context` && method === 'POST') {
      if (!isJsonRequest(req)) throw httpError(415, '请求体必须是 application/json');
      await handleContext(ctx, req, res);
      return;
    }
    if (url.pathname === `${ROUTE}/soul` && method === 'POST') {
      if (!isJsonRequest(req)) throw httpError(415, '请求体必须是 application/json');
      await handleSoul(ctx, req, res);
      return;
    }
    if (url.pathname === `${ROUTE}/memory` && method === 'POST') {
      if (!isJsonRequest(req)) throw httpError(415, '请求体必须是 application/json');
      await handleMemory(ctx, req, res);
      return;
    }
    sendJson(res, 404, { ok: false, message: `没有这条路由：${method} ${url.pathname}` });
  } catch (error) {
    const status = Number.isFinite(error?.status) ? error.status : 500;
    if (status >= 500) log(ctx, `[${PLUGIN_NAME}] ${error?.stack ?? error?.message ?? String(error)}`, 'error');
    if (!res.headersSent) {
      sendJson(res, status, { ok: false, message: error?.message ?? String(error) });
    } else {
      try {
        res.end();
      } catch {
      }
    }
  }
}

export async function apply(ctx) {
  try {
    const configured = readQQConfig(profileInfo(ctx).patchPath).cwd;
    const media = ensureMediaLink(configured);
    if (!media.linked && typeof configured === 'string' && configured !== '') {
      log(ctx, `[${PLUGIN_NAME}] QQ 上传目录未能映射到工作区：${media.error}`, 'warn');
    }
  } catch (error) {
    setMediaState(false, error?.message ?? String(error));
    log(ctx, `[${PLUGIN_NAME}] 初始化 QQ 上传目录失败：${error?.message ?? String(error)}`, 'warn');
  }

  ctx.effect(() => {
    const disposer = ctx.webServer.register({
      kind: 'prefix',
      path: ROUTE,
      handler: (req, res) => {
        void handleRoute(ctx, req, res);
      },
    });
    if (typeof disposer !== 'function') throw new TypeError('webServer.register() 没有返回 disposer');
    return disposer;
  }, `${PLUGIN_NAME}: HTTP`);

  const lock = createSecurityLock(ctx, {
    profileInfo,
    readQQConfig,
    readQQPrefs,
    writeFileAtomic,
    canonical,
    normPath,
    mediaRoot: QQ_MEDIA_ROOT,
    mediaDir: QQ_MEDIA_DIR,
    service: (key) => service(ctx, key),
    log: (message, level) => log(ctx, message, level),
  });
  lock.install();
  securityLock = lock;
  ctx.effect(() => () => {
    if (securityLock === lock) securityLock = null;
  }, `${PLUGIN_NAME}: security ref`);

  try {
    const manager = createContextManager(ctx, {
      profileInfo,
      readQQConfig,
      readQQPrefs,
      writeFileAtomic,
      canonical,
      normPath,
      service: (key) => service(ctx, key),
      sanitizeText: (text) => {
        try {
          return typeof lock.makeSanitizer === 'function' ? lock.makeSanitizer()(text) : text;
        } catch {
          return text;
        }
      },
      log: (message, level) => log(ctx, message, level),
    });
    manager.install();
    contextManager = manager;
    contextInitError = '';
    ctx.effect(() => () => {
      if (contextManager === manager) contextManager = null;
    }, `${PLUGIN_NAME}: context ref`);
  } catch (error) {
    contextInitError = error?.message ?? String(error);
    log(ctx, `[${PLUGIN_NAME}] 上下文管理初始化失败：${contextInitError}`, 'warn');
  }

  installCommandHook(ctx, lock);
  const patchResult = ensureCommandPatch(profileInfo(ctx), (message, level) => log(ctx, message, level));
  commandPatchChanged = patchResult.changed === true;
  if (!patchResult.patched) {
    log(ctx, `[${PLUGIN_NAME}] QQ 命令拦截补丁未安装：${patchResult.error ?? 'unknown'}`, 'warn');
  }

  try {
    ctx.on('session/created', (session) => {
      void onSessionCreated(ctx, session).catch((error) => {
        log(ctx, `[${PLUGIN_NAME}] 新会话加入工作区失败：${error?.message ?? String(error)}`, 'warn');
      });
    });
  } catch (error) {
    log(ctx, `[${PLUGIN_NAME}] 无法监听 session/created：${error?.message ?? String(error)}`, 'warn');
  }

  void runCleanup(ctx)
    .then((result) => {
      if (result.remaining > 0) scheduleCleanup(ctx, 5000, 1);
    })
    .catch((error) => {
      log(ctx, `[${PLUGIN_NAME}] 启动清理失败：${error?.message ?? String(error)}`, 'warn');
    });

  ctx.effect(() => {
    const timer = setTimeout(() => {
      void bootstrap(ctx).catch((error) => {
        log(ctx, `[${PLUGIN_NAME}] 启动检查失败：${error?.message ?? String(error)}`, 'warn');
      });
    }, 800);
    timer.unref?.();
    return () => clearTimeout(timer);
  }, `${PLUGIN_NAME}: bootstrap`);

  ctx.effect(() => () => {
    if (cleanupTimer !== null) {
      clearTimeout(cleanupTimer);
      cleanupTimer = null;
    }
  }, `${PLUGIN_NAME}: cleanup timer`);

  log(ctx, `[${PLUGIN_NAME}] 已加载；安全锁${lock.state().enabled ? '已开启' : '已关闭'}`);
}
