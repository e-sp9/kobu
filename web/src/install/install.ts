/**
 * Glue between a GitHub release asset and the File System Access API.
 *
 * `fetchUf2()` pulls the `.uf2` blob over HTTPS into a `Uint8Array` so
 * we can hand it to the filesystem writer. The browser caches the
 * download via the standard HTTP cache; no extra state needed.
 *
 * The actual install is driven by the `InstallButton` component — this
 * module deliberately stays a thin function library so unit tests can
 * exercise each step in isolation.
 */

import { InstallError, verifyXiaoBootDirectory, writeUf2 } from './filesystem';

/**
 * Fetch a UF2 release asset and return its bytes. Rejects with
 * `InstallError('write-failed', ...)` when the HTTP response is not
 * 2xx — using the same error kind keeps the UI layer's switch
 * statement small.
 */
export async function fetchUf2(downloadUrl: string): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetch(downloadUrl);
  } catch (err) {
    throw new InstallError(
      'write-failed',
      `uf2 のダウンロードに失敗しました: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new InstallError(
      'write-failed',
      `uf2 のダウンロードに失敗しました: HTTP ${res.status} ${res.statusText}`,
    );
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Write `bytes` into `dir` as `filename`, optionally probing for
 * `INFO_UF2.TXT` first. When the probe fails (returns null) the
 * caller is expected to have already shown a "this doesn't look like
 * XIAO-BOOT — continue?" prompt.
 */
export async function flashUf2IntoDirectory(
  dir: FileSystemDirectoryHandle,
  filename: string,
  bytes: Uint8Array,
): Promise<void> {
  await writeUf2(dir, filename, bytes);
}

export { verifyXiaoBootDirectory };
