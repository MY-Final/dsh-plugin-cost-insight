/**
 * dsh-plugin-cost-insight 主插件：消费洞察。
 * M1：余额查询——按 cc-switch 式通用模板（request + extractor JS）查询各
 * 中转站/厂商余额，/cost 命令展示。
 * M2：会话费用估算——价格表（模型单价 × 倍率）× harness 的 token-meter 投影，
 * 浏览器设置页（settings.section）在线编辑 provider / 价格表 / 预算，账单条
 * （composer.dock）与花费徽标（header.utilities）实时显示；详见 docs/PLAN.md。
 *
 * 与插件模板共存：不注册模板的演示内容（greet 工具、/hello、/dsh-demo 命令），
 * 避免与已安装的 dsh-plugin-template 重复注册（工具名/命令名必须唯一）。
 *
 * 配置通过 settings 命名空间（ctx.settings）接线：浏览器设置页写入用户设置文档，
 * 本插件与客户端实时读取。注意：Web 设置面板的可见性受 harness 的
 * WEB_SETTINGS_NAMESPACES 白名单限制——要让设置页可编辑，需把命名空间
 * `dsh-plugin-cost-insight` 加进白名单（见 README）。
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
import type { BudgetConfig, ModelPrice, PricingConfig } from './cost.ts'

// 共享纯函数（费用估算）对外导出：供其他插件复用与测试。
export { estimateCost, formatCost } from './cost.ts'
export type { ModelPrice, PricingConfig, TokenUsageLike } from './cost.ts'

/** 插件显示名（诊断日志中使用）。 */
export const name = 'dsh-plugin-cost-insight'

/** 插件配置：部署时通过 cordis.yml 覆盖，也可以在 GUI 设置里改。 */
export interface Config {
  /** 余额查询 provider 列表（cc-switch 通用模板，见 docs/PLAN.md）。 */
  providers: BalanceProviderConfig[]
  /** 价格表：会话费用估算用（模型单价 × 倍率）。 */
  pricing: PricingConfig
  /** 预算：超限提醒用。 */
  budget: BudgetConfig
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

const ModelPriceSchema = Schema.object({
  input: Schema.number().required(),
  cacheRead: Schema.number().required(),
  cacheWrite: Schema.number().required(),
  output: Schema.number().required(),
})

const PricingSchema = Schema.object({
  defaultModel: Schema.string().default('deepseek-chat'),
  multiplier: Schema.number().default(1),
  currency: Schema.string().default('CNY'),
  models: Schema.dict(ModelPriceSchema).default({
    'deepseek-chat': { input: 2, cacheRead: 0.5, cacheWrite: 2, output: 8 },
    'deepseek-reasoner': { input: 4, cacheRead: 1, cacheWrite: 4, output: 16 },
  } as Record<string, ModelPrice>),
})

const BudgetSchema = Schema.object({
  perSession: Schema.number(),
})

/** Schemastery 配置 schema：负责校验与默认值，配置非法时加载响亮失败。 */
export const Config: Schema<Config> = Schema.object({
  providers: Schema.array(ProviderSchema).default([]),
  pricing: PricingSchema.required(),
  budget: BudgetSchema.required(),
  verbose: Schema.boolean().default(false),
})

/**
 * 插件主体：所有注册都是 effect，随插件卸载自动回收。
 *
 * 配置来源：settings 服务存在时，把它注册为命名空间 `dsh-plugin-cost-insight`
 * （cordis.yml 里的配置作为 composition base 层），浏览器设置页写入的用户层
 * 会覆盖 base；settings 服务不存在时回退到 cordis.yml 配置。
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

  // /cost 命令：查询各 provider 余额（预算与费用估算见浏览器账单条）。
  registerCostCommand(ctx, () => configSource().providers)
}
