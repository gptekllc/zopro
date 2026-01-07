import { ReactNode, useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WidgetItem {
  id: string;
  component: ReactNode;
  visible: boolean;
}

interface DraggableWidgetContainerProps {
  widgets: WidgetItem[];
  storageKey: string;
  className?: string;
}

interface SortableWidgetProps {
  id: string;
  children: ReactNode;
}

function SortableWidget({ id, children }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group',
        isDragging && 'z-50 opacity-90'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-3 right-3 z-10 p-1.5 rounded-md bg-muted/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing hover:bg-muted"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>
      {children}
    </div>
  );
}

export function DraggableWidgetContainer({ 
  widgets, 
  storageKey,
  className 
}: DraggableWidgetContainerProps) {
  const [order, setOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return widgets.map(w => w.id);
      }
    }
    return widgets.map(w => w.id);
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Update order when widgets change (new widgets added)
  useEffect(() => {
    const widgetIds = widgets.map(w => w.id);
    const newIds = widgetIds.filter(id => !order.includes(id));
    const validOrder = order.filter(id => widgetIds.includes(id));
    if (newIds.length > 0 || validOrder.length !== order.length) {
      setOrder([...validOrder, ...newIds]);
    }
  }, [widgets, order]);

  // Save order to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(order));
  }, [order, storageKey]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Sort widgets according to saved order
  const sortedWidgets = [...widgets]
    .filter(w => w.visible)
    .sort((a, b) => {
      const aIndex = order.indexOf(a.id);
      const bIndex = order.indexOf(b.id);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sortedWidgets.map(w => w.id)} strategy={rectSortingStrategy}>
        <div className={className}>
          {sortedWidgets.map((widget) => (
            <SortableWidget key={widget.id} id={widget.id}>
              {widget.component}
            </SortableWidget>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
