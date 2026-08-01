import { create } from 'zustand'
import type { Patient } from '@/lib/schema'

export type SessionStatus = 'filling' | 'inactive' | 'submitted'

export type StaffSession = {
  fields: Partial<Patient>
  status: SessionStatus
  lastSeen: number
}

type StaffStore = {
  sessions: Record<string, StaffSession>
  selectedSessionId: string | null
  upsertSession: (sessionId: string, session: StaffSession) => void
  setField: <K extends keyof Patient>(
    sessionId: string,
    field: K,
    value: Patient[K]
  ) => void
  mergeFields: (sessionId: string, fields: Partial<Patient>) => void
  setStatus: (sessionId: string, status: SessionStatus) => void
  removeSession: (sessionId: string) => void
  selectSession: (sessionId: string) => void
}

export const useStaffStore = create<StaffStore>((set) => ({
  sessions: {},
  selectedSessionId: null,

  upsertSession: (sessionId, session) =>
    set((state) => ({
      sessions: { ...state.sessions, [sessionId]: session },
    })),

  setField: (sessionId, field, value) =>
    set((state) => {
      const existing = state.sessions[sessionId]
      if (!existing) return state
      // A submitted record is final, however a stray update reached us.
      if (existing.status === 'submitted') return state
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...existing,
            fields: { ...existing.fields, [field]: value },
            lastSeen: Date.now(),
          },
        },
      }
    }),

  mergeFields: (sessionId, fields) =>
    set((state) => {
      const existing = state.sessions[sessionId]
      if (!existing) return state
      if (existing.status === 'submitted') return state
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...existing,
            fields: { ...existing.fields, ...fields },
            lastSeen: Date.now(),
          },
        },
      }
    }),

  setStatus: (sessionId, status) =>
    set((state) => {
      const existing = state.sessions[sessionId]
      if (!existing) return state
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...existing, status },
        },
      }
    }),

  removeSession: (sessionId) =>
    set((state) => {
      if (!state.sessions[sessionId]) return state
      const sessions = { ...state.sessions }
      delete sessions[sessionId]
      return {
        sessions,
        // Don't leave the mirror pointed at a session that no longer exists.
        selectedSessionId:
          state.selectedSessionId === sessionId ? null : state.selectedSessionId,
      }
    }),

  selectSession: (sessionId) => set({ selectedSessionId: sessionId }),
}))
