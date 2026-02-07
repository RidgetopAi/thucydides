import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SearchBar } from './SearchBar';

export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="shrink-0 border-b border-border-subtle px-6 py-3 flex items-center gap-4 bg-zinc-950/80 backdrop-blur-sm">
          <SearchBar />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
