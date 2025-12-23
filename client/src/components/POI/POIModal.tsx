import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface POIData {
  name: string;
  description: string;
  type: 'hotel' | 'restaurant' | 'gipfel' | 'highlight' | '';
  amenities: string[];
  bestTime: string;
  images: string[];
  lngLat: [number, number];
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
  const [type, setType] = useState<POIData['type']>(editingPoi?.type || '');
  const [amenities, setAmenities] = useState<string[]>(
    editingPoi?.amenities || []
  );
  const [bestTime, setBestTime] = useState(editingPoi?.bestTime || '');
  const [imagePreviews, setImagePreviews] = useState<string[]>(
    editingPoi?.images || []
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const poiTypes = [
    { value: 'hotel', labelKey: 'hotel' },
    { value: 'restaurant', labelKey: 'restaurant' },
    { value: 'gipfel', labelKey: 'gipfel' },
    { value: 'highlight', labelKey: 'highlight' },
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

          {/* POI Type */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              {t('poiType')} *
            </label>
            <select
              value={type}
              onChange={e => setType(e.target.value as POIData['type'])}
              className="w-full px-4 py-2.5 bg-[#080e11] border border-[#1e2a33] rounded-lg text-white focus:border-[#088d95] focus:outline-none"
            >
              <option value="">{t('pleaseSelect')}</option>
              {poiTypes.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>

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

export type { POIData };
