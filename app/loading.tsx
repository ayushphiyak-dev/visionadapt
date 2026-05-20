export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="animate-pulse space-y-6">
          <div className="h-10 w-64 rounded-lg bg-slate-200" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="h-40 rounded-xl bg-slate-200" />
            <div className="h-40 rounded-xl bg-slate-200" />
            <div className="h-40 rounded-xl bg-slate-200" />
          </div>
          <div className="h-28 rounded-xl bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
