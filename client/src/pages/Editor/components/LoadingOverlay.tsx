import { useTranslation } from 'react-i18next';

interface LoadingOverlayProps {
  visible: boolean;
}

export default function LoadingOverlay({ visible }: LoadingOverlayProps) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-[#0b1215]/80">
      <div className="flex flex-col items-center gap-3">
        <i className="fas fa-spinner fa-spin text-3xl text-[#088d95]"></i>
        <span className="text-gray-400">{t('loading')}</span>
      </div>
    </div>
  );
}
