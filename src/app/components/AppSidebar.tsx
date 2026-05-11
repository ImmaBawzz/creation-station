import Link from "next/link";
import { canAccessFeature, getFeatureGateContext, type FeatureId } from "@/lib/feature-gating";

type NavItem = {
  featureId: FeatureId;
  href: string;
  key: AppSidebarProps["active"];
  label: string;
};

type AppSidebarProps = {
  active: "content" | "dashboard" | "execution" | "factory" | "inbox" | "release" | "settings";
  title: string;
  subtitle: string;
  showBackup?: boolean;
};

const navItems = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", featureId: "dashboard" },
  { key: "inbox", href: "/", label: "Inbox", featureId: "idea_inbox" },
  { key: "content", href: "/content", label: "Content Pipeline", featureId: "content_pipeline_manual" },
  { key: "factory", href: "/factory", label: "Factory Planner", featureId: "factory_planner" },
  { key: "execution", href: "/execution", label: "Execution Layer", featureId: "music_video_builder" },
  { key: "settings", href: "/settings", label: "Settings", featureId: "settings_provider_health" },
  { key: "release", href: "/release", label: "Release Checklist", featureId: "release_controls" },
] as const satisfies readonly NavItem[];

export function AppSidebar({
  active,
  title,
  subtitle,
  showBackup = false,
}: AppSidebarProps) {
  const gateContext = getFeatureGateContext();
  const visibleNavItems = navItems.filter((item) =>
    canAccessFeature(item.featureId, gateContext),
  );

  return (
    <aside className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-2xl">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>

      <nav className="mt-8 space-y-2 text-sm">
        {visibleNavItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={
              item.key === active
                ? "block rounded-2xl bg-zinc-800 px-4 py-3"
                : "block rounded-2xl px-4 py-3 text-zinc-400 transition hover:bg-zinc-800/70 hover:text-zinc-100"
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {showBackup && (
        <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          <p className="font-semibold">Local Backup</p>
          <p className="mt-2 text-emerald-100/80">
            Download ideas, projects, tasks, dependencies, and backup metadata as one JSON file.
          </p>
          <a
            href="/api/export"
            className="mt-4 block rounded-xl bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Export Backup
          </a>
        </div>
      )}
    </aside>
  );
}
