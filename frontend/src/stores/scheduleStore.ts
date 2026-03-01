import { create } from 'zustand'
import { api } from '../lib/api'

interface Schedule {
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

interface CreateScheduleInput {
  name?: string
  ticker_source?: string
  tickers?: string[]
  frequency?: string
  hour?: number
  minute?: number
  day_of_week?: number
  language?: string
  generate_audio?: boolean
}

interface ScheduleState {
  schedules: Schedule[]
  loading: boolean
  error: string | null
  isLocal: boolean
  fetch: () => Promise<void>
  create: (input: CreateScheduleInput) => Promise<boolean>
  remove: (id: string) => Promise<void>
  pause: (id: string) => Promise<void>
  resume: (id: string) => Promise<void>
}

const STORAGE_KEY = 'qb_schedules'

function loadLocal(): Schedule[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveLocal(schedules: Schedule[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules))
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: loadLocal(),
  loading: false,
  error: null,
  isLocal: false,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api.schedule.list()
      const schedules = data.schedules || []
      saveLocal(schedules)
      set({ schedules, loading: false, isLocal: false })
    } catch {
      const schedules = loadLocal()
      set({ schedules, loading: false, isLocal: true })
    }
  },

  create: async (input) => {
    set({ error: null })
    try {
      const data = await api.schedule.create(input)
      const schedule = data.schedule
      const schedules = [...get().schedules, schedule]
      saveLocal(schedules)
      set({ schedules, isLocal: false })
      return true
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to create schedule' })
      return false
    }
  },

  remove: async (id) => {
    set({ error: null })
    try {
      await api.schedule.remove(id)
      const schedules = get().schedules.filter((s) => s.id !== id)
      saveLocal(schedules)
      set({ schedules, isLocal: false })
    } catch {
      const schedules = get().schedules.filter((s) => s.id !== id)
      saveLocal(schedules)
      set({ schedules, isLocal: true })
    }
  },

  pause: async (id) => {
    set({ error: null })
    try {
      const data = await api.schedule.pause(id)
      const updated = data.schedule
      const schedules = get().schedules.map((s) => (s.id === id ? updated : s))
      saveLocal(schedules)
      set({ schedules, isLocal: false })
    } catch {
      const schedules = get().schedules.map((s) =>
        s.id === id ? { ...s, paused: true, next_run_at: null } : s
      )
      saveLocal(schedules)
      set({ schedules, isLocal: true })
    }
  },

  resume: async (id) => {
    set({ error: null })
    try {
      const data = await api.schedule.resume(id)
      const updated = data.schedule
      const schedules = get().schedules.map((s) => (s.id === id ? updated : s))
      saveLocal(schedules)
      set({ schedules, isLocal: false })
    } catch {
      const schedules = get().schedules.map((s) =>
        s.id === id ? { ...s, paused: false } : s
      )
      saveLocal(schedules)
      set({ schedules, isLocal: true })
    }
  },
}))
