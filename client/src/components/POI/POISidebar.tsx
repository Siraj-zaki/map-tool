import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { POI } from '../../api';
import './POISidebar.css';

interface POISidebarProps {
  poi: POI | null;
  routeStartPoint?: [number, number];
  routeGeometry?: [number, number][]; // Full route coordinates
  onClose: () => void;
}

// Haversine formula to calculate distance between two points in km
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Calculate distance ALONG the route from start point to where POI is located (in meters)
// This finds the closest point on the route to the POI, then calculates the route distance from start to that point
function calculateDistanceAlongRoute(
  poiLngLat: [number, number],
  routeGeometry: [number, number][]
): number {
  if (!routeGeometry || routeGeometry.length < 2) return -1;

  const poiLat = poiLngLat[1];
  const poiLng = poiLngLat[0];

  // Find the index of the closest route point to the POI
  let minDistance = Infinity;
  let closestIndex = 0;

  for (let i = 0; i < routeGeometry.length; i++) {
    const point = routeGeometry[i];
    const distance = haversineDistance(poiLat, poiLng, point[1], point[0]);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = i;
    }
  }

  // Calculate the cumulative distance along the route from start to the closest point
  let totalDistance = 0;
  for (let i = 1; i <= closestIndex; i++) {
    const prevPoint = routeGeometry[i - 1];
    const currPoint = routeGeometry[i];
    totalDistance += haversineDistance(
      prevPoint[1],
      prevPoint[0],
      currPoint[1],
      currPoint[0]
    );
  }

  return Math.round(totalDistance * 1000); // Return in meters
}

export default function POISidebar({
  poi,
  routeStartPoint: _routeStartPoint,
  routeGeometry,
  onClose,
}: POISidebarProps) {
  const { t } = useTranslation();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<
    'overview' | 'facilities'
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

              {/* Distance to Route */}
              {routeGeometry && routeGeometry.length > 0 && poi.lngLat && (
                <div
                  className="poi-info-item"
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    // background: 'rgba(8, 141, 149, 0.1)',
                    borderRadius: '0.375rem',
                    border: '0.0625rem solid rgba(8, 141, 149, 0.3)',
                  }}
                >
                  <i
                    className="fas fa-route"
                    style={{ color: '#088d95', marginRight: '0.5rem' }}
                  ></i>
                  <span>{t('distanceFromStart')}:</span>
                  <span
                    style={{
                      color: '#088d95',
                      fontWeight: 600,
                      marginLeft: '0.375rem',
                    }}
                  >
                    {(() => {
                      const distanceMeters = calculateDistanceAlongRoute(
                        poi.lngLat,
                        routeGeometry
                      );
                      if (distanceMeters < 0) return t('unknown');
                      if (distanceMeters < 1000) return `${distanceMeters} m`;
                      return `${(distanceMeters / 1000).toFixed(1)} km`;
                    })()}
                  </span>
                </div>
              )}

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
          </div>
        </div>
      </div>
    </div>
  );
}
