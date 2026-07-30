export const PATIENT_LOBBY_CHANNEL = 'patient-lobby'

export function patientSessionChannelName(sessionId: string) {
  return `patient-session-${sessionId}`
}
