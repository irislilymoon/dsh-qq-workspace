import { copyFileSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const GUARD_KEY = 'dsh-qq-workspace.qq-command-guard';
const PATCH_MARKER = 'dsh-qq-workspace.qq-command-guard';
const INSERT_AFTER = 'const [, name, rest = ""] = match;';
const INSERT_BEFORE = 'const cmd = registry.get(name.toLowerCase());';
const HOOK_CODE = [
  '        // dsh-qq-workspace security command guard',
  `        const securityCommandGuard = globalThis[Symbol.for("${PATCH_MARKER}")];`,
  '        if (typeof securityCommandGuard === "function") {',
  '            const securityHandled = await securityCommandGuard(ctx, name, rest);',
  '            if (securityHandled === true) {',
  '                ctx.stop("command:security:" + name.toLowerCase());',
  '                return;',
  '            }',
  '        }',
].join('\n');

function writeAtomic(path, content) {
  const temp = join(dirname(path), `.${Date.now()}.${process.pid}.qqw.tmp`);
  writeFileSync(temp, content, 'utf8');
  try {
    renameSync(temp, path);
  } catch {
    try {
      writeFileSync(path, content, 'utf8');
    } finally {
      try {
        rmSync(temp, { force: true });
      } catch {
      }
    }
  }
}

export function sdkSlashPath(profile) {
  return join(profile.dir, 'node_modules', '@tencent-connect', 'qqbot-nodejs', 'dist', 'middleware', 'slash-command.js');
}

export function commandPatchState(profile) {
  const path = sdkSlashPath(profile);
  try {
    const text = readFileSync(path, 'utf8');
    return { patched: text.includes(PATCH_MARKER), changed: false, path };
  } catch (error) {
    return { patched: false, changed: false, path, error: error?.message ?? String(error) };
  }
}

export function ensureCommandPatch(profile, log) {
  const path = sdkSlashPath(profile);
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    return { patched: false, changed: false, path, error: error?.message ?? String(error) };
  }
  if (text.includes(PATCH_MARKER)) return { patched: true, changed: false, path };
  if (!text.includes(INSERT_AFTER) || !text.includes(INSERT_BEFORE)) {
    log(`[dsh-qq-workspace] QQ 命令拦截补丁位置不匹配，未修改 ${path}`, 'warn');
    return { patched: false, changed: false, path, error: 'SDK code shape changed' };
  }
  try {
    copyFileSync(path, `${path}.qq-workspace.bak`);
    const patched = text.replace(INSERT_AFTER, `${INSERT_AFTER}\n${HOOK_CODE}`);
    writeAtomic(path, patched);
    log('[dsh-qq-workspace] 已安装 QQ 命令拦截补丁；需要重启 DSH 后才能生效', 'warn');
    return { patched: true, changed: true, path };
  } catch (error) {
    log(`[dsh-qq-workspace] 安装 QQ 命令拦截补丁失败：${error?.message ?? String(error)}`, 'error');
    return { patched: false, changed: false, path, error: error?.message ?? String(error) };
  }
}

export function installCommandHook(ctx, security) {
  const key = Symbol.for(GUARD_KEY);
  const hook = async (qqCtx, name, rest) => security.handleQQCommand(qqCtx, name, rest);
  globalThis[key] = hook;
  ctx.effect(() => () => {
    if (globalThis[key] === hook) delete globalThis[key];
  }, 'qq-security: command hook');
  return hook;
}
