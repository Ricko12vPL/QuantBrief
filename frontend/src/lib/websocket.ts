type ProgressCallback = (stage: string, pct: number) => void

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let shouldReconnect = false

export function connectPipelineWS(onProgress: ProgressCallback): () => void {
  const token = localStorage.getItem('qb_token') || ''
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : ''

  const apiUrl = import.meta.env.VITE_API_URL
  let url: string
  if (apiUrl) {
    const wsBase = apiUrl.replace(/^http/, 'ws')
    url = `${wsBase}/ws/pipeline${tokenParam}`
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    url = `${protocol}//${window.location.host}/api/ws/pipeline${tokenParam}`
  }

  shouldReconnect = true

  function connect() {
    if (ws) {
      ws.onclose = null
      ws.onerror = null
      ws.close()
      ws = null
    }

    ws = new WebSocket(url)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'pipeline_progress') {
          onProgress(data.stage, data.pct)
        }
      } catch { /* ignore parse errors */ }
    }

    ws.onclose = () => {
      if (shouldReconnect) {
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    ws.onerror = () => {
      ws?.close()
    }
  }

  connect()

  return () => {
    shouldReconnect = false
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws) {
      ws.onclose = null
      ws.onerror = null
      ws.close()
      ws = null
    }
  }
}
