import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-24 text-center">
      <span aria-hidden className="display text-5xl text-line">O/</span>
      <h1 className="display mt-6 text-2xl">That record does not exist</h1>
      <p className="mt-3 text-sm text-muted">It may have been deleted, or the link is out of date.</p>
      <Link href="/admin" className="btn mt-8 px-4 py-2.5 text-[0.65rem]">
        Back to the dashboard
      </Link>
    </div>
  );
}
