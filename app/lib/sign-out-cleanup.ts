// Remove application data only. Firebase clears its own auth persistence.
// Keep the theme preference; all other trade-notes keys may contain journal context.
export function clearSensitiveStorage(storage: Storage) {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith("trade-notes-") && key !== "trade-notes-theme-v1")
      keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}
export async function finishSignOut() {
  // Wait for React's signed-out subtree to unmount before removing alert keys.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  try {
    clearSensitiveStorage(localStorage);
  } catch {
    /* Blocked browser storage. */
  }
  try {
    clearSensitiveStorage(sessionStorage);
  } catch {
    /* Blocked browser storage. */
  }
  // Old device-import screenshots are sensitive too. No persistent Firestore cache is used.
  try {
    if (typeof indexedDB !== "undefined")
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase("trade-notes-images-v1");
        request.onsuccess =
          request.onerror =
          request.onblocked =
            () => resolve();
      });
  } catch {
    /* Legacy image storage can be blocked; always drop memory below. */
  }
  // A document navigation drops React drafts, image URLs, alert queues and the
  // Firebase SDK's in-memory document cache. Auth persistence is already signed out.
  window.location.replace("/login");
}
