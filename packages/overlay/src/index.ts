export interface OverlayClientConfig {
  bridgeUrl: string;
  workspace: string;
  sessionId?: string;
  targetOrigin?: string;
}

export function buildOverlayClient(config: OverlayClientConfig): string {
  const markup = `
    <style>
      :host { all: initial; color-scheme: light; }
      * { box-sizing: border-box; }
      .vt-panel { position: fixed; z-index: 2147483646; right: 12px; bottom: 12px; width: min(320px, calc(100vw - 24px)); max-height: min(540px, calc(100vh - 24px)); overflow: auto; border: 1px solid #c7cbd1; border-radius: 10px; background: #f7f8fa; color: #202124; box-shadow: 0 14px 36px rgb(32 33 36 / 24%); font: 12px/1.4 Arial, ui-sans-serif, system-ui, sans-serif; transition: opacity 120ms ease-out, transform 160ms cubic-bezier(.2,.8,.2,1); scrollbar-color: #c7cbd1 #f7f8fa; }
      .vt-panel[data-compact="true"] { width: auto; min-width: 184px; overflow: visible; }
      .vt-panel[data-compact="true"] .vt-context, .vt-panel[data-compact="true"] .vt-queue, .vt-panel[data-compact="true"] .vt-editor, .vt-panel[data-compact="true"] .vt-feedback { display: none; }
      .vt-head, .vt-queue-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .vt-head { min-height: 40px; padding: 0 10px 0 12px; border-bottom: 1px solid #e1e4e8; background: #fff; }
      .vt-panel[data-compact="true"] .vt-head { border-bottom: 0; border-radius: 7px; }
      .vt-title { color: #202124; font-size: 11px; font-weight: 700; letter-spacing: .01em; }
      .vt-mode { display: inline-flex; align-items: center; gap: 7px; color: #5f6368; font-size: 11px; cursor: pointer; user-select: none; }
      .vt-mode input { position: absolute; inline-size: 1px; block-size: 1px; opacity: 0; pointer-events: none; }
      .vt-switch { position: relative; width: 28px; height: 16px; border: 1px solid #9aa0a6; border-radius: 999px; background: #dadce0; transition: background 120ms ease-out, border-color 120ms ease-out; }
      .vt-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 10px; height: 10px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgb(60 64 67 / 30%); transition: transform 120ms ease-out; }
      .vt-mode input:checked + .vt-switch { border-color: #1a73e8; background: #1a73e8; }
      .vt-mode input:checked + .vt-switch::after { transform: translateX(12px); }
      .vt-mode input:focus-visible + .vt-switch { outline: 2px solid #1a73e8; outline-offset: 2px; }
      .vt-context { padding: 8px 12px 9px; border-bottom: 1px solid #e1e4e8; background: #fff; }
      .vt-target { margin: 0; overflow: hidden; color: #174ea6; font: 10px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }
      .vt-page { display: block; margin-top: 2px; overflow: hidden; color: #5f6368; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
      .vt-queue { border-bottom: 1px solid #e1e4e8; background: #fff; }
      .vt-queue[hidden] { display: none; }
      .vt-queue-head { min-height: 30px; padding: 0 8px 0 10px; color: #5f6368; font-size: 10px; font-weight: 700; }
      .vt-queue-toggle { display: inline-flex; align-items: center; min-height: 28px; padding: 0 16px 0 0; background: transparent; color: #3c4043; font-size: 10px; }
      .vt-queue-toggle::after { content: ""; position: relative; left: 8px; width: 5px; height: 5px; border-right: 1px solid currentColor; border-bottom: 1px solid currentColor; transform: rotate(45deg) translateY(-2px); transition: transform 120ms ease-out; }
      .vt-queue-toggle[aria-expanded="true"]::after { transform: rotate(225deg) translate(-1px, -1px); }
      .vt-clear { min-height: 24px; padding: 0 2px; background: transparent; color: #1967d2; font-size: 10px; font-weight: 600; }
      .vt-draft-list { display: grid; gap: 2px; padding: 0 6px 7px; }
      .vt-draft-list[hidden] { display: none; }
      .vt-draft { display: grid; grid-template-columns: minmax(0, 1fr) 24px; align-items: center; gap: 2px; border-radius: 5px; color: #3c4043; font-size: 10px; }
      .vt-draft[data-active="true"] { background: #e8f0fe; }
      .vt-draft-select { display: grid; grid-template-columns: 7px minmax(0, 1fr) auto; align-items: center; gap: 7px; min-width: 0; min-height: 26px; border-radius: 5px; padding: 0 5px; background: transparent; color: inherit; font: inherit; text-align: left; }
      .vt-draft-select:hover { background: #f1f3f4; }
      .vt-draft[data-active="true"] .vt-draft-select { color: #174ea6; }
      .vt-draft-select::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #1a73e8; }
      .vt-draft-name { overflow: hidden; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }
      .vt-draft-meta { color: #5f6368; font-variant-numeric: tabular-nums; }
      .vt-draft-remove { position: relative; width: 24px; min-height: 24px; border-radius: 4px; padding: 0; background: transparent; color: #80868b; }
      .vt-draft-remove:hover { background: #fce8e6; color: #c5221f; }
      .vt-draft-remove::before, .vt-draft-remove::after { content: ""; position: absolute; top: 50%; left: 50%; width: 9px; height: 1.5px; border-radius: 1px; background: currentColor; transform: translate(-50%, -50%) rotate(45deg); }
      .vt-draft-remove::after { transform: translate(-50%, -50%) rotate(-45deg); }
      .vt-editor { display: grid; min-width: 0; }
      .vt-quick { display: grid; gap: 2px; padding: 9px 12px 8px; border-bottom: 1px solid #e1e4e8; background: #fff; }
      .vt-section-label { margin: 0 0 3px; color: #7a8089; font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      .vt-quick-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; min-height: 34px; color: #30343a; font-size: 11px; }
      .vt-quick-row[hidden] { display: none; }
      .vt-value { width: 64px; height: 27px; border: 1px solid #d2d6dc; border-radius: 5px; padding: 0 7px; background: #f8f9fb; color: #202124; font: 600 10px/1 ui-monospace, SFMono-Regular, Consolas, monospace; text-align: right; font-variant-numeric: tabular-nums; }
      .vt-value:hover { border-color: #9ca3af; background: #fff; }
      .vt-value:focus { border-color: #1a73e8; background: #fff; outline: none; }
      .vt-stepper { display: grid; grid-template-columns: 28px 48px 28px; overflow: hidden; border: 1px solid #c9ced6; border-radius: 6px; background: #fff; }
      .vt-stepper .vt-value { width: 48px; height: 28px; border: 0; border-right: 1px solid #e1e4e8; border-left: 1px solid #e1e4e8; border-radius: 0; padding: 0 4px; background: #fff; text-align: center; appearance: textfield; }
      .vt-stepper .vt-value::-webkit-inner-spin-button, .vt-stepper .vt-value::-webkit-outer-spin-button { margin: 0; appearance: none; }
      .vt-step { position: relative; width: 28px; min-height: 28px; border-radius: 0; padding: 0; background: #f5f7f9; color: #3c4043; }
      .vt-step:hover { background: #e9edf2; }
      .vt-step:active { background: #dce6f5; }
      .vt-step::before, .vt-step-plus::after { content: ""; position: absolute; top: 50%; left: 50%; width: 9px; height: 1.5px; border-radius: 1px; background: currentColor; transform: translate(-50%, -50%); }
      .vt-step-plus::after { transform: translate(-50%, -50%) rotate(90deg); }
      .vt-color-quick { grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
      .vt-color-controls { display: inline-flex; align-items: center; gap: 4px; }
      .vt-color-dropdown { position: relative; }
      .vt-color-select { position: relative; display: flex; align-items: center; gap: 5px; width: 96px; min-height: 26px; border: 1px solid #c9ced6; border-radius: 5px; padding: 0 18px 0 5px; background: #fff; color: #30343a; font: 9px/1 ui-monospace, SFMono-Regular, Consolas, monospace; text-align: left; }
      .vt-color-select:hover, .vt-color-select[aria-expanded="true"] { border-color: #8b94a0; background: #f8f9fb; }
      .vt-color-select::after { content: ""; position: absolute; top: 50%; right: 7px; width: 5px; height: 5px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: translateY(-65%) rotate(45deg); }
      .vt-color-chip, .vt-color-option-swatch { flex: 0 0 auto; width: 12px; height: 12px; border: 1px solid rgba(32, 33, 36, .32); border-radius: 3px; background: var(--vt-color-preview); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .42); }
      .vt-color-chip[data-empty="true"] { background-color: #fff; background-image: linear-gradient(45deg, #d8dce2 25%, transparent 25%, transparent 75%, #d8dce2 75%), linear-gradient(45deg, #d8dce2 25%, transparent 25%, transparent 75%, #d8dce2 75%); background-position: 0 0, 4px 4px; background-size: 8px 8px; }
      .vt-color-value { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .vt-color-menu { position: fixed; z-index: 2147483647; display: grid; gap: 1px; width: 124px; max-height: 206px; overflow: auto; border: 1px solid #c9ced6; border-radius: 7px; padding: 3px; background: #fff; box-shadow: 0 8px 24px rgba(32, 33, 36, .22); }
      .vt-color-menu[hidden] { display: none; }
      .vt-color-option { display: flex; align-items: center; gap: 6px; width: 100%; min-height: 25px; border-radius: 4px; padding: 0 6px; background: transparent; color: #30343a; font: 9px/1 ui-monospace, SFMono-Regular, Consolas, monospace; text-align: left; }
      .vt-color-option:hover { background: #f1f3f4; }
      .vt-color-option[aria-selected="true"] { background: #e8f0fe; color: #174ea6; }
      .vt-color-empty { padding: 8px 7px; color: #7a8089; font-size: 10px; }
      .vt-color-custom { position: relative; width: 26px; height: 26px; overflow: hidden; border: 1px solid #c9ced6; border-radius: 5px; background: #fff; cursor: pointer; }
      .vt-color-preview { position: absolute; inset: 3px; border-radius: 3px; background: var(--vt-color-preview); pointer-events: none; }
      .vt-color-custom[data-empty="true"] .vt-color-preview { background-color: #fff; background-image: linear-gradient(45deg, #d8dce2 25%, transparent 25%, transparent 75%, #d8dce2 75%), linear-gradient(45deg, #d8dce2 25%, transparent 25%, transparent 75%, #d8dce2 75%); background-position: 0 0, 4px 4px; background-size: 8px 8px; }
      .vt-color-picker { position: absolute; inset: 0; width: 100%; height: 100%; min-height: 0; padding: 0; opacity: 0; cursor: pointer; }
      .vt-footer { position: sticky; bottom: 0; z-index: 1; display: grid; gap: 7px; padding: 9px 10px 0; background: #f7f8fa; box-shadow: 0 -1px 0 #e1e4e8; }
      .vt-prompt { width: 100%; min-height: 36px; height: 36px; max-height: 104px; resize: none; border: 1px solid #c7cbd1; border-radius: 6px; padding: 9px; background: #fff; color: #202124; font: 11px/1.45 Arial, ui-sans-serif, system-ui, sans-serif; caret-color: #1a73e8; transition: height 140ms ease-out; }
      .vt-prompt:focus, .vt-prompt:not(:placeholder-shown) { height: 66px; resize: vertical; }
      .vt-prompt::placeholder { color: #80868b; }
      .vt-actions { display: grid; }
      button { min-height: 32px; border: 0; border-radius: 5px; padding: 0 10px; cursor: pointer; font: 600 11px/1 Arial, ui-sans-serif, system-ui, sans-serif; }
      .vt-send { min-height: 35px; background: #1a73e8; color: #fff; }
      .vt-send:hover { background: #1967d2; }
      button:disabled { cursor: not-allowed; opacity: .45; }
      button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 2px solid #1a73e8; outline-offset: 1px; }
      .vt-feedback { min-height: 23px; margin: 0 -10px; padding: 5px 10px 6px; border-top: 1px solid #e1e4e8; color: #5f6368; font-size: 9px; }
      .vt-agent-status { display: flex; align-items: flex-start; gap: 7px; min-height: 24px; margin: 0 -10px; padding: 6px 10px 7px; border-top: 1px solid #e1e4e8; color: #5f6368; font-size: 9px; line-height: 1.35; }
      .vt-agent-status[hidden] { display: none; }
      .vt-agent-status::before { content: ""; flex: 0 0 auto; width: 7px; height: 7px; margin-top: 2px; border-radius: 50%; background: #9aa0a6; }
      .vt-agent-status[data-state="queued"]::before { background: #f9ab00; box-shadow: 0 0 0 3px rgb(249 171 0 / 12%); }
      .vt-agent-status[data-state="paused"] { color: #8a4b08; }
      .vt-agent-status[data-state="paused"]::before { background: #f9ab00; box-shadow: 0 0 0 3px rgb(249 171 0 / 12%); }
      .vt-agent-status[data-state="running"]::before { background: #1a73e8; box-shadow: 0 0 0 3px rgb(26 115 232 / 12%); animation: vt-agent-pulse 1.2s ease-in-out infinite; }
      .vt-agent-status[data-state="applied"] { color: #137333; }
      .vt-agent-status[data-state="applied"]::before { background: #34a853; box-shadow: 0 0 0 3px rgb(52 168 83 / 12%); }
      .vt-agent-status[data-state="failed"], .vt-agent-status[data-state="error"] { color: #c5221f; }
      .vt-agent-status[data-state="failed"]::before, .vt-agent-status[data-state="error"]::before { background: #d93025; box-shadow: 0 0 0 3px rgb(217 48 37 / 12%); }
      @keyframes vt-agent-pulse { 50% { opacity: .42; } }
      .vt-error { color: #c5221f; }
      .vt-warning { color: #8a4b08; }
      .vt-highlight, .vt-selection { position: fixed; z-index: 2147483645; pointer-events: none; border-radius: 2px; }
      .vt-highlight { border: 1px solid #1a73e8; background: rgb(26 115 232 / 12%); }
      .vt-selection { --vt-pt: 0px; --vt-pr: 0px; --vt-pb: 0px; --vt-pl: 0px; --vt-mt: 0px; --vt-mr: 0px; --vt-mb: 0px; --vt-ml: 0px; --vt-rtl: 8px; --vt-rtr: 8px; --vt-rbr: 8px; --vt-rbl: 8px; border: 2px solid #1a73e8; background: rgb(26 115 232 / 5%); }
      .vt-canvas-toolbar { position: absolute; top: -31px; left: -2px; z-index: 4; display: inline-flex; align-items: center; gap: 6px; pointer-events: auto; }
      .vt-mode-control, .vt-scope-control { overflow: hidden; border-radius: 6px; box-shadow: 0 3px 10px rgb(32 33 36 / 18%); }
      .vt-mode-control { display: inline-flex; border: 1px solid #c7cbd1; background: #fff; }
      .vt-canvas-mode { min-height: 24px; border-radius: 0; padding: 0 7px; background: #fff; color: #5f6368; font-size: 9px; }
      .vt-canvas-mode + .vt-canvas-mode { border-left: 1px solid #e1e4e8; }
      .vt-canvas-mode:hover { background: #f1f3f4; }
      .vt-canvas-mode[aria-pressed="true"] { background: #e8f0fe; color: #174ea6; }
      .vt-scope-control { display: none; border: 1px solid #e5a6c3; background: #fff7fb; }
      .vt-selection[data-canvas-mode="padding"] .vt-scope-control, .vt-selection[data-canvas-mode="margin"] .vt-scope-control, .vt-selection[data-canvas-mode="border"] .vt-scope-control, .vt-selection[data-canvas-mode="radius"] .vt-scope-control { display: inline-flex; }
      .vt-scope-option { min-height: 24px; border-radius: 0; padding: 0 7px; background: transparent; color: #7a3958; font-size: 9px; }
      .vt-scope-option + .vt-scope-option { border-left: 1px solid #f1c7da; }
      .vt-scope-option:hover { background: #fdf2f8; color: #9d174d; }
      .vt-scope-option[aria-pressed="true"] { background: #fce7f3; color: #9d174d; }
      .vt-selection[data-canvas-mode="radius"] .vt-scope-opposite { display: none; }
      .vt-guide { position: absolute; pointer-events: none; }
      .vt-padding-guide { inset: var(--vt-pt) var(--vt-pr) var(--vt-pb) var(--vt-pl); border: 1px dashed transparent; }
      .vt-margin-guide { top: calc(var(--vt-mt) * -1); right: calc(var(--vt-mr) * -1); bottom: calc(var(--vt-mb) * -1); left: calc(var(--vt-ml) * -1); border: 1px dashed transparent; }
      .vt-selection[data-drag-kind="padding"] .vt-padding-guide { border-color: #1f9d6a; background: rgb(31 157 106 / 6%); }
      .vt-selection[data-canvas-mode="margin"] .vt-margin-guide, .vt-selection[data-drag-kind="margin"] .vt-margin-guide { border-color: #d97706; }
      .vt-margin-band { position: absolute; z-index: 0; display: none; background: rgb(245 158 11 / 22%); box-shadow: inset 0 0 0 1px rgb(217 119 6 / 20%); }
      .vt-selection[data-canvas-mode="margin"] .vt-margin-band, .vt-selection[data-drag-kind="margin"] .vt-margin-band { display: block; }
      .vt-margin-band-top { top: 0; right: 0; left: 0; height: max(0px, var(--vt-mt)); }
      .vt-margin-band-right { top: max(0px, var(--vt-mt)); right: 0; bottom: max(0px, var(--vt-mb)); width: max(0px, var(--vt-mr)); }
      .vt-margin-band-bottom { right: 0; bottom: 0; left: 0; height: max(0px, var(--vt-mb)); }
      .vt-margin-band-left { top: max(0px, var(--vt-mt)); bottom: max(0px, var(--vt-mb)); left: 0; width: max(0px, var(--vt-ml)); }
      .vt-canvas-handle { position: absolute; z-index: 2; min-width: 0; min-height: 0; border: 1px solid #fff; border-radius: 3px; padding: 0; box-shadow: 0 1px 3px rgb(32 33 36 / 28%); pointer-events: auto; }
      .vt-canvas-handle:hover, .vt-canvas-handle:focus-visible { filter: brightness(.92); transform-origin: center; }
      .vt-size-handle { background: #1a73e8; }
      .vt-size-right { top: 50%; right: -6px; width: 10px; height: 22px; cursor: ew-resize; transform: translateY(-50%); }
      .vt-size-bottom { bottom: -6px; left: 50%; width: 22px; height: 10px; cursor: ns-resize; transform: translateX(-50%); }
      .vt-size-corner { right: -6px; bottom: -6px; width: 11px; height: 11px; cursor: nwse-resize; }
      .vt-edge-handle { width: 22px; height: 7px; }
      .vt-edge-left, .vt-edge-right { width: 7px; height: 22px; }
      .vt-padding-handle { background: #1f9d6a; }
      .vt-margin-handle { background: #d97706; }
      .vt-border-handle { background: #7c3aed; }
      .vt-radius-handle { width: 10px; height: 10px; border-radius: 50%; background: #db2777; cursor: ew-resize; }
      .vt-radius-top-left { top: -6px; left: var(--vt-rtl); transform: translateX(-50%); }
      .vt-radius-top-right { top: -6px; right: var(--vt-rtr); transform: translateX(50%); }
      .vt-radius-bottom-right { right: var(--vt-rbr); bottom: -6px; transform: translateX(50%); }
      .vt-radius-bottom-left { bottom: -6px; left: var(--vt-rbl); transform: translateX(-50%); }
      .vt-selection:not([data-canvas-mode="size"]) .vt-size-handle, .vt-selection:not([data-canvas-mode="padding"]) .vt-padding-handle, .vt-selection:not([data-canvas-mode="margin"]) .vt-margin-handle, .vt-selection:not([data-canvas-mode="border"]) .vt-border-handle, .vt-selection:not([data-canvas-mode="radius"]) .vt-radius-handle { display: none; }
      .vt-edge-top { top: -4px; left: 50%; cursor: ns-resize; transform: translateX(-50%); }
      .vt-edge-right { top: 50%; right: -4px; cursor: ew-resize; transform: translateY(-50%); }
      .vt-edge-bottom { bottom: -4px; left: 50%; cursor: ns-resize; transform: translateX(-50%); }
      .vt-edge-left { top: 50%; left: -4px; cursor: ew-resize; transform: translateY(-50%); }
      .vt-padding-guide .vt-edge-top { transform: translate(-50%, 4px); }
      .vt-padding-guide .vt-edge-right { transform: translate(-4px, -50%); }
      .vt-padding-guide .vt-edge-bottom { transform: translate(-50%, -4px); }
      .vt-padding-guide .vt-edge-left { transform: translate(4px, -50%); }
      .vt-padding-guide .vt-edge-top, .vt-padding-guide .vt-edge-bottom { left: 38%; }
      .vt-padding-guide .vt-edge-left, .vt-padding-guide .vt-edge-right { top: 38%; }
      .vt-margin-guide .vt-edge-top { transform: translate(-50%, -5px); }
      .vt-margin-guide .vt-edge-right { transform: translate(5px, -50%); }
      .vt-margin-guide .vt-edge-bottom { transform: translate(-50%, 5px); }
      .vt-margin-guide .vt-edge-left { transform: translate(-5px, -50%); }
      .vt-margin-guide .vt-edge-top, .vt-margin-guide .vt-edge-bottom { left: 62%; }
      .vt-margin-guide .vt-edge-left, .vt-margin-guide .vt-edge-right { top: 62%; }
      .vt-drag-badge { position: fixed; z-index: 2147483647; pointer-events: none; border-radius: 5px; padding: 4px 7px; background: #202124; color: #fff; box-shadow: 0 4px 12px rgb(32 33 36 / 24%); font: 600 10px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace; font-variant-numeric: tabular-nums; }
      .vt-drag-badge[hidden] { display: none; }
      .vt-highlight[hidden], .vt-selection[hidden] { display: none; }
      @media (max-width: 520px) { .vt-panel:not([data-compact="true"]) { width: calc(100vw - 16px); max-height: min(64vh, 480px); } }
      @media (prefers-reduced-motion: reduce) { .vt-panel, .vt-switch, .vt-switch::after { transition: none; } .vt-agent-status::before { animation: none !important; } }
    </style>
    <div class="vt-highlight" hidden></div>
    <div class="vt-selection" data-canvas-mode="size" hidden>
      <div class="vt-canvas-toolbar" role="group" aria-label="Canvas adjustment"><span class="vt-mode-control" role="group" aria-label="Adjustment property"><button class="vt-canvas-mode" type="button" data-canvas-mode="size" aria-pressed="true">Size</button><button class="vt-canvas-mode" type="button" data-canvas-mode="padding" aria-pressed="false">Padding</button><button class="vt-canvas-mode" type="button" data-canvas-mode="margin" aria-pressed="false">Margin</button><button class="vt-canvas-mode" type="button" data-canvas-mode="border" aria-pressed="false">Border</button><button class="vt-canvas-mode" type="button" data-canvas-mode="radius" aria-pressed="false">Radius</button></span><span class="vt-scope-control" role="group" aria-label="Adjustment scope"><button class="vt-scope-option" type="button" data-adjustment-scope="all" aria-pressed="true" title="Adjust all sides together">All</button><button class="vt-scope-option vt-scope-opposite" type="button" data-adjustment-scope="opposite" aria-pressed="false" title="Adjust opposite sides together">Pair</button><button class="vt-scope-option" type="button" data-adjustment-scope="each" aria-pressed="false" title="Adjust one side or corner">Each</button></span></div>
      <div class="vt-guide vt-margin-guide">
        <span class="vt-margin-band vt-margin-band-top"></span><span class="vt-margin-band vt-margin-band-right"></span><span class="vt-margin-band vt-margin-band-bottom"></span><span class="vt-margin-band vt-margin-band-left"></span>
        <button class="vt-canvas-handle vt-margin-handle vt-edge-handle vt-edge-top" type="button" data-drag-kind="margin" data-drag-side="top" aria-label="Drag margin top"></button><button class="vt-canvas-handle vt-margin-handle vt-edge-handle vt-edge-right" type="button" data-drag-kind="margin" data-drag-side="right" aria-label="Drag margin right"></button><button class="vt-canvas-handle vt-margin-handle vt-edge-handle vt-edge-bottom" type="button" data-drag-kind="margin" data-drag-side="bottom" aria-label="Drag margin bottom"></button><button class="vt-canvas-handle vt-margin-handle vt-edge-handle vt-edge-left" type="button" data-drag-kind="margin" data-drag-side="left" aria-label="Drag margin left"></button>
      </div>
      <div class="vt-guide vt-padding-guide">
        <button class="vt-canvas-handle vt-padding-handle vt-edge-handle vt-edge-top" type="button" data-drag-kind="padding" data-drag-side="top" aria-label="Drag padding top"></button><button class="vt-canvas-handle vt-padding-handle vt-edge-handle vt-edge-right" type="button" data-drag-kind="padding" data-drag-side="right" aria-label="Drag padding right"></button><button class="vt-canvas-handle vt-padding-handle vt-edge-handle vt-edge-bottom" type="button" data-drag-kind="padding" data-drag-side="bottom" aria-label="Drag padding bottom"></button><button class="vt-canvas-handle vt-padding-handle vt-edge-handle vt-edge-left" type="button" data-drag-kind="padding" data-drag-side="left" aria-label="Drag padding left"></button>
      </div>
      <button class="vt-canvas-handle vt-border-handle vt-edge-handle vt-edge-top" type="button" data-drag-kind="border" data-drag-side="top" aria-label="Drag border top"></button><button class="vt-canvas-handle vt-border-handle vt-edge-handle vt-edge-right" type="button" data-drag-kind="border" data-drag-side="right" aria-label="Drag border right"></button><button class="vt-canvas-handle vt-border-handle vt-edge-handle vt-edge-bottom" type="button" data-drag-kind="border" data-drag-side="bottom" aria-label="Drag border bottom"></button><button class="vt-canvas-handle vt-border-handle vt-edge-handle vt-edge-left" type="button" data-drag-kind="border" data-drag-side="left" aria-label="Drag border left"></button>
      <button class="vt-canvas-handle vt-radius-handle vt-radius-top-left" type="button" data-drag-kind="radius" data-drag-side="topLeft" aria-label="Drag top-left corner radius"></button><button class="vt-canvas-handle vt-radius-handle vt-radius-top-right" type="button" data-drag-kind="radius" data-drag-side="topRight" aria-label="Drag top-right corner radius"></button><button class="vt-canvas-handle vt-radius-handle vt-radius-bottom-right" type="button" data-drag-kind="radius" data-drag-side="bottomRight" aria-label="Drag bottom-right corner radius"></button><button class="vt-canvas-handle vt-radius-handle vt-radius-bottom-left" type="button" data-drag-kind="radius" data-drag-side="bottomLeft" aria-label="Drag bottom-left corner radius"></button>
      <button class="vt-canvas-handle vt-size-handle vt-size-right" type="button" data-drag-kind="size" data-drag-side="right" aria-label="Drag width"></button><button class="vt-canvas-handle vt-size-handle vt-size-bottom" type="button" data-drag-kind="size" data-drag-side="bottom" aria-label="Drag height"></button><button class="vt-canvas-handle vt-size-handle vt-size-corner" type="button" data-drag-kind="size" data-drag-side="corner" aria-label="Drag width and height"></button>
    </div>
    <div class="vt-drag-badge" hidden></div>
    <section class="vt-panel" data-compact="true" aria-label="DOMTune visual editor">
      <div class="vt-head">
        <span class="vt-title">DOMTune</span>
        <label class="vt-mode"><span>Select element</span><input class="vt-select-toggle" type="checkbox" role="switch" aria-label="Select element" /><span class="vt-switch" aria-hidden="true"></span></label>
      </div>
      <div class="vt-context"><p class="vt-target">Select an element to inspect.</p><span class="vt-page"></span></div>
      <div class="vt-queue" hidden>
        <div class="vt-queue-head"><button class="vt-queue-toggle" type="button" aria-expanded="false"><span class="vt-queue-title">Pending elements</span></button><button class="vt-clear" type="button">Clear</button></div>
        <div class="vt-draft-list" hidden></div>
      </div>
      <div class="vt-editor">
        <div class="vt-quick">
          <p class="vt-section-label">Quick adjust</p>
          <label class="vt-quick-row" data-quick-row="padding">Padding <input class="vt-value" data-group-control="paddingAll" type="number" min="0" max="240" aria-label="Padding on all sides" /></label>
          <label class="vt-quick-row" data-quick-row="radius">Corner radius <input class="vt-value" data-proxy-control="radius" type="number" min="0" max="240" aria-label="Corner radius" /></label>
          <label class="vt-quick-row" data-quick-row="font" hidden>Font size <input class="vt-value" data-proxy-control="font" type="number" min="8" max="240" aria-label="Font size" /></label>
          <label class="vt-quick-row" data-quick-row="width" hidden>Width <input class="vt-value" data-proxy-control="width" type="number" min="0" max="4000" aria-label="Width" /></label>
          <label class="vt-quick-row" data-quick-row="height" hidden>Height <input class="vt-value" data-proxy-control="height" type="number" min="0" max="4000" aria-label="Height" /></label>
          <div class="vt-quick-row vt-color-quick" data-quick-row="textColor" data-color-target="textColor"><span>Text color</span><div class="vt-color-controls"><div class="vt-color-dropdown"><button class="vt-color-select" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="Project text color" title="Colors used on this page"><span class="vt-color-chip" aria-hidden="true"></span><span class="vt-color-value">Project</span></button><div class="vt-color-menu" role="listbox" hidden></div></div><label class="vt-color-custom" title="Custom color"><input class="vt-color-picker" type="color" aria-label="Custom text color" /><span class="vt-color-preview" aria-hidden="true"></span></label></div></div>
          <div class="vt-quick-row vt-color-quick" data-quick-row="backgroundColor" data-color-target="surfaceColor"><span>Background color</span><div class="vt-color-controls"><div class="vt-color-dropdown"><button class="vt-color-select" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="Project background color" title="Colors used on this page"><span class="vt-color-chip" aria-hidden="true"></span><span class="vt-color-value">Project</span></button><div class="vt-color-menu" role="listbox" hidden></div></div><label class="vt-color-custom" title="Custom color"><input class="vt-color-picker" type="color" aria-label="Custom background color" /><span class="vt-color-preview" aria-hidden="true"></span></label></div></div>
          <div class="vt-quick-row vt-color-quick" data-quick-row="borderColor" data-color-target="borderColor" hidden><span>Border color</span><div class="vt-color-controls"><div class="vt-color-dropdown"><button class="vt-color-select" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="Project border color" title="Colors used on this page"><span class="vt-color-chip" aria-hidden="true"></span><span class="vt-color-value">Project</span></button><div class="vt-color-menu" role="listbox" hidden></div></div><label class="vt-color-custom" title="Custom color"><input class="vt-color-picker" type="color" aria-label="Custom border color" /><span class="vt-color-preview" aria-hidden="true"></span></label></div></div>
        </div>
        <div hidden>
          <input data-control="width" type="number" min="0" max="4000" /><input data-control="height" type="number" min="0" max="4000" />
          <input data-control="marginTop" type="number" min="-400" max="400" /><input data-control="marginRight" type="number" min="-400" max="400" /><input data-control="marginBottom" type="number" min="-400" max="400" /><input data-control="marginLeft" type="number" min="-400" max="400" />
          <input data-control="paddingTop" type="number" min="0" max="240" /><input data-control="paddingRight" type="number" min="0" max="240" /><input data-control="paddingBottom" type="number" min="0" max="240" /><input data-control="paddingLeft" type="number" min="0" max="240" />
          <input data-control="borderTop" type="number" min="0" max="40" /><input data-control="borderRight" type="number" min="0" max="40" /><input data-control="borderBottom" type="number" min="0" max="40" /><input data-control="borderLeft" type="number" min="0" max="40" />
          <select data-control="borderStyle"><option value="none">None</option><option value="solid">Solid</option></select><input data-control="radius" type="number" min="0" max="240" /><input data-control="radiusTopLeft" type="number" min="0" max="240" /><input data-control="radiusTopRight" type="number" min="0" max="240" /><input data-control="radiusBottomRight" type="number" min="0" max="240" /><input data-control="radiusBottomLeft" type="number" min="0" max="240" /><input data-control="font" type="number" min="8" max="240" />
        </div>
        <div class="vt-footer">
          <textarea id="vt-prompt" class="vt-prompt" rows="1" maxlength="4000" aria-label="Instruction for this element" placeholder="Ask the agent about this element…"></textarea>
          <div class="vt-actions"><button class="vt-send" type="button" disabled>Send to Agent</button></div>
          <p class="vt-agent-status" role="status" aria-live="polite" hidden></p>
          <p class="vt-feedback" role="status"></p>
        </div>
      </div>
    </section>`;

  return `(() => {
    const config = ${JSON.stringify(config)};
    if (config.targetOrigin && location.origin !== config.targetOrigin) return;
    const mount = () => {
    if (document.querySelector("domtune-overlay")) return;
    const params = new URLSearchParams(location.search);
    const sessionId = config.sessionId || params.get("domTuneSession") || "";
    const host = document.createElement("domtune-overlay");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = ${JSON.stringify(markup)};
    document.documentElement.appendChild(host);

    const panelEl = shadow.querySelector(".vt-panel");
    const targetEl = shadow.querySelector(".vt-target");
    const pageEl = shadow.querySelector(".vt-page");
    const queueEl = shadow.querySelector(".vt-queue");
    const queueTitleEl = shadow.querySelector(".vt-queue-title");
    const queueToggle = shadow.querySelector(".vt-queue-toggle");
    const draftListEl = shadow.querySelector(".vt-draft-list");
    const clearButton = shadow.querySelector(".vt-clear");
    const quickRows = [...shadow.querySelectorAll("[data-quick-row]")];
    const proxyControls = [...shadow.querySelectorAll("[data-proxy-control]")];
    const groupControls = [...shadow.querySelectorAll("[data-group-control]")];
    const quickNumberInputs = [...shadow.querySelectorAll(".vt-value[type=number]")];
    const colorRows = [...shadow.querySelectorAll("[data-color-target]")];
    const colorDropdowns = [...shadow.querySelectorAll(".vt-color-dropdown")];
    const colorButtons = [...shadow.querySelectorAll(".vt-color-select")];
    const colorPickers = [...shadow.querySelectorAll(".vt-color-picker")];
    const selectToggle = shadow.querySelector(".vt-select-toggle");
    const sendButton = shadow.querySelector(".vt-send");
    const promptEl = shadow.querySelector(".vt-prompt");
    const agentStatusEl = shadow.querySelector(".vt-agent-status");
    const feedbackEl = shadow.querySelector(".vt-feedback");
    const hoverBox = shadow.querySelector(".vt-highlight");
    const selectionBox = shadow.querySelector(".vt-selection");
    const canvasToolbar = shadow.querySelector(".vt-canvas-toolbar");
    const scopeButtons = [...shadow.querySelectorAll("[data-adjustment-scope]")];
    const dragBadge = shadow.querySelector(".vt-drag-badge");
    const canvasHandles = [...shadow.querySelectorAll("[data-drag-kind]")];
    const canvasModeButtons = [...shadow.querySelectorAll("[data-canvas-mode]")].filter((node) => node !== selectionBox);
    const controls = Object.fromEntries([...shadow.querySelectorAll("[data-control]")].map((node) => [node.dataset.control, node]));
    const controlDefinitions = {
      marginTop: { property: "margin-top", unit: "px" },
      marginRight: { property: "margin-right", unit: "px" },
      marginBottom: { property: "margin-bottom", unit: "px" },
      marginLeft: { property: "margin-left", unit: "px" },
      borderTop: { property: "border-top-width", unit: "px" },
      borderRight: { property: "border-right-width", unit: "px" },
      borderBottom: { property: "border-bottom-width", unit: "px" },
      borderLeft: { property: "border-left-width", unit: "px" },
      paddingTop: { property: "padding-top", unit: "px" },
      paddingRight: { property: "padding-right", unit: "px" },
      paddingBottom: { property: "padding-bottom", unit: "px" },
      paddingLeft: { property: "padding-left", unit: "px" },
      width: { property: "width", unit: "px" },
      height: { property: "height", unit: "px" },
      borderStyle: { property: "border-style", unit: "" },
      radius: { property: "border-radius", unit: "px" },
      radiusTopLeft: { property: "border-top-left-radius", unit: "px" },
      radiusTopRight: { property: "border-top-right-radius", unit: "px" },
      radiusBottomRight: { property: "border-bottom-right-radius", unit: "px" },
      radiusBottomLeft: { property: "border-bottom-left-radius", unit: "px" },
      font: { property: "font-size", unit: "px" },
      surfaceColor: { property: "background-color", unit: "", color: true },
      textColor: { property: "color", unit: "", color: true },
      borderColor: { property: "border-color", unit: "", color: true }
    };
    pageEl.textContent = location.href;
    pageEl.title = location.href;
    if (!sessionId) {
      feedbackEl.textContent = "Open this page from a DOMTune agent session.";
      feedbackEl.classList.add("vt-error");
    }

    let armed = false;
    let hovered = null;
    let selected = null;
    let selectedDraft = null;
    let pendingSubmission = null;
    let draftSequence = 0;
    const windowId = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
    let queueExpanded = false;
    let activeCanvasDrag = null;
    let adjustmentScope = "all";
    let openColorDropdown = null;
    let trackedRequestId = null;
    let requestStatusTimer = null;
    const drafts = new Map();
    const projectColors = collectProjectColors();
    const trackedRequestKey = "domtune:last-request:" + sessionId;

    function positionCanvasToolbar(rect) {
      const edge = 10;
      const gap = 6;
      const toolbarRect = canvasToolbar.getBoundingClientRect();
      const toolbarWidth = toolbarRect.width + 2;
      const toolbarHeight = toolbarRect.height;
      const canPlaceAbove = rect.top >= toolbarHeight + gap + edge;
      const canPlaceBelow = rect.bottom + gap + toolbarHeight <= innerHeight - edge;
      let top = canPlaceAbove || !canPlaceBelow ? -toolbarHeight - gap : rect.height + gap;
      if (!canPlaceAbove && !canPlaceBelow) {
        top = Math.min(
          Math.max(edge - rect.top, 0),
          Math.max(0, innerHeight - edge - toolbarHeight - rect.top)
        );
      }
      const minimumLeft = edge - rect.left;
      const maximumLeft = innerWidth - edge - toolbarWidth - rect.left;
      const preferredLeft = -2;
      const left = maximumLeft < minimumLeft
        ? minimumLeft
        : Math.min(Math.max(preferredLeft, minimumLeft), maximumLeft);
      canvasToolbar.style.left = left + "px";
      canvasToolbar.style.top = top + "px";
      canvasToolbar.dataset.placement = top < 0 ? "above" : "below";
    }

    function positionBox(box, element) {
      if (!element || !element.isConnected) {
        box.hidden = true;
        return;
      }
      const rect = element.getBoundingClientRect();
      box.hidden = false;
      box.style.left = rect.left + "px";
      box.style.top = rect.top + "px";
      box.style.width = rect.width + "px";
      box.style.height = rect.height + "px";
      if (box === selectionBox) {
        positionCanvasToolbar(rect);
        const style = getComputedStyle(element);
        const halfWidth = Math.max(0, rect.width / 2 - 12);
        const halfHeight = Math.max(0, rect.height / 2 - 12);
        const bounded = (value, limit) => Math.min(limit, Math.max(0, px(value, 0)));
        const margin = (value, limit) => Math.min(limit, Math.max(-limit, px(value, 0)));
        box.style.setProperty("--vt-pt", bounded(style.paddingTop, halfHeight) + "px");
        box.style.setProperty("--vt-pr", bounded(style.paddingRight, halfWidth) + "px");
        box.style.setProperty("--vt-pb", bounded(style.paddingBottom, halfHeight) + "px");
        box.style.setProperty("--vt-pl", bounded(style.paddingLeft, halfWidth) + "px");
        box.style.setProperty("--vt-mt", margin(style.marginTop, 120) + "px");
        box.style.setProperty("--vt-mr", margin(style.marginRight, 120) + "px");
        box.style.setProperty("--vt-mb", margin(style.marginBottom, 120) + "px");
        box.style.setProperty("--vt-ml", margin(style.marginLeft, 120) + "px");
        const radiusLimit = Math.max(8, rect.width / 2 - 8);
        const radiusPosition = (value) => Math.max(8, Math.min(radiusLimit, px(value, 0)));
        box.style.setProperty("--vt-rtl", radiusPosition(style.borderTopLeftRadius) + "px");
        box.style.setProperty("--vt-rtr", radiusPosition(style.borderTopRightRadius) + "px");
        box.style.setProperty("--vt-rbr", radiusPosition(style.borderBottomRightRadius) + "px");
        box.style.setProperty("--vt-rbl", radiusPosition(style.borderBottomLeftRadius) + "px");
      }
    }

    function positionPanel() {
      if (!selected || panelEl.dataset.compact === "true") return;
      const target = selected.getBoundingClientRect();
      const style = getComputedStyle(selected);
      const positiveMargin = (value) => Math.min(120, Math.max(0, px(value, 0)));
      const handleClearance = 10;
      const bounds = {
        left: target.left - positiveMargin(style.marginLeft) - handleClearance,
        right: target.right + positiveMargin(style.marginRight) + handleClearance,
        top: target.top - positiveMargin(style.marginTop) - handleClearance,
        bottom: target.bottom + positiveMargin(style.marginBottom) + handleClearance
      };
      const toolbar = canvasToolbar.getBoundingClientRect();
      bounds.left = Math.min(bounds.left, toolbar.left - handleClearance);
      bounds.right = Math.max(bounds.right, toolbar.right + handleClearance);
      bounds.top = Math.min(bounds.top, toolbar.top - handleClearance);
      bounds.bottom = Math.max(bounds.bottom, toolbar.bottom + handleClearance);
      panelEl.style.maxHeight = "";
      const panel = panelEl.getBoundingClientRect();
      const gap = 12;
      const edge = 12;
      const clampLeft = (value) => Math.min(Math.max(edge, value), Math.max(edge, innerWidth - panel.width - edge));
      let left;
      let top;
      if (bounds.right + gap + panel.width <= innerWidth - edge) {
        left = bounds.right + gap;
        top = Math.min(Math.max(edge, bounds.top), Math.max(edge, innerHeight - panel.height - edge));
      } else if (bounds.left - gap - panel.width >= edge) {
        left = bounds.left - panel.width - gap;
        top = Math.min(Math.max(edge, bounds.top), Math.max(edge, innerHeight - panel.height - edge));
      } else {
        const belowTop = bounds.bottom + gap;
        const belowSpace = innerHeight - edge - belowTop;
        const aboveSpace = bounds.top - gap - edge;
        const minimumUsefulHeight = Math.min(280, panel.height);
        if (belowSpace >= minimumUsefulHeight || aboveSpace >= minimumUsefulHeight) {
          const placeBelow = belowSpace >= minimumUsefulHeight && belowSpace >= aboveSpace;
          const availableHeight = Math.max(96, placeBelow ? belowSpace : aboveSpace);
          panelEl.style.maxHeight = availableHeight + "px";
          const constrainedPanel = panelEl.getBoundingClientRect();
          left = clampLeft(target.left + target.width / 2 - constrainedPanel.width / 2);
          top = placeBelow ? belowTop : bounds.top - gap - constrainedPanel.height;
        } else {
          panelEl.style.maxHeight = Math.max(96, innerHeight - edge * 2) + "px";
          const dockedPanel = panelEl.getBoundingClientRect();
          const toolbarCenterX = toolbar.left + toolbar.width / 2;
          const toolbarCenterY = toolbar.top + toolbar.height / 2;
          left = toolbarCenterX > innerWidth / 2 ? edge : innerWidth - dockedPanel.width - edge;
          top = toolbarCenterY > innerHeight / 2 ? edge : innerHeight - dockedPanel.height - edge;
        }
      }
      left = clampLeft(left);
      const finalPanel = panelEl.getBoundingClientRect();
      top = Math.min(Math.max(edge, top), Math.max(edge, innerHeight - finalPanel.height - edge));
      panelEl.style.right = "auto";
      panelEl.style.bottom = "auto";
      panelEl.style.left = left + "px";
      panelEl.style.top = top + "px";
    }

    function positionColorMenu(dropdown) {
      const button = dropdown?.querySelector(".vt-color-select");
      const menu = dropdown?.querySelector(".vt-color-menu");
      if (!button || !menu || menu.hidden) return;
      const trigger = button.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const edge = 8;
      const gap = 4;
      const left = Math.min(Math.max(edge, trigger.left), Math.max(edge, innerWidth - menuRect.width - edge));
      const below = trigger.bottom + gap;
      const top = below + menuRect.height <= innerHeight - edge
        ? below
        : Math.max(edge, trigger.top - menuRect.height - gap);
      menu.style.left = left + "px";
      menu.style.top = top + "px";
    }

    function closeColorMenus() {
      colorDropdowns.forEach((dropdown) => {
        dropdown.querySelector(".vt-color-select").setAttribute("aria-expanded", "false");
        dropdown.querySelector(".vt-color-menu").hidden = true;
      });
      openColorDropdown = null;
    }

    function refreshAnchors() {
      if (armed) positionBox(selectionBox, selected);
      else selectionBox.hidden = true;
      if (armed) positionBox(hoverBox, hovered);
      positionPanel();
      if (openColorDropdown) positionColorMenu(openColorDropdown);
    }

    function setSelectionMode(next) {
      armed = next;
      selectToggle.checked = next;
      if (!next) {
        if (activeCanvasDrag) finishCanvasDrag(true);
        closeColorMenus();
        clearHover();
        selectionBox.hidden = true;
        dragBadge.hidden = true;
        pruneDraft(selectedDraft);
        selected = null;
        selectedDraft = null;
        panelEl.dataset.compact = "true";
        panelEl.style.left = "auto";
        panelEl.style.top = "auto";
        panelEl.style.right = "12px";
        panelEl.style.bottom = "12px";
        panelEl.style.maxHeight = "";
        targetEl.textContent = "Select an element to inspect.";
        updateDraftList();
      }
      feedbackEl.classList.remove("vt-error");
      feedbackEl.textContent = next ? "Move over the page, then click an element. Press Escape to cancel." : "";
    }

    function px(value, fallback) {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    function normalizeColor(value) {
      const match = String(value || "").match(/rgba?\\(\\s*([\\d.]+)[,\\s]+([\\d.]+)[,\\s]+([\\d.]+)(?:\\s*[,/]\\s*([\\d.]+)%?)?\\s*\\)/i);
      if (!match) return /^#[\\da-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : null;
      const alpha = match[4] === undefined ? 1 : Number(match[4]);
      if (!Number.isFinite(alpha) || alpha === 0) return null;
      return "#" + match.slice(1, 4).map((part) => Math.min(255, Math.max(0, Math.round(Number(part)))).toString(16).padStart(2, "0")).join("");
    }

    function collectProjectColors() {
      const counts = new Map();
      const nodes = [document.documentElement, document.body, ...document.querySelectorAll("body *")].filter(Boolean).slice(0, 600);
      const properties = ["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"];
      for (const node of nodes) {
        const style = getComputedStyle(node);
        for (const property of properties) {
          const color = normalizeColor(style[property]);
          if (color) counts.set(color, (counts.get(color) || 0) + 1);
        }
      }
      return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 16).map(([color]) => color);
    }

    function selectorFor(element) {
      if (element.id) return "#" + CSS.escape(element.id);
      const path = [];
      let node = element;
      while (node && node !== document.body && path.length < 4) {
        let part = node.tagName.toLowerCase();
        const classes = [...node.classList].filter((name) => !name.startsWith("vt-")).slice(0, 2);
        if (classes.length) part += "." + classes.map((name) => CSS.escape(name)).join(".");
        path.unshift(part);
        node = node.parentElement;
      }
      return path.join(" > ");
    }

    function explicitSourceFor(element) {
      const sourceNode = element.closest("[data-domtune-source]");
      const value = sourceNode?.getAttribute("data-domtune-source");
      if (!value) return null;
      const separator = value.lastIndexOf(":");
      if (separator < 1) return null;
      const file = normalizeWorkspaceFile(value.slice(0, separator));
      const line = Number(value.slice(separator + 1));
      if (!file || !Number.isInteger(line) || line < 1) return null;
      return { file, line, method: "explicit", confidence: "exact" };
    }

    function normalizeWorkspaceFile(value) {
      let file = decodeURIComponent(String(value || "")).replaceAll("\\\\", "/");
      if (file.startsWith("file://")) {
        try { file = decodeURIComponent(new URL(file).pathname); } catch { return null; }
      }
      if (file.startsWith("/@fs/")) file = file.slice(4);
      let workspace = String(config.workspace || "").replaceAll("\\\\", "/");
      if (workspace.endsWith("/")) workspace = workspace.slice(0, -1);
      const windowsAbsolute = file.length > 2 && /[A-Za-z]/.test(file[0]) && file[1] === ":" && file[2] === "/";
      const absolute = file.startsWith("/") || windowsAbsolute;
      if (!absolute) return file.startsWith("./") ? file.slice(2) : file;
      if (file === workspace) return ".";
      if (!workspace || !file.startsWith(workspace + "/")) return null;
      return file.slice(workspace.length + 1);
    }

    function sourceFileForSheet(sheet) {
      const owner = sheet.ownerNode;
      const hinted = owner?.getAttribute?.("data-vite-dev-id") || owner?.getAttribute?.("data-domtune-source-file");
      if (hinted) return normalizeWorkspaceFile(hinted);
      if (!sheet.href) return null;
      try {
        const url = new URL(sheet.href, location.href);
        return normalizeWorkspaceFile(url.pathname);
      } catch {
        return null;
      }
    }

    function lineForSelector(text, selector) {
      if (!text || !selector) return null;
      let offset = 0;
      let found = null;
      while (offset < text.length) {
        const index = text.indexOf(selector, offset);
        if (index < 0) return found;
        const next = text.slice(index + selector.length).trimStart()[0];
        if (next === "{" || next === ",") {
          if (found !== null) return null;
          found = text.slice(0, index).split("\\n").length;
        }
        offset = index + selector.length;
      }
      return found;
    }

    function ruleDeclares(rule, property) {
      if (rule.style.getPropertyValue(property)) return true;
      if (property === "background-color" && rule.style.getPropertyValue("background")) return true;
      if (property.startsWith("border-") && property.endsWith("-radius") && rule.style.getPropertyValue("border-radius")) return true;
      if (property.startsWith("padding-") && rule.style.getPropertyValue("padding")) return true;
      if (property.startsWith("margin-") && rule.style.getPropertyValue("margin")) return true;
      if (property.startsWith("border-") && property.endsWith("-width") && (rule.style.getPropertyValue("border-width") || rule.style.getPropertyValue("border"))) return true;
      return false;
    }

    function matchingRules(element, properties) {
      const matches = [];
      function visit(rules, sheet) {
        for (const rule of rules) {
          if (rule.type === 1 && rule.selectorText) {
            let selected = false;
            try { selected = element.matches(rule.selectorText); } catch { selected = false; }
            if (!selected || !properties.some((property) => ruleDeclares(rule, property))) continue;
            const file = sourceFileForSheet(sheet);
            const text = sheet.ownerNode?.textContent || "";
            const line = lineForSelector(text, rule.selectorText);
            if (file && line) matches.push({ file, line, selector: rule.selectorText, method: "css-rule", confidence: "exact" });
            continue;
          }
          if (!rule.cssRules) continue;
          if (rule.conditionText && typeof matchMedia === "function" && !matchMedia(rule.conditionText).matches) continue;
          visit(rule.cssRules, sheet);
        }
      }
      for (const sheet of document.styleSheets) {
        try { visit(sheet.cssRules, sheet); } catch { /* Cross-origin stylesheets are not inspectable. */ }
      }
      return matches;
    }

    function sourceFor(element, properties) {
      const explicit = explicitSourceFor(element);
      if (explicit) return explicit;
      const unique = new Map();
      for (const candidate of matchingRules(element, properties)) unique.set(candidate.file + ":" + candidate.line + ":" + candidate.selector, candidate);
      if (unique.size !== 1) return null;
      const candidate = [...unique.values()][0];
      return { file: candidate.file, line: candidate.line, method: candidate.method, confidence: candidate.confidence };
    }

    async function controlledBrowserSource(draft, properties, before) {
      if (!draft?.id) return null;
      try {
        const response = await fetch(config.bridgeUrl + "/api/source-map", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId, targetToken: draft.id, properties, before })
        });
        const result = await response.json();
        if (response.status === 404 && result.reason === "session-not-found") return null;
        if (!response.ok && response.status !== 404) throw new Error(result.error || ("HTTP " + response.status));
        return result;
      } catch {
        return null;
      }
    }

    function clearHover() {
      hoverBox.hidden = true;
      hovered = null;
    }

    function draftValue(style, definition) {
      const raw = style.getPropertyValue(definition.property);
      if (definition.color) return normalizeColor(raw) || "";
      if (definition.unit === "px") return String(Math.round(px(raw, 0)));
      return raw;
    }

    function createDraft(element) {
      const style = getComputedStyle(element);
      const id = sessionId.replace(/[^A-Za-z0-9_-]/g, "") + "_" + windowId + "_" + Date.now().toString(36) + "_" + (++draftSequence);
      const baseline = Object.fromEntries(Object.entries(controlDefinitions).map(([name, definition]) => [name, style.getPropertyValue(definition.property)]));
      const values = Object.fromEntries(Object.entries(controlDefinitions).map(([name, definition]) => [name, draftValue(style, definition)]));
      const originalInline = Object.fromEntries(Object.entries(controlDefinitions).map(([name, definition]) => [name, element.style.getPropertyValue(definition.property)]));
      const draft = {
        id,
        element,
        selector: selectorFor(element),
        label: element.getAttribute("aria-label") || element.tagName.toLowerCase(),
        context: elementContext(element),
        baseline,
        values,
        originalInline,
        touched: new Set(),
        prompt: ""
      };
      drafts.set(element, draft);
      element.setAttribute("data-domtune-target", id);
      return draft;
    }

    function isMeaningful(draft) {
      return Boolean(draft && (changesForDraft(draft).length > 0 || draft.prompt.trim()));
    }

    function meaningfulDrafts() {
      return [...drafts.values()].filter(isMeaningful);
    }

    function discardDraft(draft, revert) {
      if (!draft) return;
      if (revert) {
        for (const [name, definition] of Object.entries(controlDefinitions)) {
          const original = draft.originalInline[name];
          if (original) draft.element.style.setProperty(definition.property, original);
          else draft.element.style.removeProperty(definition.property);
        }
      }
      draft.element.removeAttribute("data-domtune-target");
      drafts.delete(draft.element);
    }

    function pruneDraft(draft) {
      if (draft && !isMeaningful(draft)) discardDraft(draft, true);
    }

    function clearDraftFromQueue(draft) {
      const wasSelected = selectedDraft === draft;
      const element = draft.element;
      discardDraft(draft, true);
      if (wasSelected) {
        selected = null;
        selectedDraft = null;
        if (element.isConnected) selectElement(element);
        else {
          selectionBox.hidden = true;
          targetEl.textContent = "Select an element to inspect.";
        }
      } else {
        updateDraftList();
        updateSendState();
      }
      feedbackEl.textContent = "Cleared changes for this element.";
      requestAnimationFrame(positionPanel);
    }

    function updateDraftList() {
      const active = meaningfulDrafts();
      queueEl.hidden = active.length === 0;
      queueTitleEl.textContent = active.length + (active.length === 1 ? " pending element" : " pending elements");
      queueToggle.setAttribute("aria-expanded", String(queueExpanded));
      draftListEl.hidden = !queueExpanded;
      draftListEl.replaceChildren(...active.map((draft) => {
        const row = document.createElement("div");
        row.className = "vt-draft";
        row.dataset.active = String(selectedDraft === draft);
        const selectButton = document.createElement("button");
        selectButton.className = "vt-draft-select";
        selectButton.type = "button";
        selectButton.setAttribute("aria-pressed", String(selectedDraft === draft));
        selectButton.setAttribute("aria-label", "Select " + draft.selector);
        const name = document.createElement("span");
        name.className = "vt-draft-name";
        name.textContent = draft.selector;
        name.title = draft.selector;
        const meta = document.createElement("span");
        meta.className = "vt-draft-meta";
        const parts = [];
        const changeCount = changesForDraft(draft).length;
        if (changeCount) parts.push(changeCount + (changeCount === 1 ? " style" : " styles"));
        if (draft.prompt.trim()) parts.push("message");
        meta.textContent = parts.join(" + ");
        selectButton.append(name, meta);
        selectButton.addEventListener("click", () => {
          if (!draft.element.isConnected) {
            discardDraft(draft, false);
            updateDraftList();
            updateSendState();
            feedbackEl.textContent = "This element is no longer on the page.";
            return;
          }
          selectElement(draft.element);
          feedbackEl.textContent = "Switched to this pending element.";
        });
        const removeButton = document.createElement("button");
        removeButton.className = "vt-draft-remove";
        removeButton.type = "button";
        removeButton.setAttribute("aria-label", "Clear changes for " + draft.selector);
        removeButton.title = "Clear this element";
        removeButton.addEventListener("click", () => clearDraftFromQueue(draft));
        row.append(selectButton, removeButton);
        return row;
      }));
    }

    function selectElement(element) {
      resetPendingSubmission();
      closeColorMenus();
      clearHover();
      if (selectedDraft && selectedDraft.element !== element) pruneDraft(selectedDraft);
      selected = element;
      selectedDraft = drafts.get(element) || createDraft(element);
      element.setAttribute("data-domtune-target", selectedDraft.id);
      for (const [name, control] of Object.entries(controls)) control.value = selectedDraft.values[name];
      promptEl.value = selectedDraft.prompt;
      panelEl.dataset.compact = "false";
      const source = sourceFor(element, [...new Set(Object.values(controlDefinitions).map((definition) => definition.property))]);
      targetEl.textContent = selectedDraft.selector + (source ? " · " + source.file + ":" + source.line : " · page context ready");
      selectionBox.dataset.canvasMode = "size";
      canvasModeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.canvasMode === "size")));
      adjustmentScope = "all";
      scopeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.adjustmentScope === adjustmentScope)));
      updateQuickProfile(element);
      updateOutputs();
      renderColorControls();
      updateDraftList();
      updateSendState();
      positionBox(selectionBox, selected);
      requestAnimationFrame(positionPanel);
      return source;
    }

    function compactElementHtml(element) {
      const clean = (node) => {
        [...node.attributes].forEach((attribute, index) => {
          const name = attribute.name.toLowerCase();
          if (index >= 12 || name === "data-domtune-target" || name.startsWith("on") || attribute.value.length > 240) {
            node.removeAttribute(attribute.name);
          }
        });
      };
      const clone = element.cloneNode(true);
      clean(clone);
      clone.querySelectorAll("*").forEach(clean);
      const full = clone.outerHTML.replace(/\\s+/g, " ").trim();
      if (full.length <= 1400) return full;
      const minimal = document.createElement(element.tagName.toLowerCase());
      if (element.id) minimal.id = element.id.slice(0, 200);
      const className = [...element.classList].slice(0, 10).join(" ").slice(0, 400);
      if (className) minimal.className = className;
      const role = element.getAttribute("role");
      const ariaLabel = element.getAttribute("aria-label");
      if (role) minimal.setAttribute("role", role.slice(0, 100));
      if (ariaLabel) minimal.setAttribute("aria-label", ariaLabel.slice(0, 500));
      minimal.textContent = (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 500);
      return minimal.outerHTML;
    }

    function elementContext(element) {
      const text = (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 500);
      const ariaLabel = element.getAttribute("aria-label")?.slice(0, 500) || undefined;
      const role = element.getAttribute("role")?.slice(0, 100) || undefined;
      const id = element.id.slice(0, 200) || undefined;
      const classNames = [...element.classList].slice(0, 20).map((name) => name.slice(0, 200));
      return {
        tagName: element.tagName.toLowerCase(),
        html: compactElementHtml(element),
        ...(text ? { text } : {}),
        ...(id ? { id } : {}),
        ...(classNames.length ? { classNames } : {}),
        ...(role ? { role } : {}),
        ...(ariaLabel ? { ariaLabel } : {})
      };
    }

    function updateOutputs() {
      for (const proxy of proxyControls) {
        if (proxy.dataset.proxyControl === "radius" && selectedDraft) {
          const values = ["radiusTopLeft", "radiusTopRight", "radiusBottomRight", "radiusBottomLeft"].map((name) => selectedDraft.values[name]);
          proxy.value = values.every((value) => value === values[0]) ? values[0] : "";
          proxy.placeholder = proxy.value ? "" : "Mixed";
        } else {
          proxy.value = controls[proxy.dataset.proxyControl]?.value || "";
        }
      }
      for (const control of groupControls) {
        const names = control.dataset.groupControl === "paddingAll"
          ? ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]
          : ["marginTop", "marginRight", "marginBottom", "marginLeft"];
        const values = names.map((name) => controls[name].value);
        control.value = values.every((value) => value === values[0]) ? values[0] : "";
        control.placeholder = control.value ? "" : "Mixed";
      }
    }

    function updateQuickProfile(element) {
      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute("role") || "";
      const textTags = new Set(["p", "span", "strong", "em", "small", "label", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote"]);
      const mediaTags = new Set(["img", "video", "canvas", "svg", "picture"]);
      const isText = textTags.has(tag) || (element.children.length === 0 && Boolean((element.textContent || "").trim()) && !["button", "a", "input", "textarea", "select"].includes(tag));
      const profile = mediaTags.has(tag) ? "media" : isText ? "text" : (tag === "button" || tag === "a" || role === "button") ? "action" : "container";
      const visible = profile === "text"
        ? ["font", "textColor", "backgroundColor"]
        : profile === "media"
          ? ["width", "height", "radius", "backgroundColor"]
          : ["padding", "radius", "textColor", "backgroundColor"];
      quickRows.forEach((row) => { row.hidden = !visible.includes(row.dataset.quickRow); });
    }

    function applyDraftValue(name, value) {
      if (!selectedDraft) return;
      const definition = controlDefinitions[name];
      selectedDraft.values[name] = value;
      selectedDraft.element.style.setProperty(definition.property, value + definition.unit);
      if (name === "radius") {
        ["radiusTopLeft", "radiusTopRight", "radiusBottomRight", "radiusBottomLeft"].forEach((cornerName) => {
          selectedDraft.values[cornerName] = value;
          controls[cornerName].value = value;
        });
      }
      updateOutputs();
    }

    function commitControl(name, value) {
      resetPendingSubmission();
      if (!selectedDraft || value === "") return;
      selectedDraft.touched.add(name);
      applyDraftValue(name, value);
      if (name.startsWith("border") && name !== "borderStyle" && Number(value) > 0 && selectedDraft.values.borderStyle === "none") {
        controls.borderStyle.value = "solid";
        selectedDraft.touched.add("borderStyle");
        applyDraftValue("borderStyle", "solid");
      }
      updateDraftList();
      updateSendState();
    }

    function nudgeQuickInput(input, direction, event) {
      if (!selectedDraft) return;
      const delta = direction * (event.shiftKey ? 10 : 1);
      if (input.dataset.groupControl) {
        const names = input.dataset.groupControl === "paddingAll"
          ? ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]
          : ["marginTop", "marginRight", "marginBottom", "marginLeft"];
        names.forEach((name) => {
          const next = boundedControlValue(name, (Number(selectedDraft.values[name]) || 0) + delta);
          controls[name].value = String(next);
          commitControl(name, String(next));
        });
        return;
      }
      const name = input.dataset.proxyControl;
      const current = name === "radius" && input.value === "" ? Number(selectedDraft.values.radiusTopLeft) || 0 : Number(selectedDraft.values[name]) || 0;
      const next = boundedControlValue(name, current + delta);
      controls[name].value = String(next);
      commitControl(name, String(next));
    }

    quickNumberInputs.forEach((input) => {
      const label = input.getAttribute("aria-label") || "value";
      const wrapper = document.createElement("span");
      wrapper.className = "vt-stepper";
      const minus = document.createElement("button");
      minus.className = "vt-step vt-step-minus";
      minus.type = "button";
      minus.setAttribute("aria-label", "Decrease " + label);
      const plus = document.createElement("button");
      plus.className = "vt-step vt-step-plus";
      plus.type = "button";
      plus.setAttribute("aria-label", "Increase " + label);
      input.before(wrapper);
      wrapper.append(minus, input, plus);
      minus.addEventListener("click", (event) => nudgeQuickInput(input, -1, event));
      plus.addEventListener("click", (event) => nudgeQuickInput(input, 1, event));
    });

    function dragProperties(kind, side) {
      if (kind === "size") {
        if (side === "corner") return [{ name: "width", axis: "x", direction: 1 }, { name: "height", axis: "y", direction: 1 }];
        return [{ name: side === "right" ? "width" : "height", axis: side === "right" ? "x" : "y", direction: 1 }];
      }
      if (kind === "radius") {
        const cornerNames = {
          topLeft: "radiusTopLeft",
          topRight: "radiusTopRight",
          bottomRight: "radiusBottomRight",
          bottomLeft: "radiusBottomLeft"
        };
        const name = adjustmentScope === "all" ? "radius" : cornerNames[side];
        const direction = side.endsWith("Left") ? 1 : -1;
        return [{ name, axis: "x", direction }];
      }
      const prefix = kind === "padding" ? "padding" : kind === "margin" ? "margin" : "border";
      const axis = side === "left" || side === "right" ? "x" : "y";
      const directions = {
        padding: { top: 1, right: -1, bottom: 1, left: 1 },
        margin: { top: -1, right: -1, bottom: 1, left: 1 },
        border: { top: 1, right: -1, bottom: 1, left: 1 }
      };
      const direction = directions[kind][side];
      const opposite = { top: "bottom", right: "left", bottom: "top", left: "right" };
      const sides = adjustmentScope === "all"
        ? [side, ...["top", "right", "bottom", "left"].filter((item) => item !== side)]
        : adjustmentScope === "opposite"
          ? [side, opposite[side]]
          : [side];
      return sides.map((currentSide) => ({
        name: prefix + currentSide[0].toUpperCase() + currentSide.slice(1),
        axis,
        direction,
        linked: adjustmentScope !== "each"
      }));
    }

    function boundedControlValue(name, value) {
      const control = controls[name];
      const min = control.min === "" ? -Infinity : Number(control.min);
      const max = control.max === "" ? Infinity : Number(control.max);
      return Math.min(max, Math.max(min, value));
    }

    function updateDragBadge(event, values) {
      dragBadge.hidden = false;
      dragBadge.textContent = values.join(" · ");
      dragBadge.style.left = Math.min(innerWidth - 150, event.clientX + 12) + "px";
      dragBadge.style.top = Math.min(innerHeight - 32, event.clientY + 12) + "px";
    }

    function finishCanvasDrag(restore) {
      if (!activeCanvasDrag) return;
      const { handle, properties, startValues, pointerId } = activeCanvasDrag;
      if (restore) {
        properties.forEach(({ name }, index) => {
          controls[name].value = String(startValues[index]);
          commitControl(name, String(startValues[index]));
        });
      }
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      selectionBox.removeAttribute("data-drag-kind");
      dragBadge.hidden = true;
      activeCanvasDrag = null;
      refreshAnchors();
    }

    canvasHandles.forEach((handle) => {
      handle.addEventListener("pointerdown", (event) => {
        if (!selectedDraft) return;
        event.preventDefault();
        event.stopPropagation();
        const kind = handle.dataset.dragKind;
        const side = handle.dataset.dragSide;
        const properties = dragProperties(kind, side);
        activeCanvasDrag = {
          handle,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          properties,
          startValues: properties.map(({ name }) => Number(selectedDraft.values[name]) || 0),
          linked: properties.some((property) => property.linked),
          scopeLabel: adjustmentScope === "all" ? "All sides" : adjustmentScope === "opposite" ? "Opposite sides" : ""
        };
        handle.setPointerCapture(event.pointerId);
        selectionBox.dataset.dragKind = kind;
        updateDragBadge(event, activeCanvasDrag.linked
          ? [activeCanvasDrag.scopeLabel + " " + activeCanvasDrag.startValues[0] + "px"]
          : properties.map(({ name }, index) => controlDefinitions[name].property + " " + activeCanvasDrag.startValues[index] + "px"));
      });
      handle.addEventListener("pointermove", (event) => {
        if (!activeCanvasDrag || activeCanvasDrag.handle !== handle) return;
        const increment = event.shiftKey ? 10 : 1;
        const deltaX = Math.round((event.clientX - activeCanvasDrag.startX) / increment) * increment;
        const deltaY = Math.round((event.clientY - activeCanvasDrag.startY) / increment) * increment;
        const labels = [];
        activeCanvasDrag.properties.forEach(({ name, axis, direction }, index) => {
          const delta = axis === "x" ? deltaX : deltaY;
          const start = activeCanvasDrag.linked ? activeCanvasDrag.startValues[0] : activeCanvasDrag.startValues[index];
          const next = boundedControlValue(name, start + delta * direction);
          controls[name].value = String(next);
          commitControl(name, String(next));
          if (!activeCanvasDrag.linked) labels.push(controlDefinitions[name].property + " " + next + "px");
          else if (!labels.length) labels.push(activeCanvasDrag.scopeLabel + " " + next + "px");
        });
        updateDragBadge(event, labels);
        requestAnimationFrame(refreshAnchors);
      });
      handle.addEventListener("pointerup", () => finishCanvasDrag(false));
      handle.addEventListener("pointercancel", () => finishCanvasDrag(true));
    });

    canvasModeButtons.forEach((button) => button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const mode = button.dataset.canvasMode;
      selectionBox.dataset.canvasMode = mode;
      canvasModeButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      if (mode === "radius" && adjustmentScope === "opposite") adjustmentScope = "all";
      scopeButtons.forEach((item) => item.setAttribute("aria-pressed", String(item.dataset.adjustmentScope === adjustmentScope)));
      if (selected) updateQuickProfile(selected);
      if (mode === "border") {
        const borderColorRow = quickRows.find((row) => row.dataset.quickRow === "borderColor");
        if (borderColorRow) borderColorRow.hidden = false;
      }
      renderColorControls();
      requestAnimationFrame(positionPanel);
    }));

    scopeButtons.forEach((button) => button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextScope = button.dataset.adjustmentScope;
      if (selectionBox.dataset.canvasMode === "radius" && nextScope === "opposite") return;
      adjustmentScope = nextScope;
      scopeButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      requestAnimationFrame(positionPanel);
    }));

    function renderColorControls() {
      colorRows.forEach((row) => {
        const target = row.dataset.colorTarget;
        const button = row.querySelector(".vt-color-select");
        const chip = row.querySelector(".vt-color-chip");
        const value = row.querySelector(".vt-color-value");
        const menu = row.querySelector(".vt-color-menu");
        const picker = row.querySelector(".vt-color-picker");
        const activeValue = normalizeColor(selectedDraft?.values[target]) || "";
        const options = projectColors.map((color) => {
          const option = document.createElement("button");
          option.className = "vt-color-option";
          option.type = "button";
          option.setAttribute("role", "option");
          option.setAttribute("aria-selected", String(activeValue === color));
          const swatch = document.createElement("span");
          swatch.className = "vt-color-option-swatch";
          swatch.setAttribute("aria-hidden", "true");
          swatch.style.setProperty("--vt-color-preview", color);
          const label = document.createElement("span");
          label.textContent = color.toUpperCase();
          option.append(swatch, label);
          option.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!selectedDraft) return;
            commitControl(target, color);
            closeColorMenus();
            renderColorControls();
          });
          return option;
        });
        if (options.length) {
          menu.replaceChildren(...options);
        } else {
          const empty = document.createElement("span");
          empty.className = "vt-color-empty";
          empty.textContent = "No project colors";
          menu.replaceChildren(empty);
        }
        chip.dataset.empty = String(!activeValue);
        chip.style.setProperty("--vt-color-preview", activeValue || "transparent");
        value.textContent = activeValue ? activeValue.toUpperCase() : "Project";
        button.title = activeValue ? "Current color " + activeValue.toUpperCase() : "Colors used on this page";
        picker.value = activeValue || "#000000";
        const custom = row.querySelector(".vt-color-custom");
        custom.dataset.empty = String(!activeValue);
        custom.style.setProperty("--vt-color-preview", activeValue || "transparent");
      });
    }

    colorButtons.forEach((button) => button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const dropdown = button.closest(".vt-color-dropdown");
      const wasOpen = openColorDropdown === dropdown && !dropdown.querySelector(".vt-color-menu").hidden;
      closeColorMenus();
      if (wasOpen) return;
      const menu = dropdown.querySelector(".vt-color-menu");
      menu.hidden = false;
      button.setAttribute("aria-expanded", "true");
      openColorDropdown = dropdown;
      positionColorMenu(dropdown);
    }));

    shadow.addEventListener("pointerdown", (event) => {
      if (!event.target.closest(".vt-color-dropdown")) closeColorMenus();
    });

    document.addEventListener("pointerdown", (event) => {
      if (!host.contains(event.target)) closeColorMenus();
    }, true);

    colorPickers.forEach((picker) => {
      picker.addEventListener("input", () => {
        if (!selectedDraft) return;
        const target = picker.closest("[data-color-target]").dataset.colorTarget;
        commitControl(target, picker.value);
      });
      picker.addEventListener("change", renderColorControls);
    });

    function resetPendingSubmission() {
      pendingSubmission = null;
      feedbackEl.classList.remove("vt-warning");
      if (sendButton.textContent === "Confirm & Send" || sendButton.textContent === "Sent to Agent") sendButton.textContent = "Send to Agent";
    }

    Object.entries(controls).forEach(([name, control]) => control.addEventListener("input", () => commitControl(name, control.value)));

    proxyControls.forEach((control) => control.addEventListener("input", () => {
      const name = control.dataset.proxyControl;
      controls[name].value = control.value;
      commitControl(name, control.value);
    }));

    groupControls.forEach((control) => control.addEventListener("input", () => {
      if (control.value === "") return;
      const names = control.dataset.groupControl === "paddingAll"
        ? ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]
        : ["marginTop", "marginRight", "marginBottom", "marginLeft"];
      names.forEach((name) => {
        controls[name].value = control.value;
        commitControl(name, control.value);
      });
    }));

    queueToggle.addEventListener("click", () => {
      queueExpanded = !queueExpanded;
      updateDraftList();
      requestAnimationFrame(positionPanel);
    });

    function updateSendState() {
      const active = meaningfulDrafts();
      sendButton.disabled = !sessionId || active.length === 0;
      if (!pendingSubmission) sendButton.textContent = active.length ? "Send " + active.length + (active.length === 1 ? " element" : " elements") : "Send to Agent";
    }

    function renderAgentStatus(item) {
      if (!item) {
        agentStatusEl.hidden = true;
        delete agentStatusEl.dataset.state;
        agentStatusEl.textContent = "";
        agentStatusEl.removeAttribute("title");
        return;
      }
      const summary = item.result?.summary?.trim();
      let state = "queued";
      let message = "Waiting for Codex…";
      if (item.status === "applied") {
        state = "applied";
        message = summary ? "Applied — " + summary : "Applied";
      } else if (item.status === "failed") {
        state = "failed";
        message = summary ? "Couldn’t apply — " + summary : "Couldn’t apply the request";
      } else if (item.conversationNotifiedAt) {
        state = "running";
        message = "Codex is working…";
      } else if (item.conversationClaimedAt) {
        state = "queued";
        message = "Sending to Codex…";
      } else if (item.delivery && !item.delivery.connected && Date.now() - Date.parse(item.createdAt) > 8_000) {
        state = "paused";
        message = "Codex connection paused. Open DOMTune in the conversation to reconnect.";
      }
      agentStatusEl.hidden = false;
      agentStatusEl.dataset.state = state;
      agentStatusEl.textContent = message;
      agentStatusEl.title = item.id;
    }

    function rememberTrackedRequest(item) {
      trackedRequestId = item?.id || null;
      try {
        if (trackedRequestId) localStorage.setItem(trackedRequestKey, trackedRequestId);
        else localStorage.removeItem(trackedRequestKey);
      } catch {
        // Status still works for this page when storage is unavailable.
      }
      renderAgentStatus(item);
    }

    async function refreshTrackedRequest() {
      if (!trackedRequestId) return;
      try {
        const response = await fetch(config.bridgeUrl + "/api/change-sets/" + encodeURIComponent(trackedRequestId));
        if (response.status === 404) {
          rememberTrackedRequest(null);
          return;
        }
        const item = await response.json();
        if (!response.ok) throw new Error(item.error || ("HTTP " + response.status));
        renderAgentStatus(item);
        if (item.status === "applied" || item.status === "failed") {
          clearInterval(requestStatusTimer);
          requestStatusTimer = null;
        }
      } catch (error) {
        agentStatusEl.hidden = false;
        agentStatusEl.dataset.state = "error";
        agentStatusEl.textContent = "Status unavailable. Retrying…";
        agentStatusEl.title = error.message;
      }
    }

    function startRequestStatusTracking(item) {
      rememberTrackedRequest(item);
      if (requestStatusTimer) clearInterval(requestStatusTimer);
      requestStatusTimer = setInterval(refreshTrackedRequest, 1200);
      void refreshTrackedRequest();
    }

    try {
      trackedRequestId = localStorage.getItem(trackedRequestKey);
    } catch {
      trackedRequestId = null;
    }
    if (trackedRequestId) {
      requestStatusTimer = setInterval(refreshTrackedRequest, 1200);
      void refreshTrackedRequest();
    }

    selectToggle.addEventListener("change", () => setSelectionMode(selectToggle.checked));
    promptEl.addEventListener("input", () => {
      resetPendingSubmission();
      if (selectedDraft) selectedDraft.prompt = promptEl.value;
      updateDraftList();
      updateSendState();
    });
    promptEl.addEventListener("focus", () => requestAnimationFrame(positionPanel));
    promptEl.addEventListener("blur", () => requestAnimationFrame(positionPanel));
    promptEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      if (!sendButton.disabled) sendButton.click();
    });

    clearButton.addEventListener("click", () => {
      const current = selected;
      queueExpanded = false;
      for (const draft of [...drafts.values()]) discardDraft(draft, true);
      selected = null;
      selectedDraft = null;
      if (current?.isConnected) selectElement(current);
      feedbackEl.textContent = "Pending changes cleared.";
    });

    document.addEventListener("pointerover", (event) => {
      if (!armed) return;
      if (host.contains(event.target)) {
        clearHover();
        return;
      }
      clearHover();
      hovered = event.target;
      positionBox(hoverBox, hovered);
    }, true);

    document.addEventListener("click", (event) => {
      if (!armed || host.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      const source = selectElement(event.target.closest("[data-domtune-source]") || event.target);
      feedbackEl.textContent = source
        ? (source.method === "css-rule" ? "Element selected. Source mapped automatically." : "Element selected. Source hint verified.")
        : "Element selected. Source unavailable; page and element context will be sent to the agent.";
    }, true);

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (openColorDropdown) {
        closeColorMenus();
        return;
      }
      if (activeCanvasDrag) {
        finishCanvasDrag(true);
        feedbackEl.textContent = "Canvas adjustment cancelled.";
        return;
      }
      if (pendingSubmission) {
        resetPendingSubmission();
        feedbackEl.textContent = "Shared Token send cancelled.";
        return;
      }
      if (armed) {
        setSelectionMode(false);
        feedbackEl.textContent = "Selection cancelled.";
      }
    });

    addEventListener("scroll", refreshAnchors, true);
    addEventListener("resize", refreshAnchors);

    function changesForDraft(draft) {
      return [...draft.touched].map((name) => {
        const definition = controlDefinitions[name];
        const before = draft.baseline[name];
        const after = draft.values[name] + definition.unit;
        return { targetId: draft.id, property: definition.property, before, after, color: definition.color };
      }).filter((change) => change.color ? normalizeColor(change.before) !== normalizeColor(change.after) : change.before !== change.after)
       .map(({ targetId, property, before, after }) => ({ targetId, property, before, after }));
    }

    async function resolveDraftSource(draft) {
      const explicit = explicitSourceFor(draft.element);
      if (explicit) return explicit;
      const changes = changesForDraft(draft);
      const fallbackProperties = ["font-size", "border-radius", "background-color", "color", "padding-top"];
      const candidates = [
        ...changes.map((change) => [change.property, change.before]),
        ...fallbackProperties.filter((property) => !changes.some((change) => change.property === property)).map((property) => {
          const entry = Object.entries(controlDefinitions).find(([, definition]) => definition.property === property);
          return [property, entry ? draft.baseline[entry[0]] : ""];
        })
      ];
      for (const [property, before] of candidates) {
        const controlled = await controlledBrowserSource(draft, [property], { [property]: before });
        if (controlled?.source) return controlled.source;
        if (!controlled) {
          const local = sourceFor(draft.element, [property]);
          if (local) return local;
        }
      }
      return null;
    }

    async function mapDraft(draft) {
      const changes = changesForDraft(draft);
      const explicit = explicitSourceFor(draft.element);
      const fallbackSource = explicit || await resolveDraftSource(draft);
      const resolvedChanges = [];
      for (const change of changes) {
        if (explicit) {
          resolvedChanges.push({ ...change, source: explicit, reason: null });
          continue;
        }
        const controlled = await controlledBrowserSource(draft, [change.property], { [change.property]: change.before });
        const directSource = controlled?.source || (controlled ? null : sourceFor(draft.element, [change.property]));
        const source = directSource || (controlled?.reason === "ambiguous" ? null : fallbackSource);
        resolvedChanges.push({ ...change, source, reason: controlled?.reason || null });
      }
      const mappedChanges = resolvedChanges.map(({ targetId, property, before, after, source }) => ({
        targetId,
        property,
        before,
        after,
        ...(source ? { source } : {})
      }));
      const source = mappedChanges.find((change) => change.source)?.source || fallbackSource;
      return {
        target: {
          id: draft.id,
          selector: draft.selector,
          label: draft.label,
          ...(source ? { source } : {}),
          context: draft.context,
          ...(draft.prompt.trim() ? { prompt: draft.prompt.trim() } : {})
        },
        mappedChanges
      };
    }

    sendButton.addEventListener("click", async () => {
      if (!sessionId) return;
      if (pendingSubmission) {
        await submitMappedChanges(pendingSubmission, true);
        return;
      }
      const activeDrafts = meaningfulDrafts();
      if (!activeDrafts.length) {
        feedbackEl.textContent = "Adjust a value or tell the agent what to change.";
        feedbackEl.classList.add("vt-error");
        return;
      }
      sendButton.disabled = true;
      sendButton.textContent = "Mapping " + activeDrafts.length + (activeDrafts.length === 1 ? " element…" : " elements…");
      feedbackEl.classList.remove("vt-error");
      const mapped = [];
      for (const draft of activeDrafts) {
        const result = await mapDraft(draft);
        mapped.push(result);
      }
      const targets = mapped.map((item) => item.target);
      const mappedChanges = mapped.flatMap((item) => item.mappedChanges);
      const primaryTarget = targets.find((target) => target.id === selectedDraft?.id) || targets.at(-1);
      const mappedSources = mappedChanges.map((change) => change.source).filter(Boolean);
      const sourceCount = new Set(mappedSources.map((source) => source.file + ":" + source.line)).size;
      const riskySources = mappedSources.filter((item) => item.usageScope === "shared" || item.usageScope === "unknown");
      if (riskySources.length) {
        const hasUnknownScope = riskySources.some((item) => item.usageScope === "unknown");
        const sharedUsageCount = Math.max(0, ...riskySources.filter((item) => item.usageScope === "shared").map((item) => item.usageCount || 0));
        pendingSubmission = { mappedChanges, targets, primaryTarget, sourceCount };
        sendButton.disabled = false;
        sendButton.textContent = "Confirm & Send";
        feedbackEl.classList.add("vt-warning");
        feedbackEl.textContent = hasUnknownScope
          ? "This Token's full usage scope could not be verified. Confirm to send it for agent review."
          : "This Token has " + sharedUsageCount + " static usages and may affect multiple components. Confirm to send.";
        return;
      }
      await submitMappedChanges({ mappedChanges, targets, primaryTarget, sourceCount }, false);
    });

    async function submitMappedChanges(submission, impactAcknowledged) {
      const { mappedChanges, targets, primaryTarget, sourceCount } = submission;
      sendButton.textContent = "Sending…";
      sendButton.disabled = true;
      feedbackEl.classList.remove("vt-warning");
      try {
        const response = await fetch(config.bridgeUrl + "/api/change-sets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId,
            origin: "browser-overlay",
            ...(primaryTarget.prompt ? { prompt: primaryTarget.prompt } : {}),
            ...(impactAcknowledged ? { impactAcknowledged: true } : {}),
            workspace: config.workspace,
            pageUrl: location.href,
            pageTitle: document.title,
            viewport: { width: innerWidth, height: innerHeight },
            target: primaryTarget,
            targets,
            changes: mappedChanges
          })
        });
        const item = await response.json();
        if (!response.ok) throw new Error(item.error || ("HTTP " + response.status));
        startRequestStatusTracking(item);
        pendingSubmission = null;
        const current = selected;
        for (const draft of [...drafts.values()]) discardDraft(draft, !isMeaningful(draft));
        selected = null;
        selectedDraft = null;
        if (current?.isConnected) selectElement(current);
        feedbackEl.textContent = "Sent " + item.id + " with " + targets.length + (targets.length === 1 ? " element" : " elements") + (sourceCount > 1 ? " across " + sourceCount + " source targets." : ".");
        sendButton.textContent = "Sent to Agent";
        updateDraftList();
        updateSendState();
      } catch (error) {
        sendButton.disabled = false;
        sendButton.textContent = "Send to Agent";
        feedbackEl.textContent = "Could not send changes: " + error.message;
        feedbackEl.classList.add("vt-error");
      }
    }

    addEventListener("pagehide", () => {
      if (requestStatusTimer) clearInterval(requestStatusTimer);
    }, { once: true });
    };
    if (document.documentElement) mount();
    else document.addEventListener("DOMContentLoaded", mount, { once: true });
  })();`;
}
