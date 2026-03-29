import { useTranslation } from 'react-i18next';
import './PremiumModal.css';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PremiumModal({ isOpen, onClose }: PremiumModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="premium-modal-overlay" onClick={onClose}>
      <div className="premium-modal" onClick={e => e.stopPropagation()}>
        {/* Close Button */}
        <button className="premium-modal-close" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>

        {/* GPS Icon */}
        <div className="premium-icon">
          <i className="fas fa-map-marked-alt"></i>
        </div>

        {/* Title */}
        <h2 className="premium-title">
          {t('gpsDataAndAppFeatures', 'GPS data & app features')}
        </h2>

        {/* Description */}
        <p className="premium-description">
          {t(
            'gpsModalDescription',
            'This map lets you explore the full route in detail. The GPS download is included with the purchase of the tour and will be sent to you by email after checkout.'
          )}
        </p>

        {/* After Purchase Benefits */}
        <div className="premium-benefits-section">
          <h3 className="benefits-heading">
            {t('afterPurchase', 'After purchase, you get:')}
          </h3>
          <div className="premium-benefits">
            <div className="benefit-item">
              <i className="fas fa-file-download"></i>
              <span>
                {t(
                  'benefitFullGps',
                  'The complete GPS file for the entire route via email'
                )}
              </span>
            </div>
            <div className="benefit-item">
              <i className="fas fa-unlock-alt"></i>
              <span>
                {t('benefitFullAccess', 'Full access to all tour details')}
              </span>
            </div>
          </div>
        </div>

        {/* App-only Features */}
        <div className="premium-benefits-section app-features">
          <h3 className="benefits-heading">
            <i className="fas fa-mobile-alt"></i>
            {t('appOnlyFeatures', 'App-only features:')}
          </h3>
          <div className="premium-benefits">
            <div className="benefit-item">
              <i className="fas fa-layer-group"></i>
              <span>
                {t('benefitStageGps', 'Individual GPS files for each stage')}
              </span>
              <span className="coming-soon-badge">{t('comingSoon', 'Coming Soon')}</span>
            </div>
            <div className="benefit-item">
              <i className="fas fa-cloud-download-alt"></i>
              <span>
                {t(
                  'benefitEasyDownload',
                  'Easy stage-by-stage downloads inside the app'
                )}
              </span>
              <span className="coming-soon-badge">{t('comingSoon', 'Coming Soon')}</span>
            </div>
            <div className="benefit-item">
              <i className="fas fa-compass"></i>
              <span>
                {t(
                  'benefitNavigation',
                  'Perfect for navigation, planning, and device sync'
                )}
              </span>
              <span className="coming-soon-badge">{t('comingSoon', 'Coming Soon')}</span>
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="premium-actions">
          <button className="premium-btn primary">
            <i className="fas fa-shopping-cart"></i>
            {t('purchaseTour', 'Purchase the tour to unlock all GPS data')}
          </button>
          <button className="premium-btn secondary app-download">
            <i className="fas fa-download"></i>
            {t('downloadApp', 'Download the app to access stage GPX files')}
          </button>
        </div>
      </div>
    </div>
  );
}
