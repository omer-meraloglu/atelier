"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  listActiveVideoJobs,
  pollActiveVideoJobs,
  type VideoStatus,
} from "@/app/studio/video-actions";

const POLL_INTERVAL_MS = 6_000;

/** Cross-component signals (panel ↔ watcher) without context plumbing. */
export const VIDEO_JOB_STARTED_EVENT = "atelier:video-job-started";
export const VIDEO_JOBS_UPDATED_EVENT = "atelier:video-jobs-updated";

export function notifyVideoJobStarted() {
  window.dispatchEvent(new CustomEvent(VIDEO_JOB_STARTED_EVENT));
}

/**
 * The single poller for in-flight clips. Lives in the site nav, so it stays
 * mounted across Studio/Library/History — a clip finishes whether or not the
 * Animate panel (or even the Studio page) is still open. Server-side, the
 * fal webhook finalizes jobs with no client at all; this watcher is the
 * local-dev/mock fallback and the UI-refresh path.
 */
export function VideoJobsWatcher() {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const knownStatuses = useRef(new Map<string, VideoStatus["status"]>());
  const polling = useRef(false);

  // Discover in-flight jobs on mount and whenever a new one starts.
  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const jobs = await listActiveVideoJobs();
        if (cancelled) return;
        for (const job of jobs) {
          knownStatuses.current.set(job.id, job.status);
        }
        setActive(jobs.length > 0);
      } catch {
        // signed out or transient failure — stay idle
      }
    }

    void refresh();
    const onStarted = () => void refresh();
    window.addEventListener(VIDEO_JOB_STARTED_EVENT, onStarted);
    return () => {
      cancelled = true;
      window.removeEventListener(VIDEO_JOB_STARTED_EVENT, onStarted);
    };
  }, []);

  // Poll while anything is in flight.
  useEffect(() => {
    if (!active) return;

    const timer = setInterval(async () => {
      if (polling.current) return; // don't overlap slow ticks
      polling.current = true;
      try {
        const jobs = await pollActiveVideoJobs();

        // pollActiveVideoJobs returns rows that WERE active; anything now
        // terminal just transitioned.
        let transitioned = false;
        for (const job of jobs) {
          const prev = knownStatuses.current.get(job.id);
          if (job.status !== prev) {
            transitioned = true;
            knownStatuses.current.set(job.id, job.status);
            if (job.status === "succeeded") {
              toast.success("Your clip is ready — find it in History.");
            } else if (job.status === "failed") {
              toast.error(job.error ?? "A clip failed to render.");
            }
          }
        }

        window.dispatchEvent(
          new CustomEvent(VIDEO_JOBS_UPDATED_EVENT, { detail: jobs })
        );

        const stillActive = jobs.some(
          (j) => j.status === "queued" || j.status === "processing"
        );
        if (!stillActive) {
          setActive(false);
        }
        if (transitioned) {
          router.refresh();
        }
      } catch {
        // transient failure — keep polling; the 15-minute server guard
        // prevents anything from spinning forever
      } finally {
        polling.current = false;
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [active, router]);

  return null;
}
