export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-[1400px] animate-fade">
      <div className="mb-6 h-8 w-64 skeleton" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-28 skeleton" />
        ))}
      </div>
      <div className="mt-5 h-64 card skeleton" />
    </div>
  );
}
