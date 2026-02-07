import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';

export function SearchBar() {
  const [searchParams] = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') || '');
  const navigate = useNavigate();

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  }, [value, navigate]);

  return (
    <form onSubmit={handleSubmit} className="flex-1 max-w-xl">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search entities, sources, threads..."
          className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
        />
      </div>
    </form>
  );
}
