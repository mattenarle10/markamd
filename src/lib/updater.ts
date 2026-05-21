import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateCheckResult =
  | { status: "available"; version: string; notes?: string; date?: string }
  | { status: "none" }
  | { status: "error"; message: string };

/** Checks GitHub Releases via Tauri updater; idempotent. */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  try {
    const update = await check();
    if (!update) return { status: "none" };
    return {
      status: "available",
      version: update.version,
      notes: update.body ?? undefined,
      date: update.date ?? undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Tauri reports "could not fetch a valid release JSON" when no
    // signed latest.json exists yet at the endpoint — treat that as
    // "no update available" rather than an error.
    if (/release json|release not found|no release|404/i.test(msg)) {
      return { status: "none" };
    }
    return { status: "error", message: msg };
  }
}

/** Throws on signature mismatch; relaunches on success. */
export async function applyUpdate(
  onProgress?: (downloaded: number, total: number) => void,
): Promise<void> {
  const update: Update | null = await check();
  if (!update) {
    throw new Error("no update available");
  }
  let downloaded = 0;
  let total = 0;
  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      downloaded = 0;
      total = event.data.contentLength ?? 0;
      onProgress?.(0, total);
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress?.(downloaded, total);
    }
  });
  await relaunch();
}
