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

    function Banner(props) {
      if (typeof props?.text !== 'string' || props.text === '') return null;
      const style = props.kind === 'error' ? S.error : props.kind === 'warn' ? S.warn : S.notice;
      return h('div', { style, role: props.kind === 'error' ? 'alert' : 'status' }, props.text);
    }

    function SettingsPage() {
      const [state, setState] = React.useState(null);
      const [path, setPath] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [securityBusy, setSecurityBusy] = React.useState(false);
      const [mediaBusy, setMediaBusy] = React.useState(false);
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
            h('span', { style: S.value }, configured !== '' ? configured : '未设置（使用桌面 profile 目录）'),
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
              h('span', { style: S.switchHint }, '/model 只显示当前模型，不列出其他模型；切换请到 DSH Desktop 宿主端。'),
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
              h('span', { style: S.switchHint }, '/preset 只显示当前预设；切换请到 DSH Desktop 宿主端。'),
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
