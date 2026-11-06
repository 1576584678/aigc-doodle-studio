import { sanitizeSvg } from './sanitize'
import type { GenMode, WorkSource } from './types'

export interface SampleItem {
  id: string
  title: string
  mode: GenMode
  prompt: string
  svg: string
}

/**
 * 6 张内置原创示例（3 简笔画 + 3 火柴人）。
 * 画风严格按 visual-spec §1.3：viewBox 0 0 400 400、stroke #222222、
 * 圆角线端、仅 #cfe3ff 作强调填充、安全边距 ≥32、无 text/image/style/事件属性。
 * 全部在进入 DOM 前经 sanitizeSvg 过滤；不写 localStorage、不占画廊配额。
 */
export const SAMPLES: SampleItem[] = [
  {
    id: 'sample-cat',
    title: '戴帽子的猫',
    mode: 'doodle',
    prompt: '一只戴帽子的猫',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <g fill="none" stroke="#222222" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M148 128 L200 66 L252 128 Z" fill="#cfe3ff"/>
    <path d="M132 130 Q200 116 268 130"/>
    <path d="M146 168 L142 118 L184 150"/>
    <path d="M254 168 L258 118 L216 150"/>
    <circle cx="200" cy="210" r="68"/>
    <circle cx="176" cy="202" r="5" fill="#222222" stroke="none"/>
    <circle cx="224" cy="202" r="5" fill="#222222" stroke="none"/>
    <path d="M194 226 L206 226 L200 234 Z" fill="#222222" stroke="none"/>
    <path d="M200 234 Q190 246 180 236"/>
    <path d="M200 234 Q210 246 220 236"/>
    <path d="M150 226 L120 218 M150 238 L122 240 M250 226 L280 218 M250 238 L278 240"/>
    <path d="M158 272 Q132 312 138 352"/>
    <path d="M242 272 Q268 312 262 352"/>
    <path d="M138 352 Q200 336 262 352"/>
    <path d="M262 340 Q310 336 306 292"/>
  </g>
</svg>`
  },
  {
    id: 'sample-coffee',
    title: '冒热气的热咖啡',
    mode: 'doodle',
    prompt: '一杯冒热气的热咖啡',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <g fill="none" stroke="#222222" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M120 186 L132 312 Q200 336 268 312 L280 186 Z" fill="#cfe3ff"/>
    <path d="M280 208 Q320 204 320 240 Q320 276 280 270"/>
    <path d="M112 186 Q200 174 288 186"/>
    <path d="M164 142 Q150 122 168 106 Q186 90 170 70"/>
    <path d="M200 142 Q186 122 204 106 Q222 90 206 70"/>
    <path d="M236 142 Q222 122 240 106 Q258 90 242 70"/>
    <path d="M104 344 Q200 358 296 344"/>
  </g>
</svg>`
  },
  {
    id: 'sample-umbrella',
    title: '云朵下的小雨伞',
    mode: 'doodle',
    prompt: '云朵下的一把小雨伞',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <g fill="none" stroke="#222222" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M96 108 Q114 84 142 92 Q158 72 186 84 Q214 68 234 92 Q264 84 278 108"/>
    <path d="M96 108 Q200 122 278 108"/>
    <path d="M88 206 Q200 104 312 206 Q280 186 256 206 Q228 186 200 206 Q172 186 144 206 Q120 186 88 206 Z" fill="#cfe3ff"/>
    <path d="M200 206 L200 312 Q200 336 176 336 Q152 336 152 312"/>
    <path d="M112 156 L104 174 M320 156 L312 174 M338 186 L330 204"/>
  </g>
</svg>`
  },
  {
    id: 'sample-runner',
    title: '跑步的火柴人',
    mode: 'stickman',
    prompt: '一个正在跑步的火柴人',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <g fill="none" stroke="#222222" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="206" cy="96" r="28"/>
    <path d="M206 124 L186 216"/>
    <path d="M194 154 L136 126"/>
    <path d="M194 154 L252 178 L272 152"/>
    <path d="M186 216 L130 276 L98 268"/>
    <path d="M186 216 L248 260 L254 308"/>
  </g>
  <g fill="none" stroke="#8a9099" stroke-width="4" stroke-linecap="round">
    <path d="M78 122 L136 122"/>
    <path d="M64 152 L122 152"/>
    <path d="M82 182 L130 182"/>
  </g>
</svg>`
  },
  {
    id: 'sample-wave',
    title: '挥手打招呼的火柴人',
    mode: 'stickman',
    prompt: '一个挥手打招呼的火柴人',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <g fill="none" stroke="#222222" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="188" cy="104" r="30"/>
    <path d="M188 134 L188 238"/>
    <path d="M188 166 L132 204"/>
    <path d="M188 166 L246 130 L262 88"/>
    <path d="M188 238 L140 322"/>
    <path d="M188 238 L236 322"/>
  </g>
  <g fill="none" stroke="#8a9099" stroke-width="4" stroke-linecap="round">
    <path d="M282 72 L300 58"/>
    <path d="M286 100 L308 96"/>
    <path d="M278 48 L292 32"/>
  </g>
</svg>`
  },
  {
    id: 'sample-balloon',
    title: '举着气球的火柴人',
    mode: 'stickman',
    prompt: '一个举着气球的火柴人',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <g fill="none" stroke="#222222" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="168" cy="112" r="28"/>
    <path d="M168 140 L168 240"/>
    <path d="M168 170 L120 208"/>
    <path d="M168 170 L236 150"/>
    <path d="M168 240 L126 322"/>
    <path d="M168 240 L210 322"/>
  </g>
  <ellipse cx="268" cy="76" rx="32" ry="40" fill="#cfe3ff" stroke="#222222" stroke-width="4"/>
  <path d="M268 116 L262 126 L274 126 Z" fill="#222222" stroke="none"/>
  <path d="M268 126 Q246 152 236 150" fill="none" stroke="#222222" stroke-width="4" stroke-linecap="round"/>
</svg>`
  }
]

