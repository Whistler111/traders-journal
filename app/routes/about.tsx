import { Link } from "react-router";
import { BookOpen, CheckCheck, Image, NotebookPen } from "lucide-react";
import { siteOrigin } from "../lib/site.server";
import { ThemeToggle } from "../components/theme-toggle";
import type { Route } from "./+types/about";
export function loader({ request }: Route.LoaderArgs) {
  return { origin: siteOrigin(request) };
}
const description =
  "Trade Notes is a personal trading journal for recording trades, keeping screenshots, following playbooks and reviewing your decisions.";
export function meta({ loaderData }: Route.MetaArgs) {
  const url = loaderData ? `${loaderData.origin}/about` : "/about";
  return [
    { title: "Trade Notes | A thoughtful trading journal" },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "website" },
    {
      property: "og:title",
      content: "Trade Notes — Your pocket trading journal",
    },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: "Trade Notes" },
    { name: "twitter:description", content: description },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "Trade Notes",
        url,
        description,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web browser",
      },
    },
  ];
}
export default function About() {
  return (
    <main className="public-about">
      <nav aria-label="Public navigation">
        <Link className="public-brand" to="/about">
          <img src="/brand/favicon-32x32.png" width="32" height="32" alt="" />
          Trade Notes
        </Link>
        <div>
          <ThemeToggle />
          <Link to="/login">Sign in</Link>
        </div>
      </nav>
      <section className="about-hero">
        <p className="eyebrow">YOUR JOURNAL. YOUR PACE.</p>
        <h1>
          A little clarity.
          <br />
          One trade at a time.
        </h1>
        <p>
          Keep your original plan, record what happened, and make room for the
          lesson. A personal trading journal that stays focused on your
          decisions.
        </p>
        <Link className="about-cta" to="/login">
          Open your trading space
        </Link>
      </section>
      <section className="about-features" aria-label="Journal features">
        {[
          {
            Icon: NotebookPen,
            title: "Remember the trade",
            text: "Record your entry, original risk and broker-reported result. Keep notes that explain your decision.",
          },
          {
            Icon: Image,
            title: "Keep the context",
            text: "Attach chart screenshots, use playbooks and check the rules you followed.",
          },
          {
            Icon: CheckCheck,
            title: "Review with perspective",
            text: "Explore realized performance, mistake tags and daily reflections. Your account keeps the journal private.",
          },
        ].map(({ Icon, title, text }) => (
          <article key={title}>
            <Icon size={22} aria-hidden="true" />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>
      <footer>
        <BookOpen size={16} aria-hidden="true" />
        Trade Notes helps you record and review trades. It does not place orders
        or provide trading signals.
      </footer>
    </main>
  );
}
