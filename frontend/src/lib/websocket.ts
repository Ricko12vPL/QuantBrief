type ProgressCallback = (stage: string, pct: number) => void

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

export function connectPipelineWS(onProgress: ProgressCallback): () => void {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = `${protocol}//${window.location.host}/api/ws/pipeline`

  function connect() {
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
      reconnectTimer = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws?.close()
    }
  }

  connect()

  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    ws?.close()
    ws = null
  }
}
