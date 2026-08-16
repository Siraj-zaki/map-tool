import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  POI_CATEGORIES,
  getCategory,
  getCategoryOrFallback,
  type PoiCategoryId,
  type PoiFieldSpec,
} from '../../constants/poiCategories';

interface POIData {
  name: string;
  description: string;
  /**
   * Category id from the central registry. Empty string represents "not yet
   * selected" so save-time validation can reject it.
   */
  type: PoiCategoryId | '';
  amenities: string[];
  bestTime: string;
  images: string[];
  lngLat: [number, number];
  /** Category-specific fields keyed by PoiFieldSpec.key. */
  metadata?: Record<string, unknown> | null;
}

interface POIModalProps {
  isOpen: boolean;
  lngLat: [number, number];
  onSave: (poi: POIData) => void;
  onClose: () => void;
  editingPoi?: POIData | null;
}

export default function POIModal({
  isOpen,
  lngLat,
  onSave,
  onClose,
  editingPoi,
}: POIModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(editingPoi?.name || '');
  const [description, setDescription] = useState(editingPoi?.description || '');
  // Normalize legacy alias values (e.g. 'gipfel') to their current canonical
  // id so the picker shows the right selected chip.
  const initialType: POIData['type'] = editingPoi?.type
    ? (getCategoryOrFallback(editingPoi.type).id as PoiCategoryId)
    : '';
  const [type, setType] = useState<POIData['type']>(initialType);
  const [amenities, setAmenities] = useState<string[]>(
    editingPoi?.amenities || []
  );
  const [bestTime, setBestTime] = useState(editingPoi?.bestTime || '');
  const [imagePreviews, setImagePreviews] = useState<string[]>(
    editingPoi?.images || []
  );
  const [metadata, setMetadata] = useState<Record<string, unknown>>(
    (editingPoi?.metadata as Record<string, unknown> | null) ?? {}
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeCategory = type ? getCategory(type) : null;
  const activeFields: PoiFieldSpec[] = activeCategory?.fields ?? [];

  const updateMetadataField = (key: string, value: unknown) => {
    setMetadata(prev => {
      const next = { ...prev };
      if (value === '' || value === undefined || value === null) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  // Define options with translation keys
  const amenityOptions = [
    { value: 'wc', labelKey: 'toilet', icon: 'fa-restroom', emoji: '🚻' },
    { value: 'food', labelKey: 'food', icon: 'fa-utensils', emoji: '🍽️' },
    {
      value: 'charging',
      labelKey: 'chargingStation',
      icon: 'fa-charging-station',
      emoji: '⚡',
    },
    {
      value: 'difficulty',
      labelKey: 'difficulty',
      icon: 'fa-mountain',
      emoji: '🏔️',
    },
  ];

  const bestTimeOptions = [
    { value: 'morning', labelKey: 'morning' },
    { value: 'noon', labelKey: 'noon' },
    { value: 'afternoon', labelKey: 'afternoon' },
    { value: 'evening', labelKey: 'evening' },
    { value: 'allday', labelKey: 'allday' },
  ];

  if (!isOpen) return null;

  const handleAmenityChange = (value: string) => {
    setAmenities(prev =>
      prev.includes(value) ? prev.filter(a => a !== value) : [...prev, value]
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        if (ev.target?.result) {
          setImagePreviews(prev => [...prev, ev.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert(t('pleaseEnterName'));
      return;
    }
    if (!type) {
      alert(t('pleaseSelectPoiType'));
      return;
    }

    onSave({
      name,
      description,
      type,
      amenities,
      bestTime,
      images: imagePreviews,
      lngLat,
      metadata: Object.keys(metadata).length ? metadata : null,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[2000] p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#0b1215] border border-[#1e2a33] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2a33]">
          <h2 className="text-[#088d95] text-lg font-semibold">
            {editingPoi ? t('editPoi') : t('addPoi')}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#1e2a33] rounded-lg transition-all"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              {t('poiName')} *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              placeholder={t('poiNamePlaceholder')}
              className="w-full px-4 py-2.5 bg-[#080e11] border border-[#1e2a33] rounded-lg text-white placeholder-gray-500 focus:border-[#088d95] focus:outline-none"
            />
          </div>

          {/* Images */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              {t('poiImages')}
            </label>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/png, image/jpeg, image/jpg"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[#1e2a33] text-gray-400 hover:text-white hover:border-[#088d95] rounded-lg transition-all"
            >
              <i className="fas fa-upload"></i>
              {t('selectImages')}
            </button>

            {/* Image Previews */}
            {imagePreviews.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {imagePreviews.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative w-20 h-20 rounded-lg overflow-hidden"
                  >
                    <img
                      src={src}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Amenities */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              {t('amenitiesAndFeatures')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {amenityOptions.map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                    amenities.includes(opt.value)
                      ? 'bg-[#088d95]/20 border-[#088d95] text-white'
                      : 'bg-[#080e11] border-[#1e2a33] text-gray-400 hover:border-[#088d95]/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={amenities.includes(opt.value)}
                    onChange={() => handleAmenityChange(opt.value)}
                    className="sr-only"
                  />
                  <span>
                    {opt.emoji} {t(opt.labelKey)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              {t('shortDescription')}
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              placeholder={t('shortDescriptionPlaceholder')}
              rows={3}
              className="w-full px-4 py-2.5 bg-[#080e11] border border-[#1e2a33] rounded-lg text-white placeholder-gray-500 focus:border-[#088d95] focus:outline-none resize-none"
            />
          </div>

          {/* Best Time */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              {t('bestVisitTime')}
            </label>
            <select
              value={bestTime}
              onChange={e => setBestTime(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#080e11] border border-[#1e2a33] rounded-lg text-white focus:border-[#088d95] focus:outline-none"
            >
              <option value="">{t('pleaseSelect')}</option>
              {bestTimeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {/* POI Type — icon grid picker */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              {t('poiType')} *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {POI_CATEGORIES.map(cat => {
                const selected = type === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setType(cat.id)}
                    title={t(cat.labelKey)}
                    className={`group flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition-all ${
                      selected
                        ? 'border-white/70 bg-white/[0.04] shadow-lg'
                        : 'border-[#1e2a33] bg-[#080e11] hover:border-white/30'
                    }`}
                    style={
                      selected
                        ? { boxShadow: `0 0 0 2px ${cat.color}55 inset` }
                        : undefined
                    }
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center border-2 border-white/90 shadow-sm"
                      style={{ background: cat.color }}
                    >
                      <i
                        className={`fas ${cat.faIcon} text-white text-sm`}
                      ></i>
                    </div>
                    <span
                      className={`text-[0.7rem] leading-tight text-center transition-colors ${
                        selected ? 'text-white' : 'text-gray-400 group-hover:text-white'
                      }`}
                    >
                      {t(cat.labelKey)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category-specific fields */}
          {activeFields.length > 0 && (
            <div className="pt-2 border-t border-[#1e2a33]">
              <label className="block text-gray-400 text-xs uppercase tracking-wider mb-3">
                {t('detailsSection') || 'Details'}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {activeFields.map(field => (
                  <MetaFieldInput
                    key={field.key}
                    field={field}
                    value={metadata[field.key]}
                    onChange={v => updateMetadataField(field.key, v)}
                    t={t}
                    accent={activeCategory?.color ?? '#088d95'}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Coordinates (readonly) */}
          <div className="p-3 bg-[#080e11] rounded-lg text-sm text-gray-500">
            <i className="fas fa-map-marker-alt mr-2 text-[#088d95]"></i>
            {t('coordinates')}: {parseFloat(String(lngLat[0])).toFixed(5)},{' '}
            {parseFloat(String(lngLat[1])).toFixed(5)}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-[#1e2a33]">
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#088d95] hover:bg-[#0da6ae] text-white rounded-lg font-medium transition-all"
          >
            <i className="fas fa-save"></i>
            {t('save')}
          </button>
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg font-medium transition-all"
          >
            <i className="fas fa-times"></i>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface MetaFieldInputProps {
  field: PoiFieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
  t: (key: string) => string;
  accent: string;
}

/**
 * Renders a single category-specific field. Each kind maps to a different
 * control (text/number/url/phone/select/bool). Layout intentionally spans
 * one grid cell by default; `col-span-2` for controls that need more room.
 */
function MetaFieldInput({ field, value, onChange, t, accent }: MetaFieldInputProps) {
  const label = (
    <label className="flex items-center gap-1.5 text-gray-400 text-xs mb-1.5">
      {field.icon && (
        <i className={`fas ${field.icon}`} style={{ color: accent, fontSize: '0.75rem' }} />
      )}
      {t(field.labelKey)}
    </label>
  );

  const baseInputClass =
    'w-full px-3 py-2 bg-[#080e11] border border-[#1e2a33] rounded-lg text-white placeholder-gray-500 focus:border-[#088d95] focus:outline-none text-sm';

  switch (field.kind) {
    case 'text':
      return (
        <div>
          {label}
          <input
            type="text"
            value={typeof value === 'string' ? value : ''}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder={field.placeholder}
            className={baseInputClass}
          />
        </div>
      );

    case 'number':
      return (
        <div>
          {label}
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={typeof value === 'number' ? value : ''}
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              onChange={e => {
                const raw = e.target.value;
                onChange(raw === '' ? '' : Number(raw));
              }}
              onKeyDown={e => e.stopPropagation()}
              className={baseInputClass}
            />
            {field.unit && (
              <span className="text-gray-500 text-sm shrink-0">{field.unit}</span>
            )}
          </div>
        </div>
      );

    case 'url':
      return (
        <div className="col-span-2">
          {label}
          <input
            type="url"
            value={typeof value === 'string' ? value : ''}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder="https://…"
            className={baseInputClass}
          />
        </div>
      );

    case 'phone':
      return (
        <div>
          {label}
          <input
            type="tel"
            value={typeof value === 'string' ? value : ''}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder="+49 …"
            className={baseInputClass}
          />
        </div>
      );

    case 'select':
      return (
        <div>
          {label}
          <select
            value={typeof value === 'string' ? value : ''}
            onChange={e => onChange(e.target.value)}
            className={baseInputClass}
          >
            <option value="">—</option>
            {field.options.map(opt => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>
      );

    case 'bool': {
      const checked = value === true;
      return (
        <label
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
            checked
              ? 'bg-[#088d95]/15 border-[#088d95] text-white'
              : 'bg-[#080e11] border-[#1e2a33] text-gray-400 hover:border-[#088d95]/50'
          }`}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={e => onChange(e.target.checked)}
            className="sr-only"
          />
          {field.icon && (
            <i className={`fas ${field.icon} text-xs`} style={{ color: checked ? accent : undefined }} />
          )}
          <span className="text-xs">{t(field.labelKey)}</span>
        </label>
      );
    }
  }
}

export type { POIData };
