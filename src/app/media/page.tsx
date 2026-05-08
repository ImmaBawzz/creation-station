import Link from "next/link";

import { listVisualProjectManifests } from "@/modules/visual-engine/manifest";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const projects = await listVisualProjectManifests();

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Media Projects</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Minimal Visual Engine scaffold for local project manifests.
          </p>
        </div>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          {projects.length === 0 ? (
            <p className="text-sm text-zinc-400">No Visual Engine projects found.</p>
          ) : (
            <ul className="space-y-3">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-zinc-100">{project.name}</p>
                    <p className="text-sm text-zinc-400">
                      {project.kind} · {project.status}
                    </p>
                  </div>
                  <Link
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                    href={`/media/${project.id}`}
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
