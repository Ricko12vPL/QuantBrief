import { useAuthStore } from '../stores/authStore'
import type { Brief } from '../stores/briefStore'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

export function resolveStaticUrl(path: string): string {
  if (!path || path.startsWith('http')) return path
  const base = import.meta.env.VITE_API_URL || ''
  const origin = base.replace(/\/api$/, '')
  return origin ? `${origin}${path}` : path
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('qb_token')
  if (token) {
    return { Authorization: `Bearer ${token}` }
  }
  return {}
}

async function tryRefreshToken(): Promise<boolean> {
  const refresh = localStorage.getItem('qb_refresh')
  if (!refresh) return false
  try {
    const resp = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!resp.ok) return false
    const data = await resp.json()
    localStorage.setItem('qb_token', data.access_token)
    localStorage.setItem('qb_refresh', data.refresh_token)
    return true
  } catch {
    return false
  }
}

function handleSessionExpired(): never {
  useAuthStore.getState().logout()
  throw new Error('Session expired')
}

async function handle401Retry(url: string, options: RequestInit | undefined, headers: Record<string, string>): Promise<Response> {
  const refreshed = await tryRefreshToken()
  if (refreshed) {
    const retryHeaders = {
      ...headers,
      ...getAuthHeader(),
    }
    const retryResp = await fetch(`${BASE_URL}${url}`, { ...options, headers: retryHeaders })
    if (retryResp.ok) return retryResp
    const err = await retryResp.json().catch(() => ({ detail: retryResp.statusText }))
    throw new Error(extractErrorMessage(err))
  }
  handleSessionExpired()
}

function extractErrorMessage(err: Record<string, unknown>): string {
  const detail = err.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0]
    if (typeof first === 'object' && first !== null && 'msg' in first) {
      return String(first.msg)
    }
    return String(first)
  }
  return 'Request failed'
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options?.headers as Record<string, string> || {}),
  }

  const resp = await fetch(`${BASE_URL}${url}`, { ...options, headers })

  if (resp.status === 401 && !url.startsWith('/auth/')) {
    const retryResp = await handle401Retry(url, options, headers)
    return retryResp.json()
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(extractErrorMessage(err))
  }
  return resp.json()
}

async function authFormFetch<T>(url: string, options: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeader(),
    ...(options.headers as Record<string, string> || {}),
  }

  const resp = await fetch(`${BASE_URL}${url}`, { ...options, headers })

  if (resp.status === 401 && !url.startsWith('/auth/')) {
    const retryResp = await handle401Retry(url, options, headers)
    return retryResp.json()
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(extractErrorMessage(err))
  }
  return resp.json()
}

// --- Response types ---

interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

interface UserInfo {
  id: string
  email: string
  display_name: string
  tier: string
  language_preference: string
  is_active: boolean
  created_at: string
}

interface WatchlistItem {
  ticker: string
  company_name: string
  notes: string
  added_at: string
}

interface WatchlistResponse {
  watchlist: { items: WatchlistItem[] }
}

interface Position {
  ticker: string
  shares: number
  avg_price: number
  company_name: string
}

interface PortfolioResponse {
  positions: Position[]
}

interface BriefSummary {
  id: string
  executive_summary: string
  generated_at: string
  language: string
  tickers: string[]
  overall_sentiment: string
}

interface ScheduleItem {
  id: string
  name: string
  ticker_source: string
  tickers: string[]
  frequency: string
  hour: number
  minute: number
  day_of_week: number
  language: string
  generate_audio: boolean
  paused: boolean
  created_at: string
  last_run_at: string | null
  next_run_at: string | null
  last_brief_id: string | null
}

interface QuoteItem {
  ticker: string
  price: number
  change: number
  change_pct: number
}

interface NewsItem {
  title: string
  publisher: string
  link: string
  published_at: string
  thumbnail: string
  sentiment: string
  relevance_score: number
  summary: string
}

interface BriefResponse {
  brief: Brief | null
  message?: string
}

interface SearchResult {
  symbol: string
  description: string
  type: string
}

interface FilingInfo {
  ticker: string
  form_type: string
  filing_date: string
  filing_url: string
}

interface FilingListResponse {
  ticker: string
  filings: FilingInfo[]
}

interface FilingAnalysisResponse {
  analysis: Record<string, unknown>
}

interface EarningsAnalysis {
  ticker: string
  transcript: string
  key_topics: string[]
  financial_highlights: { metric: string; value: string; comparison: string; commentary: string }[]
  forward_guidance: string[]
  risk_factors: string[]
  qa_highlights: { question: string; answer: string; topic: string }[]
  summary: string
  sentiment: string
  confidence_score: number
}

interface EarningsAnalysisResponse {
  analysis: EarningsAnalysis
}

