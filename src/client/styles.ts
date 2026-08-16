/**
 * 客户端半边的一次性样式注入：所有 dtpl-* class 汇总在单个 <style> 里，
 * 颜色全部走主题变量（--dsw-alias-*，见 harness 的
 * ui-theme/src/styles/design-platform.css），深浅色自动适配。
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
.dtpl-page { display: flex; flex-direction: column; gap: 16px; padding: 16px; }
.dtpl-section { display: flex; flex-direction: column; gap: 8px; }
.dtpl-section-title { margin: 0; font-size: 13px; font-weight: 600; line-height: 1.5; color: var(--dsw-alias-label-primary); }
.dtpl-section-hint { margin: 0; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-tertiary); }
.dtpl-field { display: flex; flex-direction: column; gap: 4px; }
.dtpl-field-label { font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); }
.dtpl-input, .dtpl-textarea {
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12px; line-height: 1.5; padding: 6px 10px;
}
.dtpl-input:focus, .dtpl-textarea:focus { outline: none; border-color: var(--dsw-alias-brand-primary); }
.dtpl-textarea { resize: vertical; min-height: 56px; font-family: ui-monospace, monospace; }
.dtpl-card {
  list-style: none; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px;
  background: var(--dsw-alias-bg-layer-3); padding: 12px;
  display: flex; flex-direction: column; gap: 8px;
}
.dtpl-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.dtpl-card-title { font-size: 13px; font-weight: 600; line-height: 1.5; color: var(--dsw-alias-label-primary); }
.dtpl-row { display: flex; gap: 8px; align-items: flex-end; }
.dtpl-row > .dtpl-field { flex: 1; }
.dtpl-row .dtpl-number { width: 90px; }
.dtpl-btn {
  appearance: none; border: 1px solid var(--dsw-alias-border-l2); background: none; font: inherit; cursor: pointer;
  height: 28px; padding: 0 10px; border-radius: 8px; font-size: 12px; line-height: 1.5;
  color: var(--dsw-alias-label-secondary); display: inline-flex; align-items: center; gap: 6px;
}
.dtpl-btn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dtpl-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dtpl-btn-primary { background: var(--dsw-alias-label-primary); color: var(--dsw-alias-bg-layer-3); border-color: transparent; }
.dtpl-btn-danger { color: var(--dsw-alias-state-error-primary); }
.dtpl-footer { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }
.dtpl-status { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; }
.dtpl-status-title { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.4; color: var(--dsw-alias-label-primary); }
.dtpl-status-body { margin: 0; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-tertiary); }
.dtpl-strip {
  display: flex; align-items: center; gap: 8px; padding: 2px 4px;
  font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary);
}
.dtpl-strip-strong { color: var(--dsw-alias-label-primary); font-weight: 500; }
.dtpl-strip-warn { color: var(--dsw-alias-state-warning-primary); }
.dtpl-strip-error { color: var(--dsw-alias-state-error-primary); }
.dtpl-badge {
  border-radius: 999px; padding: 2px 10px; font-size: 12px; line-height: 1.5;
  background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-label-secondary);
}
.dtpl-badge-warn { color: var(--dsw-alias-state-warning-primary); }
.dtpl-overlay {
  position: fixed; right: 16px; bottom: 16px;
  display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 12px;
  border: 1px solid var(--dsw-alias-state-warning-primary);
  background: var(--dsw-alias-bg-layer-3); font-size: 12px; line-height: 1.5;
  color: var(--dsw-alias-label-primary); pointer-events: auto;
}
.dtpl-overlay-close {
  appearance: none; border: 0; background: none; padding: 0; font: inherit; cursor: pointer;
  font-size: 12px; line-height: 1; color: var(--dsw-alias-label-tertiary);
}
.dtpl-overlay-close:hover { color: var(--dsw-alias-label-primary); }
`
  document.head.appendChild(tag)
}
