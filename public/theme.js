// Constant theme bootstrap; no user text is inserted into executable markup.
try {
  const theme = globalThis.localStorage.getItem("trade-notes-theme-v1");
  globalThis.document.documentElement.dataset.theme =
    theme === "dark" || theme === "light"
      ? theme
      : globalThis.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
} catch {
  globalThis.document.documentElement.dataset.theme = globalThis.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches
    ? "dark"
    : "light";
}
