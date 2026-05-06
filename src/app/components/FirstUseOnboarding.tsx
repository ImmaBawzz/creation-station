"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const onboardingStorageKey = "creation-station-onboarding-complete";

const onboardingSteps = [
  {
    title: "Capture ideas",
    body: "Use the Idea Inbox for raw concepts before they are ready to become plans.",
  },
  {
    title: "Convert to projects",
    body: "Send a strong idea to the Factory Planner, then review or revise the generated plan.",
  },
  {
    title: "Execute with tasks",
    body: "Approve a plan to create tasks, then use Active, Blocked, Backlog, Completed, and Archived sections to keep work clear.",
  },
];

export function FirstUseOnboarding() {
  const [isReady, setIsReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const isComplete = window.localStorage.getItem(onboardingStorageKey) === "1";

      setIsOpen(!isComplete);
      setIsReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function recordOnboardingEvent(eventType: "onboarding_completed" | "onboarding_skipped") {
    void fetch("/api/analytics", {
      body: JSON.stringify({ eventType }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  }

  function completeOnboarding(eventType: "onboarding_completed" | "onboarding_skipped") {
    window.localStorage.setItem(onboardingStorageKey, "1");
    recordOnboardingEvent(eventType);
    setIsOpen(false);
  }

  if (!isReady || !isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/85 p-4 backdrop-blur-sm">
      <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-blue-500/30 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-blue-200">
              Welcome to Creation Station
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-100">
              Turn raw ideas into execution tasks
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Creation Station is a local-first workspace for a solo creator. Start
              with one idea, let the Factory Planner shape it, review the result,
              then approve it into a task board you can work from.
            </p>
          </div>
          <button
            onClick={() => completeOnboarding("onboarding_skipped")}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
          >
            Skip
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {onboardingSteps.map((step, index) => (
            <div key={step.title} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs font-semibold text-blue-200">Step {index + 1}</p>
              <h3 className="mt-2 font-semibold text-zinc-100">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h3 className="font-semibold text-zinc-100">Quick start</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Capture your first idea, then convert it in the Factory when the raw
            notes are good enough to plan.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              href="#new-idea"
              onClick={() => completeOnboarding("onboarding_completed")}
              className="rounded-xl bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-500"
            >
              Start with first idea
            </Link>
            <Link
              href="/settings"
              onClick={() => completeOnboarding("onboarding_completed")}
              className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-center text-sm font-semibold text-blue-100 hover:bg-blue-500/20"
            >
              Check AI setup
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
