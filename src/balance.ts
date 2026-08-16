/**
 * 余额查询服务（host 半边）：按 cc-switch 的通用模板查询各 provider 余额。
 * 每个 provider 由 Config.providers 描述：request（url/method/headers）+
 * extractor（一段 JS 函数源码，接收 HTTP JSON 响应，返回
 * `{ isValid, remaining, unit }`）。`{{baseUrl}}` / `{{apiKey}}` 占位符在
 * URL 与 header 值里替换。
 *
 * 安全说明：extractor 是用 `new Function` 执行的用户配置代码（配置即代码，
 * 与 cc-switch 同立场）——只应放信任来源的 extractor。M1 防护仅 AbortController
 * 超时（覆盖 async 分支）；同步死循环无法被中断，文档明示；M2 计划接入
 * harness 代码沙箱（cordis-host-runner / sandbox）后再放开。extractor 拿不到
 * 本模块的任何内部引用，只能访问全局（含 fetch / process 等 Node 全局）。
 * @module dsh-plugin-cost-insight/balance
 */

/** 一个余额 provider 的配置（cc-switch 通用模板）。 */
export interface BalanceProviderConfig {
  /** 显示名（/cost 输出与日志用）。 */
  name: string
  /** 接口基础地址；`{{baseUrl}}` 占位符的取值。 */
  baseUrl: string
  /** API 密钥；`{{apiKey}}` 占位符的取值。 */
  apiKey: string
  /** 请求模板。 */
  request: {
    /** 请求路径，可含 `{{baseUrl}}` 占位符。 */
    url: string
    /** HTTP 方法，默认 GET。 */
    method?: string
    /** 请求头，值可含 `{{baseUrl}}` / `{{apiKey}}` 占位符。 */
    headers?: Record<string, string>
  }
  /** JS 函数源码：`function(response) { return { isValid, remaining, unit }; }`。 */
  extractor: string
  /** 默认货币单位（extractor 未返回 unit 时使用），默认 USD。 */
  unit?: string
}

/** 一次余额查询的归一化结果。 */
export interface BalanceResult {
  /** provider 显示名。 */
  provider: string
  /** extractor 报告的可用性（缺省视为 true）。 */
  isValid: boolean
  /** 剩余余额；查询失败时为 0。 */
  remaining: number
  /** 货币单位。 */
  unit: string
  /** 失败原因（成功时为 undefined）。 */
  error?: string
}

/** 替换模板中的 `{{baseUrl}}` / `{{apiKey}}` 占位符。 */
function interpolate(template: string, provider: BalanceProviderConfig): string {
  return template
    .replaceAll('{{baseUrl}}', provider.baseUrl)
    .replaceAll('{{apiKey}}', provider.apiKey)
}

/**
 * 查询一个 provider 的余额。
 * @param provider - provider 配置。
 * @param timeoutMs - 请求超时（毫秒），默认 10s；仅覆盖 async 分支。
 * @returns 归一化结果；任何失败都落到 error 分支而不是抛错。
 */
export async function queryBalance(
  provider: BalanceProviderConfig,
  timeoutMs = 10_000,
): Promise<BalanceResult> {
  const url = interpolate(provider.request.url, provider)
  const headers = Object.fromEntries(
    Object.entries(provider.request.headers ?? {})
      .map(([key, value]) => [key, interpolate(value, provider)]),
  )
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: provider.request.method ?? 'GET',
      headers,
      signal: controller.signal,
    })
    if (!response.ok) {
      return failure(provider, `HTTP ${response.status}`)
    }
    const body: unknown = await response.json()
    const extractor = new Function(
      'response',
      `return (${provider.extractor})(response)`,
    ) as (response: unknown) => { isValid?: boolean; remaining?: number; unit?: string }
    const parsed = extractor(body)
    if (typeof parsed?.remaining !== 'number') {
      return failure(provider, 'extractor 未返回数字 remaining')
    }
    return {
      provider: provider.name,
      isValid: parsed.isValid !== false,
      remaining: parsed.remaining,
      unit: parsed.unit ?? provider.unit ?? 'USD',
    }
  } catch (error) {
    return failure(provider, error instanceof Error ? error.message : String(error))
  } finally {
    clearTimeout(timer)
  }
}

function failure(provider: BalanceProviderConfig, message: string): BalanceResult {
  return {
    provider: provider.name,
    isValid: false,
    remaining: 0,
    unit: provider.unit ?? 'USD',
    error: message,
  }
}
