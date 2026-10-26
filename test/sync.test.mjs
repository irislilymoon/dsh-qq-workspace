import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { __test } from '../index.js';

const { enablePromptStudioMemory } = __test;

function promptStudioHome(t, stored) {
  const home = mkdtempSync(join(tmpdir(), 'dsh-qq-sync-'));
  const path = join(home, 'prompt-studio', 'settings.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(stored, null, 2)}\n`);
  t.after(() => rmSync(home, { recursive: true, force: true }));
  return { home, path };
}

test('turning a QQ file on enables the matching global switch', (t) => {
  const { home, path } = promptStudioHome(t, {
    version: 4,
    memory: false,
    memoryFiles: { soul: false, memory: false },
  });
  assert.equal(enablePromptStudioMemory(home, 'memory'), true);
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  assert.deepEqual(saved.memoryFiles, { soul: false, memory: true });
  assert.equal(saved.memory, true);
});

test('an already enabled file is left alone and the file is not rewritten', (t) => {
  const { home, path } = promptStudioHome(t, {
    version: 4,
    memory: true,
    memoryFiles: { soul: true, memory: true },
  });
  assert.equal(enablePromptStudioMemory(home, 'soul'), false);
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).memory, true);
});

test('a v3 settings file gains per-file switches without losing anything', (t) => {
  const { home, path } = promptStudioHome(t, {
    version: 3,
    memory: false,
    prompt: { mode: 'only', text: 'hello' },
    defaultMode: 'pure',
  });
  assert.equal(enablePromptStudioMemory(home, 'soul'), true);
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  assert.deepEqual(saved.memoryFiles, { soul: true, memory: false });
  assert.equal(saved.memory, true);
  assert.equal(saved.prompt.text, 'hello');
  assert.equal(saved.defaultMode, 'pure');
});

test('a missing settings file is skipped instead of created', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-qq-sync-missing-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  assert.equal(enablePromptStudioMemory(home, 'memory'), false);
});
