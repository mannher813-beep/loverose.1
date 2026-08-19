import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { getCountryList, type CountryOption } from "../lib/countries";
import type { CountryCode } from "libphonenumber-js";

interface CountryDialSelectProps {
  value: CountryCode | null;
  onChange: (iso2: CountryCode) => void;
  locale?: string;
  disabled?: boolean;
}

export default function CountryDialSelect({ value, onChange, locale = "fr", disabled }: CountryDialSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const countries: CountryOption[] = useMemo(() => getCountryList(locale), [locale]);
  const selected = useMemo(() => countries.find((c) => c.iso2 === value) || null, [countries, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.replace("+", "").includes(q.replace("+", "")) ||
        c.iso2.toLowerCase().includes(q)
    );
  }, [countries, query]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => searchRef.current?.focus(), 10);
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full h-[46px] px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-slate-900 flex items-center justify-between gap-1 cursor-pointer disabled:opacity-50"
      >
        <span className="flex items-center gap-1 truncate">
          <span className="text-base leading-none">{selected?.flag || "🏳️"}</span>
          <span>{selected?.dialCode || "+..."}</span>
        </span>
        <ChevronDown size={12} className="text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 max-w-[85vw] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden left-0">
          <div className="p-2 border-b border-slate-100 flex items-center gap-1.5 bg-slate-50">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un pays ou un indicatif..."
              className="w-full bg-transparent text-xs font-semibold focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="p-3 text-[11px] text-slate-400 text-center">Aucun pays trouvé</div>
            )}
            {filtered.map((c) => (
              <button
                key={c.iso2}
                type="button"
                onClick={() => {
                  onChange(c.iso2);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-rose-50 transition ${
                  c.iso2 === value ? "bg-rose-50 text-rose-600" : "text-slate-700"
                }`}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-slate-400 font-mono text-[11px]">{c.dialCode}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
