'use client'

import { useEffect } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useStaffStore, type SessionStatus } from '@/store/useStaffStore'
import { PATIENT_LOBBY_CHANNEL, patientSessionChannelName } from '@/lib/realtime'
import { fetchPatientSubmissions } from '@/lib/patientSubmissions'
import type { Patient } from '@/lib/schema'

type LobbyPresence = { status: SessionStatus; fields?: Partial<Patient> }

/**
 * How long a session stays on screen after its presence disappears.
 *
 * A closed tab and a phone that suspended its socket look identical from here,
 * so we don't retire the row instantly — a patient who comes back within this
 * window keeps their place in the queue.
 */
const DISCONNECT_GRACE_MS = 15_000

export function useStaffSync() {
  const upsertSession = useStaffStore((state) => state.upsertSession)
  const setField = useStaffStore((state) => state.setField)
  const mergeFields = useStaffStore((state) => state.mergeFields)
  const setStatus = useStaffStore((state) => state.setStatus)
  const removeSession = useStaffStore((state) => state.removeSession)

  useEffect(() => {
    let cancelled = false
    const sessionChannels = new Map<string, RealtimeChannel>()
    const pendingRemovals = new Map<string, ReturnType<typeof setTimeout>>()

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

    function leaveSessionChannel(sessionId: string) {
      const channel = sessionChannels.get(sessionId)
      if (!channel) return
      supabase.removeChannel(channel)
      sessionChannels.delete(sessionId)
    }

    function cancelRemoval(sessionId: string) {
      const timer = pendingRemovals.get(sessionId)
      if (!timer) return
      clearTimeout(timer)
      pendingRemovals.delete(sessionId)
    }

    function scheduleRemoval(sessionId: string) {
      if (pendingRemovals.has(sessionId)) return
      const timer = setTimeout(() => {
        pendingRemovals.delete(sessionId)
        if (cancelled) return

        // Re-check rather than trusting the state we saw when the timer was
        // set. A `submitted` broadcast can land after the presence leave —
        // untrack() and the broadcast travel on different channels, so their
        // arrival order isn't guaranteed — and that record must survive.
        const session = useStaffStore.getState().sessions[sessionId]
        if (!session || session.status === 'submitted') return

        leaveSessionChannel(sessionId)
        removeSession(sessionId)
      }, DISCONNECT_GRACE_MS)
      pendingRemovals.set(sessionId, timer)
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
          // Whoever is present is alive — call off any pending retirement.
          cancelRemoval(sessionId)

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

        // Safety net: a `leave` can be missed (dropped socket, a staff tab that
        // was asleep). Presence state is the authority, so anything in the
        // store that isn't in it is on its way out.
        Object.entries(useStaffStore.getState().sessions).forEach(
          ([sessionId, session]) => {
            if (session.status === 'submitted') return
            if (presenceState[sessionId]) return
            scheduleRemoval(sessionId)
          }
        )
      })
      .on('presence', { event: 'leave' }, ({ key, currentPresences }) => {
        // Re-calling track() retires the old presence ref and registers a new
        // one, so a leave fires for a patient who never actually left. Phoenix
        // reports what's still present for that key; only a genuine departure
        // leaves nothing behind.
        if (currentPresences.length > 0) return

        const existing = useStaffStore.getState().sessions[key]
        if (existing && existing.status !== 'submitted') {
          // Show them as inactive straight away, then retire the row if they
          // don't come back. Without this the queue filled up with dead
          // sessions that only a page refresh would clear.
          setStatus(key, 'inactive')
          scheduleRemoval(key)
        }
      })
      .subscribe()

    return () => {
      cancelled = true
      pendingRemovals.forEach((timer) => clearTimeout(timer))
      pendingRemovals.clear()
      sessionChannels.forEach((channel) => supabase.removeChannel(channel))
      sessionChannels.clear()
      supabase.removeChannel(lobbyChannel)
    }
  }, [upsertSession, setField, mergeFields, setStatus, removeSession])
}
