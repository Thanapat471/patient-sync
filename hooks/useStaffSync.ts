'use client'

import { useEffect } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useStaffStore, type SessionStatus } from '@/store/useStaffStore'
import { PATIENT_LOBBY_CHANNEL, patientSessionChannelName } from '@/lib/realtime'
import { fetchPatientSubmissions } from '@/lib/patientSubmissions'
import type { Patient } from '@/lib/schema'

type LobbyPresence = { status: SessionStatus; fields?: Partial<Patient> }

export function useStaffSync() {
  const upsertSession = useStaffStore((state) => state.upsertSession)
  const setField = useStaffStore((state) => state.setField)
  const mergeFields = useStaffStore((state) => state.mergeFields)
  const setStatus = useStaffStore((state) => state.setStatus)

  useEffect(() => {
    let cancelled = false
    const sessionChannels = new Map<string, RealtimeChannel>()

    function joinSessionChannel(sessionId: string) {
      if (sessionChannels.has(sessionId)) return
      const channel = supabase
        .channel(patientSessionChannelName(sessionId))
        .on('broadcast', { event: 'field_update' }, ({ payload }) => {
          setField(sessionId, payload.field, payload.value)
        })
        // Periodic catch-up for a dashboard that connected mid-session and
        // therefore missed the earlier keystrokes.
        .on('broadcast', { event: 'state_snapshot' }, ({ payload }) => {
          mergeFields(sessionId, payload.fields ?? {})
        })
        .on('broadcast', { event: 'submitted' }, () => {
          setStatus(sessionId, 'submitted')
        })
        .subscribe()
      sessionChannels.set(sessionId, channel)
    }

    fetchPatientSubmissions()
      .then((submissions) => {
        if (cancelled) return
        submissions.forEach(({ sessionId, fields }) => {
          upsertSession(sessionId, { fields, status: 'submitted', lastSeen: Date.now() })
        })
      })
      .catch((error) => {
        console.error('Failed to load past patient submissions', error)
      })

    const lobbyChannel = supabase
      .channel(PATIENT_LOBBY_CHANNEL)
      .on('presence', { event: 'sync' }, () => {
        const presenceState = lobbyChannel.presenceState<LobbyPresence>()

        Object.entries(presenceState).forEach(([sessionId, presences]) => {
          const status = presences[0]?.status ?? 'filling'
          const existing = useStaffStore.getState().sessions[sessionId]
          if (existing?.status === 'submitted') {
            // already submitted — presence updates no longer apply
          } else if (existing) {
            setStatus(sessionId, status)
          } else {
            // First time seeing this session (e.g. this staff tab just
            // (re)connected) — presence carries a recent fields snapshot so
            // we don't show "Unnamed patient" until the next keystroke.
            const fields = presences[0]?.fields ?? {}
            upsertSession(sessionId, { fields, status, lastSeen: Date.now() })
          }
          joinSessionChannel(sessionId)
        })
      })
      .on('presence', { event: 'leave' }, ({ key, currentPresences }) => {
        // Re-calling track() — which the patient does periodically to refresh
        // its field snapshot — retires the old presence ref and registers a new
        // one, so a leave fires for a patient who never actually left. Phoenix
        // reports what's still present for that key; only a genuine departure
        // leaves nothing behind.
        if (currentPresences.length > 0) return

        const existing = useStaffStore.getState().sessions[key]
        if (existing && existing.status !== 'submitted') {
          setStatus(key, 'inactive')
        }
      })
      .subscribe()

    return () => {
      cancelled = true
      sessionChannels.forEach((channel) => supabase.removeChannel(channel))
      sessionChannels.clear()
      supabase.removeChannel(lobbyChannel)
    }
  }, [upsertSession, setField, mergeFields, setStatus])
}
