import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
type Theme = "system" | "light" | "dark";
const choices: Theme[] = ["system", "light", "dark"];
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system"),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("trade-notes-theme-v1");
      if (choices.includes(saved as Theme)) setTheme(saved as Theme);
    } catch {
      /* System preference remains available. */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme, loaded]);
  const Icon = theme === "system" ? Monitor : theme === "dark" ? Moon : Sun;
  return (
    <>
      <button
        type="button"
        className="icon-button theme-toggle"
        title={`Appearance: ${theme}. Click to switch.`}
        aria-label={`Appearance: ${theme}. Switch to ${choices[(choices.indexOf(theme) + 1) % 3]} mode`}
        onClick={() => {
          const next = choices[(choices.indexOf(theme) + 1) % 3];
          setTheme(next);
          try {
            localStorage.setItem("trade-notes-theme-v1", next);
            setError("");
          } catch {
            setError(
              "Appearance changed for this visit; preference could not be saved.",
            );
          }
        }}
      >
        <Icon size={17} aria-hidden="true" />
      </button>
      {error && (
        <span className="theme-error" role="status">
          {error}
        </span>
      )}
    </>
  );
}
