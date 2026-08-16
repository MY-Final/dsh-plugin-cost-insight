// 构建产物冒烟测试：验证主插件注册 /cost 命令、配置经 settings 命名空间实时接线、
// hook 权限门按配置拒绝/放行、queryBalance 的余额归一与失败信息。
// 注意：本插件不注册模板演示（greet 工具、/hello、/dsh-demo），
// 避免与已安装的 dsh-plugin-template 重复注册。
// 运行：node test/smoke.mjs（先 pnpm build）
import assert from 'node:assert/strict'
import http from 'node:http'
import { name, apply, estimateCost, formatCost } from '../lib/index.js'
import { queryBalance } from '../lib/balance.js'
import * as hook from '../lib/hook.js'

// 最小可用的 ctx：只实现本插件用到的成员。
// inject 存在但从不提供服务 —— 模拟"profile 里没有 settings 服务"，
// 此时 installSettingsSection 不执行，配置回退到 composition entry。
const ctx = {
  tools: {
    register() {},
  },
  on() {
    return () => {}
  },
  effect() {
    return () => {}
  },
  inject() {
    return () => {}
  },
}

const config = {
  providers: [],
  pricing: {
    defaultModel: 'deepseek-chat',
    multiplier: 1,
    currency: 'CNY',
    models: { 'deepseek-chat': { input: 2, cacheRead: 0.5, cacheWrite: 2, output: 8 } },
  },
  budget: {},
}
apply(ctx, config)

assert.equal(name, 'dsh-plugin-cost-insight')

// 费用估算纯函数：1M 输入 token × 2/1M = 2；缓存读 1M × 0.5 = 0.5；倍率 ×2。
const pricing = config.pricing
assert.equal(
  estimateCost({ uncachedInputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, pricing),
  2,
)
assert.equal(
  estimateCost({ uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 0 }, pricing),
  0.5,
)
assert.equal(
  estimateCost({ uncachedInputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, { ...pricing, multiplier: 2 }),
  4,
)
assert.equal(formatCost(2, 'CNY'), '2.00 CNY')

// settings 接线：模拟 settings 服务存在（installSettingsSection 的依赖立即满足），
// 断言命名空间以 composition entry 为 base 层注册、/cost 命令注册到 commands 服务。
{
  const settingsCtx = {
    settings: {
      register(ns, schema, options) {
        assert.equal(ns, 'dsh-plugin-cost-insight')
        assert.equal(options.base, config, 'composition entry 应作为 base 层传入')
        return {
          get() {
            return { providers: [] }
          },
          watch() {
            return () => {}
          },
        }
      },
    },
    effect() {
      return () => {}
    },
  }
  const registeredCommands = []
  const liveCtx = {
    tools: { register() {} },
    on() { return () => {} },
    effect() { return () => {} },
    // 按注入名分发：installSettingsSection 注入 ['settings']，命令注册注入 ['commands']。
    inject(names, callback) {
      if (names.includes('settings')) callback(settingsCtx)
      if (names.includes('commands')) callback({ commands: { register(d) { registeredCommands.push(d) } } })
      return () => {}
    },
  }
  apply(liveCtx, config)

  const cost = registeredCommands.find((c) => c.name === 'cost')
  assert.ok(cost, 'cost command should be registered')
  assert.equal(registeredCommands.length, 1, '不应注册模板演示命令（hello/dsh-demo）')
  const out = await cost.handler({ rawInput: '' })
  assert.equal(out.kind, 'success')
  assert.match(out.text, /未配置任何 provider/, 'cost 空配置应提示配置方法')
}

// hook 权限门：捕获注册的 tools/pre-execute 监听器，验证拒绝与放行两条路径。
let listener
const hookCtx = {
  on(_event, fn) {
    listener = fn
  },
}
hook.apply(hookCtx, { denyTools: ['bash'] })
assert.ok(listener, 'tools/pre-execute listener should be registered')

const denied = await listener({ name: 'bash' }, () => Promise.resolve({ kind: 'allow' }))
assert.deepEqual(denied, { kind: 'deny', reason: 'Tool "bash" is denied by policy.' })

const allowed = await listener({ name: 'greet' }, () => Promise.resolve({ kind: 'allow' }))
assert.deepEqual(allowed, { kind: 'allow' })

// queryBalance：对本地测试服务器发起真实请求。
// 1) 余额字段是字符串（如 DeepSeek 的 "110.00"）时被 Number() 归一；
// 2) 401 响应把状态码与响应体摘要拼进错误信息。
const server = http.createServer((req, res) => {
  if (req.url === '/ok') {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '110.00' }] }))
  } else if (req.url === '/denied') {
    res.statusCode = 401
    res.end(JSON.stringify({ error: { message: 'Authentication Fails, Your api key is invalid' } }))
  } else {
    res.statusCode = 404
    res.end('not found')
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const { port } = server.address()
const provider = (url) => ({
  name: 't',
  baseUrl: '',
  apiKey: 'k',
  request: { url: `http://127.0.0.1:${port}${url}` },
  extractor: 'function(r) { return { remaining: r.balance_infos[0].total_balance, unit: r.balance_infos[0].currency }; }',
})
try {
  const ok = await queryBalance(provider('/ok'))
  assert.equal(ok.remaining, 110, '字符串余额应被 Number() 归一')
  assert.equal(ok.unit, 'CNY')
  const denied = await queryBalance(provider('/denied'))
  assert.match(denied.error ?? '', /401/, '非 2xx 应报告状态码')
  assert.match(denied.error ?? '', /Authentication/, '非 2xx 应附响应体摘要')
} finally {
  server.close()
}

console.log('smoke ok')
