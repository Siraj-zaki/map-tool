import { useTranslation } from 'react-i18next';
import './PremiumModal.css';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}

export default function PremiumModal({
  isOpen,
  onClose,
  featureName = 'GPX Download',
}: PremiumModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="premium-modal-overlay" onClick={onClose}>
      <div className="premium-modal" onClick={e => e.stopPropagation()}>
        {/* Close Button */}
        <button className="premium-modal-close" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>

        {/* Premium Icon */}
        <div className="premium-icon">
          <i className="fas fa-crown"></i>
        </div>

        {/* Title */}
        <h2 className="premium-title">
          {t('premiumFeature', 'Premium Feature')}
        </h2>

        {/* Feature Name */}
        <p className="premium-feature-name">{featureName}</p>

        {/* Description */}
        <p className="premium-description">
          {t(
            'premiumDescription',
            'This feature requires a premium subscription to access. Upgrade your account to unlock all features including GPX downloads, offline maps, and more.'
          )}
        </p>

        {/* Benefits List */}
        <div className="premium-benefits">
          <div className="benefit-item">
            <i className="fas fa-download"></i>
            <span>{t('benefitGpx', 'GPX Route Downloads')}</span>
          </div>
          <div className="benefit-item">
            <i className="fas fa-map"></i>
            <span>{t('benefitOffline', 'Offline Map Access')}</span>
          </div>
          <div className="benefit-item">
            <i className="fas fa-route"></i>
            <span>{t('benefitRoutes', 'Unlimited Route Storage')}</span>
          </div>
          <div className="benefit-item">
            <i className="fas fa-star"></i>
            <span>{t('benefitPriority', 'Priority Support')}</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="premium-actions">
          <button className="premium-btn primary">
            <i className="fas fa-crown"></i>
            {t('upgradePremium', 'Upgrade to Premium')}
          </button>
          <button className="premium-btn secondary" onClick={onClose}>
            {t('maybeLater', 'Maybe Later')}
          </button>
        </div>

        {/* Login Link */}
        <p className="premium-login">
          {t('alreadyPremium', 'Already have premium?')}{' '}
          <a href="/login" className="login-link">
            {t('loginHere', 'Login here')}
          </a>
        </p>
      </div>
    </div>
  );
}