/** 示例作品来源标识，配合画廊/历史复用。 */
export const SAMPLE_SOURCE: WorkSource = 'sample'

/**
 * 构建示例墙（画布空态）。每格自身过 sanitizeSvg；单张损坏时降级为 .is-broken 占位，
 * 其余 5 格照常（EX-16）。不新增任何 ID。
 */
export function createSampleWall(onSelect: (s: SampleItem) => void): HTMLElement {
  const wall = document.createElement('div')
  wall.className = 'sample-wall'

  const grid = document.createElement('div')
  grid.className = 'sample-grid'
  grid.setAttribute('role', 'list')

  SAMPLES.forEach((s) => {
    const cell = document.createElement('div')
    cell.setAttribute('role', 'listitem')

    const tile = document.createElement('button')
    tile.type = 'button'
    tile.className = 'sample-tile'
    tile.setAttribute('aria-label', `查看示例作品：${s.title}（${s.mode === 'stickman' ? '火柴人' : '简笔画'}）`)

    let safe = ''
    try {
      safe = sanitizeSvg(s.svg)
    } catch {
      safe = ''
    }

    if (safe) {
      const art = document.createElement('div')
      art.className = 'sample-art'
      art.innerHTML = safe
      const inner = art.querySelector('svg')
      if (inner) inner.setAttribute('aria-hidden', 'true')
      tile.appendChild(art)
      tile.addEventListener('click', () => onSelect(s))
    } else {
      tile.classList.add('is-broken')
      tile.disabled = true
      const note = document.createElement('span')
      note.className = 'broken-note'
      note.textContent = '这幅示例暂时无法显示'
      tile.appendChild(note)
    }

    const badge = document.createElement('span')
    badge.className = 'sample-badge'
    badge.textContent = '示例'
    tile.appendChild(badge)

    cell.appendChild(tile)
    grid.appendChild(cell)
  })

  const caption = document.createElement('p')
  caption.className = 'sample-caption'
  caption.textContent = '6 幅内置示例 · 点开即可导出 · 无需填写 Key'

  wall.appendChild(grid)
  wall.appendChild(caption)
  return wall
}
