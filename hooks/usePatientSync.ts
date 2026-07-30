'use client'

import { useCallback, useEffect, useRef } from 'react'
import throttle from 'lodash.throttle'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Patient } from '@/lib/schema'
import { PATIENT_LOBBY_CHANNEL, patientSessionChannelName } from '@/lib/realtime'

type ThrottledSend = ((field: keyof Patient, value: string) => void) & { cancel: () => void }

const IDLE_TIMEOUT_MS = 15_000

export function usePatientSync(sessionId: string) {
  const sendRef = useRef<ThrottledSend | null>(null)
  const sessionChannelRef = useRef<RealtimeChannel | null>(null)
  const lobbyChannelRef = useRef<RealtimeChannel | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submittedRef = useRef(false)
  const activeRef = useRef(true)
  const currentStatusRef = useRef<'filling' | 'inactive'>('filling')

  // Presence channels can silently drop after a period of inactivity. Phoenix
  // channel objects can only be joined once, so recovering means creating a
  // fresh channel for the same topic rather than resubscribing the old one.
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

  const setPresenceStatus = useCallback(
    (status: 'filling' | 'inactive') => {
      if (submittedRef.current) return
      // Presence is meant for slow-changing state — track() on every keystroke
      // floods the channel, so only send an update when the status actually flips.
      if (currentStatusRef.current === status) return
      currentStatusRef.current = status

      const channel = lobbyChannelRef.current
      if (channel?.state === 'joined') {
        channel.track({ status })
      } else {
        if (channel) supabase.removeChannel(channel)
        joinLobbyChannel(() => {
          lobbyChannelRef.current?.track({ status })
        })
      }
    },
    [joinLobbyChannel]
  )

  const scheduleIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setPresenceStatus('inactive'), IDLE_TIMEOUT_MS)
  }, [setPresenceStatus])

  useEffect(() => {
    activeRef.current = true
    submittedRef.current = false
    currentStatusRef.current = 'filling'

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

    joinLobbyChannel(() => {
      lobbyChannelRef.current?.track({ status: 'filling' })
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
      throttledSend.cancel()
      supabase.removeChannel(sessionChannel)
      sessionChannelRef.current = null
      if (lobbyChannelRef.current) supabase.removeChannel(lobbyChannelRef.current)
      lobbyChannelRef.current = null
    }
  }, [sessionId, scheduleIdle, setPresenceStatus, joinLobbyChannel])

  const sendFieldUpdate = useCallback(
    (field: keyof Patient, value: string) => {
      sendRef.current?.(field, value)
      setPresenceStatus('filling')
      scheduleIdle()
    },
    [setPresenceStatus, scheduleIdle]
  )

  const markSubmitted = useCallback(() => {
    submittedRef.current = true
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    sessionChannelRef.current?.send({
      type: 'broadcast',
      event: 'submitted',
      payload: {},
    })
    lobbyChannelRef.current?.untrack()
  }, [])

  return { sendFieldUpdate, markSubmitted }
}
