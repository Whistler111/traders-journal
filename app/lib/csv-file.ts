import { parseCsv } from "./csv-import";
export async function parseCsvFile(file: File): Promise<string[][]> {
  if (file.size > 5 * 1024 * 1024) throw Error("CSV exceeds 5 MB.");
  const text = await file.text();
  if (file.size < 256 * 1024) return parseCsv(text);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./csv-worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e) => {
      worker.terminate();
      if (e.data.error) reject(Error(e.data.error));
      else resolve(e.data.rows);
    };
    worker.onerror = () => {
      worker.terminate();
      reject(Error("CSV worker failed. Try splitting the file."));
    };
    worker.postMessage(text);
  });
}
