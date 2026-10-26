window.__ModuleLoader__.load({
  id: 'dsh-qq-workspace',
  factory: function qqWorkspaceFactory(require) {
    'use strict';
    let React = null;
    try {
      React = require('react');
    } catch {
      React = null;
    }
    if (React === null || typeof React.createElement !== 'function') {
      try {
        console.error('[dsh-qq-workspace] 无法加载 react');
      } catch {
      }
      return { inject: [], apply() {} };
    }
    const h = React.createElement;
    let primitives = null;
    try {
      primitives = require('@deepseek-ai/dsh-client-ui-primitives');
    } catch {
      primitives = null;
    }
    const HostButton = primitives?.Button ?? null;
    const ROUTE = '/qq-workspace';
    // Shared with dsh-prompt-studio's client: both settings panels edit the same
    // SOUL.md / MEMORY.md, so a save in one panel makes the other reload at once.
    const MEMORY_EVENT = 'dsh-workspace-memory:changed';
    const uiWorkspaceHolder = { service: null };

    const S = {
      root: { display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 980 },
      h2: { margin: 0, fontSize: 18, fontWeight: 600, lineHeight: '26px' },
      h3: { margin: 0, fontSize: 14, fontWeight: 600, lineHeight: '22px' },
      sub: { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-secondary, #61666b)' },
      card: {
        border: '0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.28))',
        borderRadius: 10,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.04))',
      },
      row: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      split: { display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' },
      grow: { flex: '1 1 360px', minWidth: 220 },
      label: { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary, #61666b)' },
      value: { fontSize: 13, lineHeight: '20px', wordBreak: 'break-all' },
      mono: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 12,
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-secondary, #61666b)',
        wordBreak: 'break-all',
      },
      input: {
        font: '13px/20px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        height: 34,
        padding: '0 10px',
        borderRadius: 8,
        boxSizing: 'border-box',
        width: '100%',
        outline: 'none',
        color: 'var(--dsw-alias-label-primary, inherit)',
        background: 'var(--dsw-alias-bg-layer-1, transparent)',
        border: '0.5px solid var(--dsw-alias-border-l3, rgba(127,127,127,0.4))',
      },
      select: {
        fontFamily: 'inherit',
        fontSize: 13,
        lineHeight: '20px',
        height: 34,
        padding: '0 8px',
        borderRadius: 8,
        boxSizing: 'border-box',
        outline: 'none',
        color: 'var(--dsw-alias-label-primary, inherit)',
        background: 'var(--dsw-alias-bg-layer-1, transparent)',
        border: '0.5px solid var(--dsw-alias-border-l3, rgba(127,127,127,0.4))',
      },
      textarea: {
        font: '13px/20px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        padding: '8px 10px',
        borderRadius: 8,
        boxSizing: 'border-box',
        width: '100%',
        minHeight: 140,
        resize: 'vertical',
        outline: 'none',
        color: 'var(--dsw-alias-label-primary, inherit)',
        background: 'var(--dsw-alias-bg-layer-1, transparent)',
        border: '0.5px solid var(--dsw-alias-border-l3, rgba(127,127,127,0.4))',
      },
      button: {
        font: 'inherit',
        fontSize: 13,
        height: 34,
        padding: '0 12px',
        borderRadius: 8,
        border: '0.5px solid var(--dsw-alias-border-l3, rgba(127,127,127,0.4))',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        flex: 'none',
      },
      primary: {
        border: 'none',
        background: 'var(--dsw-alias-button-primary-fill, rgba(47,124,246,0.16))',
        color: 'var(--dsw-alias-label-primary-foreground, inherit)',
      },
      notice: {
        fontSize: 13,
        lineHeight: '20px',
        padding: '7px 10px',
        borderRadius: 8,
        border: '1px solid rgba(25,184,166,0.45)',
        background: 'rgba(25,184,166,0.10)',
      },
      error: {
        fontSize: 13,
        lineHeight: '20px',
        padding: '7px 10px',
        borderRadius: 8,
        border: '1px solid rgba(220,80,80,0.5)',
        background: 'rgba(220,80,80,0.10)',
      },
      warn: {
        fontSize: 12,
        lineHeight: '18px',
        padding: '6px 9px',
        borderRadius: 8,
        border: '1px solid rgba(220,150,60,0.45)',
        background: 'rgba(220,150,60,0.10)',
      },
      empty: {
        fontSize: 12,
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-tertiary, #81858c)',
      },
      list: { display: 'flex', flexDirection: 'column' },
      switchRow: { display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 13, lineHeight: '20px' },
      switchText: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
      switchLabel: { fontWeight: 500 },
      switchHint: { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary, #61666b)' },
      item: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px 0',
        borderTop: '0.5px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.18))',
      },
      itemTitle: { fontSize: 13, lineHeight: '20px', fontWeight: 500, wordBreak: 'break-word' },
      badge: {
        fontSize: 11,
        lineHeight: '16px',
        padding: '1px 6px',
        borderRadius: 999,
        border: '1px solid rgba(127,127,127,0.4)',
        opacity: 0.85,
        whiteSpace: 'nowrap',
        flex: 'none',
      },
    };

    function ActionButton(props) {
      const { variant = 'outline', style, type = 'button', ...rest } = props;
      if (HostButton !== null) {
        try {
          return h(HostButton, {
            variant: variant === 'primary' ? 'primary' : 'outline',
            size: 'sm',
            type,
            ...rest,
            ...(style === undefined ? {} : { style }),
          });
        } catch {
        }
      }
      return h('button', {
        type,
        ...rest,
        style: { ...S.button, ...(variant === 'primary' ? S.primary : {}), ...(style ?? {}) },
      });
    }

    async function api(path, init) {
      const headers = { ...(init?.headers ?? {}), 'x-dsh-qq-workspace': '1' };
      if (init?.body !== undefined) headers['content-type'] = 'application/json';
      const response = await fetch(ROUTE + path, { ...(init ?? {}), headers });
      const text = await response.text();
      let payload = null;
      try {
        payload = text === '' ? null : JSON.parse(text);
      } catch {
        payload = null;
      }
      if (!response.ok || (payload !== null && payload.ok === false)) {
        throw new Error(payload !== null && typeof payload.message === 'string' ? payload.message : `HTTP ${response.status}`);
      }
      return payload;
    }

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function notifyMemoryChanged() {
      try {
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new Event(MEMORY_EVENT));
        }
      } catch {
      }
    }

    function Banner(props) {
      if (typeof props?.text !== 'string' || props.text === '') return null;
      const style = props.kind === 'error' ? S.error : props.kind === 'warn' ? S.warn : S.notice;
      return h('div', { style, role: props.kind === 'error' ? 'alert' : 'status' }, props.text);
    }

    function PersistentFileCard(props) {
      const { title, description, fileState, draft, busy, toggleHint, placeholder, onToggle, onDraft, onSave, onRefresh } = props;
      if (fileState === null || fileState === undefined) return null;
      return h(
        'div',
        { style: S.card },
        h('h3', { style: S.h3 }, title),
        h('p', { style: S.sub }, description),
        h(
          'label',
          { style: S.switchRow },
          h('input', {
            type: 'checkbox',
            checked: fileState.enabled === true,
            disabled: busy,
            onChange: (event) => void onToggle(event.target.checked),
            style: { marginTop: 2, flex: 'none' },
          }),
          h(
            'span',
            { style: S.switchText },
            h('span', { style: S.switchLabel }, fileState.enabled === true ? `${title}：已开启` : `${title}：已关闭`),
            h('span', { style: S.switchHint }, toggleHint),
          ),
        ),
        h(
          'div',
          { style: S.row },
          h('span', { style: S.label }, '文件'),
          h('span', { style: S.value }, fileState.exists ? `${fileState.file} · ${fileState.size} 字节` : '尚未创建（开启后自动创建模板）'),
        ),
        fileState.error ? h(Banner, { kind: 'warn', text: fileState.error }) : null,
        fileState.enabled === true && fileState.exists !== true && !fileState.error
          ? h(Banner, { kind: 'warn', text: `${fileState.file} 尚未创建；保存内容或等模型写入后会创建。` })
          : null,
        h('textarea', {
          style: S.textarea,
          value: draft ?? fileState.content ?? '',
          spellCheck: false,
          disabled: busy,
          placeholder,
          onChange: (event) => onDraft(event.target.value),
        }),
        h(
          'div',
          { style: { ...S.row, justifyContent: 'space-between' } },
          h('span', { style: S.empty }, `注入上限 ${fileState.injectedLimit} 字符；编辑上限 ${fileState.editLimit} 字符。`),
          h(
            'div',
            { style: S.row },
            h(ActionButton, { onClick: onRefresh, disabled: busy }, '刷新'),
            h(ActionButton, { variant: 'primary', onClick: onSave, disabled: busy }, busy ? '保存中…' : '保存'),
          ),
        ),
        h('p', { style: S.empty }, '不要写入密钥、密码或一次性细节。'),
      );
    }

    function SettingsPage() {
      const [state, setState] = React.useState(null);
      const [path, setPath] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [securityBusy, setSecurityBusy] = React.useState(false);
      const [mediaBusy, setMediaBusy] = React.useState(false);
      const [contextBusy, setContextBusy] = React.useState(false);
      const [memoryBusy, setMemoryBusy] = React.useState(false);
      const [soulBusy, setSoulBusy] = React.useState(false);
      const [contextForm, setContextForm] = React.useState(null);
      const [memoryDraft, setMemoryDraft] = React.useState(null);
      const [soulDraft, setSoulDraft] = React.useState(null);
      const [error, setError] = React.useState('');
      const [notice, setNotice] = React.useState('');

      const fetchState = React.useCallback(async () => {
        return await api('/state');
      }, []);

      const load = React.useCallback(async (keepPath) => {
        try {
          const next = await fetchState();
          setState(next);
          setPath((previous) => {
            if (keepPath === true && previous !== '') return previous;
            return next?.qq?.configuredCwd || next?.qq?.effectiveCwd || '';
          });
          setError('');
          return true;
        } catch (problem) {
          setError(problem?.message ?? String(problem));
          return false;
        }
      }, [fetchState]);

      React.useEffect(() => {
        void load(false);
      }, [load]);

      React.useEffect(() => {
        if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined;
        const reload = () => void load(true);
        window.addEventListener(MEMORY_EVENT, reload);
        window.addEventListener('focus', reload);
        return () => {
          window.removeEventListener(MEMORY_EVENT, reload);
          window.removeEventListener('focus', reload);
        };
      }, [load]);

      const context = state?.context ?? null;
      const memory = context?.memory ?? null;
      const soul = context?.soul ?? null;

      React.useEffect(() => {
        if (context === null || contextForm !== null) return;
        setContextForm({
          enabled: context.enabled === true,
          percentEnabled: context.percentEnabled !== false,
          percent: context.percent ?? 80,
          turnsEnabled: context.turnsEnabled === true,
          turns: context.turns ?? 20,
          retainMode: context.retainMode === 'custom' ? 'custom' : 'default',
          retainPercent: context.retainPercent ?? 15,
        });
      }, [context, contextForm]);

      // The textareas keep the user's unsaved edits, but they must follow the
      // file on disk (the other plugin's panel or the model can rewrite it).
      // A draft that was never edited tracks the server; an edited one stays.
      const memoryBase = React.useRef('');
      const soulBase = React.useRef('');

      React.useEffect(() => {
        if (memory === null) return;
        const content = memory.content ?? '';
        setMemoryDraft((previous) => (previous === null || previous === memoryBase.current ? content : previous));
        memoryBase.current = content;
      }, [memory]);

      React.useEffect(() => {
        if (soul === null) return;
        const content = soul.content ?? '';
        setSoulDraft((previous) => (previous === null || previous === soulBase.current ? content : previous));
        soulBase.current = content;
      }, [soul]);

      const pick = async () => {
        setError('');
        setNotice('');
        const picker = uiWorkspaceHolder.service;
        if (picker === null || typeof picker?.pickDirectory !== 'function') {
          setError('当前环境不支持系统文件夹选择，请手动填写绝对路径。');
          return;
        }
        try {
          const picked = await picker.pickDirectory();
          if (typeof picked === 'string' && picked.trim() !== '') {
            setPath(picked.trim());
            setNotice(`已选择：${picked.trim()}`);
          }
        } catch (problem) {
          setError(`打开文件夹选择器失败：${problem?.message ?? String(problem)}`);
        }
      };

      const updateSecurity = async (patch) => {
        if (securityBusy) return;
        setSecurityBusy(true);
        setError('');
        setNotice('');
        try {
          await api('/security', {
            method: 'POST',
            body: JSON.stringify(patch),
          });
          setNotice('安全锁设置已更新。');
          await load(true);
        } catch (problem) {
          setError(`安全锁设置失败：${problem?.message ?? String(problem)}`);
        } finally {
          setSecurityBusy(false);
        }
      };

      const updateMediaRetention = async (retainForever) => {
        if (mediaBusy) return;
        setMediaBusy(true);
        setError('');
        setNotice('');
        try {
          await api('/media', {
            method: 'POST',
            body: JSON.stringify({ retainForever }),
          });
          setNotice(retainForever ? '已设为长期保留：QQ 插件会热重载，上传文件不再自动清理。' : '已恢复 24 小时自动清理：QQ 插件会热重载。');
          await sleep(900);
          await load(true);
        } catch (problem) {
          setError(`设置上传保留失败：${problem?.message ?? String(problem)}`);
        } finally {
          setMediaBusy(false);
        }
      };

      const updateContextForm = (patch) => {
        setContextForm((previous) => ({ ...(previous ?? {}), ...patch }));
        setNotice('');
      };

      const saveContext = async () => {
        if (contextBusy || contextForm === null) return;
        setContextBusy(true);
        setError('');
        setNotice('');
        try {
          const numberOr = (value, fallback) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
          };
          const payload = {
            ...contextForm,
            percent: numberOr(contextForm.percent, 80),
            turns: numberOr(contextForm.turns, 20),
            retainPercent: numberOr(contextForm.retainPercent, 15),
          };
          const result = await api('/context', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          const next = result?.context ?? null;
          if (next !== null) {
            setContextForm({
              enabled: next.enabled === true,
              percentEnabled: next.percentEnabled !== false,
              percent: next.percent ?? 80,
              turnsEnabled: next.turnsEnabled === true,
              turns: next.turns ?? 20,
              retainMode: next.retainMode === 'custom' ? 'custom' : 'default',
              retainPercent: next.retainPercent ?? 15,
            });
          }
          setNotice('上下文管理设置已保存。');
          await load(true);
        } catch (problem) {
          setError(`保存上下文设置失败：${problem?.message ?? String(problem)}`);
        } finally {
          setContextBusy(false);
        }
      };

      const updateMemoryEnabled = async (enabled) => {
        if (memoryBusy) return;
        setMemoryBusy(true);
        setError('');
        setNotice('');
        try {
          await api('/memory', {
            method: 'POST',
            body: JSON.stringify({ enabled }),
          });
          setNotice(enabled ? '长期记忆已开启。' : '长期记忆已关闭；MEMORY.md 不会被删除。');
          setMemoryDraft(null);
          await load(true);
          notifyMemoryChanged();
        } catch (problem) {
          setError(`设置长期记忆失败：${problem?.message ?? String(problem)}`);
        } finally {
          setMemoryBusy(false);
        }
      };

      const saveMemory = async () => {
        if (memoryBusy) return;
        setMemoryBusy(true);
        setError('');
        setNotice('');
        try {
          const result = await api('/memory', {
            method: 'POST',
            body: JSON.stringify({ content: memoryDraft ?? '' }),
          });
          const next = result?.context?.memory ?? null;
          setMemoryDraft(next?.content ?? memoryDraft ?? '');
          setNotice('长期记忆已保存。');
          await load(true);
          notifyMemoryChanged();
        } catch (problem) {
          setError(`保存长期记忆失败：${problem?.message ?? String(problem)}`);
        } finally {
          setMemoryBusy(false);
        }
      };

      const refreshMemory = async () => {
        setMemoryDraft(null);
        setNotice('');
        setError('');
        await load(true);
      };

      const updateSoulEnabled = async (enabled) => {
        if (soulBusy) return;
        setSoulBusy(true);
        setError('');
        setNotice('');
        try {
          await api('/soul', {
            method: 'POST',
            body: JSON.stringify({ enabled }),
          });
          setNotice(enabled ? '人格 SOUL.md 已开启。' : '人格 SOUL.md 已关闭；文件不会被删除。');
          setSoulDraft(null);
          await load(true);
          notifyMemoryChanged();
        } catch (problem) {
          setError(`设置人格 SOUL.md 失败：${problem?.message ?? String(problem)}`);
        } finally {
          setSoulBusy(false);
        }
      };

      const saveSoul = async () => {
        if (soulBusy) return;
        setSoulBusy(true);
        setError('');
        setNotice('');
        try {
          const result = await api('/soul', {
            method: 'POST',
            body: JSON.stringify({ content: soulDraft ?? '' }),
          });
          const next = result?.context?.soul ?? null;
          setSoulDraft(next?.content ?? soulDraft ?? '');
          setNotice('人格 SOUL.md 已保存。');
          await load(true);
          notifyMemoryChanged();
        } catch (problem) {
          setError(`保存人格 SOUL.md 失败：${problem?.message ?? String(problem)}`);
        } finally {
          setSoulBusy(false);
        }
      };

      const refreshSoul = async () => {
        setSoulDraft(null);
        setNotice('');
        setError('');
        await load(true);
      };

      const apply = async () => {
        if (busy) return;
        const target = path.trim();
        if (target === '') {
          setError('请填写工作目录的绝对路径。');
          return;
        }
        const candidates = Array.isArray(state?.candidates) ? state.candidates : [];
        if (candidates.length > 0 && typeof window !== 'undefined' && typeof window.confirm === 'function') {
          const lines = candidates.slice(0, 12).map((item) => `• ${item.title} (${String(item.id).slice(0, 8)}…)`);
          const more = candidates.length > 12 ? `\n… 共 ${candidates.length} 个` : '';
          const confirmed = window.confirm(
            `应用后将：\n1. 把 QQ 机器人工作目录切换到 ${target}\n2. 把以下 ${candidates.length} 个旧 QQ 会话移入回收站（不会动其他对话和文件）\n\n${lines.join('\n')}${more}\n\n继续？`,
          );
          if (confirmed !== true) return;
        }
        setBusy(true);
        setError('');
        setNotice('');
        try {
          const result = await api('/apply', {
            method: 'POST',
            body: JSON.stringify({ path: target }),
          });
          const applied = result?.applied ?? {};
          if (applied.workspaceError) {
            setError(`目录已切换，但创建工作区失败：${applied.workspaceError}`);
          } else if (applied.prefsReset === false) {
            setError(applied.message ?? '目录已切换，但重置 QQ 会话失败。');
          } else if (applied.media?.linked === false) {
            setError(`目录已切换，但 QQ 上传目录映射失败：${applied.media.error || '未知错误'}`);
          } else {
            setNotice(applied.message ?? '已保存。');
          }
          setPath(applied.path ?? target);
          for (let attempt = 0; attempt < 4; attempt += 1) {
            await sleep(attempt === 0 ? 900 : 1200);
            const loaded = await load(true);
            if (loaded) break;
          }
        } catch (problem) {
          setError(`应用失败：${problem?.message ?? String(problem)}`);
        } finally {
          setBusy(false);
        }
      };

      const candidates = Array.isArray(state?.candidates) ? state.candidates : [];
      const workspace = state?.workspace ?? null;
      const configured = state?.qq?.configuredCwd ?? '';
      const security = state?.security ?? null;
      const media = state?.media ?? null;

      return h(
        'div',
        { style: S.root, 'data-plugin': 'dsh-qq-workspace' },
        h('h2', { style: S.h2 }, 'QQ 工作区'),
        h(
          'p',
          { style: S.sub },
          '给 QQ 机器人会话指定独立工作目录，并在侧栏创建/复用对应工作区。应用后 QQ 插件会自动重载，下一条 QQ 消息在指定目录新建会话。',
        ),
        h(Banner, { kind: 'error', text: error }),
        h(Banner, { kind: 'notice', text: notice }),

        h(
          'div',
          { style: S.card },
          h('h3', { style: S.h3 }, '当前状态'),
          h(
            'div',
            { style: S.row },
            h('span', { style: S.label }, 'QQ 插件配置目录'),
            h('span', { style: S.value }, configured !== '' ? configured : '未设置（使用当前 profile 目录）'),
          ),
          h(
            'div',
            { style: S.row },
            h('span', { style: S.label }, '侧栏工作区'),
            h(
              'span',
              { style: S.value },
              workspace !== null ? `${workspace.title} · ${workspace.path}` : '尚未创建（应用后自动创建）',
            ),
          ),
          state?.targetExists === false && configured !== ''
            ? h(Banner, { kind: 'warn', text: '当前配置的目录不存在；应用新目录后会自动创建。' })
            : null,
          state?.pending > 0
            ? h(Banner, { kind: 'warn', text: `还有 ${state.pending} 个旧 QQ 会话等待移入回收站（宿主会在会话释放后重试）。` })
            : null,
        ),

        h(
          'div',
          { style: S.card },
          h('h3', { style: S.h3 }, '安全锁'),
          h(
            'label',
            { style: S.switchRow },
            h('input', {
              type: 'checkbox',
              checked: security?.enabled === true,
              disabled: securityBusy,
              onChange: (event) => void updateSecurity({ enabled: event.target.checked }),
              style: { marginTop: 2, flex: 'none' },
              'data-qq-workspace-security': '1',
            }),
            h(
              'span',
              { style: S.switchText },
              h('span', { style: S.switchLabel }, security?.enabled === true ? '总开关：已开启（仅 QQ 会话）' : '总开关：已关闭'),
              h('span', { style: S.switchHint }, '只锁定 QQ Bot 自动创建的会话；你自己的会话不受影响。'),
            ),
          ),
          h(
            'label',
            { style: { ...S.switchRow, paddingLeft: 22 } },
            h('input', {
              type: 'checkbox',
              checked: security?.core !== false,
              disabled: security?.enabled !== true || securityBusy,
              onChange: (event) => void updateSecurity({ core: event.target.checked }),
              style: { marginTop: 2, flex: 'none' },
            }),
            h(
              'span',
              { style: S.switchText },
              h('span', { style: S.switchLabel }, '核心保护：文件 / 工具 / 路径 / 环境'),
              h('span', { style: S.switchHint }, '限制 QQ 会话只能访问工作区，禁用危险工具，并隐藏绝对路径、父目录和环境信息。'),
            ),
          ),
          h(
            'label',
            { style: { ...S.switchRow, paddingLeft: 22 } },
            h('input', {
              type: 'checkbox',
              checked: security?.allowWeb === false,
              disabled: security?.enabled !== true || security?.core === false || securityBusy,
              onChange: (event) => void updateSecurity({ allowWeb: !event.target.checked }),
              style: { marginTop: 2, flex: 'none' },
            }),
            h(
              'span',
              { style: S.switchText },
              h('span', { style: S.switchLabel }, '禁止联网（网页搜索 / 打开网页）'),
              h('span', { style: S.switchHint }, `勾选后禁止 QQ 会话使用 web_search 和 web_fetch；取消勾选允许访问公网 HTTP(S)。当前：${security?.allowWeb === false ? '已禁止' : '允许联网'}。核心保护开启时生效。`),
            ),
          ),
          h(
            'label',
            { style: { ...S.switchRow, paddingLeft: 22 } },
            h('input', {
              type: 'checkbox',
              checked: security?.blockModelSwitch !== false,
              disabled: security?.enabled !== true || securityBusy,
              onChange: (event) => void updateSecurity({ blockModelSwitch: event.target.checked }),
              style: { marginTop: 2, flex: 'none' },
            }),
            h(
              'span',
              { style: S.switchText },
              h('span', { style: S.switchLabel }, '禁止 QQ 切换模型'),
              h('span', { style: S.switchHint }, '/model 只显示当前模型，不列出其他模型；切换请到 DSH 宿主端（Desktop / Web）。'),
            ),
          ),
          h(
            'label',
            { style: { ...S.switchRow, paddingLeft: 22 } },
            h('input', {
              type: 'checkbox',
              checked: security?.blockPresetSwitch !== false,
              disabled: security?.enabled !== true || securityBusy,
              onChange: (event) => void updateSecurity({ blockPresetSwitch: event.target.checked }),
              style: { marginTop: 2, flex: 'none' },
            }),
            h(
              'span',
              { style: S.switchText },
              h('span', { style: S.switchLabel }, '禁止 QQ 切换预设'),
              h('span', { style: S.switchHint }, '/preset 只显示当前预设；切换请到 DSH 宿主端（Desktop / Web）。'),
            ),
          ),
          security?.enabled === true && security?.core !== false
            ? h(Banner, { kind: 'notice', text: `核心保护已开启；已登记 ${security.lockedCount ?? 0} 个 QQ 会话。工作区内的文件对该 QQ 会话可见，请勿放入密钥；也不要运行 QQ 生成的可执行文件或脚本。` })
            : security?.enabled === true
              ? h(Banner, { kind: 'warn', text: '核心保护已关闭：QQ 会话可以访问工作区外的文件和环境信息。' })
              : h(Banner, { kind: 'warn', text: '安全锁已关闭：QQ 会话仍按正常权限运行。' }),
          security?.guardReady === false
            ? h(Banner, { kind: 'error', text: '安全锁工具守卫未初始化：QQ 会话的工具已按故障安全策略关闭。请重启 DSH；若仍失败，请检查宿主版本与新接口是否兼容。' })
            : null,
          state?.commandPatch?.changed === true
            ? h(Banner, { kind: 'warn', text: 'QQ 命令拦截补丁已写入，需要重启 DSH 后才会拦截 /model 和 /preset。' })
            : (security?.enabled === true && (security?.blockModelSwitch !== false || security?.blockPresetSwitch !== false)
              && state?.commandPatch?.patched !== true)
              ? h(Banner, { kind: 'warn', text: `QQ 命令拦截补丁未安装，/model 和 /preset 暂不会被拦截。${state?.commandPatch?.error ? ` ${state.commandPatch.error}` : ''}` })
              : null,
        ),

        h(
          'div',
          { style: S.card },
          h('h3', { style: S.h3 }, 'QQ 上传文件'),
          h(
            'div',
            { style: S.row },
            h('span', { style: S.label }, '上传目录'),
            h('span', { style: S.value }, media?.linked === true ? `工作区 ${media.dir}/` : '未映射到工作区'),
          ),
          h(
            'label',
            { style: S.switchRow },
            h('input', {
              type: 'checkbox',
              checked: media?.retainForever === true,
              disabled: mediaBusy,
              onChange: (event) => void updateMediaRetention(event.target.checked),
              style: { marginTop: 2, flex: 'none' },
            }),
            h(
              'span',
              { style: S.switchText },
              h('span', { style: S.switchLabel }, '长期保留上传文件'),
              h('span', { style: S.switchHint }, `开启后写入 im-qqbot.config.media.ttlHours = 0，不自动清理；关闭时按 24 小时清理。当前：${media?.retainForever === true ? '长期保留' : `${media?.ttlHours ?? 24} 小时`}。修改后 QQ 插件会热重载。`),
            ),
          ),
          media?.linked === false
            ? h(Banner, { kind: 'warn', text: `QQ 上传目录未能映射到工作区：${media.error || '未知错误'}。图片/文件仍会被安全锁拦截。` })
            : null,
          media?.linked === true && media?.retainForever === true
            ? h(Banner, { kind: 'notice', text: '上传文件会一直保留在 qq-uploads/；记得定期手动清理不需要的文件。' })
            : null,
        ),

        h(
          'div',
          { style: S.card },
          h('h3', { style: S.h3 }, '上下文管理'),
          h('p', { style: S.sub }, '只作用于 QQ 工作区会话；你自己的普通会话继续使用 DSH 内建压缩。'),
          h(
            'label',
            { style: S.switchRow },
            h('input', {
              type: 'checkbox',
              checked: contextForm?.enabled === true,
              disabled: contextBusy || contextForm === null,
              onChange: (event) => updateContextForm({ enabled: event.target.checked }),
              style: { marginTop: 2, flex: 'none' },
            }),
            h(
              'span',
              { style: S.switchText },
              h('span', { style: S.switchLabel }, '启用自动上下文压缩'),
              h('span', { style: S.switchHint }, '满足下面任一触发条件后，在下一次模型请求前把较早的完整轮次总结成一条摘要。'),
            ),
          ),
          h(
            'div',
            { style: { ...S.row, paddingLeft: 22 } },
            h(
              'label',
              { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 } },
              h('input', {
                type: 'checkbox',
                checked: contextForm?.percentEnabled === true,
                disabled: contextBusy || contextForm?.enabled !== true,
                onChange: (event) => updateContextForm({ percentEnabled: event.target.checked }),
                style: { flex: 'none' },
              }),
              '按上下文比例触发',
            ),
            h('input', {
              type: 'number',
              min: 1,
              max: 100,
              step: 1,
              style: { ...S.input, width: 96, flex: 'none' },
              value: contextForm?.percent ?? 80,
              disabled: contextBusy || contextForm?.enabled !== true || contextForm?.percentEnabled !== true,
              onChange: (event) => updateContextForm({ percent: event.target.value }),
            }),
            h('span', { style: S.label }, '% 模型上下文窗口'),
          ),
          h(
            'div',
            { style: { ...S.row, paddingLeft: 22 } },
            h(
              'label',
              { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 } },
              h('input', {
                type: 'checkbox',
                checked: contextForm?.turnsEnabled === true,
                disabled: contextBusy || contextForm?.enabled !== true,
                onChange: (event) => updateContextForm({ turnsEnabled: event.target.checked }),
                style: { flex: 'none' },
              }),
              '按对话轮数触发',
            ),
            h('input', {
              type: 'number',
              min: 1,
              max: 1000,
              step: 1,
              style: { ...S.input, width: 96, flex: 'none' },
              value: contextForm?.turns ?? 20,
              disabled: contextBusy || contextForm?.enabled !== true || contextForm?.turnsEnabled !== true,
              onChange: (event) => updateContextForm({ turns: event.target.value }),
            }),
            h('span', { style: S.label }, '轮后压缩'),
          ),
          h(
            'div',
            { style: { ...S.row, paddingLeft: 22 } },
            h('span', { style: S.label }, '保留最近上下文'),
            h(
              'select',
              {
                style: S.select,
                value: contextForm?.retainMode ?? 'default',
                disabled: contextBusy || contextForm?.enabled !== true,
                onChange: (event) => updateContextForm({ retainMode: event.target.value }),
              },
              h('option', { value: 'default' }, '默认 15%'),
              h('option', { value: 'custom' }, '自定义'),
            ),
            h('input', {
              type: 'number',
              min: 0,
              max: 50,
              step: 1,
              style: { ...S.input, width: 96, flex: 'none' },
              value: contextForm?.retainPercent ?? 15,
              disabled: contextBusy || contextForm?.enabled !== true || contextForm?.retainMode !== 'custom',
              onChange: (event) => updateContextForm({ retainPercent: event.target.value }),
            }),
            h('span', { style: S.label }, '% 当前上下文'),
          ),
          h(
            'div',
            { style: { ...S.row, justifyContent: 'flex-end' } },
            h(ActionButton, {
              variant: 'primary',
              onClick: saveContext,
              disabled: contextBusy || contextForm === null,
            }, contextBusy ? '保存中…' : '保存上下文设置'),
          ),
          h(
            'p',
            { style: S.empty },
            '触发比例默认 80%，保留比例默认 15%。DSH 会为输出和摘要预留空间，小窗口模型的实际触发点可能早于设定比例。压缩使用当前会话模型，会产生一次额外模型请求；最近一轮始终保留。',
          ),
          state !== null && context === null
            ? h(Banner, { kind: 'warn', text: `上下文管理服务尚未加载${state.contextError ? `：${state.contextError}` : '；请重启 DSH 或检查插件加载日志。'}` })
            : null,
          context?.ready === false
            ? h(Banner, { kind: 'error', text: `上下文压缩不可用：${context.lastError || '宿主未提供 tokenMeter 服务'}` })
            : null,
          context?.ready === true && context?.enabled === true && context?.services?.compaction !== true
            ? h(Banner, { kind: 'notice', text: '压缩服务由当前 agent preset 提供，将在首次 QQ 会话时自动检测。' })
            : null,
          context?.enabled === true && context?.percentEnabled !== true && context?.turnsEnabled !== true
            ? h(Banner, { kind: 'warn', text: '已开启总开关，但没有勾选任何触发条件，QQ 会话不会自动压缩。' })
            : null,
          context?.lastError && context?.ready !== false
            ? h(Banner, { kind: 'warn', text: context.lastError })
            : null,
          context?.last
            ? h(
                'p',
                { style: S.mono },
                `上次压缩：${context.last.at} · ${context.last.compactedTurns} 轮 → 保留 ${context.last.retainedTurns} 轮 · 约 ${context.last.shadowedTokens} tokens`,
              )
            : null,
        ),

        h(PersistentFileCard, {
          title: '人格 SOUL.md',
          description: '开启后每轮把 QQ 工作区的 SOUL.md 注入系统提示，用来定义助手的语气、风格、价值观和边界。',
          fileState: soul,
          draft: soulDraft,
          busy: soulBusy,
          toggleHint: '只在你明确要求时让模型修改人格；关闭不会删除文件。',
          placeholder: '# SOUL.md\n\n- 语气与风格…\n- 价值观…\n- 行为边界…',
          onToggle: updateSoulEnabled,
          onDraft: (value) => {
            setSoulDraft(value);
            setNotice('');
          },
          onSave: saveSoul,
          onRefresh: refreshSoul,
        }),

        h(PersistentFileCard, {
          title: '长期记忆 MEMORY.md',
          description: '开启后每轮把 QQ 工作区的 MEMORY.md 注入系统提示；上下文压缩不会清掉它。',
          fileState: memory,
          draft: memoryDraft,
          busy: memoryBusy,
          toggleHint: '模型会在学到长期偏好、项目背景或重要决定时更新 MEMORY.md；你也可以直接编辑。',
          placeholder: '# MEMORY.md\n\n- 用户偏好…\n- 项目背景…',
          onToggle: updateMemoryEnabled,
          onDraft: (value) => {
            setMemoryDraft(value);
            setNotice('');
          },
          onSave: saveMemory,
          onRefresh: refreshMemory,
        }),

        h(
          'div',
          { style: S.card },
          h('h3', { style: S.h3 }, '修改 QQ 工作目录'),
          h('span', { style: S.label }, '绝对路径（不存在会自动创建）'),
          h(
            'div',
            { style: S.split },
            h('input', {
              style: { ...S.input, ...S.grow },
              value: path,
              placeholder: 'D:\\qq-workspace',
              spellCheck: false,
              disabled: busy,
              onChange: (event) => {
                setPath(event.target.value);
                setNotice('');
              },
              onKeyDown: (event) => {
                if (event.key === 'Enter') void apply();
              },
              'data-qq-workspace-path': '1',
            }),
            h(ActionButton, { onClick: pick, disabled: busy }, '选择文件夹'),
            h(ActionButton, { variant: 'primary', onClick: apply, disabled: busy }, busy ? '应用…' : '应用'),
          ),
          h(
            'p',
            { style: S.empty },
            '旧 QQ 会话会移入回收站而不是直接删除；你其他的对话和目录内文件不会被改动。',
          ),
        ),

        h(
          'div',
          { style: S.card },
          h('h3', { style: S.h3 }, '旧 QQ 会话'),
          candidates.length === 0
            ? h('span', { style: S.empty }, '没有检测到需要清理的旧 QQ 会话。')
            : h(
                'div',
                { style: S.list },
                candidates.map((item) => h(
                  'div',
                  { key: item.id, style: S.item },
                  h(
                    'div',
                    { style: S.row },
                    h('span', { style: S.itemTitle }, item.title),
                    item.active ? h('span', { style: S.badge }, '运行中') : null,
                    h('span', { style: S.badge }, item.source === 'prefs' ? 'QQ 当前会话' : 'QQ 历史会话'),
                  ),
                  h('span', { style: S.mono }, `${item.id} · ${item.cwd || '(无 cwd)'}`),
                )),
              ),
        ),

        h(
          'p',
          { style: S.mono },
          `回收站：${state?.trashRoot ?? '~/.dsh/qq-workspace/trash'}`,
        ),
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        try {
          uiWorkspaceHolder.service = typeof ctx.get === 'function'
            ? (ctx.get('uiWorkspace') ?? ctx.uiWorkspace ?? null)
            : (ctx.uiWorkspace ?? null);
        } catch {
          uiWorkspaceHolder.service = null;
        }
        try {
          if (typeof ctx.inject === 'function') {
            ctx.inject(['uiWorkspace'], (scoped) => {
              uiWorkspaceHolder.service = scoped?.uiWorkspace ?? uiWorkspaceHolder.service;
            });
          }
        } catch {
        }
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            { name: 'settings.section', id: 'qq-workspace', order: 8, label: 'QQ 工作区' },
            SettingsPage,
          ));
      },
    };
  },
});
