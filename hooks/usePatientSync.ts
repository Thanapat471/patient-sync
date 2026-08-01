'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import throttle from 'lodash.throttle'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Patient } from '@/lib/schema'
import { PATIENT_LOBBY_CHANNEL, patientSessionChannelName } from '@/lib/realtime'

type ThrottledSend = ((field: keyof Patient, value: string) => void) & { cancel: () => void }
type ThrottledSnapshot = (() => void) & { cancel: () => void }

/** Status only — staff see "Inactive". Nothing is discarded. */
const IDLE_TIMEOUT_MS = 15_000
const SNAPSHOT_INTERVAL_MS = 3_000

/**
 * Inactivity expiry, the kiosk pattern. The form holds name, date of birth,
 * address and religion, so a session abandoned on a shared device exposes the
 * previous patient to whoever sits down next. Lower both values to a few
 * seconds to exercise the flow by hand.
 */
const SESSION_WARNING_AFTER_MS = 3 * 60_000
export const SESSION_WARNING_GRACE_MS = 60_000

export type PatientSessionState = 'active' | 'warning' | 'expired'

export function usePatientSync(sessionId: string) {
  const [sessionState, setSessionState] = useState<PatientSessionState>('active')
  const sendRef = useRef<ThrottledSend | null>(null)
  const snapshotRef = useRef<ThrottledSnapshot | null>(null)
  const sessionChannelRef = useRef<RealtimeChannel | null>(null)
  const lobbyChannelRef = useRef<RealtimeChannel | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submittedRef = useRef(false)
  const expiredRef = useRef(false)
  const activeRef = useRef(true)
  const currentStatusRef = useRef<'filling' | 'inactive'>('filling')
  /** Everything typed so far, so a late-joining dashboard can catch up. */
  const fieldsSnapshotRef = useRef<Partial<Patient>>({})

  // Presence channels can silently drop, and a Phoenix channel can only be
  // joined once — recovering means a fresh channel object, not a resubscribe.
  const joinLobbyChannel = useCallback(
    (onJoined?: () => void) => {
      const channel = supabase.channel(PATIENT_LOBBY_CHANNEL, {
        config: { presence: { key: sessionId } },
      })
      lobbyChannelRef.current = channel
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED' && activeRef.current) {
          onJoined?.()
        }
      })
      return channel
    },
    [sessionId]
  )

  const trackPresence = useCallback(
    (status: 'filling' | 'inactive') => {
      const channel = lobbyChannelRef.current
      // An idle patient sends no broadcasts, so the snapshot rides along here
      // as the only up-to-date copy staff can pick up.
      const payload = { status, fields: fieldsSnapshotRef.current }

      if (channel?.state === 'joined') {
        channel.track(payload)
      } else {
        if (channel) supabase.removeChannel(channel)
        joinLobbyChannel(() => {
          lobbyChannelRef.current?.track(payload)
        })
      }
    },
    [joinLobbyChannel]
  )

  const setPresenceStatus = useCallback(
    (status: 'filling' | 'inactive') => {
      if (submittedRef.current || expiredRef.current) return
      // Supabase rate-limits presence and closes the channel if track() runs on
      // a timer, so it fires only on a genuine flip. High-frequency updates go
      // over broadcast instead.
      if (currentStatusRef.current === status) return
      currentStatusRef.current = status
      trackPresence(status)
    },
    [trackPresence]
  )

  const expireSession = useCallback(() => {
    if (submittedRef.current || expiredRef.current) return
    expiredRef.current = true
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    snapshotRef.current?.cancel()
    // Staff's normal presence-leave path retires the row from here.
    lobbyChannelRef.current?.untrack()
    setSessionState('expired')
  }, [])

  /** Resets all three activity clocks together, so none is left counting down. */
  const scheduleIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current)
    if (submittedRef.current || expiredRef.current) return

    idleTimerRef.current = setTimeout(() => setPresenceStatus('inactive'), IDLE_TIMEOUT_MS)
    warningTimerRef.current = setTimeout(() => {
      setSessionState('warning')
      // Armed only once the warning is on screen, so the patient always gets
      // the full grace period to react to it.
      expiryTimerRef.current = setTimeout(expireSession, SESSION_WARNING_GRACE_MS)
    }, SESSION_WARNING_AFTER_MS)
  }, [setPresenceStatus, expireSession])

  /**
   * Any sign of life: a keystroke, window focus, "I'm still here", Submit.
   * Clears the warning banner as well as the clocks — resetting one without the
   * other strands a frozen countdown over a form that will no longer expire.
   */
  const keepSessionAlive = useCallback(() => {
    if (expiredRef.current) return
    setSessionState('active')
    setPresenceStatus('filling')
    scheduleIdle()
  }, [setPresenceStatus, scheduleIdle])

  useEffect(() => {
    activeRef.current = true
    submittedRef.current = false
    expiredRef.current = false
    currentStatusRef.current = 'filling'
    fieldsSnapshotRef.current = {}

    const sessionChannel = supabase.channel(patientSessionChannelName(sessionId))
    sessionChannel.subscribe()
    sessionChannelRef.current = sessionChannel

    const throttledSend: ThrottledSend = throttle((field, value) => {
      sessionChannel.send({
        type: 'broadcast',
        event: 'field_update',
        payload: { field, value },
      })
    }, 300)
    sendRef.current = throttledSend

    // Broadcast has far higher rate limits than presence, so the catch-up
    // snapshot for late-joining staff rides on this channel.
    const throttledSnapshot: ThrottledSnapshot = throttle(() => {
      sessionChannel.send({
        type: 'broadcast',
        event: 'state_snapshot',
        payload: { fields: fieldsSnapshotRef.current },
      })
    }, SNAPSHOT_INTERVAL_MS)
    snapshotRef.current = throttledSnapshot

    joinLobbyChannel(() => {
      trackPresence('filling')
    })

    scheduleIdle()

    function handleBlur() {
      setPresenceStatus('inactive')
    }
    function handleFocus() {
      keepSessionAlive()
    }
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)

    return () => {
      activeRef.current = false
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current)
      sendRef.current = null
      snapshotRef.current = null
      throttledSend.cancel()
      throttledSnapshot.cancel()
      supabase.removeChannel(sessionChannel)
      sessionChannelRef.current = null
      if (lobbyChannelRef.current) supabase.removeChannel(lobbyChannelRef.current)
      lobbyChannelRef.current = null
    }
  }, [
    sessionId,
    scheduleIdle,
    setPresenceStatus,
    keepSessionAlive,
    joinLobbyChannel,
    trackPresence,
  ])

  const sendFieldUpdate = useCallback(
    (field: keyof Patient, value: string) => {
      // Nothing more goes out on an expired session's channels.
      if (expiredRef.current) return
      sendRef.current?.(field, value)
      fieldsSnapshotRef.current = { ...fieldsSnapshotRef.current, [field]: value }
      keepSessionAlive()
      snapshotRef.current?.()
    },
    [keepSessionAlive]
  )

  const markSubmitted = useCallback(() => {
    submittedRef.current = true
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current)
    snapshotRef.current?.cancel()
    sessionChannelRef.current?.send({
      type: 'broadcast',
      event: 'submitted',
      payload: {},
    })
    lobbyChannelRef.current?.untrack()
  }, [])

  return { sendFieldUpdate, markSubmitted, sessionState, keepSessionAlive }
}
