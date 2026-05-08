import Link from "next/link";
import { notFound } from "next/navigation";

import { readVisualProjectManifest, relativeProjectPath } from "@/modules/visual-engine/manifest";
import { getVisualProjectAssetFolders } from "@/modules/visual-engine/paths";
import { validateVisualProjectById } from "@/modules/visual-engine/validate";
import { RenderProjectButton } from "./RenderProjectButton";

type MediaProjectPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function MediaProjectPage({ params }: MediaProjectPageProps) {
  const { id } = await params;
  const project = await readVisualProjectManifest(id);

  if (!project) {
    notFound();
  }

  const folders = getVisualProjectAssetFolders(id);
  const validation = await validateVisualProjectById(id);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-400">Visual Engine Project</p>
            <h1 className="text-3xl font-semibold">{project.name}</h1>
          </div>
          <Link
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            href="/media"
          >
            Back to Media
          </Link>
        </div>

        <section className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Kind</p>
            <p className="mt-1 text-sm text-zinc-200">{project.kind}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Status</p>
            <p className="mt-1 text-sm text-zinc-200">{project.status}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Validation</p>
            <p className="mt-1 text-sm text-zinc-200">
              {validation?.valid ? "Valid" : `${validation?.errors.length ?? 0} errors`}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Validation</h2>
            <div className="flex items-center gap-3">
              <Link
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                href={`/api/visual-engine/projects/${project.id}/validate`}
              >
                View Validation JSON
              </Link>
              <RenderProjectButton projectId={project.id} />
            </div>
          </div>

          <div className="mt-4">
            {validation && validation.errors.length > 0 ? (
              <ul className="space-y-2 text-sm text-amber-200">
                {validation.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-emerald-200">No validation errors.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-xl font-semibold">Asset Folders</h2>
          <ul className="mt-4 space-y-2 text-sm text-zinc-300">
            {Object.entries(folders).map(([label, folderPath]) => (
              <li key={label} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                <span className="font-medium capitalize text-zinc-100">{label}</span>
                <span className="ml-3 text-zinc-400">{relativeProjectPath(folderPath)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
