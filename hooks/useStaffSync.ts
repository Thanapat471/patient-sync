'use client'

import { useEffect } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useStaffStore, type SessionStatus } from '@/store/useStaffStore'
import { PATIENT_LOBBY_CHANNEL, patientSessionChannelName } from '@/lib/realtime'

type LobbyPresence = { status: SessionStatus }

export function useStaffSync() {
  const upsertSession = useStaffStore((state) => state.upsertSession)
  const setField = useStaffStore((state) => state.setField)
  const setStatus = useStaffStore((state) => state.setStatus)

  useEffect(() => {
    const sessionChannels = new Map<string, RealtimeChannel>()

    function joinSessionChannel(sessionId: string) {
      if (sessionChannels.has(sessionId)) return
      const channel = supabase
        .channel(patientSessionChannelName(sessionId))
        .on('broadcast', { event: 'field_update' }, ({ payload }) => {
          setField(sessionId, payload.field, payload.value)
        })
        .subscribe()
      sessionChannels.set(sessionId, channel)
    }

    const lobbyChannel = supabase
      .channel(PATIENT_LOBBY_CHANNEL)
      .on('presence', { event: 'sync' }, () => {
        const presenceState = lobbyChannel.presenceState<LobbyPresence>()

        Object.entries(presenceState).forEach(([sessionId, presences]) => {
          const status = presences[0]?.status ?? 'filling'
          if (useStaffStore.getState().sessions[sessionId]) {
            setStatus(sessionId, status)
          } else {
            upsertSession(sessionId, { fields: {}, status, lastSeen: Date.now() })
          }
          joinSessionChannel(sessionId)
        })
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (useStaffStore.getState().sessions[key]) {
          setStatus(key, 'inactive')
        }
      })
      .subscribe()

    return () => {
      sessionChannels.forEach((channel) => supabase.removeChannel(channel))
      sessionChannels.clear()
      supabase.removeChannel(lobbyChannel)
    }
  }, [upsertSession, setField, setStatus])
}
