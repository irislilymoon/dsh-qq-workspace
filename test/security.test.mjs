import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  unlinkSync,
  rmdirSync,
  rmSync,
  realpathSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { SecurityLock } from '../security.js';

const SESSION_ID = 'session-test-01';
const PEER_KEY = 'qqbot:test-app:c2c:test-peer';

function removeDirLink(path) {
  try {
    if (process.platform === 'win32') rmdirSync(path);
    else unlinkSync(path);
  } catch {
  }
}

function makeHarness(t, options = {}) {
  const base = mkdtempSync(join(tmpdir(), 'dsh-qq-security-'));
  const workspace = join(base, 'workspace');
  const uploads = join(workspace, 'qq-uploads');
  mkdirSync(uploads, { recursive: true });
  const mediaRoot = join(base, 'media');
  let linkMade = false;
  if (options.link !== false) {
    try {
      symlinkSync(uploads, mediaRoot, process.platform === 'win32' ? 'junction' : 'dir');
      linkMade = true;
    } catch {
    }
  }
  let currentCwd = workspace;
  let sandboxMode = 'workspace-write';
  const prefs = {
    sessionIds: { [PEER_KEY]: SESSION_ID },
    overrides: {},
    presets: {},
  };
  const profile = { dir: base, home: base, patchPath: join(base, 'cordis.patch.yml') };
  const deps = {
    profileInfo: () => profile,
    readQQConfig: () => ({
      cwd: workspace,
      provider: 'test-provider',
      model: 'test-model',
      preset: 'standard',
    }),
    readQQPrefs: () => prefs,
    writeFileAtomic: (path, content) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    },
    canonical: (value) => {
      try {
        return realpathSync.native(value);
      } catch {
        return resolve(value);
      }
    },
    normPath: (value) => {
      const resolved = resolve(value);
      return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    },
    mediaRoot,
    mediaDir: 'qq-uploads',
    service: (key) => {
      if (key === 'workingDirectory') return { get: () => currentCwd };
      if (key === 'sandboxPolicy') return { resolve: () => ({ mode: sandboxMode }) };
      if (key === 'agents') return { get: () => undefined };
      return undefined;
    },
    log: () => {},
  };
  const ctx = {
    get: (key) => deps.service(key),
    on: () => {},
    effect: () => {},
    logger: { warn: () => {}, error: () => {}, info: () => {} },
  };
  const lock = new SecurityLock(ctx, deps);
  lock.enabled = true;
  lock.core = true;
  lock.guardReady = true;
  lock.ids.add(SESSION_ID);
  const agent = {
    session: { id: SESSION_ID, header: { cwd: workspace } },
    runtimeContext: { project: () => ({ cwd: workspace, env: { USER: 'tester' } }) },
    ctx: { systemPrompt: { suppressRuntimeContext: () => () => {} } },
  };
  t.after(() => {
    if (linkMade) removeDirLink(mediaRoot);
    rmSync(base, { recursive: true, force: true });
  });
  return {
    base,
    workspace,
    uploads,
    mediaRoot,
    linkMade,
    lock,
    agent,
    prefs,
    setCwd: (value) => { currentCwd = value; },
    setSandboxMode: (value) => { sandboxMode = value; },
  };
}

const read = (h, file_path) => h.lock.guard({ agent: h.agent, name: 'read', arguments: { file_path } });
const glob = (h, args) => h.lock.guard({ agent: h.agent, name: 'glob', arguments: args });

test('safe workspace paths pass and escapes are rejected', (t) => {
  const h = makeHarness(t);
  assert.equal(read(h, 'note.txt'), undefined);
  assert.match(read(h, 'C:/Windows/win.ini'), /冒号|相对路径/);
  assert.match(read(h, '../secret.txt'), /\.\./);
  assert.match(read(h, 'safe.txt:stream'), /冒号/);
  assert.match(read(h, 'CON'), /设备路径/);
  assert.match(read(h, '.git/config'), /控制文件|控制目录/);
  assert.match(read(h, 'docs/AGENTS.md'), /控制文件|控制目录/);
  assert.match(read(h, '.vscode/tasks.json'), /控制文件|控制目录/);
  assert.match(read(h, 'file:///C:/x'), /冒号/);
});

