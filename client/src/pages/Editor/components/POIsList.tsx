import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  POI_CATEGORIES,
  getCategoryOrFallback,
  type PoiCategoryId,
} from '../../../constants/poiCategories';

interface POIsListProps {
  pois: any[];
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  /**
   * Optional — when provided, rows become draggable to reorder the parent's
   * POI array. Indices refer to positions in the *full* pois array, not
   * the currently filtered view.
   */
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

type FilterState = PoiCategoryId | 'all';

export default function POIsList({
  pois,
  onEdit,
  onRemove,
  onReorder,
}: POIsListProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterState>('all');
  const [search, setSearch] = useState('');
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Pre-compute per-category counts once per render. Legacy types are
  // resolved through the registry, so an old 'gipfel' POI counts under
  // 'summit' — matching how it renders on the map.
  const countsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of pois) {
      const id = getCategoryOrFallback(p.type).id;
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [pois]);

  // Categories that actually have a POI — used to render only the relevant
  // filter chips so the toolbar doesn't overflow with empty ones.
  const activeCategories = useMemo(
    () => POI_CATEGORIES.filter(c => (countsByCategory.get(c.id) ?? 0) > 0),
    [countsByCategory]
  );

  // Filter pipeline: category (canonical id) → search text.
  const filteredIndices = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const result: number[] = [];
    pois.forEach((p, idx) => {
      if (filter !== 'all') {
        const id = getCategoryOrFallback(p.type).id;
        if (id !== filter) return;
      }
      if (needle && !(p.name ?? '').toLowerCase().includes(needle)) return;
      result.push(idx);
    });
    return result;
  }, [pois, filter, search]);

  if (pois.length === 0) return null;

  // Only show controls when they're worth their pixels — filters when
  // there's more than one category, search once the list is long enough
  // to skim.
  const showFilters = activeCategories.length > 1;
  const showSearch = pois.length > 4;

  return (
    <div className="bg-[#0b1215] border border-[#1e2a33] rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[#088d95] text-xs uppercase font-semibold">
          {t('poisSectionTitle') || 'Points of Interest'} ({pois.length})
        </h4>
        {filter !== 'all' && (
          <button
            onClick={() => setFilter('all')}
            className="text-[0.65rem] text-gray-400 hover:text-white uppercase tracking-wide"
          >
            {t('clearFilter') || 'Clear'}
          </button>
        )}
      </div>

      {/* Filter chips */}
      {showFilters && (
        <div className="flex flex-wrap gap-1 mb-2">
          <FilterChip
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label={t('all') || 'All'}
            count={pois.length}
          />
          {activeCategories.map(cat => (
            <FilterChip
              key={cat.id}
              active={filter === cat.id}
              onClick={() => setFilter(cat.id)}
              label={t(cat.labelKey)}
              count={countsByCategory.get(cat.id) ?? 0}
              color={cat.color}
              icon={cat.faIcon}
            />
          ))}
        </div>
      )}

      {/* Search */}
      {showSearch && (
        <div className="relative mb-2">
          <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder={t('searchPois') || 'Search POIs…'}
            className="w-full pl-7 pr-7 py-1.5 bg-[#080e11] border border-[#1e2a33] rounded text-xs text-white placeholder-gray-500 focus:border-[#088d95] focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
              title={t('clear') || 'Clear'}
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* List */}
      {filteredIndices.length === 0 ? (
        <p className="text-xs text-gray-500 py-4 text-center">
          {t('noPoisMatch') || 'No POIs match the current filter.'}
        </p>
      ) : (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {filteredIndices.map(idx => {
            const poi = pois[idx];
            const category = getCategoryOrFallback(poi.type);
            const isDragging = draggingIndex === idx;
            const isDropTarget =
              onReorder != null &&
              draggingIndex !== null &&
              dragOverIndex === idx &&
              draggingIndex !== idx;

            return (
              <div
                key={idx}
                draggable={onReorder != null}
                onDragStart={e => {
                  if (!onReorder) return;
                  setDraggingIndex(idx);
                  // dataTransfer is required for Firefox to fire drag events
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(idx));
                }}
                onDragOver={e => {
                  if (!onReorder || draggingIndex === null || draggingIndex === idx) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverIndex !== idx) setDragOverIndex(idx);
                }}
                onDragLeave={() => {
                  if (dragOverIndex === idx) setDragOverIndex(null);
                }}
                onDrop={e => {
                  if (!onReorder || draggingIndex === null) return;
                  e.preventDefault();
                  if (draggingIndex !== idx) onReorder(draggingIndex, idx);
                  setDraggingIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDraggingIndex(null);
                  setDragOverIndex(null);
                }}
                className={`flex justify-between items-center py-1.5 px-2 bg-[#080e11] rounded border-l-2 border border-[#1e2a33] transition-all ${
                  isDragging ? 'opacity-40' : ''
                } ${isDropTarget ? 'ring-1 ring-[#088d95]' : ''} ${
                  onReorder ? 'cursor-move' : ''
                }`}
                style={{ borderLeftColor: category.color }}
              >
                <span className="text-sm text-white flex items-center gap-2 truncate min-w-0">
                  {onReorder && (
                    <i
                      className="fas fa-grip-vertical text-gray-600 text-xs shrink-0"
                      title={t('dragToReorder') || 'Drag to reorder'}
                    ></i>
                  )}
                  <i
                    className={`fas ${category.faIcon} shrink-0`}
                    style={{ color: category.color }}
                  ></i>
                  <span className="truncate">{poi.name}</span>
                </span>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => onEdit(idx)}
                    className="text-gray-400 hover:text-white px-1"
                    title={t('edit') || 'Edit'}
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button
                    onClick={() => onRemove(idx)}
                    className="text-red-400 hover:text-red-300 px-1"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color?: string;
  icon?: string;
}

function FilterChip({ active, onClick, label, count, color, icon }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[0.68rem] border transition-all ${
        active
          ? 'text-white'
          : 'text-gray-400 border-[#1e2a33] hover:text-white hover:border-[#088d95]/50'
      }`}
      style={
        active
          ? {
              background: color ? `${color}20` : 'rgba(8,141,149,0.15)',
              borderColor: color ?? '#088d95',
            }
          : undefined
      }
    >
      {icon && (
        <i
          className={`fas ${icon}`}
          style={{ color: active && color ? color : undefined, fontSize: '0.65rem' }}
        />
      )}
      {label}
      <span
        className="px-1 py-[1px] rounded-full text-[0.6rem] leading-none font-semibold"
        style={{
          background: active
            ? color ?? '#088d95'
            : 'rgba(255,255,255,0.06)',
          color: active ? 'white' : '#9ca3af',
        }}
      >
        {count}
      </span>
    </button>
  );
}
