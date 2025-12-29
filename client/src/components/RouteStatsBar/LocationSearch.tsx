import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import './LocationSearch.css';

interface LocationSearchProps {
  onLocationSelect: (coords: {
    lng: number;
    lat: number;
    name: string;
  }) => void;
}

interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number];
}

const MAPBOX_TOKEN =
  'pk.eyJ1IjoicHVuY2hpbmdtYW4iLCJhIjoiY2p1cjcyMmh2M3NpZDQ5bnEwMDV6ZTE1OSJ9.ef8y6l9fsKFMX91m_Rt2ng';

export default function LocationSearch({
  onLocationSelect,
}: LocationSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update dropdown position when open
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width - 38, // Account for locate button
      });
    }
  }, [isOpen, results]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Geocoding search
  const searchLocations = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          searchQuery
        )}.json?access_token=${MAPBOX_TOKEN}&limit=5&types=place,locality,neighborhood,address,poi`
      );
      const data = await response.json();

      if (data.features) {
        setResults(
          data.features.map((f: any) => ({
            id: f.id,
            place_name: f.place_name,
            center: f.center,
          }))
        );
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchLocations(value);
    }, 300);
  };

  // Handle result selection
  const handleResultClick = (result: SearchResult) => {
    setQuery(result.place_name.split(',')[0]);
    setIsOpen(false);
    setResults([]);
    onLocationSelect({
      lng: result.center[0],
      lat: result.center[1],
      name: result.place_name,
    });
  };

  // Handle current location
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert(
        t('geolocationNotSupported') ||
          'Geolocation is not supported by your browser'
      );
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        setIsLocating(false);
        setQuery('');
        onLocationSelect({
          lng: position.coords.longitude,
          lat: position.coords.latitude,
          name: t('currentLocation') || 'Current Location',
        });
      },
      error => {
        setIsLocating(false);
        console.error('Geolocation error:', error);
        alert(t('locationError') || 'Unable to get your location');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Render dropdown using Portal to escape stacking context
  const renderDropdown = () => {
    if (!isOpen || results.length === 0) return null;

    return createPortal(
      <div
        className="search-results-portal"
        style={{
          position: 'fixed',
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          width: dropdownPosition.width,
          zIndex: 99999,
        }}
      >
        {results.map(result => (
          <div
            key={result.id}
            className="search-result-item"
            onClick={() => handleResultClick(result)}
          >
            <i className="fas fa-map-marker-alt result-icon" />
            <span className="result-text">{result.place_name}</span>
          </div>
        ))}
      </div>,
      document.body
    );
  };

  return (
    <div className="location-search" ref={containerRef}>
      <div className="search-input-wrapper">
        <i className="fas fa-search search-icon" />
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={t('searchLocation') || 'Search location...'}
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setIsOpen(true)}
        />
        {isLoading && <i className="fas fa-spinner fa-spin loading-icon" />}
      </div>

      <button
        className="locate-btn"
        onClick={handleLocateMe}
        disabled={isLocating}
        title={t('myLocation') || 'My Location'}
      >
        {isLocating ? (
          <i className="fas fa-spinner fa-spin" />
        ) : (
          <i className="fas fa-crosshairs" />
        )}
      </button>

      {renderDropdown()}
    </div>
  );
}
