import { Skeleton } from "@/components/ui/skeleton";

export function MembersListSkeleton() {
  return (
    <div className="p-2 space-y-1">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="p-3 rounded-lg">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MemberDetailsSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header Card Skeleton */}
      <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      </div>

      {/* Info and Stats Grid Skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {/* Contact Block Skeleton */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <Skeleton className="h-3 w-16 mb-4" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>

        {/* Activities Block Skeleton */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <Skeleton className="h-3 w-20 mb-4" />
          <div className="flex flex-col items-center justify-center h-[calc(100%-32px)]">
            <Skeleton className="w-12 h-12 rounded-xl mb-3" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>

        {/* Performance Block Skeleton */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <Skeleton className="h-3 w-24 mb-4" />
          <div className="flex flex-col items-center justify-center h-[calc(100%-32px)]">
            <Skeleton className="w-12 h-12 rounded-xl mb-3" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>

      {/* Activity History Skeleton */}
      <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
        <Skeleton className="h-3 w-36 mb-4" />
        <div className="flex flex-col items-center justify-center py-10">
          <Skeleton className="w-14 h-14 rounded-2xl mb-4" />
          <Skeleton className="h-4 w-40 mb-2" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
    </div>
  );
}
