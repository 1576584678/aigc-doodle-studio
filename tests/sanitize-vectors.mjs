/**
 * FR-12 `src/sanitize.ts` 白名单安全回归向量 —— 纯数据模块。
 *
 * 本文件只导出一份静态数组：不含函数、闭包、副作用、导入项与浏览器 API，
 * 因此可被 Node（scripts/verify.mjs）与浏览器（tests/sanitize.test.html）直接共用，
 * 也便于构建前置脚本做静态计数与关键词覆盖检查。
 *
 * 每条结构统一为：
 *   {
 *     name: string,                       // 人类可读的样本名 / 攻击类别
 *     svg: string,                        // 待过滤的原始 SVG 文本（可含不可信内容）
 *     expect: 'accept' | 'reject',        // 期望结果
 *     mustContain?: string[],             // accept 时输出必须包含的片段
 *     mustNotContain?: string[]           // 输出中绝对不允许出现的敏感片段
 *   }
 *
 * 判定语义（大小写不敏感，见测试页实现）：
 *   expect === 'reject'：sanitizeSvg(svg) 抛错  OR  未抛错但输出里不含 mustNotContain 任一片段 → 通过
 *   expect === 'accept'：sanitizeSvg(svg) 不抛错 AND 输出含全部 mustContain AND 不含任何 mustNotContain → 通过
 *
 * 覆盖类别：
 *   script / foreignObject / on* 事件属性（含命名空间前缀）/ javascript: 大小写+制表符+换行混淆 /
 *   data: / vbscript: / expression( / DOCTYPE+ENTITY(XXE) / CDATA 注入 / style / 注释与处理指令 /
 *   animate set use a iframe image filter mask pattern defs object embed link meta /
 *   href xlink:href / 命名空间前缀元素 / 非法根节点 / 空串 / 空白串 / XML 解析错误 /
 *   fill="url(...)" 危险协议 / 合法简笔画（含 text tspan title desc、缺 xmlns、transform 分组）
 */

