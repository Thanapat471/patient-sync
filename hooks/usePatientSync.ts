'use client'

import { useCallback, useEffect, useRef } from 'react'
import throttle from 'lodash.throttle'
import { supabase } from '@/lib/supabase'
import type { Patient } from '@/lib/schema'
import { PATIENT_LOBBY_CHANNEL, patientSessionChannelName } from '@/lib/realtime'

type ThrottledSend = ((field: keyof Patient, value: string) => void) & { cancel: () => void }

export function usePatientSync(sessionId: string) {
  const sendRef = useRef<ThrottledSend | null>(null)

  useEffect(() => {
    const sessionChannel = supabase.channel(patientSessionChannelName(sessionId))
    sessionChannel.subscribe()

    const throttledSend: ThrottledSend = throttle((field: keyof Patient, value: string) => {
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

    return () => {
      sendRef.current = null
      throttledSend.cancel()
      supabase.removeChannel(sessionChannel)
      supabase.removeChannel(lobbyChannel)
    }
  }, [sessionId])

  return useCallback((field: keyof Patient, value: string) => {
    sendRef.current?.(field, value)
  }, [])
}
