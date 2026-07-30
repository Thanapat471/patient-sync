'use client'

import { useCallback, useEffect, useRef } from 'react'
import throttle from 'lodash.throttle'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Patient } from '@/lib/schema'
import { PATIENT_LOBBY_CHANNEL, patientSessionChannelName } from '@/lib/realtime'

type ThrottledSend = ((field: keyof Patient, value: string) => void) & { cancel: () => void }
type ThrottledSnapshot = (() => void) & { cancel: () => void }

const IDLE_TIMEOUT_MS = 15_000
const SNAPSHOT_INTERVAL_MS = 3_000

export function usePatientSync(sessionId: string) {
  const sendRef = useRef<ThrottledSend | null>(null)
  const snapshotRef = useRef<ThrottledSnapshot | null>(null)
  const sessionChannelRef = useRef<RealtimeChannel | null>(null)
  const lobbyChannelRef = useRef<RealtimeChannel | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submittedRef = useRef(false)
  const activeRef = useRef(true)
  const currentStatusRef = useRef<'filling' | 'inactive'>('filling')
  // A running copy of everything typed so far, so a staff dashboard that
  // connects late can be brought up to date without replaying every keystroke.
  const fieldsSnapshotRef = useRef<Partial<Patient>>({})

  // Presence channels can silently drop. Phoenix channel objects can only be
  // joined once, so recovering means creating a fresh channel for the same
  // topic rather than resubscribing the old one.
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
      // Carrying the snapshot here covers the idle case: an idle patient sends
      // no broadcasts, so this is the only up-to-date copy staff can pick up.
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
      if (submittedRef.current) return
      // Supabase rate-limits presence and will close the channel if track() is
      // called on a timer, so it fires only when the status genuinely flips.
      // Everything high-frequency goes over broadcast instead.
      if (currentStatusRef.current === status) return
      currentStatusRef.current = status
      trackPresence(status)
    },
    [trackPresence]
  )

  const scheduleIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setPresenceStatus('inactive'), IDLE_TIMEOUT_MS)
  }, [setPresenceStatus])

  useEffect(() => {
    activeRef.current = true
    submittedRef.current = false
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

    // Broadcast has far higher rate limits than presence, so the periodic
    // catch-up snapshot for late-joining staff rides on this channel.
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
      setPresenceStatus('filling')
      scheduleIdle()
    }
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)

    return () => {
      activeRef.current = false
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      sendRef.current = null
      snapshotRef.current = null
      throttledSend.cancel()
      throttledSnapshot.cancel()
      supabase.removeChannel(sessionChannel)
      sessionChannelRef.current = null
      if (lobbyChannelRef.current) supabase.removeChannel(lobbyChannelRef.current)
      lobbyChannelRef.current = null
    }
  }, [sessionId, scheduleIdle, setPresenceStatus, joinLobbyChannel, trackPresence])

  const sendFieldUpdate = useCallback(
    (field: keyof Patient, value: string) => {
      sendRef.current?.(field, value)
      fieldsSnapshotRef.current = { ...fieldsSnapshotRef.current, [field]: value }
      setPresenceStatus('filling')
      scheduleIdle()
      snapshotRef.current?.()
    },
    [setPresenceStatus, scheduleIdle]
  )

  const markSubmitted = useCallback(() => {
    submittedRef.current = true
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    snapshotRef.current?.cancel()
    sessionChannelRef.current?.send({
      type: 'broadcast',
      event: 'submitted',
      payload: {},
    })
    lobbyChannelRef.current?.untrack()
  }, [])

  return { sendFieldUpdate, markSubmitted }
}
