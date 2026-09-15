import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { PageEditor } from "../PageEditor";

export const dynamic = "force-dynamic";

export default async function NewPagePage() {
  await requireStudio("content.write", "/admin/pages/new");
  const csrf = await csrfToken();

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageHeader title="New page" description="Policy and story pages. Keep shipping and returns accurate — the concierge quotes them to customers." />
      <PageEditor
        csrf={csrf}
        data={{
          id: null,
          slug: "",
          titleEn: "",
          titleBn: "",
          bodyEn: "",
          bodyBn: "",
          template: "editorial",
          isPublished: false,
          showInFooter: true,
          seoTitleEn: "",
          seoTitleBn: "",
          seoDescriptionEn: "",
          seoDescriptionBn: "",
        }}
      />
    </div>
  );
}
