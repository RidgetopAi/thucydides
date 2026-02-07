interface FilterOption {
  label: string;
  value: string;
}

interface FilterBarProps {
  filters: {
    label: string;
    key: string;
    options: FilterOption[];
    value: string;
  }[];
  onChange: (key: string, value: string) => void;
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-3 mb-4">
      {filters.map((filter) => (
        <div key={filter.key} className="flex items-center gap-2">
          <label className="text-xs text-zinc-400 uppercase tracking-wide">{filter.label}</label>
          <select
            value={filter.value}
            onChange={(e) => onChange(filter.key, e.target.value)}
            className="bg-surface border border-border rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
          >
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
