import { Skeleton } from '@/components/ui/skeleton'

/** Screen-reader text for a loading region (the shapes themselves are decorative). */
function LoadingLabel({ children = 'Loading' }: { children?: string }) {
  return <span className="sr-only">{children}…</span>
}

/** One parcel row: photo, two lines of text, status on the right. */
export function ParcelRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className="size-11 flex-none rounded-lg" />
      <div className="grid flex-1 gap-1.5">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <div className="grid justify-items-end gap-1.5">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  )
}

/** Home page while parcels load: greeting, overview card, parcel list card. */
export function HomeSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start" aria-busy="true">
      <LoadingLabel>Loading your parcels</LoadingLabel>
      <div className="grid gap-5">
        <Skeleton className="h-7 w-40" />
        <div className="rounded-lg bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
          <div className="flex justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="grid gap-1.5 border-l pl-3">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-5 w-6" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-lg bg-card px-4 pt-4 pb-1 ring-1 ring-foreground/10 sm:px-5 lg:mt-[3.25rem]">
        <div className="flex justify-between">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 4 }, (_, i) => (
            <ParcelRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Orders list while parcels load. */
export function OrdersSkeleton() {
  return (
    <section aria-busy="true">
      <LoadingLabel>Loading your orders</LoadingLabel>
      <Skeleton className="h-7 w-36" />
      <Skeleton className="mt-2 h-4 w-64 max-w-full" />
      <div className="mt-4 grid gap-2.5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-lg bg-card px-4 ring-1 ring-foreground/10">
            <ParcelRowSkeleton />
          </div>
        ))}
      </div>
    </section>
  )
}

/** Whole customer app before the config arrives: header, then the home skeleton. */
function CustomerAppSkeleton() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-10">
          <Skeleton className="size-7 rounded-lg" />
          <Skeleton className="hidden h-5 w-16 sm:block" />
          <div className="ml-6 hidden gap-2 sm:flex">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-20" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-10 lg:pt-8">
        <HomeSkeleton />
      </div>
    </div>
  )
}

/** Stage page before the config arrives: sidebar sections, then the inspector card. */
function StageSkeleton() {
  return (
    <div className="min-h-dvh lg:grid lg:h-dvh lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="grid content-start gap-6 border-b bg-card p-5 lg:border-r lg:border-b-0">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="h-6 w-24" />
        </div>
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="grid gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ))}
        {[4, 3, 2].map((rows, i) => (
          <div key={i} className="grid gap-2.5">
            <Skeleton className="h-3 w-32" />
            {Array.from({ length: rows }, (_, r) => (
              <div key={r} className="flex items-center gap-2.5 px-2.5">
                <Skeleton className="size-4 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="px-4 py-6 sm:px-8">
        <div className="mx-auto grid max-w-5xl gap-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-9 w-44" />
          </div>
          <div className="rounded-lg bg-card ring-1 ring-foreground/10">
            <div className="flex items-center justify-between border-b px-6 py-5">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-6 w-28" />
            </div>
            <div className="grid gap-6 p-6">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="grid grid-cols-[2.5rem_1fr] gap-6">
                  <Skeleton className="mt-3 size-10 rounded-full" />
                  <Skeleton className="h-32 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Shown while the app fetches its config, shaped like the page being opened. */
export function AppSkeleton({ stage }: { stage: boolean }) {
  return (
    <div aria-busy="true">
      <LoadingLabel>Loading Shippy</LoadingLabel>
      {stage ? <StageSkeleton /> : <CustomerAppSkeleton />}
    </div>
  )
}
