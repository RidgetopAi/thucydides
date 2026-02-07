import { NavLink } from 'react-router-dom';
import { Search, Database, BookOpen, GitBranch, Clock, LayoutDashboard } from 'lucide-react';

const links = [
  { to: '/search', label: 'Search', icon: Search },
  { to: '/entities', label: 'Entities', icon: Database },
  { to: '/sources', label: 'Sources', icon: BookOpen },
  { to: '/threads', label: 'Threads', icon: GitBranch },
  { to: '/shifts', label: 'Shifts', icon: Clock },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

export function Sidebar() {
  return (
    <aside className="w-48 shrink-0 bg-zinc-950 border-r border-border-subtle flex flex-col">
      <div className="p-4 border-b border-border-subtle">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Thucydides</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Research Database</p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-surface-active text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-hover'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
