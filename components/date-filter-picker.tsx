"use client";

import { useEffect, useRef, useState } from "react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}

const dateValue = (year: number, month: number, day: number) =>
  `${year.toString().padStart(4, "0")}-${(month + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

export function DateFilterPicker({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  const selected = parts(defaultValue);
  const today = new Date();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({
    year: selected?.year ?? today.getFullYear(),
    month: selected?.month ?? today.getMonth(),
  });
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const firstDay = new Date(view.year, view.month, 1).getDay();
  const days = new Date(view.year, view.month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + days }, (_, index) =>
    index < firstDay ? null : index - firstDay + 1,
  );
  const moveMonth = (amount: number) =>
    setView((current) => {
      const next = new Date(current.year, current.month + amount, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  return (
    <div className="date-filter">
      <span>{label}</span>
      <input type="hidden" name={name} value={value} />
      <div className="date-picker" ref={root}>
        <button
          className="date-picker-trigger"
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-label={`${label}: ${value || "not selected"}`}
        >
          <span className={value ? "" : "placeholder"}>
            {value || "Select date"}
          </span>
          <span aria-hidden="true">▦</span>
        </button>
        {open && (
          <div className="calendar-popover">
            <div className="calendar-heading">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                aria-label="Previous month"
              >
                ‹
              </button>
              <strong>
                {new Intl.DateTimeFormat("en", {
                  month: "long",
                  year: "numeric",
                }).format(new Date(view.year, view.month, 1))}
              </strong>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                aria-label="Next month"
              >
                ›
              </button>
            </div>
            <div className="calendar-grid">
              {WEEKDAYS.map((day) => (
                <span className="calendar-weekday" key={day}>
                  {day}
                </span>
              ))}
              {cells.map((day, index) =>
                day ? (
                  <button
                    className={
                      value === dateValue(view.year, view.month, day)
                        ? "selected"
                        : ""
                    }
                    type="button"
                    key={day}
                    onClick={() => {
                      setValue(dateValue(view.year, view.month, day));
                      setOpen(false);
                    }}
                  >
                    {day}
                  </button>
                ) : (
                  <span key={`blank-${index}`} />
                ),
              )}
            </div>
            <div className="calendar-footer">
              <button
                type="button"
                onClick={() => {
                  setValue("");
                  setOpen(false);
                }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setValue(
                    dateValue(now.getFullYear(), now.getMonth(), now.getDate()),
                  );
                  setView({ year: now.getFullYear(), month: now.getMonth() });
                  setOpen(false);
                }}
              >
                Today
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
