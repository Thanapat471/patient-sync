'use client'

import { useEffect, useRef, useState } from 'react'
import { useStaffStore } from '@/store/useStaffStore'
import type { Patient } from '@/lib/schema'
import { fieldsInSection, patientFields, sections } from '@/lib/patientFields'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function MirrorField({
  sessionId,
  fieldKey,
  label,
  fullWidth,
}: {
  sessionId: string
  fieldKey: keyof Patient
  label: string
  fullWidth?: boolean
}) {
  // One selector per field, so a single keystroke re-renders one value box
  // instead of the whole dashboard.
  const value = useStaffStore((state) => state.sessions[sessionId]?.fields[fieldKey])

  // Remounting the value box on change restarts the flash animation; without
  // the key it would only ever play once.
  const [flashKey, setFlashKey] = useState(0)
  const previous = useRef(value)
  useEffect(() => {
    if (previous.current !== value) {
      previous.current = value
      setFlashKey((n) => n + 1)
    }
  }, [value])

  return (
    <div className={fullWidth ? 'md:col-span-2' : undefined}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div
        key={flashKey}
        className="mt-1.5 min-h-10 rounded-lg border border-border bg-muted px-3 py-2 text-sm wrap-break-word animate-field-flash"
      >
        {value || <span className="text-muted-foreground/60">—</span>}
      </div>
    </div>
  )
}

export default function LiveMirrorForm({ sessionId }: { sessionId: string }) {
  return (
    // Same four sections in the same order as the patient's own form, so staff
    // are looking at the layout the patient is looking at.
    <div className="flex flex-col gap-5">
      {sections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
            {fieldsInSection(section.id).map((key) => (
              <MirrorField
                key={key}
                sessionId={sessionId}
                fieldKey={key}
                label={patientFields[key].label}
                fullWidth={patientFields[key].fullWidth}
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
