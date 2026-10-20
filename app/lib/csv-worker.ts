import { parseCsv } from "./csv-import";
self.onmessage = (event: MessageEvent<string>) => {
  try {
    self.postMessage({ rows: parseCsv(event.data) });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
