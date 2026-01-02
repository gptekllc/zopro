import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface UseUndoableDeleteOptions {
  /** Time in milliseconds before the delete is executed (default: 5000) */
  timeout?: number;
  /** Label for the item type (e.g., "job", "quote", "invoice") */
  itemLabel: string;
}

export function useUndoableDelete(
  deleteFn: (id: string) => Promise<void>,
  options: UseUndoableDeleteOptions
) {
  const { timeout = 5000, itemLabel } = options;
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const scheduleDelete = useCallback(
    (itemId: string) => {
      // Mark as pending (will be hidden from UI)
      setPendingDeleteIds(prev => new Set(prev).add(itemId));

      // Clear any existing timeout for this item
      const existingTimeout = timeoutsRef.current.get(itemId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Schedule the actual delete
      const timeoutId = setTimeout(async () => {
        timeoutsRef.current.delete(itemId);
        try {
          await deleteFn(itemId);
          // Remove from pending after successful delete
          setPendingDeleteIds(prev => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
        } catch (error) {
          // Restore on error
          setPendingDeleteIds(prev => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
          toast.error(`Failed to delete ${itemLabel}`);
        }
      }, timeout);

      timeoutsRef.current.set(itemId, timeoutId);

      // Show toast with undo option
      const capitalizedLabel = itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1);
      toast(`${capitalizedLabel} deleted`, {
        description: 'Click undo to restore',
        action: {
          label: 'Undo',
          onClick: () => {
            const pending = timeoutsRef.current.get(itemId);
            if (pending) {
              clearTimeout(pending);
              timeoutsRef.current.delete(itemId);
              setPendingDeleteIds(prev => {
                const next = new Set(prev);
                next.delete(itemId);
                return next;
              });
              toast.success(`${capitalizedLabel} restored`);
            }
          },
        },
        duration: timeout,
      });
    },
    [deleteFn, itemLabel, timeout]
  );

  const cancelDelete = useCallback((itemId: string) => {
    const pending = timeoutsRef.current.get(itemId);
    if (pending) {
      clearTimeout(pending);
      timeoutsRef.current.delete(itemId);
      setPendingDeleteIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }, []);

  const isPending = useCallback((itemId: string) => {
    return pendingDeleteIds.has(itemId);
  }, [pendingDeleteIds]);

  // Filter function to exclude pending deletes from a list
  const filterPendingDeletes = useCallback(<T extends { id: string }>(items: T[]) => {
    return items.filter(item => !pendingDeleteIds.has(item.id));
  }, [pendingDeleteIds]);

  return { scheduleDelete, cancelDelete, isPending, filterPendingDeletes, pendingDeleteIds };
}
