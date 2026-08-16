/**
 * 设置页（settings.section 插槽）：设置 → 消费洞察，在线编辑 provider /
 * 价格表 / 预算，保存时按字段写入 settings 命名空间（schema 校验，revision 围栏）。
 *
 * 数据链路：host 半边用 installSettingsSection 注册命名空间（cordis.yml 配置是
 * base 层），本页通过 settingsScope 绑定同名命名空间；draft 只进本地状态，
 * 保存是唯一写入点（整字段 set）。命名空间未对 Web 暴露时（harness 的
 * WEB_SETTINGS_NAMESPACES 白名单）渲染说明卡而不是消失。
 * 样式与内置 Models 设置页同一套面板语言（cis-*，见 styles.ts）。
 * @module dsh-plugin-cost-insight/client/settings-page
 */

import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { NAMESPACE } from './constants.ts'
import type { SettingsScopeLike } from './types.ts'
import type { BalanceProviderConfig } from '../balance.ts'
import type { BudgetConfig, ModelPrice, PricingConfig } from '../cost.ts'

/** 页内草稿：命名空间解析值（Config）的可编辑子集。 */
interface ConfigDraft {
  providers: BalanceProviderConfig[]
  pricing: PricingConfig
  budget: BudgetConfig
}

/** 价格表编辑用的行（Record 转数组便于增删）。 */
interface ModelRow {
  model: string
  price: ModelPrice
}

/** 在 `settings.section` 插槽注册"消费洞察"设置页。 */
export function registerSettingsPage(ctx: Context, scope: SettingsScopeLike): void {
  ctx.slots.inject('settings.section', () => ctx.slots.register(
    { name: 'settings.section', id: NAMESPACE, order: 30, label: '消费洞察' },
    () => React.createElement(SettingsPage, { scope }),
  ))
}

/** 从命名空间解析值克隆草稿（缺省回退到空结构，保存时由 schema 兜底）。 */
function cloneDraft(value: unknown): ConfigDraft {
  const config = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  const pricing = typeof config.pricing === 'object' && config.pricing !== null
    ? config.pricing as PricingConfig
    : { defaultModel: 'deepseek-chat', multiplier: 1, currency: 'CNY', models: {} }
  const budget = typeof config.budget === 'object' && config.budget !== null
    ? config.budget as BudgetConfig
    : {}
  return {
    providers: Array.isArray(config.providers) ? config.providers as BalanceProviderConfig[] : [],
    pricing,
    budget,
  }
}

