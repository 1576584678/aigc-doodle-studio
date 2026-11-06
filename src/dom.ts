// 统一 DOM 引用：沿用既有 ID，不新增任何 ID；新控件一律用 class / data-* 属性选择器。
// 模块脚本为 defer 执行，求值发生在 HTML 解析完成之后，此处同步查询是安全的。

const byId = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T
const one = <T extends Element = HTMLElement>(sel: string): T =>
  document.querySelector(sel) as T
const all = <T extends Element = HTMLElement>(sel: string): T[] =>
  Array.from(document.querySelectorAll<T>(sel))

export const dom = {
  layout: one<HTMLElement>('.layout'),
  left: one<HTMLElement>('.panel.left'),
  right: one<HTMLElement>('.panel.right'),

  baseUrl: byId<HTMLInputElement>('baseUrl'),
  apiKey: byId<HTMLInputElement>('apiKey'),
  model: byId<HTMLInputElement>('model'),
  prompt: byId<HTMLTextAreaElement>('prompt'),
  promptCount: byId<HTMLSpanElement>('prompt-count'),
  generate: byId<HTMLButtonElement>('generate'),
  status: byId<HTMLDivElement>('status'),

  canvas: byId<HTMLDivElement>('canvas'),
  gallery: byId<HTMLDivElement>('gallery'),
  galleryCount: byId<HTMLSpanElement>('gallery-count'),
  toastRegion: byId<HTMLDivElement>('toast-region'),

  download: byId<HTMLButtonElement>('download'),
  copy: byId<HTMLButtonElement>('copy'),
  save: byId<HTMLButtonElement>('save'),

  modeBtns: all<HTMLButtonElement>('.mode-btn'),
  chips: all<HTMLButtonElement>('.chip'),
  styleBtns: all<HTMLButtonElement>('.style-btn'),
  stylePicker: one<HTMLElement>('.style-picker'),

  settingsBtn: one<HTMLButtonElement>('[data-action="open-settings"]'),
  settingsDialog: one<HTMLDialogElement>('.settings-dialog'),
  settingsClose: one<HTMLButtonElement>('[data-action="close-settings"]'),
  canvasBack: one<HTMLButtonElement>('.canvas-back'),
  valueMore: one<HTMLButtonElement>('.value-more'),
  valueDetail: one<HTMLElement>('.value-detail'),
  presetSelect: one<HTMLSelectElement>('.preset-select'),
  btnTest: one<HTMLButtonElement>('.btn-test'),
  testResult: one<HTMLElement>('.test-result'),
  dontSaveKey: one<HTMLInputElement>('.check-row input'),
  linkDanger: one<HTMLButtonElement>('.link-danger'),

  exportTrigger: one<HTMLButtonElement>('[data-action="export-png"]'),
  actWrap: one<HTMLElement>('.act-wrap'),
  exportPanel: one<HTMLElement>('.export-panel'),
  shareBtn: one<HTMLButtonElement>('[data-action="share"]'),
  printBtn: one<HTMLButtonElement>('[data-action="print"]'),
  historyStrip: one<HTMLElement>('.history-strip'),
  printCaption: one<HTMLElement>('.print-caption'),
  leadJump: one<HTMLButtonElement>('.lead-jump'),

  dialog: one<HTMLDialogElement>('.confirm-dialog'),
  btnQuiet: one<HTMLButtonElement>('.btn-quiet'),
  btnDanger: one<HTMLButtonElement>('.btn-danger')
}

export { byId, one, all }
