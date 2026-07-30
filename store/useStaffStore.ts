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

  selectSession: (sessionId) => set({ selectedSessionId: sessionId }),
}))
