'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
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
  const removeSession = useStaffStore((state) => state.removeSession)

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
        // Catch-up for a dashboard that connected mid-session.
        .on('broadcast', { event: 'state_snapshot' }, ({ payload }) => {
          mergeFields(sessionId, payload.fields ?? {})
        })
        .on('broadcast', { event: 'submitted' }, () => {
          setStatus(sessionId, 'submitted')
        })
        .subscribe()
      sessionChannels.set(sessionId, channel)
    }

    /**
     * Retire a session as soon as its presence is gone. Callers exempt
     * submitted ones — those are records that outlive the connection.
     */
    function dropSession(sessionId: string) {
      const channel = sessionChannels.get(sessionId)
      if (channel) {
        supabase.removeChannel(channel)
        sessionChannels.delete(sessionId)
      }
      removeSession(sessionId)
    }

    fetchPatientSubmissions()
      .then((submissions) => {
        if (cancelled) return
        submissions.forEach(({ sessionId, fields, submittedAt }) => {
          // The real submission time, so "…ago" survives a staff refresh.
          upsertSession(sessionId, { fields, status: 'submitted', lastSeen: submittedAt })
        })
      })
      .catch((error) => {
        console.error('Failed to load past patient submissions', error)
        if (!cancelled) {
          toast.error('Could not load submitted registrations', {
            description: 'Live sessions still work. Refresh to retry.',
          })
        }
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
            // First sighting — presence carries a fields snapshot, so a staff
            // tab that just connected skips straight past "Unnamed patient".
            const fields = presences[0]?.fields ?? {}
            upsertSession(sessionId, { fields, status, lastSeen: Date.now() })
          }
          joinSessionChannel(sessionId)
        })

        // Presence state, not the leave event, is the authority — reconciling
        // here means a missed `leave` can't strand a dead session in the queue.
        Object.entries(useStaffStore.getState().sessions).forEach(
          ([sessionId, session]) => {
            if (session.status === 'submitted') return
            if (presenceState[sessionId]) return
            dropSession(sessionId)
          }
        )
      })
      .on('presence', { event: 'leave' }, ({ key, currentPresences }) => {
        // Re-calling track() retires the old presence ref, firing a leave for a
        // patient who never left. Only a genuine departure leaves nothing behind.
        if (currentPresences.length > 0) return

        const existing = useStaffStore.getState().sessions[key]
        if (existing && existing.status !== 'submitted') {
          dropSession(key)
        }
      })
      .subscribe()

    return () => {
      cancelled = true
      sessionChannels.forEach((channel) => supabase.removeChannel(channel))
      sessionChannels.clear()
      supabase.removeChannel(lobbyChannel)
    }
  }, [upsertSession, setField, mergeFields, setStatus, removeSession])
}
