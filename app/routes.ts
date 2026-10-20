import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  route("about", "routes/about.tsx"),
  route("robots.txt", "routes/robots.ts"),
  route("sitemap.xml", "routes/sitemap.ts"),
  route("login", "routes/login.tsx"),
  route("api/price", "routes/api.price.ts"),
  layout("routes/authenticated.tsx", [
    layout("routes/workspace.tsx", [
      index("routes/home.tsx"),
      route("overview", "routes/home.tsx", { id: "overview" }),
      route("journal", "routes/journal.tsx"),
      route("reports", "routes/reports.tsx"),
      route("settings", "routes/settings.tsx"),
      route("review", "routes/review.tsx"),
      route("connections", "routes/connections.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
