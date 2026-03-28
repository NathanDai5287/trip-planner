import { Skeleton } from "@/components/ui/skeleton";

export default function SharedTripLoading() {
  return (
    <div className="flex flex-col h-screen">
      {/* Top banner skeleton */}
      <div className="flex items-center justify-between bg-charcoal px-4 sm:px-6 py-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar skeleton */}
        <div className="hidden lg:flex w-[400px] flex-col border-r border-border bg-cream p-6 gap-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />

          <div className="flex flex-col gap-3 mt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex gap-3 items-center">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <div className="flex-1 flex flex-col gap-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
                {i < 3 && (
                  <div className="flex justify-center py-1">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-auto">
            <Skeleton className="h-5 w-40" />
          </div>
        </div>

        {/* Map skeleton */}
        <div className="flex-1 bg-stone-light">
          <Skeleton className="h-full w-full rounded-none" />
        </div>
      </div>
    </div>
  );
}
