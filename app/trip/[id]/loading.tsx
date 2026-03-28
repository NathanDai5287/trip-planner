import { Header } from "@/components/header";
import { Skeleton } from "@/components/ui/skeleton";

export default function TripLoading() {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar skeleton */}
        <div className="hidden lg:flex w-[400px] flex-col border-r border-border bg-cream p-6 gap-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-10 w-full" />
          <div className="flex flex-col gap-3 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 items-center">
                <Skeleton className="h-6 w-6 rounded" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-auto flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
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
