import { DOODLE_PROMPT, STICKMAN_PROMPT } from './prompts'
import { sanitizeSvg } from './sanitize'

export type GenMode = 'doodle' | 'stickman'

export interface GenOptions {
  baseUrl: string
  apiKey: string
  model: string
  mode: GenMode
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
    public detail?: string // 原始响应体/技术信息，仅供 console.error，绝不进 userMessage
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

function httpUserMessage(status: number): string {
  if (status === 401 || status === 403) return '密钥无效或没有权限，请检查 API Key'
  if (status === 404) return '接口地址不对，请检查 API 地址'
  if (status === 429) return '请求太频繁，稍等一会儿再试'
  if (status === 400) return '请求没被接受，请缩短描述后再试'
  return '请求没被接受，请检查设置或换一句描述再试'
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

/** 生成并过滤一张 SVG。重试由 main.ts 的 submit 循环控制，此处不重试。 */
export async function generateSvg(opts: GenOptions, signal?: AbortSignal): Promise<string> {
  const endpoint = buildEndpoint(opts.baseUrl)
  const system = opts.mode === 'stickman' ? STICKMAN_PROMPT : DOODLE_PROMPT

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = opts.apiKey.trim()
  // apiKey 为空时不再发送 "Bearer EMPTY"；正常路径由 main.ts 前置校验拦截
  if (key) headers.Authorization = `Bearer ${key}`

  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: opts.model || 'glm-5.2',
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
    // AbortError 原样抛出，由 main.ts 依据 cancelReason 判定（user / timeout）
    if (isAbortError(e)) throw e
    throw new ApiError(
      'network',
      '还是没能连上，请检查网络或 API 地址后重试',
      undefined,
      String(e)
    )
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError('http', httpUserMessage(res.status), res.status, text)
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
    throw new ApiError('invalid-svg', BAD_SVG_MESSAGE, undefined, content.slice(0, 200))
  }
}