export const vectors = [
  // ==================== 一、攻击向量（expect: 'reject'） ====================
  {
    name: 'script 元素注入',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><script>alert(document.cookie)</script><path d="M0 0 L10 10"/></svg>',
    expect: 'reject',
    mustNotContain: ['<script', 'alert(', 'document.cookie']
  },
  {
    name: 'script 元素大写变体 <SCRIPT>',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><SCRIPT>alert(1)</SCRIPT><path d="M0 0 L10 10"/></svg>',
    expect: 'reject',
    mustNotContain: ['<script', 'alert(1)']
  },
  {
    name: 'foreignObject 跨命名空间 HTML 注入',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><foreignObject width="100" height="100"><div xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></div></foreignObject><path d="M0 0 L10 10"/></svg>',
    expect: 'reject',
    mustNotContain: ['foreignobject', '<div', '<script', 'alert(1)']
  },
  {
    name: 'onload / onerror 事件属性',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onload="alert(1)"><path d="M0 0 L10 10" onerror="alert(2)"/></svg>',
    expect: 'reject',
    mustNotContain: ['onload', 'onerror', 'alert(']
  },
  {
    name: 'on* 事件属性变体 onclick / onmouseover / onbegin / ONFOCUS',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onclick="evil()" onmouseover="evil()" onbegin="evil()" ONFOCUS="evil()"><path d="M0 0 L10 10"/></svg>',
    expect: 'reject',
    mustNotContain: ['onclick', 'onmouseover', 'onbegin', 'onfocus', 'evil(']
  },
  {
    name: 'on* 事件属性带命名空间前缀 xlink:onload',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100"><path d="M0 0 L10 10" xlink:onload="alert(1)" xlink:onerror="evil()"/></svg>',
    expect: 'reject',
    mustNotContain: ['xlink:onload', 'onload', 'onerror', 'alert(1)', 'evil(']
  },
  {
    name: 'javascript: 协议（a / xlink:href）',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100"><a xlink:href="javascript:alert(1)"><rect x="0" y="0" width="10" height="10"/></a></svg>',
    expect: 'reject',
    mustNotContain: ['javascript:', '<a', 'xlink:href', 'alert(']
  },
  {
    name: 'javascript: 大小写混淆 JaVaScRiPt:',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="JaVaScRiPt:alert(1)"><path d="M0 0 L10 10"/></svg>',
    expect: 'reject',
    mustNotContain: ['javascript:', 'alert(1)']
  },
  {
    name: 'javascript: 制表符混淆 java\\tscript:（真实 TAB 字符）',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0 L10 10" fill="url(java\tscript:alert(1))"/></svg>',
    expect: 'reject',
    mustNotContain: ['javascript:', 'alert(1)']
  },
  {
    name: 'javascript: 换行 / 空格混淆 java\\n script:',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0 L10 10" fill="url( java\n script: alert(1) )"/></svg>',
    expect: 'reject',
    mustNotContain: ['javascript:', 'alert(1)']
  },
  {
    name: 'data: 协议（fill 属性值）',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0 L10 10" fill="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="/></svg>',
    expect: 'reject',
    mustNotContain: ['data:', 'base64']
  },
  {
    name: 'data: 协议 + base64（image / href）',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><image href="data:text/html;base64,PHNjcmlwdD4=" x="0" y="0" width="10" height="10"/></svg>',
    expect: 'reject',
    mustNotContain: ['<image', 'data:', 'base64', 'href=']
  },
  {
    name: 'vbscript: 协议',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0 L10 10" fill="vbscript:msgbox(1)"/></svg>',
    expect: 'reject',
    mustNotContain: ['vbscript:', 'msgbox']
  },
  {
    name: 'expression( CSS 表达式（style 属性）',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" style="width:expression(alert(1))"><path d="M0 0 L10 10"/></svg>',
    expect: 'reject',
    mustNotContain: ['expression(', 'alert(1)', 'style=']
  },
  {
    name: 'DOCTYPE + ENTITY 外部实体（XXE / 本地文件读取）',
    svg: '<!DOCTYPE svg [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="10" y="20">&xxe;</text></svg>',
    expect: 'reject',
    mustNotContain: ['<!doctype', '<!entity', '&xxe;', 'file:///etc/passwd']
  },
  {
    name: 'ENTITY 独立声明（内嵌 javascript: 实体）',
    svg: '<!DOCTYPE svg [<!ENTITY x "javascript:alert(1)">]><svg xmlns="http://www.w3.org/2000/svg"><text x="1" y="2">&x;</text></svg>',
    expect: 'reject',
    mustNotContain: ['<!doctype', '<!entity', 'javascript:', '&x;']
  },
  {
    name: 'CDATA 注入 script（应降级为转义文本而非可执行节点）',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><![CDATA[<script>alert(1)</script>]]><path d="M0 0 L10 10"/></svg>',
    expect: 'reject',
    mustNotContain: ['<![cdata[', '<script', '<script>', ']]']
  },
  {
    name: '<style> 元素 + CSS url(javascript:)',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>path{fill:url(javascript:alert(1))}</style><path d="M0 0 L10 10"/></svg>',
    expect: 'reject',
    mustNotContain: ['<style', 'javascript:', 'url(javascript', 'alert(1)']
  },
  {
    name: '禁用元素组合 A：animate / set / use / a',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100"><animate attributeName="x" to="javascript:alert(1)"/><set attributeName="fill" to="javascript:alert(2)"/><use xlink:href="#evil"/><a href="https://evil.example/x"><rect width="10" height="10"/></a></svg>',
    expect: 'reject',
    mustNotContain: ['<animate', '<set', '<use', '<a', 'xlink:href', 'javascript:', 'evil.example']
  },
  {
    name: '禁用元素组合 B：iframe / image / filter / mask / pattern / defs',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><filter id="f"><feGaussianBlur/></filter><mask id="m"/><pattern id="p"/><linearGradient id="g"><stop/></linearGradient></defs><image href="javascript:alert(1)"/><iframe src="https://evil.example"/></svg>',
    expect: 'reject',
    mustNotContain: ['<defs', '<filter', '<mask', '<pattern', '<image', '<iframe', 'javascript:', 'evil.example']
  },
  {
    name: '禁用元素组合 C：object / embed / link / meta',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><object data="javascript:alert(1)"/><embed src="https://evil.example/e"/><link href="https://evil.example/l"/><meta http-equiv="refresh" content="0;url=javascript:alert(2)"/></svg>',
    expect: 'reject',
    mustNotContain: ['<object', '<embed', '<link', '<meta', 'javascript:', 'evil.example']
  },
  {
    name: 'href / xlink:href 外链属性（含非白名单属性整体移除）',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100" href="https://evil.example/x"><path d="M0 0 L10 10" xlink:href="javascript:alert(1)"/></svg>',
    expect: 'reject',
    mustNotContain: ['href=', 'xlink:href', 'javascript:', 'evil.example']
  },
  {
    name: '带命名空间前缀的元素 x:script / x:path',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:x="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><x:script>alert(1)</x:script><x:path d="M0 0 L10 10"/></svg>',
    expect: 'reject',
    mustNotContain: ['x:script', 'x:path', 'alert(1)']
  },
  {
    name: '注释与处理指令注入（xml-stylesheet）',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><!-- <script>evil()</script> --><?xml-stylesheet type="text/css" href="javascript:alert(1)"?><path d="M0 0 L10 10"/></svg>',
    expect: 'reject',
    mustNotContain: ['<script', 'xml-stylesheet', 'javascript:', '<!--', 'evil(']
  },
  {
    name: '非法根节点（html 而非 svg）',
    svg: '<html><body onload="alert(1)"><script>evil()</script></body></html>',
    expect: 'reject',
    mustNotContain: ['<html', '<script', 'onload', 'evil(']
  },
  {
    name: '空字符串',
    svg: '',
    expect: 'reject',
    mustNotContain: ['<svg']
  },
  {
    name: '仅空白字符（空格 / 换行 / 制表符）',
    svg: '   \n\t  ',
    expect: 'reject',
    mustNotContain: ['<svg']
  },
  {
    name: 'fill="url(javascript:...)" 危险协议',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0 L10 10" fill="url(javascript:alert(1))"/></svg>',
    expect: 'reject',
    mustNotContain: ['javascript:', 'alert(1)', 'url(']
  },
  {
    name: 'fill="url(data:...)" 危险协议',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0 L10 10" fill="url(data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)"/></svg>',
    expect: 'reject',
    mustNotContain: ['data:', 'url(', 'base64']
  },
  {
    name: 'XML 解析错误（标签未闭合）',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0 L10 10">',
    expect: 'reject',
    mustNotContain: ['<path']
  },

  // ==================== 二、合法样本（expect: 'accept'） ====================
  {
    name: '合法：标准简笔画（曲线 path）',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M10 80 Q50 10 90 80" fill="none" stroke="#333333" stroke-width="3" stroke-linecap="round"/></svg>',
    expect: 'accept',
    mustContain: ['viewbox', 'xmlns', '<path', 'd=', 'stroke-width'],
    mustNotContain: ['<script', 'onload', 'javascript:', 'data:']
  },
  {
    name: '合法：带浅蓝填充的简笔画（ellipse / circle）',
    svg: '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><ellipse cx="60" cy="60" rx="40" ry="30" fill="#cfe8ff" stroke="#4a90d9" stroke-width="2"/><circle cx="45" cy="55" r="4" fill="#333"/><circle cx="75" cy="55" r="4" fill="#333"/></svg>',
    expect: 'accept',
    mustContain: ['viewbox', 'xmlns', '<ellipse', '<circle', '#cfe8ff'],
    mustNotContain: ['<script', 'onload', 'javascript:', 'data:']
  },
  {
    name: '合法：火柴人（line / circle）',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="20" r="10" fill="none" stroke="#222" stroke-width="3"/><line x1="50" y1="30" x2="50" y2="65" stroke="#222" stroke-width="3"/><line x1="50" y1="40" x2="25" y2="55" stroke="#222" stroke-width="3"/><line x1="50" y1="40" x2="75" y2="55" stroke="#222" stroke-width="3"/><line x1="50" y1="65" x2="30" y2="90" stroke="#222" stroke-width="3"/><line x1="50" y1="65" x2="70" y2="90" stroke="#222" stroke-width="3"/></svg>',
    expect: 'accept',
    mustContain: ['viewbox', 'xmlns', '<line', '<circle'],
    mustNotContain: ['<script', 'onload', 'javascript:', 'data:']
  },
  {
    name: '合法：含 <text> / <tspan> / <title> / <desc> 的 SVG',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><title>小猫简笔画</title><desc>合法示例</desc><text x="10" y="35" font-size="18" font-family="sans-serif" fill="#333">Hello <tspan fill="#4a90d9">Doodle</tspan>!</text></svg>',
    expect: 'accept',
    mustContain: ['viewbox', 'xmlns', '<title', '<desc', '<text', '<tspan', 'doodle'],
    mustNotContain: ['<script', 'onload', 'javascript:', 'data:']
  },
  {
    name: '合法：缺少 xmlns 的根（应被补全 xmlns）',
    svg: '<svg viewBox="0 0 50 50"><rect x="5" y="5" width="40" height="40" fill="none" stroke="#333" stroke-width="2"/></svg>',
    expect: 'accept',
    mustContain: ['viewbox', 'xmlns', '<rect'],
    mustNotContain: ['<script', 'onload', 'javascript:', 'data:']
  },
  {
    name: '合法：带 transform 的分组（g / opacity）',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g transform="translate(10 10) rotate(15)" opacity="0.8"><path d="M0 0 L40 0 L40 40 Z" fill="none" stroke="#333"/></g></svg>',
    expect: 'accept',
    mustContain: ['viewbox', 'xmlns', '<g', 'transform=', '<path'],
    mustNotContain: ['<script', 'onload', 'javascript:', 'data:']
  },
  {
    name: '合法：polyline / polygon / rect 组合',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polyline points="0,0 20,20 40,0" fill="none" stroke="#333"/><polygon points="60,10 90,10 75,40" fill="#cfe8ff"/><rect x="10" y="60" width="30" height="20" rx="3" fill="none" stroke="#4a90d9"/></svg>',
    expect: 'accept',
    mustContain: ['viewbox', 'xmlns', '<polyline', '<polygon', '<rect'],
    mustNotContain: ['<script', 'onload', 'javascript:', 'data:']
  },
  {
    name: '合法：注释与危险属性被清理后仍可渲染的简笔画',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onload="alert(1)"><!-- 注释应被移除 --><path d="M0 0 L10 10" onclick="evil()" style="fill:expression(alert(2))"/></svg>',
    expect: 'accept',
    mustContain: ['viewbox', 'xmlns', '<path', 'd='],
    mustNotContain: ['onload', 'onclick', '<!--', 'expression(', 'style=']
  }
]