/** 设置页主体：状态机 = 未暴露/读取中 → 表单。 */
function SettingsPage({ scope }: { scope: SettingsScopeLike }): React.ReactElement | null {
  const subscribe = React.useMemo(() => scope.subscribe.bind(scope), [scope])
  const snapshot = React.useSyncExternalStore(subscribe, scope.getSnapshot.bind(scope))
  const [draft, setDraft] = React.useState<ConfigDraft | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    if (snapshot.status === 'ready' && draft === null) setDraft(cloneDraft(snapshot.value))
  }, [snapshot, draft])

  if (snapshot.status !== 'ready' || draft === null) {
    if (snapshot.status === 'unavailable') {
      return statusCard(
        `命名空间 ${NAMESPACE} 未对 Web 暴露`,
        'harness 的 Web 网关只向设置面板暴露白名单内的 settings 命名空间（WEB_SETTINGS_NAMESPACES，'
        + '见 packages/host/apiproxy/src/api-proxy.ts），本命名空间不在名单里，设置页只读。',
        '要让本页可编辑：在 harness 的 WEB_SETTINGS_NAMESPACES 里加一行 '
        + `${NAMESPACE} 后重建/重启 harness；或等 harness 把暴露声明移进 settings.register()。`,
      )
    }
    return statusCard('正在读取配置…', '命名空间数据到达后本页自动可编辑。')
  }

  const update = (patch: Partial<ConfigDraft>): void => {
    setDraft(current => current === null ? current : { ...current, ...patch })
    setFailed(false)
  }
  const updateProvider = (index: number, patch: Partial<BalanceProviderConfig>): void => {
    update({ providers: draft.providers.map((p, i) => i === index ? { ...p, ...patch } : p) })
  }
  const updateModel = (index: number, patch: Partial<ModelRow>): void => {
    const rows = modelsToRows(draft.pricing.models)
    const next = rows.map((r, i) => i === index ? { ...r, ...patch } : r)
    update({ pricing: { ...draft.pricing, models: rowsToModels(next) } })
  }

  const save = async (): Promise<void> => {
    if (saving) return
    setSaving(true)
    setFailed(false)
    let ok = true
    for (const [field, value] of [
      ['providers', draft.providers],
      ['pricing', draft.pricing],
      ['budget', draft.budget],
    ] as const) {
      try {
        await scope.set(field, value)
      } catch {
        ok = false
      }
    }
    setSaving(false)
    setFailed(!ok)
  }

  return React.createElement(
    'div',
    { className: 'cis-page' },
    React.createElement('h2', { className: 'cis-title' }, '消费洞察'),
    React.createElement('p', { className: 'cis-intro' }, '余额查询与会话费用估算：provider 用 cc-switch 式模板（request + extractor JS），价格按每 1M token 计价。改动保存在 设置 → 消费洞察 命名空间，立即生效。'),
    !snapshot.writable
      ? React.createElement('p', { className: 'cis-notice' }, '当前设置文档只读（memory 模式或只读 provider），改动无法保存。')
      : null,

    React.createElement(
      'section',
      { className: 'cis-section' },
      React.createElement('h3', { className: 'cis-section-title' }, '余额 Provider'),
      React.createElement('p', { className: 'cis-section-hint' }, '占位符 {{baseUrl}} / {{apiKey}} 在请求时替换；extractor 接收 JSON 响应，返回 { isValid, remaining, unit }。'),
      React.createElement(
        'ul',
        { className: 'cis-card-list' },
        draft.providers.map((provider, index) => React.createElement(ProviderCard, {
          key: provider.name || `provider-${index}`,
          provider,
          index,
          onChange: (patch) => updateProvider(index, patch),
          onRemove: () => update({ providers: draft.providers.filter((_, i) => i !== index) }),
        })),
      ),
      React.createElement('button', {
        type: 'button',
        className: 'cis-btn cis-btn-add',
        onClick: () => update({ providers: [...draft.providers, emptyProvider()] }),
      }, '＋ 添加 provider'),
    ),

    React.createElement(
      'section',
      { className: 'cis-section' },
      React.createElement('h3', { className: 'cis-section-title' }, '价格表（会话费用估算）'),
      React.createElement('p', { className: 'cis-section-hint' }, '价格按每 1M token 计，乘以倍率；估算按默认模型计价（token 投影不含模型信息）。'),
      React.createElement(
        'div',
        { className: 'cis-editor' },
        React.createElement(
          'div',
          { className: 'cis-grid' },
          field('默认模型', React.createElement('input', {
            className: 'cis-input',
            value: draft.pricing.defaultModel,
            onChange: (e) => update({ pricing: { ...draft.pricing, defaultModel: inputValue(e) } }),
          })),
          field('倍率', React.createElement('input', {
            className: 'cis-input',
            type: 'number',
            step: '0.01',
            value: String(draft.pricing.multiplier),
            onChange: (e) => update({ pricing: { ...draft.pricing, multiplier: Number(inputValue(e)) || 0 } }),
          })),
          field('货币', React.createElement('input', {
            className: 'cis-input',
            value: draft.pricing.currency,
            onChange: (e) => update({ pricing: { ...draft.pricing, currency: inputValue(e) } }),
          })),
        ),
        React.createElement(
          'div',
          { className: 'cis-table' },
          React.createElement(
            'div',
            { className: 'cis-table-head', 'aria-hidden': 'true' },
            React.createElement('span', null, '模型'),
            React.createElement('span', null, '输入'),
            React.createElement('span', null, '缓存读'),
            React.createElement('span', null, '缓存写'),
            React.createElement('span', null, '输出'),
            React.createElement('span', null),
          ),
          modelsToRows(draft.pricing.models).map((row, index) => React.createElement(ModelRow, {
            key: row.model || `model-${index}`,
            row,
            onChange: (patch) => updateModel(index, patch),
            onRemove: () => {
              const rows = modelsToRows(draft.pricing.models).filter((_, i) => i !== index)
              update({ pricing: { ...draft.pricing, models: rowsToModels(rows) } })
            },
          })),
        ),
        React.createElement('button', {
          type: 'button',
          className: 'cis-btn cis-btn-add',
          onClick: () => {
            const rows = [...modelsToRows(draft.pricing.models), { model: '', price: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 } }]
            update({ pricing: { ...draft.pricing, models: rowsToModels(rows) } })
          },
        }, '＋ 添加模型'),
      ),
    ),

    React.createElement(
      'section',
      { className: 'cis-section' },
      React.createElement('h3', { className: 'cis-section-title' }, '预算'),
      React.createElement('p', { className: 'cis-section-hint' }, '超过单会话上限时，账单条与花费徽标变警示色。'),
      React.createElement(
        'div',
        { className: 'cis-editor' },
        field('单会话上限（留空 = 不限）', React.createElement('input', {
          className: 'cis-input',
          type: 'number',
          step: '0.01',
          value: draft.budget.perSession === undefined ? '' : String(draft.budget.perSession),
          onChange: (e) => {
            const text = inputValue(e)
            update({ budget: text === '' ? {} : { perSession: Number(text) } })
          },
        })),
      ),
    ),

    React.createElement(
      'div',
      { className: 'cis-footer' },
      failed ? React.createElement('span', { className: 'cis-strip-error' }, '保存失败（schema 校验或写冲突），请检查后重试') : null,
      React.createElement('button', {
        type: 'button',
        className: 'cis-btn',
        disabled: saving,
        onClick: () => setDraft(cloneDraft(snapshot.value)),
      }, '放弃'),
      React.createElement('button', {
        type: 'button',
        className: 'cis-btn cis-btn-primary',
        disabled: saving,
        onClick: () => { void save() },
      }, saving ? '保存中…' : '保存'),
    ),
  )
}

