import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { db } from "@/lib/db";
import { MediaLibrary } from "./MediaLibrary";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  await requireStudio("media.write", "/admin/media");
  const [folders, count] = await Promise.all([
    db.media.findMany({ distinct: ["folder"], select: { folder: true }, orderBy: { folder: "asc" } }),
    db.media.count(),
  ]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        title="Media library"
        description={`${count} file${count === 1 ? "" : "s"}. Images are converted to WebP and capped at 2600px on the long edge.`}
      />
      <MediaLibrary initialFolders={folders.map((f) => f.folder)} />
    </div>
  );
}
