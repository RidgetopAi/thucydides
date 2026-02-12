import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TopicProvider } from './lib/TopicContext';
import { AppShell } from './components/layout/AppShell';
import { SearchResults } from './components/search/SearchResults';
import { EntityList } from './components/entities/EntityList';
import { EntityDetail } from './components/entities/EntityDetail';
import { SourceList } from './components/sources/SourceList';
import { SourceDetail } from './components/sources/SourceDetail';
import { ThreadBoard, ThreadDetail } from './components/threads/ThreadBoard';
import { ShiftTimeline, ShiftDetail } from './components/shifts/ShiftTimeline';
import { Dashboard } from './components/dashboard/Dashboard';
import { TradingDashboard } from './components/trading/TradingDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <TopicProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/search" replace />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/entities" element={<EntityList />} />
          <Route path="/entities/:id" element={<EntityDetail />} />
          <Route path="/sources" element={<SourceList />} />
          <Route path="/sources/:id" element={<SourceDetail />} />
          <Route path="/threads" element={<ThreadBoard />} />
          <Route path="/threads/:id" element={<ThreadDetail />} />
          <Route path="/shifts" element={<ShiftTimeline />} />
          <Route path="/shifts/:id" element={<ShiftDetail />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/trading" element={<TradingDashboard />} />
        </Route>
      </Routes>
      </TopicProvider>
    </BrowserRouter>
  );
}