interface CandleData {
  date: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface CandleResponse {
  ticker: string
  resolution: string
  candles: CandleData[]
  error: string | null
}

interface TechnicalData {
  ticker: string
  rsi: number
  rsi_signal: string
  macd_signal: string
  macd_histogram: number
  macd_line?: number
  macd_signal_line?: number
  bb_upper?: number
  bb_middle?: number
  bb_lower?: number
  bb_position?: string
  sma_20?: number
  sma_50?: number
  sma_200?: number
  price?: number
  price_vs_sma200?: string
  volume_signal?: string
  volume_latest?: number
  volume_avg_20?: number
}

interface TechnicalAnalysisResponse {
  ticker: string
  indicators: TechnicalData
  ai_analysis: Record<string, unknown>
}

interface RatiosResponse {
  ticker: string
  [key: string]: unknown
}

// --- API namespace ---

export const api = {
  auth: {
    register: (email: string, password: string, displayName = '') =>
      fetchJSON<TokenResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, display_name: displayName }),
      }),
    login: (email: string, password: string) =>
      fetchJSON<TokenResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    refresh: (refreshToken: string) =>
      fetchJSON<TokenResponse>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      }),
    me: () => fetchJSON<UserInfo>('/auth/me'),
  },
  brief: {

    getLatest: () => fetchJSON<BriefResponse>('/brief/latest'),

    generate: (tickers?: string[], language?: string, generateAudio?: boolean) =>
      fetchJSON<BriefResponse>('/brief/generate', {
        method: 'POST',
        body: JSON.stringify({
          tickers: tickers || ['NVDA', 'AAPL', 'MSFT'],
          language: language || 'en',
          generate_audio: generateAudio ?? true,
        }),
      }),
    getHistory: (limit = 10, offset = 0) =>
      fetchJSON<{ briefs: BriefSummary[]; total: number }>(`/brief/history?limit=${limit}&offset=${offset}`),
  },
  watchlist: {
    get: () => fetchJSON<WatchlistResponse>('/watchlist'),
    add: (ticker: string, companyName = '') =>
      fetchJSON<WatchlistResponse>(`/watchlist?ticker=${ticker}&company_name=${encodeURIComponent(companyName)}`, {
        method: 'POST',
      }),
    remove: (ticker: string) =>
      fetchJSON<WatchlistResponse>(`/watchlist/${ticker}`, { method: 'DELETE' }),

    search: (q: string) =>
      fetchJSON<{ results: SearchResult[] }>(`/watchlist/search?q=${encodeURIComponent(q)}`),
  },
  filing: {

    get: (ticker: string) => fetchJSON<FilingListResponse>(`/filing/${ticker}`),

    analyze: (ticker: string, formType = '10-K') =>
      fetchJSON<FilingAnalysisResponse>(`/filing/${ticker}/analyze?form_type=${formType}`),
  },
  earningsCall: {

    analyze: async (file: File, ticker: string) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('ticker', ticker)
  
      return authFormFetch<EarningsAnalysisResponse>('/filing/earnings-call', {
        method: 'POST',
        body: formData,
      })
    },

    analyzeText: async (transcript: string, ticker: string) => {
      const formData = new FormData()
      formData.append('transcript', transcript)
      formData.append('ticker', ticker)

      return authFormFetch<EarningsAnalysisResponse>('/filing/earnings-call/text', {
        method: 'POST',
        body: formData,
      })
    },
  },
  audio: {
    getLatest: () => fetchJSON<{ audio_url: string; script: string; language: string }>('/audio/latest'),
    generate: (script: string, language = 'en') =>
      fetchJSON<{ audio_url: string; language: string }>('/audio/generate', {
        method: 'POST',
        body: JSON.stringify({ script, language }),
      }),
  },
  market: {
    getQuotes: (tickers: string[]) =>
      fetchJSON<{ quotes: QuoteItem[] }>(
        `/market/quotes?tickers=${tickers.join(',')}`
      ),

    getCandles: (ticker: string, resolution = 'D', days = 90) =>
      fetchJSON<CandleResponse>(`/market/${ticker}/candles?resolution=${resolution}&days=${days}`),

    getTechnical: (ticker: string) =>
      fetchJSON<TechnicalData>(`/market/${ticker}/technical`),

    analyzeTechnical: (ticker: string, question = '') =>
      fetchJSON<TechnicalAnalysisResponse>(`/market/${ticker}/analyze-technical`, {
        method: 'POST',
        body: JSON.stringify({ question }),
      }),

    getRatios: (ticker: string) =>
      fetchJSON<RatiosResponse>(`/market/${ticker}/ratios`),
    getNews: (ticker: string) =>
      fetchJSON<{ ticker: string; news: NewsItem[] }>(`/market/${ticker}/news`),
  },
  portfolio: {
    get: () => fetchJSON<PortfolioResponse>('/portfolio'),
    add: (ticker: string, shares: number, avgPrice: number, companyName = '') =>
      fetchJSON<PortfolioResponse>('/portfolio', {
        method: 'POST',
        body: JSON.stringify({
          ticker,
          shares,
          avg_price: avgPrice,
          company_name: companyName,
        }),
      }),
    remove: (ticker: string) =>
      fetchJSON<PortfolioResponse>(`/portfolio/${ticker}`, { method: 'DELETE' }),
  },
  schedule: {
    list: () => fetchJSON<{ schedules: ScheduleItem[] }>('/schedule'),
    create: (input: {
      name?: string
      ticker_source?: string
      tickers?: string[]
      frequency?: string
      hour?: number
      minute?: number
      day_of_week?: number
      language?: string
      generate_audio?: boolean
    }) =>
      fetchJSON<{ schedule: ScheduleItem }>('/schedule', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    remove: (id: string) =>
      fetchJSON<{ deleted: boolean }>(`/schedule/${id}`, { method: 'DELETE' }),
    pause: (id: string) =>
      fetchJSON<{ schedule: ScheduleItem }>(`/schedule/${id}/pause`, { method: 'POST' }),
    resume: (id: string) =>
      fetchJSON<{ schedule: ScheduleItem }>(`/schedule/${id}/resume`, { method: 'POST' }),
  },
}
