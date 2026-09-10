"use client";

import { useEffect, useState } from "react";

export function PocFilter({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const query = value.trim();
    if (!focused || !query) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/poc-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
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
  }, [focused, value]);

  return (
    <label className="poc-filter">
      <span>PoC</span>
      <input
        name="poc"
        value={value}
        placeholder="Name or reference"
        autoComplete="off"
        onChange={(event) => setValue(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 100)}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={focused && suggestions.length > 0}
        aria-controls="poc-suggestion-list"
      />
      {focused && suggestions.length > 0 ? (
        <ul className="poc-suggestions" id="poc-suggestion-list" role="listbox">
          {suggestions.map((suggestion) => (
            <li key={suggestion} role="option" aria-selected={suggestion === value}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setValue(suggestion);
                  setFocused(false);
                }}
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </label>
  );
}
