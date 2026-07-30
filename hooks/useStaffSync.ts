'use client'

import { useEffect } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useStaffStore, type SessionStatus } from '@/store/useStaffStore'
import { PATIENT_LOBBY_CHANNEL, patientSessionChannelName } from '@/lib/realtime'
import { fetchPatientSubmissions } from '@/lib/patientSubmissions'

type LobbyPresence = { status: SessionStatus }

export function useStaffSync() {
  const upsertSession = useStaffStore((state) => state.upsertSession)
  const setField = useStaffStore((state) => state.setField)
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
            upsertSession(sessionId, { fields: {}, status, lastSeen: Date.now() })
          }
          joinSessionChannel(sessionId)
        })
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
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
  }, [upsertSession, setField, setStatus])
}
