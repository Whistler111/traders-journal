import { useState } from "react";
import { BookOpen, Check, Plus } from "lucide-react";
import { useJournal } from "./provider";
import {
  type Playbook,
  type DailyReflection,
  validatePractice,
} from "../lib/practice";
import { stats, percent, rFormat } from "../lib/journal";
const today = () => {
  const d = new Date();
  return new Date(+d - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};
export function PracticeHub() {
  const { practice, savePractice, trades, error } = useJournal(),
    [editing, setEditing] = useState<Playbook | null>(null),
    [message, setMessage] = useState(""),
    [failure, setFailure] = useState(""),
    [saving, setSaving] = useState(false),
    [date, setDate] = useState(today);
  const saved = practice.reflections.find((r) => r.date === date),
    [reflection, setReflection] = useState<DailyReflection | null>(null);
  function chooseDate(value: string) {
    setDate(value);
    setReflection(null);
    setMessage("");
  }
  // The stored entry is the source until the user begins editing this date.
  const current = reflection ??
    saved ?? { date, plan: "", worked: "", improve: "" };
  async function persist(next: typeof practice) {
    if (saving) return false;
    setSaving(true);
    try {
      await savePractice(validatePractice(next));
      setFailure("");
      setMessage("Your review is saved to your account.");
      return true;
    } catch (e) {
      setFailure((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="practice-hub" aria-label="Your trading practice">
      <div className="practice-columns">
        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">A PLAN YOU CAN REPEAT</p>
              <h2>
                <BookOpen size={17} aria-hidden="true" />
                Your playbooks
              </h2>
            </div>
            <button
              type="button"
              className="quiet-button"
              disabled={saving || !!error}
              onClick={() =>
                setEditing({
                  id: crypto.randomUUID(),
                  name: "",
                  description: "",
                  rules: [],
                })
              }
            >
              <Plus size={15} />
              New playbook
            </button>
          </div>
          {!practice.playbooks.length && (
            <p className="practice-empty">
              Keep one setup and its rules close. Add a playbook, then attach it
              when logging a trade.
            </p>
          )}
          <ul className="playbook-list">
            {practice.playbooks.map((p) => {
              const records = trades.filter(
                  (t) => t.journalReview?.playbookId === p.id,
                ),
                s = stats(records);
              return (
                <li key={p.id}>
                  <div>
                    <strong>{p.name}</strong>
                    {p.archived && <span className="tag">Archived</span>}
                    <p>
                      {p.description || `${p.rules.length} checklist rules`}
                    </p>
                    <small>
                      {records.length} linked trades · {s.n} closed ·{" "}
                      {percent(s.win)} win rate · {rFormat(s.avg)} average
                    </small>
                  </div>
                  <button
                    type="button"
                    className="quiet-button"
                    disabled={saving || !!error}
                    onClick={() => setEditing({ ...p, rules: [...p.rules] })}
                  >
                    Edit
                  </button>
                </li>
              );
            })}
          </ul>
          {editing && (
            <form
              className="playbook-editor"
              aria-label="Playbook editor"
              onSubmit={async (e) => {
                e.preventDefault();
                const clean = {
                  ...editing,
                  name: editing.name.trim(),
                  rules: editing.rules.map((s) => s.trim()).filter(Boolean),
                };
                if (
                  await persist({
                    ...practice,
                    playbooks: practice.playbooks.some(
                      (p) => p.id === editing.id,
                    )
                      ? practice.playbooks.map((p) =>
                          p.id === editing.id ? clean : p,
                        )
                      : [...practice.playbooks, clean],
                  })
                )
                  setEditing(null);
              }}
            >
              <label>
                Playbook name
                <input
                  required
                  maxLength={100}
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  placeholder="e.g. London breakout"
                />
              </label>
              <label>
                What are you looking for?
                <textarea
                  maxLength={2000}
                  rows={2}
                  value={editing.description}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                />
              </label>
              <label>
                Rules, one per line
                <textarea
                  maxLength={4000}
                  rows={4}
                  value={editing.rules.join("\n")}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      rules: e.target.value.split("\n"),
                    })
                  }
                  placeholder="Wait for confirmation\nDefine my original risk"
                />
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={!!editing.archived}
                  onChange={(e) =>
                    setEditing({ ...editing, archived: e.target.checked })
                  }
                />
                Archive this playbook
              </label>
              <p className="footnote">
                Edits affect future checklists. Saved trades keep their original
                rules. Archive a playbook to hide it from new trades.
              </p>
              <div className="feature-actions">
                <button type="button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button
                  className="primary"
                  type="submit"
                  disabled={saving || !!error}
                >
                  Save playbook
                </button>
              </div>
            </form>
          )}
        </section>
        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">A MOMENT TO CHECK IN</p>
              <h2>Daily reflection</h2>
            </div>
            <span className="tag">{saved ? "Recorded" : "Your own words"}</span>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!current.date) return;
              if (
                ![current.plan, current.worked, current.improve].some((s) =>
                  s.trim(),
                )
              ) {
                setFailure("Write a short reflection before saving.");
                return;
              }
              await persist({
                ...practice,
                reflections: [
                  ...practice.reflections.filter((r) => r.date !== date),
                  current,
                ],
              });
            }}
          >
            <label>
              Reflection date
              <input
                type="date"
                required
                value={date}
                onChange={(e) => chooseDate(e.target.value)}
              />
            </label>
            {(
              [
                {
                  key: "plan",
                  label: "My focus before trading",
                  placeholder: "What do I want to be patient about?",
                },
                {
                  key: "worked",
                  label: "What went well?",
                  placeholder: "A decision worth repeating.",
                },
                {
                  key: "improve",
                  label: "One thing for next time",
                  placeholder: "A small, specific adjustment.",
                },
              ] as const
            ).map(({ key, label, placeholder }) => (
              <label key={key}>
                {label}
                <textarea
                  rows={2}
                  maxLength={4000}
                  value={current[key]}
                  placeholder={placeholder}
                  onChange={(e) =>
                    setReflection({ ...current, [key]: e.target.value })
                  }
                />
              </label>
            ))}
            <div className="feature-actions">
              <button
                className="primary"
                disabled={saving || !!error}
                type="submit"
              >
                <Check size={15} />
                Save reflection
              </button>
            </div>
          </form>
          {!!practice.reflections.length && (
            <details className="reflection-history">
              <summary>
                Previous reflections ({practice.reflections.length})
              </summary>
              <div className="reflection-days">
                {[...practice.reflections]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((r) => (
                    <button
                      type="button"
                      key={r.date}
                      onClick={() => chooseDate(r.date)}
                    >
                      {r.date}
                    </button>
                  ))}
              </div>
            </details>
          )}
        </section>
      </div>
      {failure && (
        <p className="error" role="alert">
          {failure}
        </p>
      )}
      {message && (
        <p role="status" className="feature-status">
          {message}
        </p>
      )}
    </section>
  );
}