test('execution directory must stay inside the workspace', (t) => {
  const h = makeHarness(t);
  h.setCwd(h.base);
  assert.match(read(h, 'note.txt'), /工作目录不在/);
  h.setCwd(h.workspace);
  assert.equal(read(h, 'note.txt'), undefined);
});

test('control directories block broad recursive searches', (t) => {
  const h = makeHarness(t);
  mkdirSync(join(h.workspace, '.git'));
  assert.match(glob(h, { pattern: '**/*' }), /受保护的控制项/);
  assert.match(glob(h, { pattern: '**/.git/**' }), /控制目录/);
  rmSync(join(h.workspace, '.git'), { recursive: true });
  writeFileSync(join(h.workspace, 'AGENTS.md'), 'instructions');
  assert.match(glob(h, { pattern: '**/*' }), /受保护的控制项/);
  rmSync(join(h.workspace, 'AGENTS.md'));
  assert.equal(glob(h, { pattern: '**/*' }), undefined);
});

test('symlink and junction escapes are rejected', (t) => {
  const h = makeHarness(t, { link: false });
  const outside = join(h.base, 'outside');
  mkdirSync(outside);
  writeFileSync(join(outside, 'secret.txt'), 'secret');
  const link = join(h.workspace, 'outside-link');
  try {
    symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  } catch {
    t.skip('directory links are not available in this environment');
    return;
  }
  try {
    assert.match(read(h, 'outside-link/secret.txt'), /超出工作区/);
  } finally {
    removeDirLink(link);
  }
  mkdirSync(join(h.workspace, '.dsh'));
  writeFileSync(join(h.workspace, '.dsh', 'secret.txt'), 'hidden');
  const alias = join(h.workspace, 'alias');
  symlinkSync(join(h.workspace, '.dsh'), alias, process.platform === 'win32' ? 'junction' : 'dir');
  try {
    assert.match(read(h, 'alias/secret.txt'), /控制文件|控制目录/);
  } finally {
    removeDirLink(alias);
    rmSync(join(h.workspace, '.dsh'), { recursive: true });
  }
});

test('web tools follow the allowWeb flag', (t) => {
  const h = makeHarness(t);
  assert.equal(h.lock.guard({ agent: h.agent, name: 'web_fetch', arguments: { url: 'https://example.com' } }), undefined);
  assert.match(h.lock.guard({ agent: h.agent, name: 'web_fetch', arguments: { url: 'file:///C:/x' } }), /HTTP/);
  h.lock.allowWeb = false;
  assert.match(h.lock.guard({ agent: h.agent, name: 'web_fetch', arguments: { url: 'https://example.com' } }), /不允许使用工具/);
  h.lock.allowWeb = true;
});

test('read-only mode blocks writes', (t) => {
  const h = makeHarness(t);
  h.setSandboxMode('read-only');
  assert.match(h.lock.guard({ agent: h.agent, name: 'write', arguments: { file_path: 'new.txt', content: 'x' } }), /只读|不允许使用工具 write/);
  h.setSandboxMode('workspace-write');
  assert.equal(h.lock.guard({ agent: h.agent, name: 'write', arguments: { file_path: 'new.txt', content: 'x' } }), undefined);
});

test('command guard fails closed and hides other models', async (t) => {
  const h = makeHarness(t);
  const throwing = {
    message: { kind: 'c2c', senderId: 'test-peer' },
    bot: { sendMarkdown: async () => { throw new Error('send failed'); } },
  };
  assert.equal(await h.lock.handleQQCommand(throwing, 'model', ''), true);
  assert.equal(await h.lock.handleQQCommand(throwing, 'model', 'other/model'), true);
  assert.equal(await h.lock.handleQQCommand({}, 'preset', 'reset'), true);

  const sent = [];
  const ok = {
    message: { kind: 'c2c', senderId: 'test-peer' },
    bot: { sendMarkdown: async (_target, text) => sent.push(text) },
  };
  assert.equal(await h.lock.handleQQCommand(ok, 'model', ''), true);
  assert.match(sent.at(-1), /当前模型/);
  assert.doesNotMatch(sent.at(-1), /可用模型/);
  assert.equal(await h.lock.handleQQCommand(ok, 'model', 'other/model'), true);
  assert.match(sent.at(-1), /禁止切换模型/);
  assert.equal(await h.lock.handleQQCommand(ok, 'preset', 'reset'), true);
  assert.match(sent.at(-1), /禁止切换 preset/);

  h.lock.blockModelSwitch = false;
  assert.equal(await h.lock.handleQQCommand(ok, 'model', 'other/model'), false);
  h.lock.blockModelSwitch = true;
  h.lock.enabled = false;
  assert.equal(await h.lock.handleQQCommand(ok, 'model', 'other/model'), false);
});