// ---- 子组件 ----

/** 一个 provider 的编辑卡片：标题行 + 填充编辑器面。 */
function ProviderCard(props: {
  provider: BalanceProviderConfig
  index: number
  onChange: (patch: Partial<BalanceProviderConfig>) => void
  onRemove: () => void
}): React.ReactElement {
  const { provider, index, onChange, onRemove } = props
  const headersText = Object.entries(provider.request.headers ?? {})
    .map(([key, value]) => `${key}: ${value}`).join('\n')
  const keyMissing = provider.apiKey.trim() === '' || provider.apiKey.trim() === 'sk-xxx'
  return React.createElement(
    'li',
    { className: 'cis-card' },
    React.createElement(
      'div',
      { className: 'cis-card-head' },
      React.createElement('span', { className: 'cis-card-title' }, provider.name || `Provider ${index + 1}`),
      React.createElement('span', { className: 'cis-card-tag' }, 'cc-switch 模板'),
      React.createElement('button', {
        type: 'button',
        className: 'cis-btn cis-btn-sm cis-btn-danger',
        onClick: onRemove,
      }, '删除'),
    ),
    React.createElement(
      'div',
      { className: 'cis-editor' },
      React.createElement(
        'div',
        { className: 'cis-grid' },
        field('名称', React.createElement('input', {
          className: 'cis-input', value: provider.name,
          onChange: (e) => onChange({ name: inputValue(e) }),
        })),
        field('Base URL', React.createElement('input', {
          className: 'cis-input', value: provider.baseUrl,
          onChange: (e) => onChange({ baseUrl: inputValue(e) }),
        })),
        field('单位', React.createElement('input', {
          className: 'cis-input', value: provider.unit ?? 'USD',
          onChange: (e) => onChange({ unit: inputValue(e) }),
        })),
      ),
      React.createElement(
        'div',
        { className: 'cis-grid' },
        field('请求 URL', React.createElement('input', {
          className: 'cis-input', value: provider.request.url,
          onChange: (e) => onChange({ request: { ...provider.request, url: inputValue(e) } }),
        })),
        field('方法', React.createElement('input', {
          className: 'cis-input', value: provider.request.method ?? 'GET',
          onChange: (e) => onChange({ request: { ...provider.request, method: inputValue(e) } }),
        })),
      ),
      field('API Key', React.createElement('input', {
        className: 'cis-input', value: provider.apiKey, type: 'password',
        onChange: (e) => onChange({ apiKey: inputValue(e) }),
      })),
      keyMissing
        ? React.createElement('p', { className: 'cis-field-warn' }, '占位符 API Key（sk-xxx / 空）会导致 /cost 查询 401——填入真实 Key。')
        : null,
      field('请求头（每行 "Key: Value"）', React.createElement('textarea', {
        className: 'cis-textarea', value: headersText,
        onChange: (e: { target: unknown }) => onChange({ request: { ...provider.request, headers: parseHeaders(inputValue(e)) } }),
      })),
      field('Extractor（JS 函数源码）', React.createElement('textarea', {
        className: 'cis-textarea cis-code', value: provider.extractor,
        onChange: (e: { target: unknown }) => onChange({ extractor: inputValue(e) }),
      })),
    ),
  )
}

