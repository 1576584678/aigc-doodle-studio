/**
 * SVG 白名单安全过滤（纯函数）。
 *
 * 所有进入 DOM（innerHTML）、localStorage、剪贴板、下载文件的 SVG 都必须先经过这里：
 * - api.ts 在拿到模型返回后过滤一次（生成侧）
 * - main.ts 的 renderSvg / galleryCard 各再过滤一次（防御 localStorage 被篡改的存储型 XSS）
 *
 * 策略是「白名单 + 显式黑名单」双保险：元素/属性只保留绘图所必需的最小集合，
 * 其余节点连同整棵子树删除；危险协议、事件属性、CSS 表达式再单独兜底拦截。
 */

const SVG_NS = 'http://www.w3.org/2000/svg'
const FAIL_MESSAGE = '这次没画出来，换个说法或再试一次'

/** 保留并递归遍历的元素（小写比较）。 */
const ALLOWED_TAGS = new Set([
  'svg', 'g', 'path', 'line', 'circle', 'rect', 'ellipse', 'polyline',
  'polygon', 'text', 'tspan', 'title', 'desc'
])

/**
 * 显式禁止的元素（审计用，逻辑上已被白名单排除）。
 * 覆盖向量：script / foreignObject / style / image / animate / use / a /
 * iframe / object / embed / link / meta / filter / mask / pattern / set ...
 */
const FORBIDDEN_TAGS = new Set([
  'script', 'foreignobject', 'image', 'style', 'animate', 'animatetransform',
  'animatemotion', 'set', 'use', 'a', 'iframe', 'object', 'embed', 'link',
  'meta', 'filter', 'mask', 'pattern', 'marker', 'clippath', 'symbol',
  'defs', 'lineargradient', 'radialgradient', 'stop', 'switch', 'view',
  'cursor', 'font', 'font-face', 'audio', 'video', 'canvas', 'handler'
])

/** 展示类属性白名单（统一小写比较，保留原始拼写如 viewBox）。 */
const ALLOWED_ATTRS = new Set([
  'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'points', 'width', 'height', 'viewbox', 'xmlns', 'fill', 'stroke',
  'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
  'opacity', 'fill-opacity', 'stroke-opacity', 'transform', 'font-size',
  'font-family', 'text-anchor', 'dominant-baseline'
])

/** 链接类属性：不在白名单内，本就整体移除；这里额外显式识别危险协议。 */
const LINK_ATTRS = new Set(['href', 'xlink:href', 'src'])

/** 去掉空白 / 制表符 / 控制字符并转小写，抵御 "java\tscript:"、" JaVaScRiPt: " 之类混淆。 */
function squash(value: string): string {
  return value.replace(/[\s\u0000-\u001F\u007F]+/g, '').toLowerCase()
}

/** href / xlink:href / src 的危险协议（含大小写与前后空白/制表符混淆）。 */
function isDangerousLink(value: string): boolean {
  const v = squash(value)
  return v.includes('javascript:') || v.includes('data:') || v.includes('vbscript:')
}

/** style 属性中的危险值：expression( / url( / javascript: 。style 本身也不在白名单内。 */
function isDangerousStyle(value: string): boolean {
  const v = squash(value)
  return v.includes('expression(') || v.includes('url(') || v.includes('javascript:')
}

/** 任意属性值的兜底：脚本协议、CSS 表达式、data: 一律不允许出现在属性值里。 */
function isDangerousValue(value: string): boolean {
  const v = squash(value)
  return (
    v.includes('javascript:') ||
    v.includes('vbscript:') ||
    v.includes('data:') ||
    v.includes('expression(')
  )
}

function removeAttr(el: Element, attr: Attr): void {
  try {
    if (attr.namespaceURI) el.removeAttributeNS(attr.namespaceURI, attr.localName)
    else el.removeAttribute(attr.name)
  } catch {
    try { el.removeAttribute(attr.name) } catch { /* 忽略不可删除的只读属性 */ }
  }
}

