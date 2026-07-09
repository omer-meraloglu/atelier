import { Skeleton } from "@/components/ui/skeleton";

export default function LibraryLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-12 sm:px-8">
      <Skeleton className="h-3 w-28 rounded-none" />
      <Skeleton className="mt-4 h-10 w-48 rounded-none" />
      <Skeleton className="mt-12 h-24 w-full rounded-none" />
      <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-none" />
        ))}
      </div>
    </div>
  );
}