test('prefs learn a session even when session/created missed it', (t) => {
  const h = makeHarness(t);
  h.lock.ids.clear();
  assert.equal(h.lock.ensureLocked(h.agent), true);
  assert.equal(h.lock.ids.has(SESSION_ID), true);
});

test('media paths are rewritten and readable when linked', (t) => {
  const h = makeHarness(t);
  if (!h.linkMade) {
    t.skip('directory links are not available in this environment');
    return;
  }
  assert.equal(h.lock.mediaLinked(), true);
  writeFileSync(join(h.uploads, 'photo.jpg'), 'fake');
  const mediaPath = h.mediaRoot.replace(/\\/g, '/');
  const decision = {
    kind: 'enter',
    messages: [{
      role: 'user',
      source: { kind: 'user' },
      content: [{ type: 'text', text: `Image: ${mediaPath}/photo.jpg` }],
    }],
  };
  const rewritten = h.lock.rewritePreStep(decision, h.agent);
  const text = JSON.stringify(rewritten);
  assert.match(text, /qq-uploads\/photo\.jpg/);
  assert.ok(!text.includes(mediaPath));
  assert.equal(h.lock.guard({ agent: h.agent, name: 'read_image', arguments: { file_path: 'qq-uploads/photo.jpg' } }), undefined);
  const prompt = h.lock.rewriteAssembly({ sections: [], contexts: [], variables: {}, tools: [] }, h.agent)
    .sections.find((section) => section.name === 'security-lock').text;
  assert.match(prompt, /qq-uploads/);
});

test('host prompt sections, contexts and tools are filtered', (t) => {
  const h = makeHarness(t);
  const assembly = {
    sections: [
      { name: 'harness:identity', text: `You are a coding agent at ${h.workspace}` },
      { name: 'custom:keep', text: `custom ${h.workspace}` },
      { name: 'ui:environment', text: `Windows ${h.workspace}` },
    ],
    contexts: [{ name: 'working-directory:current', text: h.workspace }],
    variables: { cwd: h.workspace, model: 'test-model' },
    tools: [
      { name: 'read', description: `read ${h.workspace}`, parameters: { properties: { file_path: { type: 'string' } } } },
      { name: 'bash', description: 'shell', parameters: {} },
      { name: 'qqbot_send_file', description: 'send', parameters: {} },
    ],
  };
  const rewritten = h.lock.rewriteAssembly(assembly, h.agent);
  assert.equal(rewritten.contexts.length, 0);
  assert.ok(rewritten.sections.some((section) => section.name === 'custom:keep'));
  assert.ok(rewritten.sections.some((section) => section.name === 'security-lock'));
  assert.ok(!rewritten.sections.some((section) => section.name === 'harness:identity'));
  assert.ok(!rewritten.sections.some((section) => section.name === 'ui:environment'));
  assert.deepEqual(rewritten.tools.map((tool) => tool.name), ['read']);
  assert.ok(!JSON.stringify(rewritten).includes(h.workspace));

  const decision = {
    kind: 'enter',
    messages: [
      { role: 'user', source: { kind: 'agent-instructions' }, content: [{ type: 'text', text: 'SECRET' }] },
      { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'read C:\\Users\\someone\\secret.txt' }] },
      { role: 'tool', content: [{ type: 'text', text: 'opened C:\\Users\\someone\\secret.txt' }] },
    ],
  };
  const filtered = h.lock.rewritePreStep(decision, h.agent);
  assert.equal(filtered.messages.length, 2);
  assert.ok(!JSON.stringify(filtered).includes('SECRET'));
  assert.ok(!JSON.stringify(filtered).includes('C:\\Users'));

  h.lock.guardReady = false;
  assert.deepEqual(h.lock.rewriteAssembly(assembly, h.agent).tools, []);
});
