const BASE_URL = '/api'

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return resp.json()
}

export const api = {
  brief: {
    getLatest: () => fetchJSON<any>('/brief/latest'),
    generate: (tickers?: string[], language?: string, generateAudio?: boolean) =>
      fetchJSON<any>('/brief/generate', {
        method: 'POST',
        body: JSON.stringify({
          tickers: tickers || ['NVDA', 'AAPL', 'MSFT'],
          language: language || 'en',
          generate_audio: generateAudio ?? true,
        }),
      }),
    getHistory: (limit = 10) => fetchJSON<any>(`/brief/history?limit=${limit}`),
  },
  watchlist: {
    get: () => fetchJSON<any>('/watchlist'),
    add: (ticker: string, companyName = '') =>
      fetchJSON<any>(`/watchlist?ticker=${ticker}&company_name=${encodeURIComponent(companyName)}`, {
        method: 'POST',
      }),
    remove: (ticker: string) =>
      fetchJSON<any>(`/watchlist/${ticker}`, { method: 'DELETE' }),
    search: (q: string) =>
      fetchJSON<any>(`/watchlist/search?q=${encodeURIComponent(q)}`),
  },
  filing: {
    get: (ticker: string) => fetchJSON<any>(`/filing/${ticker}`),
    analyze: (ticker: string, formType = '10-K') =>
      fetchJSON<any>(`/filing/${ticker}/analyze?form_type=${formType}`),
  },
  earningsCall: {
    analyze: async (file: File, ticker: string) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('ticker', ticker)
      const res = await fetch(`${BASE_URL}/filing/earnings-call`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || 'Earnings call analysis failed')
      }
      return res.json()
    },
    analyzeText: async (transcript: string, ticker: string) => {
      const formData = new FormData()
      formData.append('transcript', transcript)
      formData.append('ticker', ticker)
      const res = await fetch(`${BASE_URL}/filing/earnings-call/text`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || 'Earnings call text analysis failed')
      }
      return res.json()
    },
  },
  audio: {
    getLatest: () => fetchJSON<any>('/audio/latest'),
    generate: (script: string, language = 'en') =>
      fetchJSON<any>('/audio/generate', {
        method: 'POST',
        body: JSON.stringify({ script, language }),
      }),
  },
  market: {
    getCandles: (ticker: string, resolution = 'D', days = 90) =>
      fetchJSON<any>(`/market/${ticker}/candles?resolution=${resolution}&days=${days}`),
    getTechnical: (ticker: string) =>
      fetchJSON<any>(`/market/${ticker}/technical`),
    analyzeTechnical: (ticker: string, question = '') =>
      fetchJSON<any>(`/market/${ticker}/analyze-technical`, {
        method: 'POST',
        body: JSON.stringify({ question }),
      }),
    getRatios: (ticker: string) =>
      fetchJSON<any>(`/market/${ticker}/ratios`),
  },
  portfolio: {
    get: () => fetchJSON<any>('/portfolio'),
    add: (ticker: string, shares: number, avgPrice: number, companyName = '') =>
      fetchJSON<any>('/portfolio', {
        method: 'POST',
        body: JSON.stringify({
          ticker,
          shares,
          avg_price: avgPrice,
          company_name: companyName,
        }),
      }),
    remove: (ticker: string) =>
      fetchJSON<any>(`/portfolio/${ticker}`, { method: 'DELETE' }),
  },
}
