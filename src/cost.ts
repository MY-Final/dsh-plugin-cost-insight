/**
 * 会话费用估算（host/client 共用的纯函数，不依赖任何 Node/浏览器 API）。
 * 数据：harness 的 TokenUsageProjection（uncachedInputTokens / cacheReadTokens /
 * cacheWriteTokens / outputTokens，按会话持久累积）；价格：pricing 配置。
 * 价格按每 1M token 计价，乘以中转倍率；按 defaultModel 计价（投影不含模型信息，
 * 中途切模型是已知缺口，界面标注"估算"）。
 * @module dsh-plugin-cost-insight/cost
 */

/** TokenUsageProjection 的结构子集（四桶互斥）。 */
export interface TokenUsageLike {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/** 一个模型每 1M token 的单价（计价单位与 pricing.currency 一致）。 */
export interface ModelPrice {
  input: number
  cacheRead: number
  cacheWrite: number
  output: number
}

/** 价格表配置。 */
export interface PricingConfig {
  /** 会话计价所用模型（投影不含模型信息，取默认模型估算）。 */
  defaultModel: string
  /** 中转站倍率（1 = 官方原价）。 */
  multiplier: number
  /** 计价货币/符号（如 CNY / USD / ¥）。 */
  currency: string
  /** 模型名 → 单价表；未收录的模型按全 0 计（界面提示"未配置该模型价格"）。 */
  models: Record<string, ModelPrice>
}

/** 预算配置。 */
export interface BudgetConfig {
  /** 单会话费用上限（超限时账单条与 /cost 提示）；缺省不限。 */
  perSession?: number
}

/**
 * 按价格表估算一次会话的 token 成本。
 * @param usage - 会话 token 用量（四桶）。
 * @param pricing - 价格表配置。
 * @returns 估算成本（currency 单位）。
 */
export function estimateCost(usage: TokenUsageLike, pricing: PricingConfig): number {
  const model = pricing.models[pricing.defaultModel]
  if (model === undefined) return 0
  const raw = usage.uncachedInputTokens / 1_000_000 * model.input
    + usage.cacheReadTokens / 1_000_000 * model.cacheRead
    + usage.cacheWriteTokens / 1_000_000 * model.cacheWrite
    + usage.outputTokens / 1_000_000 * model.output
  return raw * pricing.multiplier
}

/** 格式化成本：两位小数 + 货币符号。 */
export function formatCost(cost: number, currency: string): string {
  return `${cost.toFixed(2)} ${currency}`
}
