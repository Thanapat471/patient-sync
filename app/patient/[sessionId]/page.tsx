import PatientForm from '@/components/patient/PatientForm'

export default async function PatientSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10 dark:bg-black sm:px-6">
      <div className="w-full max-w-3xl">
        <h1 className="mb-6 text-2xl font-semibold text-foreground">
          Patient Registration
        </h1>
        <PatientForm sessionId={sessionId} />
      </div>
    </div>
  )
}
