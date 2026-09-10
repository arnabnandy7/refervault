"use client";

import { useEffect, useRef, useState } from "react";

export function StoredSuggestionField({
  label,
  name,
  field,
  defaultValue = "",
  placeholder,
  error,
}: {
  label: string;
  name: string;
  field: "referredTo" | "company";
  defaultValue?: string;
  placeholder?: string;
  error?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const root = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const reset = () => {
      setValue(defaultValue);
      setSuggestions([]);
      setFocused(false);
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultValue]);

  useEffect(() => {
    const query = value.trim();
    if (!focused || !query) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/referrals/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field, query }),
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok) setSuggestions(await response.json());
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setSuggestions([]);
      }
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [field, focused, value]);

  const listId = `${name}-suggestions`;
  return (
    <label className="entry-field stored-suggestion-field" ref={root}>
      <span>{label}</span>
      <input
        name={name}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={focused && suggestions.length > 0}
        aria-controls={listId}
        onChange={(event) => setValue(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 100)}
      />
      {focused && suggestions.length > 0 ? (
        <ul className="poc-suggestions" id={listId} role="listbox">
          {suggestions.map((suggestion) => (
            <li key={suggestion} role="option" aria-selected={suggestion === value}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { setValue(suggestion); setFocused(false); }}
              >{suggestion}</button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <small id={`${name}-error`}>{error}</small> : null}
    </label>
  );
}
