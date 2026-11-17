import React, { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { PageSkeleton, ErrorState } from './Feedback';
import { useParking } from '../../context/ParkingContext';
import { useDocumentTitle } from '../../hooks/hooks';
import { ROUTE_META } from '../../pages/registry';
import { TourProvider, useTour } from '../../context/TourContext';

export const Layout = () => (
  <TourProvider>
    <LayoutInner />
  </TourProvider>
);

const LayoutInner = () => {
  const { sidebarForced } = useTour();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const { ready, loadError, connection, refresh } = useParking();

  useDocumentTitle(ROUTE_META[pathname]?.title);

  // Smooth, predictable navigation: start every page at the top and close the mobile drawer.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setIsSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar isOpen={isSidebarOpen || sidebarForced} onClose={() => !sidebarForced && setIsSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 lg:pl-72 print:pl-0">
        <Navbar onOpenSidebar={() => setIsSidebarOpen(true)} />

        {connection.status === 'offline' && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs px-4 sm:px-8 py-2 flex items-center gap-2 print:hidden">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span>Connection lost. Showing the last known data — we'll reconnect automatically.</span>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full print:p-0">
          {!ready && loadError ? (
            <ErrorState message={loadError} onRetry={refresh} />
          ) : !ready ? (
            <PageSkeleton />
          ) : (
            <Suspense fallback={<PageSkeleton />}>
              {/* keyed by path so each navigation plays the entrance animation */}
              <div key={pathname} className="page-enter">
                <Outlet />
              </div>
            </Suspense>
          )}
        </main>
      </div>
    </div>
  );
};
