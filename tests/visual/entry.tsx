import { setScreenshotBackend } from "../../app/lib/screenshots";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import { Workspace } from "../../app/routes/workspace";
import Home from "../../app/routes/home";
import Journal from "../../app/routes/journal";
import Reports from "../../app/routes/reports";
import Review from "../../app/routes/review";
import Settings from "../../app/routes/settings";
import { ViewFiltersProvider } from "../../app/components/view-filters";
import { JournalProvider } from "./provider";
import "../../app/app.css";
import "../../app/ui.css";
import "../../app/features.css";
import "../../app/dashboard.css";
setScreenshotBackend({
  images: async (refs) =>
    refs.map((ref) => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 340;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#171923";
      ctx.fillRect(0, 0, 640, 340);
      ctx.strokeStyle = "#35394d";
      for (let y = 50; y < 340; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(640, y);
        ctx.stroke();
      }
      ctx.fillStyle = "#afb3c7";
      ctx.font = "14px sans-serif";
      ctx.fillText("FICTIONAL CHART FIXTURE", 20, 28);
      for (let i = 0; i < 30; i++) {
        const base = 230 - i * 4 + Math.sin(i * 1.7) * 30;
        ctx.strokeStyle = i % 3 ? "#75d3ad" : "#f197a2";
        ctx.beginPath();
        ctx.moveTo(25 + i * 20, base - 15);
        ctx.lineTo(25 + i * 20, base + 25);
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillRect(20 + i * 20, base, 10, i % 3 ? -14 : 14);
      }
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = ref.id.includes("after") ? "#f197a2" : "#b0a5f0";
      ctx.beginPath();
      ctx.moveTo(0, ref.id.includes("after") ? 190 : 160);
      ctx.lineTo(640, ref.id.includes("after") ? 190 : 160);
      ctx.stroke();
      return { ...ref, dataUrl: canvas.toDataURL("image/png") };
    }),
  writeImages: async () => {},
  deleteImages: async () => {},
});
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ViewFiltersProvider>
      <JournalProvider>
        <Routes>
          <Route element={<Workspace />}>
            <Route index element={<Home />} />
            <Route path="journal" element={<Journal />} />
            <Route path="reports" element={<Reports />} />
            <Route path="review" element={<Review />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </JournalProvider>
    </ViewFiltersProvider>
  </BrowserRouter>,
);
