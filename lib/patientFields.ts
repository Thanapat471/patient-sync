import type { Patient } from '@/lib/schema'

/**
 * Presentation metadata for the patient form.
 *
 * `lib/schema.ts` still owns the patient *shape*; this file only describes how
 * each of those fields is labelled and rendered. Both the patient form and the
 * staff mirror read from here, so adding a field means touching the schema and
 * this file — and nothing else.
 *
 * Typing it as `Record<keyof Patient, ...>` means a field added to the schema
 * but forgotten here fails `tsc`, rather than silently disappearing from the UI.
 */

export type PatientFieldSection =
  | 'personal'
  | 'contact'
  | 'background'
  | 'emergency'

export type PatientFieldMeta = {
  label: string
  type: 'text' | 'email' | 'tel' | 'date' | 'select' | 'textarea'
  section: PatientFieldSection
  placeholder?: string
  options?: readonly { value: string; label: string }[]
  optional?: boolean
  /** Span both columns on `md:` and up — for values that need the room. */
  fullWidth?: boolean
}

export const sections: readonly {
  id: PatientFieldSection
  title: string
  description: string
}[] = [
  {
    id: 'personal',
    title: 'Personal details',
    description: 'The patient’s name and identity information.',
  },
  {
    id: 'contact',
    title: 'Contact information',
    description: 'How the clinic can reach the patient.',
  },
  {
    id: 'background',
    title: 'Background',
    description: 'Helps us prepare the right support during the visit.',
  },
  {
    id: 'emergency',
    title: 'Emergency contact',
    description: 'Optional, but recommended.',
  },
]

export const patientFields: Record<keyof Patient, PatientFieldMeta> = {
  firstName: {
    label: 'First name',
    type: 'text',
    section: 'personal',
    placeholder: 'Somchai',
  },
  middleName: {
    label: 'Middle name',
    type: 'text',
    section: 'personal',
    optional: true,
  },
  lastName: {
    label: 'Last name',
    type: 'text',
    section: 'personal',
    placeholder: 'Jaidee',
  },
  dateOfBirth: {
    label: 'Date of birth',
    type: 'date',
    section: 'personal',
  },
  gender: {
    label: 'Gender',
    type: 'select',
    section: 'personal',
    placeholder: 'Select gender',
    options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'other', label: 'Other' },
    ],
  },
  phone: {
    label: 'Phone',
    type: 'tel',
    section: 'contact',
    placeholder: '081 234 5678',
  },
  email: {
    label: 'Email',
    type: 'email',
    section: 'contact',
    placeholder: 'somchai@example.com',
  },
  address: {
    label: 'Address',
    type: 'textarea',
    section: 'contact',
    placeholder: 'Street, district, city, postal code',
    fullWidth: true,
  },
  preferredLanguage: {
    label: 'Preferred language',
    type: 'text',
    section: 'background',
    placeholder: 'Thai',
  },
  nationality: {
    label: 'Nationality',
    type: 'text',
    section: 'background',
    placeholder: 'Thai',
  },
  religion: {
    label: 'Religion',
    type: 'text',
    section: 'background',
    optional: true,
  },
  emergencyContactName: {
    label: 'Contact name',
    type: 'text',
    section: 'emergency',
    optional: true,
  },
  emergencyContactRelationship: {
    label: 'Relationship',
    type: 'text',
    section: 'emergency',
    placeholder: 'Spouse, parent, friend…',
    optional: true,
  },
}

/** Field keys in declaration order — `Object.keys` loses the `keyof Patient` type. */
export const patientFieldKeys = Object.keys(patientFields) as (keyof Patient)[]

export function fieldsInSection(section: PatientFieldSection) {
  return patientFieldKeys.filter((key) => patientFields[key].section === section)
}
