/**
 * 客户端半边的一次性样式注入：所有 cis-* class 汇总在单个 <style> 里。
 * 类名前缀必须保持本插件独有（cis = cost insight）：CSS 是全局的，若沿用
 * 模板的 dtpl-* 前缀，两个插件同装一个 profile 时后加载的 <style> 会覆盖
 * 先加载的同名规则——模板卡片曾被本插件的 .dtpl-card（padding/display）污染，
 * 这就是 212b6f0 之后"卡片文字右移"的根因。换前缀后不再互相干扰。
 * 样式完全走 harness 设置面板的设计语言（--dsw-alias-* token，见
 * packages/client/ui-settings-models/src/client/ModelsSection.module.css 与
 * ui-theme/src/styles/design-platform.css）：14/22 正文、12/18 说明、胶囊按钮
 * （h36 r18，行内 h28 r14）、h32 输入框、`border-l2` 细线卡片 + `bg-module-platform`
 * 填充编辑器面，深浅色自动适配。
 * @module dsh-plugin-cost-insight/client/styles
 */

import { NAMESPACE } from './constants.ts'

/** tsconfig 没有 dom lib，这里声明用到的 DOM 形状。 */
declare const document: {
  createElement(tag: 'style'): { dataset: Record<string, string>; textContent: string }
  head: { appendChild(node: { dataset: Record<string, string>; textContent: string }): void }
}

let stylesInjected = false

/** 注入 <style data-plugin data-plugin-css>；client-modules 的 claimStyles 据此回收。 */
export function injectStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return
  stylesInjected = true
  const tag = document.createElement('style')
  tag.dataset.plugin = NAMESPACE
  tag.dataset.pluginCss = `${NAMESPACE}/ui`
  tag.textContent = `
/* ---- 设置页（settings.section）：与内置 Models 页同一套面板语言 ---- */
.cis-page { display: flex; flex-direction: column; gap: 20px; max-width: 720px; color: var(--dsw-alias-label-primary); }
.cis-title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.cis-intro { margin: 0; font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-tertiary); }
.cis-notice { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-warn-label); }

.cis-section { display: flex; flex-direction: column; gap: 10px; }
.cis-section-title { margin: 0; font-size: 12px; line-height: 18px; font-weight: 500; color: var(--dsw-alias-label-secondary); }
.cis-section-hint { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }

/* 卡片列表：描边卡（面板底上浮一层），展开的编辑器是卡内的填充面。 */
.cis-card-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.cis-card {
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; padding: 12px 14px;
  display: flex; flex-direction: column; gap: 12px;
}
.cis-card-head { display: flex; align-items: center; gap: 10px; min-width: 0; }
.cis-card-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; line-height: 22px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.cis-card-tag { flex: none; padding: 1px 6px; border: 1px solid var(--dsw-alias-border-l3); border-radius: 4px; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary); }

/* 编辑器面：填充模块，与设置面板的选中底色一致，不再叠第二层描边。 */
.cis-editor { border-radius: 12px; background: var(--dsw-alias-bg-module-platform); padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.cis-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.cis-field-label { font-size: 12px; line-height: 18px; font-weight: 500; color: var(--dsw-alias-label-secondary); }
.cis-field-hint { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.cis-field-warn { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-warn-label); }
.cis-field-error { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary); }

/* 字段网格：自动换列，窄面板时退化为单列。 */
.cis-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px 12px; }

/* 输入控件：h32 r8，面板语言的内置 input 同款。 */
.cis-input, .cis-textarea {
  box-sizing: border-box; width: 100%; min-width: 0;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 14px; line-height: 22px; padding: 0 10px; height: 32px;
}
.cis-textarea { padding: 5px 10px; height: auto; min-height: 64px; resize: vertical; }
.cis-input:focus, .cis-textarea:focus { outline: none; border-color: var(--dsw-alias-brand-primary); }
.cis-input::placeholder, .cis-textarea::placeholder { color: var(--dsw-alias-label-dimmed); }
.cis-input:disabled, .cis-textarea:disabled { opacity: 0.6; cursor: default; }
.cis-code { font-family: var(--ds-font-family-code, ui-monospace, monospace); font-size: 13px; line-height: 20px; }

/* 价格表：一次写死的列头 + 每模型一行（内置 modelList 同款）。 */
.cis-table { display: flex; flex-direction: column; gap: 8px; }
.cis-table-head, .cis-table-row {
  display: grid; grid-template-columns: minmax(0, 1.3fr) repeat(4, minmax(0, 1fr)) auto; gap: 6px; align-items: center;
}
.cis-table-head { padding: 0 6px; }
.cis-table-head span { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.cis-table-row { border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; padding: 6px; }

/* 按钮：胶囊（h36 r18），行内密集态 h28 r14；"添加"用虚线占位卡。 */
.cis-btn {
  box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 36px; padding: 0 14px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 18px;
  background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 14px; line-height: 22px; cursor: pointer;
}
.cis-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.cis-btn-primary { border-color: transparent; background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); }
.cis-btn-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover, var(--dsw-alias-brand-primary)); }
.cis-btn-danger { color: var(--dsw-alias-state-error-primary); }
.cis-btn-danger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-danger); }
.cis-btn-sm { height: 28px; padding: 0 10px; border-radius: 14px; font-size: 12px; line-height: 18px; }
.cis-btn-icon { width: 28px; padding: 0; border-radius: 6px; }
.cis-btn-icon:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-danger); color: var(--dsw-alias-state-error-primary); }
.cis-btn-add {
  height: 44px; border: 1px dashed var(--dsw-alias-border-l3); border-radius: 12px; align-self: stretch;
}
.cis-btn:disabled { opacity: 0.4; cursor: default; }
.cis-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--dsw-alias-border-l3); }

.cis-footer { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }

/* 只读状态卡（读取中 / 未暴露）。 */
.cis-status { display: flex; flex-direction: column; gap: 6px; max-width: 720px; }
.cis-status-title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.cis-status-body { margin: 0; font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-tertiary); }

/* ---- 会话 UI（账单条 / 徽标 / 预算提示）---- */
.cis-strip {
  display: flex; align-items: center; gap: 8px; padding: 2px 4px;
  font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary);
}
.cis-strip-strong { color: var(--dsw-alias-label-primary); font-weight: 500; }
.cis-strip-warn { color: var(--dsw-alias-state-warning-primary); }
.cis-strip-error { color: var(--dsw-alias-state-error-primary); }
.cis-badge {
  box-sizing: border-box; display: inline-flex; align-items: center;
  border-radius: 999px; padding: 2px 10px; font-size: 12px; line-height: 18px;
  background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-label-secondary);
}
.cis-badge-warn { color: var(--dsw-alias-state-warning-primary); }
.cis-overlay {
  position: fixed; right: 16px; bottom: 16px;
  display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 12px;
  border: 1px solid var(--dsw-alias-state-warning-primary);
  background: var(--dsw-alias-bg-layer-2); font-size: 12px; line-height: 18px;
  color: var(--dsw-alias-label-primary); pointer-events: auto;
}
.cis-overlay-close {
  appearance: none; border: 0; background: none; padding: 0; font: inherit; cursor: pointer;
  font-size: 12px; line-height: 1; color: var(--dsw-alias-label-tertiary);
}
.cis-overlay-close:hover { color: var(--dsw-alias-label-primary); }
`
  document.head.appendChild(tag)
}
