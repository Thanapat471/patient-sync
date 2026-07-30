'use client'

import { useState } from 'react'
import { useForm, type FieldError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { patientSchema, type Patient } from '@/lib/schema'

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string
  error?: FieldError
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error.message}</p>
      )}
    </div>
  )
}

const inputClass =
  'mt-1 block w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40'

export default function PatientForm() {
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Patient>({
    resolver: zodResolver(patientSchema),
  })

  const onSubmit = (data: Patient) => {
    console.log('patient form submitted', data)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="rounded-md border border-black/15 bg-white p-6 text-center dark:border-white/20 dark:bg-black">
        <p className="text-lg font-medium">Thank you — your information has been submitted.</p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2"
    >
      <Field label="First name" error={errors.firstName}>
        <input className={inputClass} {...register('firstName')} />
      </Field>

      <Field label="Middle name (optional)" error={errors.middleName}>
        <input className={inputClass} {...register('middleName')} />
      </Field>

      <Field label="Last name" error={errors.lastName}>
        <input className={inputClass} {...register('lastName')} />
      </Field>

      <Field label="Date of birth" error={errors.dateOfBirth}>
        <input type="date" className={inputClass} {...register('dateOfBirth')} />
      </Field>

      <Field label="Gender" error={errors.gender}>
        <select className={inputClass} defaultValue="" {...register('gender')}>
          <option value="" disabled>
            Select gender
          </option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </Field>

      <Field label="Phone" error={errors.phone}>
        <input type="tel" className={inputClass} {...register('phone')} />
      </Field>

      <Field label="Email" error={errors.email}>
        <input type="email" className={inputClass} {...register('email')} />
      </Field>

      <Field label="Address" error={errors.address} className="md:col-span-2">
        <textarea rows={2} className={inputClass} {...register('address')} />
      </Field>

      <Field label="Preferred language" error={errors.preferredLanguage}>
        <input className={inputClass} {...register('preferredLanguage')} />
      </Field>

      <Field label="Nationality" error={errors.nationality}>
        <input className={inputClass} {...register('nationality')} />
      </Field>

      <Field label="Religion (optional)" error={errors.religion}>
        <input className={inputClass} {...register('religion')} />
      </Field>

      <Field
        label="Emergency contact name (optional)"
        error={errors.emergencyContactName}
      >
        <input className={inputClass} {...register('emergencyContactName')} />
      </Field>

      <Field
        label="Emergency contact relationship (optional)"
        error={errors.emergencyContactRelationship}
      >
        <input className={inputClass} {...register('emergencyContactRelationship')} />
      </Field>

      <button
        type="submit"
        className="mt-2 h-12 rounded-full bg-foreground px-6 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:col-span-2 md:w-[200px]"
      >
        Submit
      </button>
    </form>
  )
}
