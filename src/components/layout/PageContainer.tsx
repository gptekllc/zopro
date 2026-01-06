import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: ReactNode;
  /**
   * Controls the maximum width of the page content.
   * - contained: centered content with max-w-7xl (default)
   * - full: content spans available width
   * - narrow: centered content with max-w-4xl (for forms, settings)
   */
  width?: 'contained' | 'full' | 'narrow';
  /** Additional className for the container */
  className?: string;
}

/**
 * PageContainer - Standardized page content wrapper
 * 
 * Use this component to wrap page content for consistent padding and width.
 * This ensures all pages follow the same layout rules.
 * 
 * @example
 * // Default contained width
 * <PageContainer>
 *   <h1>Dashboard</h1>
 *   ...
 * </PageContainer>
 * 
 * @example
 * // Full width for tables/calendars
 * <PageContainer width="full">
 *   <DataTable ... />
 * </PageContainer>
 * 
 * @example
 * // Narrow width for forms
 * <PageContainer width="narrow">
 *   <SettingsForm />
 * </PageContainer>
 */
const PageContainer = ({ 
  children, 
  width = 'contained',
  className 
}: PageContainerProps) => {
  return (
    <div
      className={cn(
        'w-full animate-fade-in',
        width === 'contained' && 'max-w-7xl mx-auto',
        width === 'narrow' && 'max-w-4xl mx-auto',
        // full width has no max-width constraint
        className
      )}
    >
      {children}
    </div>
  );
};

export default PageContainer;
