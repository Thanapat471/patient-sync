import { z } from 'zod'

export const patientSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((value) => {
      const parsed = Date.parse(value)
      return !Number.isNaN(parsed) && parsed <= Date.now()
    }, 'Date of birth cannot be in the future'),
  gender: z.enum(['male', 'female', 'other'], {
    message: 'Please select a gender',
  }),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^[0-9+\-\s()]{7,20}$/, 'Enter a valid phone number'),
  email: z.email('Enter a valid email address'),
  address: z.string().min(1, 'Address is required'),
  preferredLanguage: z.string().min(1, 'Preferred language is required'),
  nationality: z.string().min(1, 'Nationality is required'),
  emergencyContactName: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  religion: z.string().optional(),
})

export type Patient = z.infer<typeof patientSchema>
