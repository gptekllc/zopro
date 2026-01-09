import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const LAST_PAGE_KEY = 'zopro_last_visited_page';
const EXCLUDED_PATHS = ['/', '/login', '/terms', '/privacy', '/reset-password'];

export const useLastVisitedPage = (isAuthenticated: boolean) => {
  const location = useLocation();

  useEffect(() => {
    // Only save if user is authenticated and not on excluded paths
    if (isAuthenticated && !EXCLUDED_PATHS.includes(location.pathname)) {
      const fullPath = location.pathname + location.search;
      localStorage.setItem(LAST_PAGE_KEY, fullPath);
    }
  }, [location.pathname, location.search, isAuthenticated]);
};

export const getLastVisitedPage = (): string | null => {
  return localStorage.getItem(LAST_PAGE_KEY);
};

export const clearLastVisitedPage = () => {
  localStorage.removeItem(LAST_PAGE_KEY);
};

// Get a friendly name for the page
export const getPageName = (path: string): string => {
  const pathWithoutQuery = path.split('?')[0];
  const segments = pathWithoutQuery.split('/').filter(Boolean);
  
  if (segments.length === 0) return 'Dashboard';
  
  const pageNames: Record<string, string> = {
    'dashboard': 'Dashboard',
    'customers': 'Customers',
    'jobs': 'Jobs',
    'quotes': 'Quotes',
    'invoices': 'Invoices',
    'items': 'Items',
    'technicians': 'Team',
    'reports': 'Reports',
    'settings': 'Settings',
    'company': 'Company',
    'profile': 'Profile',
    'templates': 'Templates',
    'timeclock': 'Time Clock',
    'notifications': 'Notifications',
    'subscription': 'Subscription',
    'security': 'Security',
  };
  
  return pageNames[segments[0]] || segments[0].charAt(0).toUpperCase() + segments[0].slice(1);
};
