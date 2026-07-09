import { Skeleton } from "@/components/ui/skeleton";

export default function StudioLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-12 sm:px-8">
      <Skeleton className="h-3 w-28 rounded-none" />
      <Skeleton className="mt-4 h-10 w-40 rounded-none" />
      <div className="mt-12 grid gap-10 lg:grid-cols-12">
        <div className="grid grid-cols-2 gap-5 lg:col-span-5">
          <Skeleton className="aspect-[3/4] rounded-none" />
          <Skeleton className="aspect-[3/4] rounded-none" />
        </div>
        <Skeleton className="min-h-[420px] rounded-none lg:col-span-7" />
      </div>
    </div>
  );
}
