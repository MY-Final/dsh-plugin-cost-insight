# dsh-plugin-cost-insight

[English](README.md) | **简体中文**

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）消费洞察插件：按 cc-switch 式通用模板查询各中转站/厂商余额，估算每次会话花费，超预算提醒，可导出报销记录。

基于 [dsh-plugin-template](https://github.com/kun2-5code/dsh-plugin-template) 骨架开发，但**刻意不注册模板的演示内容**（`greet` 工具、`/hello`、`/dsh-demo` 命令），因此可以和模板同装一个 profile，不会重复注册工具/命令名。

## M1（当前）：余额查询

每个 provider 用 cc-switch 式通用模板描述——一段请求配置 + 一段 JS extractor——任何有余额接口的中转站/厂商都能适配，不用等预置：

```yaml
providers:
  - name: deepseek-official
    baseUrl: https://api.deepseek.com
    apiKey: sk-xxx
    request:
      url: '{{baseUrl}}/user/balance'
      method: GET
      headers:
        Authorization: 'Bearer {{apiKey}}'
    extractor: |
      function(response) {
        var info = response && response.balance_infos && response.balance_infos[0];
        return {
          isValid: !!(response && response.is_available),
          remaining: info ? Number(info.total_balance) : 0,
          unit: 'CNY'
        };
      }
    unit: CNY
```

- `{{baseUrl}}` / `{{apiKey}}` 占位符在 URL 与 header 值里替换。
- extractor 接收 JSON 响应，返回 `{ isValid, remaining, unit }`；`remaining` 会先经 `Number()` 归一（字符串余额如 `"110.00"` 也能通过）。
- 适配 DeepSeek 官方、newapi / sub2api / one-api 系中转，以及 token plan 厂商（火山、智谱、MiniMax、Qwen、Kimi、opencode go）——都走同一个模板。

在任意会话里查询：

```
/cost           # 各 provider 余额
/cost balance   # 仅余额
```

> 🔑 查询失败（HTTP 401）＝ API Key 不对：最常见原因是 cordis.yml 里还是占位符 `sk-xxx`。到 设置 → 消费洞察 填入真实 Key 保存即可；失败信息现在会附上厂商返回的鉴权错误原文，方便排查。

> ⚠️ **extractor 是"配置即代码"**：它用 `new Function` 在插件进程内执行。只放信任来源的 extractor；仅有请求超时防护。

## M2（当前）：设置页 + 会话费用

- **设置页** —— 设置 → 消费洞察：在 GUI 里编辑 provider / 价格表 / 预算（写入 settings 命名空间，schema 校验），不用碰 cordis.yml。
- **账单条** —— 输入卡片下方：本次会话估算花费，超预算变警示色。
- **花费徽标** —— 会话标题旁：本会话花费 pill（超预算警示色）。
- **预算提示** —— 配置预算后右下角出现一枚可关闭的 `shell.overlay` 提示。

会话费用 = `token-meter` 投影（未缓存输入 / 缓存读 / 缓存写 / 输出）× 价格表（每 1M token × 中转倍率，按 `defaultModel` 计价）。投影不含模型信息，因此为**估算值**。

> ⚠️ 设置页可编辑需要 harness 暴露命名空间：在 `packages/host/apiproxy/src/api-proxy.ts` 的 `WEB_SETTINGS_NAMESPACES` 加一行 `'dsh-plugin-cost-insight'`（改完重启）；否则设置页渲染只读说明卡。

## Roadmap

- **M3** —— 成本报表视图（`conversation.view`）、`/cost report` 报销 CSV 导出、设置页内展示余额。

设计细节见 [docs/PLAN.md](docs/PLAN.md)。

## 安装与配置

```sh
dsh plugin --profile web add /path/to/dsh-plugin-cost-insight   # 或 github:MY-Final/dsh-plugin-cost-insight
```

随包 `cordis.patch.yml` 自带 DeepSeek 示例——填上真实 `apiKey`，或在 profile 的 `cordis.patch.yml` 里按 `id: dsh-plugin-cost-insight` 覆盖整行。然后在会话里输入 `/cost`。

## 本地开发

在 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 源码根目录可用 overlay 加载 host 半边；要看 M2 UI 则安装进 profile：

```sh
pnpm dsh web --patch /absolute/path/to/dsh-plugin-cost-insight/dev/cordis.yml
```

本仓库内：

```sh
pnpm install --ignore-workspace   # 仓库嵌在 harness checkout 里时必须
pnpm typecheck
pnpm build
node test/smoke.mjs
```

## 目录结构

```
src/
├── index.ts        # 插件入口：Config（providers/pricing/budget）+ settings 接线
├── balance.ts      # cc-switch 式余额查询（request + extractor，超时）
├── cost.ts         # 共享费用估算（纯函数，对外导出供复用/测试）
├── commands.ts     # /cost 命令
├── service.ts      # 可选示例 Service（默认注释启用）
├── hook.ts         # 可选示例 hook 权限门（默认注释启用）
└── client/         # 浏览器半边（M2 UI）
    ├── index.ts        # 入口：绑定 settings 命名空间，组装各注册
    ├── settings-page.ts # settings.section：provider / 价格表 / 预算编辑器
    ├── bill-strip.ts   # composer.dock：本次会话花费 + 预算警示
    ├── header-badge.ts # header.utilities：花费徽标
    └── budget-toast.ts # shell.overlay：可关闭预算提示
docs/PLAN.md        # 设计文档（模块拆解、决策、M1/M2/M3）
```