function sanitizeAttributes(el: Element): void {
  // 快照后遍历，避免删除时影响迭代
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name
    const local = attr.localName || name
    const lowerName = name.toLowerCase()
    const lowerLocal = local.toLowerCase()
    const value = attr.value

    // 1) 所有 on* 事件属性（大小写不敏感，含带命名空间前缀的形式）
    if (/^on/i.test(name) || /^on/i.test(local)) {
      removeAttr(el, attr)
      continue
    }

    // 2) href / xlink:href / src：危险协议显式删除，其余因为不在白名单内随后也会被删除
    //    （简笔画不需要任何外链，规范允许「这类属性整体可移除」）
    if (LINK_ATTRS.has(lowerName) || lowerLocal === 'href' || lowerLocal === 'src') {
      if (isDangerousLink(value)) {
        removeAttr(el, attr)
        continue
      }
      // 落到下面的白名单检查，统一移除
    }

    // 3) style 属性：expression( / url( / javascript: 显式删除
    if (lowerLocal === 'style' && isDangerousStyle(value)) {
      removeAttr(el, attr)
      continue
    }

    // 4) 任意属性值的危险协议兜底（例如 fill="url(javascript:...)"）
    if (isDangerousValue(value)) {
      removeAttr(el, attr)
      continue
    }

    // 5) 白名单之外的属性一律移除
    if (!ALLOWED_ATTRS.has(lowerLocal) && !ALLOWED_ATTRS.has(lowerName)) {
      removeAttr(el, attr)
    }
  }
}

/** 递归清洗子树：非白名单元素连同整棵子树直接删除。 */
function walk(parent: Node, doc: Document): void {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element
      const tag = el.localName.toLowerCase()
      if (!ALLOWED_TAGS.has(tag) || FORBIDDEN_TAGS.has(tag) || el.prefix) {
        parent.removeChild(child)
        continue
      }
      sanitizeAttributes(el)
      walk(el, doc)
    } else if (child.nodeType === Node.TEXT_NODE) {
      // 保留；XMLSerializer 会转义 < & 等字符
    } else if (child.nodeType === Node.CDATA_SECTION_NODE) {
      // CDATA 转成普通文本节点，避免序列化后仍以 CDATA 形式注入
      parent.replaceChild(doc.createTextNode(child.nodeValue ?? ''), child)
    } else {
      // 注释、处理指令等一律移除
      parent.removeChild(child)
    }
  }
}

/** 保证序列化结果一定带合法的 xmlns 声明。 */
function ensureXmlns(root: Element): void {
  let ok = false
  for (const attr of Array.from(root.attributes)) {
    if ((attr.name === 'xmlns' || attr.localName === 'xmlns') && attr.value === SVG_NS) {
      ok = true
    }
  }
  if (ok) return
  for (const attr of Array.from(root.attributes)) {
    if (attr.name === 'xmlns' || attr.localName === 'xmlns') removeAttr(root, attr)
  }
  root.setAttribute('xmlns', SVG_NS)
}

/**
 * 把不可信的 SVG 文本过滤成可安全注入的字符串。
 * @throws Error('这次没画出来，换个说法或再试一次') 解析失败 / 根节点不是 svg / 序列化结果异常
 */
export function sanitizeSvg(raw: string): string {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error(FAIL_MESSAGE)
  // 拒绝 DOCTYPE / ENTITY 声明，避免实体展开类攻击
  if (/<!DOCTYPE|<!ENTITY/i.test(raw)) throw new Error(FAIL_MESSAGE)

  let doc: Document
  try {
    doc = new DOMParser().parseFromString(raw, 'image/svg+xml')
  } catch {
    throw new Error(FAIL_MESSAGE)
  }

  if (
    doc.getElementsByTagName('parsererror').length > 0 ||
    doc.querySelector('parsererror') !== null
  ) {
    throw new Error(FAIL_MESSAGE)
  }

  const root = doc.documentElement
  if (
    !root ||
    root.tagName.toLowerCase() !== 'svg' ||
    root.localName.toLowerCase() !== 'svg'
  ) {
    throw new Error(FAIL_MESSAGE)
  }

  sanitizeAttributes(root)
  walk(root, doc)
  ensureXmlns(root)

  let out = new XMLSerializer().serializeToString(root)
  if (!/xmlns\s*=/i.test(out)) {
    ensureXmlns(root)
    out = new XMLSerializer().serializeToString(root)
  }

  if (!/^<svg[\s>]/i.test(out) || !/xmlns\s*=/i.test(out)) {
    throw new Error(FAIL_MESSAGE)
  }
  return out
}
