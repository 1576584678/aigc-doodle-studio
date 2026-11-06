import { sanitizeSvg } from './sanitize'
import { svgDimensions } from './export'
import { track } from './telemetry'
import type { CurrentWork } from './types'

// 分享卡片为 Canvas 像素排版（visual-spec §6），无新增 DOM 类、无网络。
const W = 1080
const H = 1440
const SAFE = 72
const ART = { x: 140, y: 176, w: 800, h: 800 }
const ART_INNER = { x: 172, y: 208, w: 736, h: 736 }
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'

const INK = '#1f2329'
const META = '#5f6672'
const LINK = '#3a63d8'
const LINE = '#e3e6ea'
const PRIMARY = '#4f7cff'
const SAMPLE_BORDER = '#7b8595'

function font(size: number, weight = 400): string {
  return `${weight} ${size}px ${FONT}`
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 逐字符 measureText，宽 800、最多 2 行，超出以单个「…」替换末字符。 */
function layoutDescription(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const chars = Array.from(text.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim())
  const lines: string[] = []
  let i = 0
  while (i < chars.length && lines.length < maxLines) {
    let line = ''
    while (i < chars.length) {
      const test = line + chars[i]
      if (line && ctx.measureText(test).width > maxWidth) break
      line = test
      i++
    }
    lines.push(line)
  }
  if (i < chars.length && lines.length) {
    let last = lines[lines.length - 1]
    while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1)
    lines[lines.length - 1] = last + '…'
  }
  return lines
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let out = text
  while (out && ctx.measureText(out + '…').width > maxWidth) out = out.slice(0, -1)
  return out + '…'
}

/** 把 SVG 以 4× 栅格化到离屏 canvas，返回尺寸与 URL 释放函数。 */
async function rasterize4x(svg: string): Promise<{ canvas: HTMLCanvasElement }> {
  const dims = svgDimensions(svg)
  const stripped = svg.replace(/\s(?:width|height)\s*=\s*["'][^"']*["']/gi, '')
  const markup = stripped.replace(
    /<svg\b/i,
    `<svg width="${dims.w * 4}" height="${dims.h * 4}"`
  )
  const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('decode failed'))
      img.src = url
    })
    const c = document.createElement('canvas')
    c.width = dims.w * 4
    c.height = dims.h * 4
    const cctx = c.getContext('2d')
    if (!cctx) throw new Error('no 2d context')
    cctx.drawImage(img, 0, 0, c.width, c.height)
    return { canvas: c }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function isLocalOrigin(): boolean {
  const host = location.hostname
  return (
    location.protocol === 'file:' ||
    host === '' ||
    /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(host)
  )
}

/**
 * FR-07：1080×1440 本地合成 PNG。
 * 字段白名单 = 作品 / 描述 / 来源 / 类型标识；不含 Key、Base URL、Model、水印、二维码、诱导文案。
 */
export async function generateShareCard(work: CurrentWork): Promise<boolean> {
  let safe = ''
  try {
    safe = sanitizeSvg(work.svg)
  } catch {
    return false
  }

  let raster: HTMLCanvasElement
  try {
    raster = (await rasterize4x(safe)).canvas
  } catch {
    return false
  }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  ctx.textBaseline = 'top'

  // 白底
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // 顶部信息行：方点 + 站名
  ctx.fillStyle = PRIMARY
  ctx.fillRect(SAFE, 86, 12, 12)
  ctx.fillStyle = META
  ctx.font = font(28, 600)
  ctx.fillText('AIGC 简笔画工坊', SAFE + 24, 76)

  // 类型胶囊（右对齐，右缘 1008）
  const isSample = work.source === 'sample'
  const typeText = isSample ? '示例作品' : '生成作品'
  ctx.font = font(24, 600)
  const tw = ctx.measureText(typeText).width
  const capsuleW = Math.max(120, tw + 32)
  const capsuleX = 1008 - capsuleW
  ctx.fillStyle = isSample ? '#e7ebf1' : '#eef3ff'
  roundRect(ctx, capsuleX, 72, capsuleW, 36, 18)
  ctx.fill()
  ctx.fillStyle = isSample ? '#4a5261' : '#3a63d8'
  ctx.textAlign = 'center'
  ctx.fillText(typeText, capsuleX + capsuleW / 2, 78)
  ctx.textAlign = 'left'

  // 分隔线 1
  ctx.fillStyle = LINE
  ctx.fillRect(SAFE, 132, 936, 1)

  // 作品容器
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, ART.x, ART.y, ART.w, ART.h, 24)
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = isSample ? SAMPLE_BORDER : LINE
  ctx.setLineDash(isSample ? [8, 6] : [])
  ctx.stroke()
  ctx.setLineDash([])

  // 作品：4× 栅格化后等比 contain 到 736×736
  const iw = raster.width
  const ih = raster.height
  const s = Math.min(ART_INNER.w / iw, ART_INNER.h / ih)
  const dw = iw * s
  const dh = ih * s
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    raster,
    ART_INNER.x + (ART_INNER.w - dw) / 2,
    ART_INNER.y + (ART_INNER.h - dh) / 2,
    dw,
    dh
  )

  // 描述区
  ctx.fillStyle = META
  ctx.font = font(24, 400)
  ctx.fillText('作品描述', 140, 1012)
  ctx.fillStyle = INK
  ctx.font = font(40, 400)
  const descLines = layoutDescription(ctx, work.prompt || '一幅简笔画', 800, 2)
  descLines.forEach((line, idx) => {
    ctx.fillText(line, 140, 1056 + idx * 60)
  })

  // 分隔线 2
  ctx.fillStyle = LINE
  ctx.fillRect(SAFE, 1240, 936, 1)

  // 来源区
  ctx.font = font(28, 400)
  ctx.fillStyle = META
  if (isLocalOrigin()) {
    // localhost：不渲染地址行、不画占位框，费用说明上移 y=1264
    ctx.fillText('本站不收费，模型自备', SAFE, 1264)
  } else {
    ctx.fillStyle = LINK
    ctx.font = font(30, 600)
    ctx.fillText(ellipsize(ctx, location.origin, 936), SAFE, 1264)
    ctx.fillStyle = META
    ctx.font = font(28, 400)
    ctx.fillText('本站不收费，模型自备', SAFE, 1320)
  }

  let png: Blob | null = null
  try {
    png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  } catch {
    return false
  }
  if (!png) return false
  const url = URL.createObjectURL(png)
  const a = document.createElement('a')
  a.href = url
  a.download = `share_${Date.now()}.png`
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  track('export_card')
  return true
}
