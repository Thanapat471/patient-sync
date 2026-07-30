import { supabase } from './supabase'
import type { Patient } from './schema'

type PatientSubmissionRow = {
  session_id: string
  first_name: string
  middle_name: string | null
  last_name: string
  date_of_birth: string
  gender: string
  phone: string
  email: string
  address: string
  preferred_language: string
  nationality: string
  emergency_contact_name: string | null
  emergency_contact_relationship: string | null
  religion: string | null
}

export type PatientSubmission = {
  sessionId: string
  fields: Partial<Patient>
}

export async function insertPatientSubmission(sessionId: string, patient: Patient) {
  const { error } = await supabase.from('patient_submissions').insert({
    session_id: sessionId,
    first_name: patient.firstName,
    middle_name: patient.middleName ?? null,
    last_name: patient.lastName,
    date_of_birth: patient.dateOfBirth,
    gender: patient.gender,
    phone: patient.phone,
    email: patient.email,
    address: patient.address,
    preferred_language: patient.preferredLanguage,
    nationality: patient.nationality,
    emergency_contact_name: patient.emergencyContactName ?? null,
    emergency_contact_relationship: patient.emergencyContactRelationship ?? null,
    religion: patient.religion ?? null,
  })

  if (error) throw error
}

export async function fetchPatientSubmissions(): Promise<PatientSubmission[]> {
  const { data, error } = await supabase.from('patient_submissions').select('*')
  if (error) throw error

  return (data as PatientSubmissionRow[]).map((row) => ({
    sessionId: row.session_id,
    fields: {
      firstName: row.first_name,
      middleName: row.middle_name ?? undefined,
      lastName: row.last_name,
      dateOfBirth: row.date_of_birth,
      gender: row.gender as Patient['gender'],
      phone: row.phone,
      email: row.email,
      address: row.address,
      preferredLanguage: row.preferred_language,
      nationality: row.nationality,
      emergencyContactName: row.emergency_contact_name ?? undefined,
      emergencyContactRelationship: row.emergency_contact_relationship ?? undefined,
      religion: row.religion ?? undefined,
    },
  }))
}
