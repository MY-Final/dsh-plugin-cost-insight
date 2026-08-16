/**
 * dsh-plugin-cost-insight 主插件：消费洞察。
 * M1：余额查询——按 cc-switch 式通用模板（request + extractor JS）查询各
 * 中转站/厂商余额，/cost 命令展示；M2 起追加会话费用估算、预算提醒与报销导出
 * （见 docs/PLAN.md）。
 *
 * 与插件模板共存：不注册模板的演示内容（greet 工具、/hello、/dsh-demo 命令），
 * 避免与已安装的 dsh-plugin-template 重复注册（工具名/命令名必须唯一）。
 * M1 无浏览器半边（/cost 是纯 host 命令，余额走文本输出）；M2 起按需引入
 * 账单条 / 花费徽标 / 预算 toast（从模板取对应槽位组件）。
 *
 * 配置通过 settings 命名空间（ctx.settings）接线：浏览器半边配置卡片被移除
 * （M1 provider 配置走 cordis.yml，M2 提供配置页）。注意：Web 设置面板的
 * 可见性受 harness 的 WEB_SETTINGS_NAMESPACES 白名单限制。
 *
 * 加载契约：模块具名导出 apply(ctx, config)；框架在依赖（inject）就绪后调用 apply，
 * 卸载时自动回收所有通过 ctx 注册的监听器与 effect，无需手动移除。
 * @module dsh-plugin-cost-insight
 */

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { registerCostCommand } from './commands.ts'
import type { BalanceProviderConfig } from './balance.ts'

/** 插件显示名（诊断日志中使用）。 */
export const name = 'dsh-plugin-cost-insight'

/** 插件配置：部署时通过 cordis.yml 覆盖，也可以在 GUI 设置里改。 */
export interface Config {
  /** 余额查询 provider 列表（cc-switch 通用模板，见 docs/PLAN.md）。 */
  providers: BalanceProviderConfig[]
  /** 是否打印调试日志。 */
  verbose?: boolean
}

const ProviderRequestSchema = Schema.object({
  url: Schema.string().required(),
  method: Schema.string().default('GET'),
  headers: Schema.dict(Schema.string()).default({}),
})

const ProviderSchema = Schema.object({
  name: Schema.string().required(),
  baseUrl: Schema.string().required(),
  apiKey: Schema.string().required(),
  request: ProviderRequestSchema.required(),
  extractor: Schema.string().required(),
  unit: Schema.string().default('USD'),
})

/** Schemastery 配置 schema：负责校验与默认值，配置非法时加载响亮失败。 */
export const Config: Schema<Config> = Schema.object({
  providers: Schema.array(ProviderSchema).default([]),
  verbose: Schema.boolean().default(false),
})

/**
 * 插件主体：所有注册都是 effect，随插件卸载自动回收。
 *
 * 配置来源：settings 服务存在时，把它注册为命名空间 `dsh-plugin-cost-insight`
 * （cordis.yml 里的配置作为 composition base 层），GUI 配置卡片写入的用户层
 * 会覆盖 base；settings 服务不存在时回退到 cordis.yml 配置。
 * /cost 命令通过 configSource() 惰性读取 providers，配置变更立即生效。
 */
export function apply(ctx: Context, config: Config): void {
  let configSource: () => Config = () => config
  installSettingsSection(ctx, settingsNamespace('dsh-plugin-cost-insight'), Config, config, {
    // 收到当前权威配置源（有 settings 时是命名空间的解析值，否则是 composition entry）。
    setSource: (current) => {
      configSource = current
    },
    onChange: () => {},
  })

  // /cost 命令：查询各 provider 余额。
  registerCostCommand(ctx, () => configSource().providers)
}
