'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Controller, useForm, type Control, type FieldError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { patientSchema, type Patient } from '@/lib/schema'
import {
  fieldsInSection,
  patientFields,
  sections,
  type PatientFieldMeta,
} from '@/lib/patientFields'
import { usePatientSync } from '@/hooks/usePatientSync'
import { insertPatientSubmission } from '@/lib/patientSubmissions'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type FieldKey = keyof Patient

function FieldRow({
  fieldKey,
  meta,
  error,
  control,
  register,
}: {
  fieldKey: FieldKey
  meta: PatientFieldMeta
  error?: FieldError
  control: Control<Patient>
  register: ReturnType<typeof useForm<Patient>>['register']
}) {
  const id = `field-${fieldKey}`
  const errorId = `${id}-error`
  const invalid = Boolean(error)

  let input: React.ReactNode
  if (meta.type === 'select') {
    // shadcn's Select is a Radix listbox, not a native <select>, so it can't be
    // wired up with register(). Controller keeps it inside react-hook-form —
    // which also means the `watch` subscription below still fires for it.
    input = (
      <Controller
        name={fieldKey}
        control={control}
        render={({ field }) => (
          <Select value={field.value ?? ''} onValueChange={field.onChange}>
            <SelectTrigger
              id={id}
              className="h-10 w-full"
              aria-invalid={invalid}
              aria-describedby={invalid ? errorId : undefined}
              onBlur={field.onBlur}
            >
              <SelectValue placeholder={meta.placeholder ?? 'Select…'} />
            </SelectTrigger>
            <SelectContent>
              {meta.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    )
  } else if (meta.type === 'textarea') {
    input = (
      <Textarea
        id={id}
        rows={3}
        placeholder={meta.placeholder}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        {...register(fieldKey)}
      />
    )
  } else {
    input = (
      <Input
        id={id}
        type={meta.type}
        placeholder={meta.placeholder}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        className="h-10"
        {...register(fieldKey)}
      />
    )
  }

  return (
    <div className={cn('flex flex-col gap-2', meta.fullWidth && 'md:col-span-2')}>
      <Label htmlFor={id} className="text-muted-foreground">
        {meta.label}
        {meta.optional && (
          <span className="font-normal text-muted-foreground/70">optional</span>
        )}
      </Label>
      {input}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error.message}
        </p>
      )}
    </div>
  )
}

export default function PatientForm({ sessionId }: { readonly sessionId: string }) {
  const [submitted, setSubmitted] = useState(false)
  const { sendFieldUpdate, markSubmitted } = usePatientSync(sessionId)

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Patient>({
    resolver: zodResolver(patientSchema),
  })

  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (!name) return
      sendFieldUpdate(name, (value[name] as string) ?? '')
    })
    return () => subscription.unsubscribe()
  }, [watch, sendFieldUpdate])

  const onSubmit = async (data: Patient) => {
    try {
      await insertPatientSubmission(sessionId, data)
      markSubmitted()
      setSubmitted(true)
    } catch {
      toast.error('Could not submit the form', {
        description: 'Something went wrong on our side. Please try again.',
      })
    }
  }

  if (submitted) {
    return (
      <Card className="py-10">
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-status-submitted-bg text-status-submitted-fg">
            <CheckCircle2 className="size-6" />
          </span>
          <div>
            <p className="text-lg font-medium text-foreground">
              Your information has been submitted
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              A staff member has already received it. You can close this page.
            </p>
          </div>
          <Button asChild variant="outline" className="mt-2 h-10 px-4">
            <Link href="/patient">Start another registration</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {sections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
            {fieldsInSection(section.id).map((key) => (
              <FieldRow
                key={key}
                fieldKey={key}
                meta={patientFields[key]}
                error={errors[key]}
                control={control}
                register={register}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Fields marked optional can be left blank.
        </p>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full px-6 text-sm sm:w-auto"
        >
          {isSubmitting ? <Loader2 className="animate-spin" /> : <Send />}
          {isSubmitting ? 'Submitting…' : 'Submit registration'}
        </Button>
      </div>
    </form>
  )
}
