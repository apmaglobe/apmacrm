"use client";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["B.e.", "Ç.a.", "Ç.", "C.a.", "C.", "Ş.", "B."];
const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function DateTimeField({ name, label, value, required = false }: { name: string; label: string; value?: string; required?: boolean }) {
  const initial = value ? new Date(value) : null;
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initial ? initial.getFullYear() : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(initial ? initial.getMonth() : new Date().getMonth());
  const [picked, setPicked] = useState<{ year: number; month: number; day: number } | null>(
    initial ? { year: initial.getFullYear(), month: initial.getMonth(), day: initial.getDate() } : null,
  );
  const [time, setTime] = useState(initial ? `${pad(initial.getHours())}:${pad(initial.getMinutes())}` : "09:00");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const composed = picked ? `${picked.year}-${pad(picked.month + 1)}-${pad(picked.day)}T${time}` : "";
  const display = picked
    ? `${pad(picked.day)}.${pad(picked.month + 1)}.${picked.year} ${time}`
    : "Seçilməyib";
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leading = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;

  function changeMonth(delta: number) {
    let month = viewMonth + delta, year = viewYear;
    if (month < 0) { month = 11; year -= 1; }
    if (month > 11) { month = 0; year += 1; }
    setViewMonth(month);
    setViewYear(year);
  }

  return (
    <div className="datetime-field" ref={ref}>
      <span>{label}</span>
      <button type="button" className="datetime-trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <CalendarDays size={15} /> {display}
      </button>
      <input type="hidden" name={name} value={composed} required={required} />
      {open && (
        <div className="datetime-popover" role="dialog" aria-label={label}>
          <div className="datetime-nav">
            <button type="button" aria-label="Əvvəlki ay" onClick={() => changeMonth(-1)}><ChevronLeft size={16} /></button>
            <strong>{MONTHS[viewMonth]} {viewYear}</strong>
            <button type="button" aria-label="Növbəti ay" onClick={() => changeMonth(1)}><ChevronRight size={16} /></button>
          </div>
          <div className="datetime-grid">
            {WEEKDAYS.map((d) => <strong key={d}>{d}</strong>)}
            {Array.from({ length: leading }, (_, i) => <span key={"empty" + i} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const active = !!picked && picked.year === viewYear && picked.month === viewMonth && picked.day === day;
              return (
                <button
                  type="button"
                  key={day}
                  className={active ? "active" : ""}
                  onClick={() => setPicked({ year: viewYear, month: viewMonth, day })}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <label className="datetime-time">
            Saat
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <button type="button" className="primary" onClick={() => setOpen(false)}>Təsdiqlə</button>
        </div>
      )}
    </div>
  );
}
