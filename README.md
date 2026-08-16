# dsh-plugin-cost-insight

**English** | [简体中文](README.zh.md)

Cost insight for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`): query provider balances through cc-switch-style templates, estimate per-session spend, get over-budget alerts, and export records for reimbursement.

Built on the [dsh-plugin-template](https://github.com/kun2-5code/dsh-plugin-template) skeleton. It deliberately does **not** register the template's demo content (the `greet` tool, `/hello`, `/dsh-demo`), so it can coexist with the template in one profile without duplicate tool/command names.

## M1 (current): balance query

Every provider is described by a cc-switch-style generic template — a request plus a small JS extractor — so any station or vendor with a balance API fits without waiting for a preset:

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

- `{{baseUrl}}` / `{{apiKey}}` placeholders are substituted into the URL and header values.
- The extractor receives the JSON response and returns `{ isValid, remaining, unit }`; `remaining` is normalized through `Number()` first, so string balances like `"110.00"` pass too.
- Works for DeepSeek official, newapi / sub2api / one-api style relays, and token-plan vendors (Volcano, Zhipu, MiniMax, Qwen, Kimi, opencode go) — configure each through the same template.

Query balances from any session:

```
/cost           # per-provider balances
/cost balance   # balances only
```

> 🔑 A `查询失败（HTTP 401）` means the API key is wrong — most often the placeholder `sk-xxx` still sitting in cordis.yml. Fill in a real key under Settings → 消费洞察 and save; failure messages now include the vendor's own auth-error text for diagnosis.

> ⚠️ **The extractor is configuration-as-code**: it runs with `new Function` inside the plugin process. Only use extractors from sources you trust; a request timeout is the only guard.

## M2 (current): settings page & session cost

- **Settings page** — Settings → 消费洞察: edit providers, the price table, and the budget in the GUI (writes to the settings namespace, schema-validated). Configure everything without touching cordis.yml.
- **Bill strip** — under the composer: this session's estimated spend, turning warning-colored when it exceeds the budget.
- **Spend badge** — next to the session title: this session's cost pill (warning color over budget).
- **Budget hint** — a dismissible `shell.overlay` pill on the right edge once a budget is configured.

Session cost = `token-meter` projection (uncached input / cache read / cache write / output) × price table (per 1M tokens, × relay multiplier, keyed by `defaultModel`). The projection carries no model info, so the figure is an **estimate**.

> ⚠️ Editing the settings page requires the harness to expose the namespace: add `'dsh-plugin-cost-insight'` to `WEB_SETTINGS_NAMESPACES` in `packages/host/apiproxy/src/api-proxy.ts` (one line, then restart). Until then the page renders a read-only explainer.

## Roadmap

- **M3** — a cost report view (`conversation.view`), `/cost report` CSV export for reimbursement, and balance display in the settings page.

Design details: [docs/PLAN.md](docs/PLAN.md).

## Install & configure

```sh
dsh plugin --profile web add /path/to/dsh-plugin-cost-insight   # or github:MY-Final/dsh-plugin-cost-insight
```

The shipped `cordis.patch.yml` carries a DeepSeek example — set a real `apiKey`, or override the whole row by `id: dsh-plugin-cost-insight` in your profile's `cordis.patch.yml`. Then type `/cost` in a session.

## Local development

From a [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) source checkout, load the host half via overlay; to see the M2 UI, install into a profile instead:

```sh
pnpm dsh web --patch /absolute/path/to/dsh-plugin-cost-insight/dev/cordis.yml
```

Inside this repo:

```sh
pnpm install --ignore-workspace   # required when the repo sits inside a harness checkout
pnpm typecheck
pnpm build
node test/smoke.mjs
```

## Directory structure

```
src/
├── index.ts        # plugin entry: Config (providers/pricing/budget) + settings wiring
├── balance.ts      # cc-switch-style balance query (request + extractor, timeout)
├── cost.ts         # shared cost estimate (pure; exported for reuse/tests)
├── commands.ts     # /cost command
├── service.ts      # optional example Service (disabled by default)
├── hook.ts         # optional example hook permission gate (disabled by default)
└── client/         # browser half (M2 UI)
    ├── index.ts        # entry: bind settings namespace, assemble the registrations
    ├── settings-page.ts # settings.section: providers / price table / budget editor
    ├── bill-strip.ts   # composer.dock: per-session cost, budget warning
    ├── header-badge.ts # header.utilities: cost pill
    └── budget-toast.ts # shell.overlay: dismissible budget hint
docs/PLAN.md        # design doc (modules, decisions, M1/M2/M3)
```
