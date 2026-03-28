import { Header } from "@/components/header";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Page header skeleton */}
        <div className="flex items-center justify-between gap-4 mb-10">
          <div>
            <Skeleton className="h-9 w-48" />
            <Skeleton className="mt-2 h-4 w-28" />
          </div>
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>

        {/* Card grid skeleton */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border border-l-4 border-l-stone bg-cream p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="mt-3 h-4 w-full" />
              <div className="mt-5 flex items-center gap-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
