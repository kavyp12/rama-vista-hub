import { useState, useRef, useEffect } from 'react';
import { COUNTRY_CODES } from '@/lib/utils';
import { Search, ChevronDown } from 'lucide-react';

interface Props {
  value: string;           // selected dial code e.g. "+91"
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
}

export function CountryCodeSelect({ value, onChange, disabled, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = COUNTRY_CODES.find(c => c.code === value) ?? COUNTRY_CODES[0];

  const filtered = COUNTRY_CODES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.includes(search) ||
    c.iso.toLowerCase().includes(search.toLowerCase())
  );

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Auto-focus search when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(o => !o); }}
        className={`
          flex h-10 w-[130px] items-center gap-1.5 rounded-l-md border border-r-0 border-input
          px-2 py-2 text-xs font-medium transition-colors
          focus:outline-none focus:ring-2 focus:ring-ring
          disabled:cursor-not-allowed disabled:opacity-50
          ${disabled ? 'bg-muted' : 'bg-white hover:bg-slate-50'}
        `}
      >
        <img
          src={`https://flagcdn.com/w20/${selected.iso.toLowerCase()}.png`}
          alt={selected.name}
          className="w-5 h-3.5 object-cover rounded-sm shrink-0"
        />
        <span className="truncate flex-1 text-left">{selected.code}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-[calc(100%+2px)] z-50 w-[240px] rounded-md border border-input bg-white shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1">
          {/* Search */}
          <div className="p-2 border-b border-slate-100 flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search country..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-sm outline-none bg-transparent placeholder:text-muted-foreground"
            />
          </div>

          {/* List */}
          <ul className="max-h-[220px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-sm text-center text-muted-foreground">No countries found</li>
            ) : (
              filtered.map(c => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.code);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`
                      w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors
                      hover:bg-slate-50
                      ${c.code === value ? 'bg-blue-50 text-blue-700 font-medium' : ''}
                    `}
                  >
                    <img
                      src={`https://flagcdn.com/w20/${c.iso.toLowerCase()}.png`}
                      alt={c.name}
                      className="w-5 h-3.5 object-cover rounded-sm shrink-0"
                    />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground font-mono shrink-0">{c.code}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
