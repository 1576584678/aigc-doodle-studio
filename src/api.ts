import { DOODLE_PROMPT, STICKMAN_PROMPT, buildSystemPrompt } from './prompts'
import { sanitizeSvg } from './sanitize'
import type { StyleKey, TestCategory } from './types'

export type GenMode = 'doodle' | 'stickman'

export interface GenOptions {
  baseUrl: string
  apiKey: string
  model: string
  mode: GenMode
  style: StyleKey
  prompt: string
}

const BAD_SVG_MESSAGE = '这次没画出来，换个说法或再试一次'

// ---------- 错误契约 ----------

export type ApiFailureCode = 'network' | 'http' | 'invalid-svg' | 'unknown'

export class ApiError extends Error {
  constructor(
    public code: ApiFailureCode,
    public userMessage: string,
    public status?: number,
    public detail?: string // 仅进 console.error，且只记类别、绝不含 Key / 响应体原文
  ) {
    super(userMessage)
    this.name = 'ApiError'
  }
}

/** 把用户填写的 baseUrl 规范化为 OpenAI 兼容的 chat/completions 端点。 */
export function buildEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error('请填写 API Base URL')
  if (trimmed.endsWith('/chat/completions')) return trimmed
  return `${trimmed}/chat/completions`
}

/** 从模型返回的 content 中抽取 <svg>...</svg>，兼容被 ```svg 包裹的情况。 */
export function extractSvg(content: string): string {
  if (!content) throw new ApiError('invalid-svg', BAD_SVG_MESSAGE)
  const fence = content.match(/```(?:svg)?\s*([\s\S]*?)```/i)
  const raw = fence ? fence[1] : content
  const match = raw.match(/<svg[\s\S]*?<\/svg>/i)
  if (!match) throw new ApiError('invalid-svg', BAD_SVG_MESSAGE)
  return match[0].trim()
}

// ---------- 失败分类（生成与自检共用同一口径，FR-03 / EX-03~07） ----------

export interface FailureInfo {
  category: TestCategory
  message: string
  action: string
}

/** CORS / 网络被拦：必须说明「浏览器直连要求端点允许跨域，本站为纯前端无法代为转发」。 */
export function classifyNetwork(): FailureInfo {
  return {
    category: 'cors',
    message:
      '该端点不允许浏览器直连（跨域）。浏览器直连要求端点允许跨域，本站为纯前端无法代为转发',
    action: '请换用支持跨域（CORS）的端点，或检查网络后重试'
  }
}

export function classifyHttpStatus(status: number): FailureInfo {
  if (status === 401) {
    return {
      category: '401',
      message: '密钥无效或没有权限，请检查 API Key',
      action: '请检查或重新填写 API Key'
    }
  }
  if (status === 403) {
    return {
      category: '403',
      message: '密钥无效或没有权限，请检查 API Key',
      action: '请确认该 Key 是否具备调用权限'
    }
  }
  if (status === 404) {
    return {
      category: '404',
      message: '接口地址不对，请检查 API 地址',
      action: '请换用端点预设或核对地址'
    }
  }
  if (status === 429) {
    return {
      category: '429',
      message: '请求太频繁，稍等一会儿再试',
      action: '请稍后再试，或调整服务商限频'
    }
  }
  if (status === 400) {
    return {
      category: 'other',
      message: '请求没被接受，请缩短描述后再试',
      action: '请缩短描述或检查模型名称'
    }
  }
  if (status >= 500) {
    return {
      category: 'network',
      message: '服务端暂时不可用，请稍后再试',
      action: '请稍后重试或换一个端点'
    }
  }
  return {
    category: 'other',
    message: '请求没被接受，请检查设置或换一句描述再试',
    action: '请检查配置或换一个端点'
  }
}

/** 生成路径的 HTTP 文案：分类 + 至少一个可行动作（EX-04~07）。 */
export function httpUserMessage(status: number): string {
  const info = classifyHttpStatus(status)
  return `${info.message}；${info.action}`
}

/** 把 ApiError 归到统计事件类别（仅事件名，FR-08）。 */
export function apiErrorCategory(e: unknown): TestCategory {
  if (e instanceof ApiError) {
    if (e.code === 'network') return 'cors'
    if (e.code === 'http') return classifyHttpStatus(e.status ?? 0).category
    return 'other'
  }
  return 'other'
}

function isAbortError(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'name' in e &&
    (e as { name: unknown }).name === 'AbortError'
  )
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
}

function authHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = apiKey.trim()
  if (key) headers.Authorization = `Bearer ${key}`
  return headers
}

/** 生成并过滤一张 SVG。重试由 main.ts 的 submit 循环控制，此处不重试。 */
export async function generateSvg(opts: GenOptions, signal?: AbortSignal): Promise<string> {
  const endpoint = buildEndpoint(opts.baseUrl)
  const system = buildSystemPrompt(
    opts.mode === 'stickman' ? STICKMAN_PROMPT : DOODLE_PROMPT,
    opts.style
  )

  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: authHeaders(opts.apiKey),
      body: JSON.stringify({
        // 模型名必须显式填写，绝不回落到任何内置默认值
        model: opts.model.trim(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: opts.prompt }
        ],
        temperature: 0.7,
        stream: false
      }),
      signal
    })
  } catch (e) {
    // AbortError 原样抛出，由 main.ts 依据 cancelReason 判定（user / single / total）
    if (isAbortError(e)) throw e
    const info = classifyNetwork()
    throw new ApiError('network', `${info.message}；${info.action}`, undefined, 'network_or_cors')
  }

  if (!res.ok) {
    // 不读取、不记录响应体原文（可能回显凭据），detail 只记 HTTP 类别
    throw new ApiError('http', httpUserMessage(res.status), res.status, `http_${res.status}`)
  }

  let content = ''
  try {
    const data = (await res.json()) as ChatCompletionResponse
    content = data?.choices?.[0]?.message?.content ?? ''
  } catch {
    content = ''
  }

  try {
    return sanitizeSvg(extractSvg(content))
  } catch {
    // 危险节点 / 解析失败：console 只记类别，绝不含模型输出原文
    throw new ApiError('invalid-svg', BAD_SVG_MESSAGE, undefined, 'invalid_svg')
  }
}

// ---------- FR-03 连接自检专用请求 ----------

export interface TestRequestResult {
  ok: boolean
  status?: number
  info?: FailureInfo
}

/**
 * 最小请求：max_tokens=1、单次不重试、不携带任何用户作品数据。
 * Key 只进 Authorization 头，绝不进 URL / 日志 / console / 持久化之外的位置。
 * 网络层异常由本函数归类为 cors；6s 超时与取消由 selftest.ts 的 AbortController 控制。
 */
export async function testConnectionRequest(
  opts: Pick<GenOptions, 'baseUrl' | 'apiKey' | 'model'>,
  signal?: AbortSignal
): Promise<TestRequestResult> {
  const endpoint = buildEndpoint(opts.baseUrl)
  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: authHeaders(opts.apiKey),
      body: JSON.stringify({
        model: opts.model.trim(),
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0,
        stream: false
      }),
      signal
    })
  } catch (e) {
    if (isAbortError(e)) throw e
    return { ok: false, info: classifyNetwork() }
  }
  if (!res.ok) {
    return { ok: false, status: res.status, info: classifyHttpStatus(res.status) }
  }
  return { ok: true }
}
