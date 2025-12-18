import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { POI } from '../../api';
import './POISidebar.css';

interface POISidebarProps {
  poi: POI | null;
  routeStartPoint?: [number, number];
  onClose: () => void;
}

// Haversine formula to calculate distance between two points
function calculateDistance(
  point1: [number, number],
  point2: [number, number]
): number {
  const R = 6371; // Earth's radius in km
  const [lng1, lat1] = point1;
  const [lng2, lat2] = point2;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function POISidebar({
  poi,
  routeStartPoint,
  onClose,
}: POISidebarProps) {
  const { t } = useTranslation();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<
    'overview' | 'facilities' | 'location'
  >('overview');

  if (!poi) return null;

  const hasImages = poi.images && poi.images.length > 0;
  const hasMultipleImages = poi.images && poi.images.length > 1;

  const nextImage = () => {
    if (!poi.images) return;
    setCurrentImageIndex(prev => (prev + 1) % poi.images.length);
  };

  const prevImage = () => {
    if (!poi.images) return;
    setCurrentImageIndex(
      prev => (prev - 1 + poi.images.length) % poi.images.length
    );
  };

  const showImage = (index: number) => {
    setCurrentImageIndex(index);
  };

  // Helper function to get best time label
  const getBestTimeLabel = (time: string): string => {
    const timeKeys: Record<string, string> = {
      morning: 'morning',
      noon: 'noon',
      afternoon: 'afternoon',
      evening: 'evening',
      allday: 'allday',
    };
    return t(timeKeys[time] || time);
  };

  // Helper function to get amenity icon
  const getAmenityIcon = (amenity: string): string => {
    const icons: Record<string, string> = {
      food: 'fa-utensils',
      wc: 'fa-restroom',
      charging: 'fa-charging-station',
      difficulty: 'fa-mountain',
      parking: 'fa-parking',
      water: 'fa-droplet',
      shelter: 'fa-house',
      viewpoint: 'fa-binoculars',
      camping: 'fa-campground',
      wifi: 'fa-wifi',
      shower: 'fa-shower',
    };
    return icons[amenity.toLowerCase()] || 'fa-circle';
  };

  // Helper function to get amenity label
  const getAmenityLabel = (amenity: string): string => {
    const labelKeys: Record<string, string> = {
      food: 'food',
      wc: 'toilet',
      charging: 'chargingStation',
      difficulty: 'difficulty',
      parking: 'parking',
      water: 'waterSource',
      shelter: 'shelter',
      viewpoint: 'viewpoint',
      camping: 'camping',
      wifi: 'wifi',
      shower: 'shower',
    };
    return t(labelKeys[amenity.toLowerCase()] || amenity);
  };

  return (
    <div className={`poi-sidebar ${poi ? 'visible' : ''}`}>
      <div className="poi-content">
        {/* Hero Section */}
        <div className="poi-hero">
          <button className="close-button" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>

          {/* Image Carousel */}
          <div className="image-carousel">
            <div className="carousel-container">
              {hasImages ? (
                poi.images.map((img, index) => (
                  <img
                    key={index}
                    src={img}
                    alt={poi.name}
                    className="carousel-image"
                    style={{
                      display: index === currentImageIndex ? 'block' : 'none',
                    }}
                    data-index={index}
                    onError={e => {
                      e.currentTarget.src = '/api/placeholder/400/320';
                    }}
                  />
                ))
              ) : (
                <div className="carousel-placeholder">
                  <i className="fas fa-mountain"></i>
                </div>
              )}
            </div>

            {hasMultipleImages && (
              <>
                <button className="carousel-button prev" onClick={prevImage}>
                  ❮
                </button>
                <button className="carousel-button next" onClick={nextImage}>
                  ❯
                </button>
                <div className="carousel-dots">
                  {poi.images.map((_, index) => (
                    <span
                      key={index}
                      className={`dot ${
                        index === currentImageIndex ? 'active' : ''
                      }`}
                      onClick={() => showImage(index)}
                    ></span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Hero Overlay with Title */}
          <div className="poi-hero-overlay">
            <h1 className="poi-hero-title">{poi.name}</h1>
          </div>
        </div>

        {/* Category Navigation */}
        <div className="poi-category-nav">
          <div className="category-buttons">
            <button
              className={`category-btn ${
                activeCategory === 'overview' ? 'active' : ''
              }`}
              data-category="overview"
              onClick={() => setActiveCategory('overview')}
            >
              <i className="fas fa-info-circle"></i>
              <span>{t('overview')}</span>
            </button>
            <button
              className={`category-btn ${
                activeCategory === 'facilities' ? 'active' : ''
              }`}
              data-category="facilities"
              onClick={() => setActiveCategory('facilities')}
            >
              <i className="fas fa-wrench"></i>
              <span>{t('facilitiesAndService')}</span>
            </button>
            <button
              className={`category-btn ${
                activeCategory === 'location' ? 'active' : ''
              }`}
              data-category="location"
              onClick={() => setActiveCategory('location')}
            >
              <i className="fas fa-map-pin"></i>
              <span>{t('location')}</span>
            </button>
          </div>

          <div className="category-content">
            {/* Overview Panel */}
            <div
              className={`category-panel ${
                activeCategory === 'overview' ? 'active' : ''
              }`}
              id="overview-panel"
            >
              <p className="poi-description">
                {poi.description || t('noDescriptionAvailable')}
              </p>

              {poi.best_time && (
                <div className="poi-additional-info">
                  <div className="poi-info-item">
                    <i className="fas fa-clock"></i>
                    <span>
                      {t('bestVisitTime')}: {getBestTimeLabel(poi.best_time)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Facilities Panel */}
            <div
              className={`category-panel ${
                activeCategory === 'facilities' ? 'active' : ''
              }`}
              id="facilities-panel"
            >
              {poi.amenities && poi.amenities.length > 0 ? (
                <div className="poi-amenities-grid">
                  {poi.amenities.map((amenity, index) => (
                    <div key={index} className="poi-amenity-item">
                      <i className={`fas ${getAmenityIcon(amenity)}`}></i>
                      <span>{getAmenityLabel(amenity)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-facilities">{t('noFacilitiesAvailable')}</p>
              )}
            </div>

            {/* Location Panel */}
            <div
              className={`category-panel ${
                activeCategory === 'location' ? 'active' : ''
              }`}
              id="location-panel"
            >
              <div className="location-coordinates">
                <i className="fas fa-map-marker-alt"></i>
                <span>
                  {t('coordinates')}: {poi.lngLat[0].toFixed(2)},{' '}
                  {poi.lngLat[1].toFixed(2)}
                </span>
              </div>

              <div className="route-distance-info">
                <p>
                  <i className="fas fa-route"></i>
                  {t('distanceToRoute')}:{' '}
                  {routeStartPoint
                    ? calculateDistance(routeStartPoint, poi.lngLat).toFixed(1)
                    : '0.0'}{' '}
                  km
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
