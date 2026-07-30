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

  const setPresenceStatus = useCallback((status: 'filling' | 'inactive') => {
    if (submittedRef.current) return
    lobbyChannelRef.current?.track({ status })
  }, [])

  const scheduleIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setPresenceStatus('inactive'), IDLE_TIMEOUT_MS)
  }, [setPresenceStatus])

  useEffect(() => {
    submittedRef.current = false

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

    const lobbyChannel = supabase.channel(PATIENT_LOBBY_CHANNEL, {
      config: { presence: { key: sessionId } },
    })
    lobbyChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        lobbyChannel.track({ status: 'filling' })
      }
    })
    lobbyChannelRef.current = lobbyChannel

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
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      sendRef.current = null
      sessionChannelRef.current = null
      lobbyChannelRef.current = null
      throttledSend.cancel()
      supabase.removeChannel(sessionChannel)
      supabase.removeChannel(lobbyChannel)
    }
  }, [sessionId, scheduleIdle, setPresenceStatus])

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
