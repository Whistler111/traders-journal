import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import {
  getScreenshots,
  prepareScreenshot,
  MAX_SCREENSHOTS,
  type Screenshot,
  type ScreenshotRef,
} from "../lib/screenshots";
import {
  ClipboardSession,
  imageFingerprint,
  pastedImages,
  readClipboardImage,
} from "../lib/clipboard";
export function ScreenshotUpload({
  refs,
  drafts,
  onChange,
  onBusy,
  disabled = false,
}: {
  refs: ScreenshotRef[];
  drafts: Screenshot[];
  onChange: (refs: ScreenshotRef[], drafts: Screenshot[]) => void;
  onBusy: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null),
    section = useRef<HTMLElement>(null),
    mounted = useRef(true),
    reading = useRef(false);
  const [saved, setSaved] = useState<Screenshot[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [expanded, setExpanded] = useState<string | null>(null);
  const [clipboardImage, setClipboardImage] = useState<File | null>(null);
  const actions = useRef({
    add,
    disabled,
    loading,
    full: refs.length >= MAX_SCREENSHOTS,
  });
  actions.current = {
    add,
    disabled,
    loading,
    full: refs.length >= MAX_SCREENSHOTS,
  };
  const session = useRef<ClipboardSession | null>(null),
    attached = useRef(new Map<string, string>()),
    clipboardBusy = useRef(false);
  async function attachClipboard(file: File) {
    const hash = await imageFingerprint(file);
    if (attached.current.has(hash)) return;
    const success = await actions.current.add([file]);
    if (success) {
      attached.current.set(hash, success[0].id);
      session.current?.claim(hash);
    }
  }
  useEffect(() => {
    let cancelled = false;
    try {
      session.current = new ClipboardSession(sessionStorage);
    } catch {
      session.current = new ClipboardSession();
    }
    const dialog = section.current?.closest("dialog");
    // Privacy: clipboard reads are scoped to the visible, focused Add/Edit dialog.
    // No global/background clipboard watcher, timers, text reads, or permission request on other screens.
    async function check() {
      if (
        cancelled ||
        clipboardBusy.current ||
        !dialog?.open ||
        !document.hasFocus() ||
        document.visibilityState !== "visible" ||
        actions.current.disabled ||
        actions.current.loading ||
        actions.current.full
      )
        return;
      clipboardBusy.current = true;
      try {
        const file = await readClipboardImage();
        if (!file || file.size > 10 * 1024 * 1024) return;
        const hash = await imageFingerprint(file);
        if (
          !cancelled &&
          dialog.open &&
          document.hasFocus() &&
          session.current?.claim(hash)
        )
          setClipboardImage(file);
      } catch {
        /* Denied/unsupported automatic reads are intentionally silent. */
      } finally {
        clipboardBusy.current = false;
      }
    }
    function paste(event: ClipboardEvent) {
      const files = pastedImages(event.clipboardData);
      if (!files.length || actions.current.disabled || actions.current.loading)
        return;
      event.preventDefault();
      setClipboardImage(null);
      void (async () => {
        const entries = await Promise.all(
          files.map(async (file) => ({
            file,
            hash: await imageFingerprint(file),
          })),
        );
        const unique = new Map(
          entries
            .filter((entry) => !attached.current.has(entry.hash))
            .map((entry) => [entry.hash, entry.file]),
        );
        const added = unique.size
          ? await actions.current.add([...unique.values()])
          : false;
        if (added) {
          let index = 0;
          for (const hash of unique.keys()) {
            attached.current.set(hash, added[index++].id);
            session.current?.claim(hash);
          }
        }
      })().catch((error) => {
        if (!cancelled) setError((error as Error).message);
      });
    }
    dialog?.addEventListener("paste", paste);
    window.addEventListener("focus", check);
    const openCheck = setTimeout(() => void check(), 0);
    return () => {
      cancelled = true;
      clearTimeout(openCheck);
      dialog?.removeEventListener("paste", paste);
      window.removeEventListener("focus", check);
    };
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const existing = refs.filter(
      (ref) => !drafts.some((image) => image.id === ref.id),
    );
    if (existing.length)
      getScreenshots(existing)
        .then((images) => {
          if (!cancelled) setSaved(images);
        })
        .catch((e) => {
          if (!cancelled) setError((e as Error).message);
        });
    return () => {
      cancelled = true;
    };
  }, [refs, drafts]);
  async function add(files: File[]) {
    if (reading.current || disabled || !files.length) return false;
    setError("");
    if (files.length + refs.length > MAX_SCREENSHOTS) {
      setError("You can add up to 3 screenshots per trade.");
      return false;
    }
    reading.current = true;
    setLoading(true);
    onBusy(true);
    try {
      const images = await Promise.all(files.map(prepareScreenshot));
      if (mounted.current)
        onChange(
          [...refs, ...images.map(({ id, name }) => ({ id, name }))],
          [...drafts, ...images],
        );
      return images;
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
      return false;
    } finally {
      reading.current = false;
      if (mounted.current) {
        setLoading(false);
        onBusy(false);
      }
      if (input.current) input.current.value = "";
    }
  }
  const images = [...saved, ...drafts];
  return (
    <section
      ref={section}
      className="screenshot-section"
      aria-labelledby="screenshots-title"
    >
      <div className="screenshot-heading">
        <div>
          <h3 id="screenshots-title">
            Screenshots <span className="optional">optional</span>
          </h3>
          <p>Add a chart or trade confirmation.</p>
        </div>
        <span className="muted">{refs.length}/3</span>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        aria-label="Add trade screenshots"
        className="sr-only"
        disabled={disabled || loading || refs.length >= MAX_SCREENSHOTS}
        onChange={(e) => {
          void add(Array.from(e.target.files ?? []));
        }}
      />
      <button
        type="button"
        className="upload-button"
        disabled={disabled || loading || refs.length >= MAX_SCREENSHOTS}
        onClick={() => input.current?.click()}
      >
        <ImagePlus size={23} aria-hidden="true" />
        {loading ? "Preparing images…" : "Add image / screenshot"}
        <small>PNG, JPG or WebP · up to 10 MB each</small>
      </button>
      <div className="clipboard-tools">
        <button
          type="button"
          disabled={disabled || loading || refs.length >= MAX_SCREENSHOTS}
          onClick={async () => {
            try {
              const file = await readClipboardImage();
              if (!file) {
                setError(
                  "No supported image found. Paste with Ctrl+V / ⌘V, or choose a file.",
                );
                return;
              }
              await attachClipboard(file);
              setClipboardImage(null);
            } catch {
              setError(
                "Clipboard access is unavailable. Paste with Ctrl+V / ⌘V, or choose a file.",
              );
            }
          }}
        >
          Paste image
        </button>
        <small>Or press Ctrl+V / ⌘V while this form is open.</small>
      </div>
      {clipboardImage && (
        <div className="clipboard-banner" role="status">
          <p>Image found in your clipboard. Attach it to this trade?</p>
          <div>
            <button
              type="button"
              disabled={disabled || loading || refs.length >= MAX_SCREENSHOTS}
              onClick={async () => {
                await attachClipboard(clipboardImage);
                setClipboardImage(null);
              }}
            >
              Attach
            </button>
            <button type="button" onClick={() => setClipboardImage(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}
      {!!refs.length && (
        <ul className="screenshot-grid">
          {refs.map((ref) => {
            const image = images.find((image) => image.id === ref.id);
            return (
              <li key={ref.id}>
                <button
                  type="button"
                  className="screenshot-preview"
                  aria-label={`View screenshot ${ref.name}`}
                  disabled={!image || disabled}
                  aria-expanded={expanded === ref.id}
                  onClick={() =>
                    setExpanded(expanded === ref.id ? null : ref.id)
                  }
                >
                  {image ? (
                    <img src={image.dataUrl} alt={ref.name} />
                  ) : (
                    <span>Loading preview…</span>
                  )}
                </button>
                <div className="screenshot-caption">
                  <span title={ref.name}>{ref.name}</span>
                  <button
                    type="button"
                    disabled={disabled || loading}
                    onClick={() => {
                      for (const [hash, id] of attached.current)
                        if (id === ref.id) attached.current.delete(hash);
                      onChange(
                        refs.filter((item) => item.id !== ref.id),
                        drafts.filter((item) => item.id !== ref.id),
                      );
                      if (expanded === ref.id) setExpanded(null);
                    }}
                    aria-label={`Remove screenshot ${ref.name}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {expanded && images.find((image) => image.id === expanded) && (
        <div className="screenshot-enlarged">
          <button type="button" onClick={() => setExpanded(null)}>
            Close preview
          </button>
          <img
            src={images.find((image) => image.id === expanded)!.dataUrl}
            alt={
              refs.find((ref) => ref.id === expanded)?.name ??
              "Trade screenshot"
            }
          />
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <p className="upload-note">
        Saved in this browser with your trade. Included in JSON backups.
      </p>
    </section>
  );
}