/** 价格表一行：模型名 + 四档单价 + 删除。 */
function ModelRow(props: {
  row: ModelRow
  onChange: (patch: Partial<ModelRow>) => void
  onRemove: () => void
}): React.ReactElement {
  const { row, onChange, onRemove } = props
  const numberField = (key: keyof ModelPrice): React.ReactElement => React.createElement('input', {
    className: 'cis-input',
    type: 'number',
    step: '0.01',
    value: String(row.price[key]),
    'aria-label': key,
    onChange: (e) => onChange({ price: { ...row.price, [key]: Number(inputValue(e)) || 0 } }),
  })
  return React.createElement(
    'div',
    { className: 'cis-table-row' },
    React.createElement('input', {
      className: 'cis-input',
      value: row.model,
      'aria-label': '模型',
      onChange: (e) => onChange({ model: inputValue(e) }),
    }),
    numberField('input'),
    numberField('cacheRead'),
    numberField('cacheWrite'),
    numberField('output'),
    React.createElement('button', {
      type: 'button',
      className: 'cis-btn cis-btn-sm cis-btn-icon',
      'aria-label': '删除该模型',
      onClick: onRemove,
    }, '×'),
  )
}

// ---- 工具函数 ----

/** 读取输入控件值（@types/react 的 DOM 存根没有 value 成员，显式 cast）。 */
function inputValue(event: { target: unknown }): string {
  return (event.target as unknown as { value: string }).value
}

function field(label: string, control: React.ReactElement): React.ReactElement {
  return React.createElement(
    'label',
    { className: 'cis-field' },
    React.createElement('span', { className: 'cis-field-label' }, label),
    control,
  )
}

function parseHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const index = line.indexOf(':')
    if (index <= 0) continue
    const key = line.slice(0, index).trim()
    const value = line.slice(index + 1).trim()
    if (key.length > 0) headers[key] = value
  }
  return headers
}

function modelsToRows(models: Record<string, ModelPrice>): ModelRow[] {
  return Object.entries(models).map(([model, price]) => ({ model, price }))
}

function rowsToModels(rows: ModelRow[]): Record<string, ModelPrice> {
  const models: Record<string, ModelPrice> = {}
  for (const row of rows) {
    if (row.model.trim().length > 0) models[row.model.trim()] = row.price
  }
  return models
}

function emptyProvider(): BalanceProviderConfig {
  return {
    name: '',
    baseUrl: '',
    apiKey: '',
    request: { url: '{{baseUrl}}/user/balance', method: 'GET', headers: { Authorization: 'Bearer {{apiKey}}' } },
    extractor: 'function(response) {\n  return { isValid: true, remaining: Number(response.balance) || 0, unit: "USD" };\n}',
    unit: 'USD',
  }
}

/** 只读状态卡（读取中 / 未暴露），说明而非静默消失。 */
function statusCard(title: string, body: string, remedy?: string): React.ReactElement {
  return React.createElement(
    'div',
    { className: 'cis-status' },
    React.createElement('p', { className: 'cis-status-title' }, title),
    React.createElement('p', { className: 'cis-status-body' }, body),
    remedy === undefined ? null : React.createElement('p', { className: 'cis-status-body' }, remedy),
  )
}
