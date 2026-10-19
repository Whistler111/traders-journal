import { useJournal } from "./provider";
import { tagsFromText, type TradeReview } from "../lib/practice";
import { useState } from "react";
export function TradeReviewFields({
  value,
  onChange,
  disabled = false,
}: {
  value: TradeReview;
  onChange: (review: TradeReview) => void;
  disabled?: boolean;
}) {
  const { practice } = useJournal(),
    [tags, setTags] = useState(value.mistakes.join(", "));
  const available = practice.playbooks.filter(
    (p) => !p.archived || p.id === value.playbookId,
  );
  return (
    <fieldset className="review-fields" disabled={disabled}>
      <legend>Playbook & learning</legend>
      <label>
        Playbook (optional)
        <select
          value={value.playbookId}
          onChange={(e) => {
            const p = practice.playbooks.find((p) => p.id === e.target.value);
            onChange({
              ...value,
              playbookId: p?.id ?? "",
              playbookName: p?.name ?? "",
              rules: p?.rules.map((label) => ({ label, checked: false })) ?? [],
            });
          }}
        >
          <option value="">No playbook selected</option>
          {value.playbookId &&
            !available.some((p) => p.id === value.playbookId) && (
              <option value={value.playbookId}>
                {value.playbookName} (saved checklist)
              </option>
            )}
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.archived ? " (archived)" : ""}
            </option>
          ))}
        </select>
      </label>
      {!!value.rules.length && (
        <div className="trade-checklist">
          <p className="footnote">
            The rules for this trade. Check the ones you followed.
          </p>
          {value.rules.map((rule, i) => (
            <label key={i} className="inline-check">
              <input
                type="checkbox"
                checked={rule.checked}
                onChange={(e) =>
                  onChange({
                    ...value,
                    rules: value.rules.map((r, index) =>
                      index === i ? { ...r, checked: e.target.checked } : r,
                    ),
                  })
                }
              />
              {rule.label}
            </label>
          ))}
        </div>
      )}
      <label>
        Mistake tags (optional)
        <input
          value={tags}
          maxLength={500}
          placeholder="e.g. Early entry, Moved stop"
          onChange={(e) => {
            setTags(e.target.value);
            onChange({ ...value, mistakes: tagsFromText(e.target.value) });
          }}
        />
        <small>
          Separate with commas. Up to 12 tags, 40 characters each. No need to
          tag a mistake when there wasn’t one.
        </small>
      </label>
    </fieldset>
  );
}
