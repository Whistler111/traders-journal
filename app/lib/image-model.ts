export function safeScreenshotName(name: string) {
  const filename = name.replace(/\\/g, "/").split("/").pop() ?? "";
  return (
    filename
      .replace(
        // eslint-disable-next-line no-control-regex -- Strip controls from untrusted filenames.
        /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069<>:"|?*]/g,
        "",
      )
      .replace(/^\.+|[. ]+$/g, "")
      .trim()
      .slice(0, 200) || "Screenshot"
  );
}
export interface ScreenshotRef {
  id: string;
  name: string;
}
export interface Screenshot extends ScreenshotRef {
  dataUrl: string;
}
export const MAX_SCREENSHOTS = 3;
export const MAX_IMAGE_BYTES = 500 * 1024;
export function validateScreenshotRefs(
  value: unknown,
): asserts value is ScreenshotRef[] {
  if (!Array.isArray(value) || value.length > MAX_SCREENSHOTS)
    throw Error("A trade can have up to 3 screenshots.");
  const ids = new Set<string>();
  for (const ref of value) {
    if (
      !ref ||
      typeof ref !== "object" ||
      typeof ref.id !== "string" ||
      !ref.id ||
      ref.id.length > 100 ||
      typeof ref.name !== "string" ||
      !ref.name ||
      ref.name.length > 200 ||
      ids.has(ref.id)
    )
      throw Error("Invalid screenshot reference.");
    ids.add(ref.id);
  }
}
export function validateScreenshot(value: unknown): Screenshot {
  validateScreenshotRefs([value]);
  const image = value as Screenshot;
  if (
    typeof image.dataUrl !== "string" ||
    image.dataUrl.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 100 ||
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
      image.dataUrl,
    )
  )
    throw Error(
      "Invalid screenshot image. Use PNG, JPEG or WebP up to 500 KB after resizing.",
    );
  return { ...image, name: safeScreenshotName(image.name) };
}
