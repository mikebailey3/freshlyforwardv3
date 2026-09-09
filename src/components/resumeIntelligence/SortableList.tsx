import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

/**
 * Phase 5 — one generic, pointer- AND keyboard-accessible sortable list,
 * reused for both section ordering and entry ordering (DRY: two nearly-
 * identical components would just be one component with two call sites).
 * `@dnd-kit` (MIT) is the only new drag-and-drop dependency this program
 * adds -- see the master plan's OSS decision table.
 *
 * Persisted order lives in the caller's state/DB via `onReorder`, which
 * receives the full reordered id list every time -- never only DOM order.
 * `KeyboardSensor` with `sortableKeyboardCoordinates` makes every list
 * here keyboard-operable (Tab to an item, Space to pick up, arrow keys to
 * move, Space to drop) without any extra code at each call site.
 */

export interface SortableListItem {
  id: string
  label: string
}

interface SortableRowProps {
  item: SortableListItem
}

function SortableRow({ item }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
      data-testid={`sortable-row-${item.id}`}
    >
      <button
        type="button"
        aria-label={`Reorder ${item.label}`}
        className="cursor-grab touch-none text-slate-400 hover:text-slate-600"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <span>{item.label}</span>
    </li>
  )
}

export function SortableList({ items, onReorder }: { items: SortableListItem[]; onReorder: (orderedIds: string[]) => void }) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(items, oldIndex, newIndex).map((i) => i.id))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <SortableRow key={item.id} item={item} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
