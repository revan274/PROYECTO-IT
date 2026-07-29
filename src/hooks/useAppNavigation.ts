import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '../constants/app';
import type { ViewType } from '../types/app';

export const VIEW_PATHS: Record<ViewType, string> = {
  dashboard: '/dashboard',
  reports: '/reports',
  inventory: '/inventory',
  supplies: '/supplies',
  tickets: '/tickets',
  history: '/history',
  users: '/users',
};

export function getViewPath(view: ViewType): string {
  return VIEW_PATHS[view];
}

function getViewFromPathname(pathname: string): ViewType | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const match = (Object.entries(VIEW_PATHS) as Array<[ViewType, string]>)
    .find(([, path]) => path === normalized);
  return match?.[0] || null;
}

interface UseAppNavigationOptions {
  canManageUsers: boolean;
  isRequesterOnlyUser: boolean;
}

export function useAppNavigation({
  canManageUsers,
  isRequesterOnlyUser,
}: UseAppNavigationOptions) {
  const location = useLocation();
  const navigate = useNavigate();
  const routeView = useMemo(
    () => getViewFromPathname(location.pathname),
    [location.pathname],
  );
  const defaultView: ViewType = isRequesterOnlyUser ? 'tickets' : 'dashboard';
  const accessibleRouteView = useMemo(() => {
    if (routeView === null) return null;
    if (routeView === 'users') return canManageUsers ? routeView : null;
    if (routeView !== 'tickets' && isRequesterOnlyUser) return null;
    return routeView;
  }, [canManageUsers, isRequesterOnlyUser, routeView]);
  const view: ViewType = accessibleRouteView ?? defaultView;

  const setView = useCallback(
    (nextView: ViewType, options?: { replace?: boolean }) => {
      const nextPath = getViewPath(nextView);
      if (location.pathname === nextPath && !options?.replace) return;
      navigate(nextPath, { replace: options?.replace ?? false });
    },
    [location.pathname, navigate],
  );

  const visibleNavItems = useMemo(() => {
    if (isRequesterOnlyUser) return NAV_ITEMS.filter((item) => item.id === 'tickets');
    return canManageUsers ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.id !== 'users');
  }, [canManageUsers, isRequesterOnlyUser]);

  return {
    view,
    setView,
    visibleNavItems,
    defaultViewPath: getViewPath(defaultView),
    isDashboardView: view === 'dashboard',
    isReportsView: view === 'reports',
  };
}
