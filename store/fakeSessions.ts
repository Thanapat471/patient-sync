import type { StaffSession } from './useStaffStore'

export const fakeSessions: Record<string, StaffSession> = {
  'session-1': {
    status: 'filling',
    lastSeen: Date.now(),
    fields: {
      firstName: 'Somchai',
      lastName: 'Jaidee',
      phone: '0891234567',
      email: 'somchai@example.com',
    },
  },
  'session-2': {
    status: 'inactive',
    lastSeen: Date.now() - 30_000,
    fields: {
      firstName: 'Malee',
      lastName: 'Suksawat',
    },
  },
  'session-3': {
    status: 'submitted',
    lastSeen: Date.now() - 120_000,
    fields: {
      firstName: 'Anan',
      lastName: 'Wongsakul',
      phone: '0812223334',
      email: 'anan@example.com',
      nationality: 'Thai',
      preferredLanguage: 'Thai',
    },
  },
}
