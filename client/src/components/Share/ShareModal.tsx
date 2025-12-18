import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ShareModalProps {
  routeId: number;
  routeName: string;
  onClose: () => void;
}

export default function ShareModal({
  routeId,
  routeName,
  onClose,
}: ShareModalProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);

  const baseUrl = window.location.origin;

  const urls = {
    public: `${baseUrl}/route/${routeId}`,
    embed: `${baseUrl}/embed?route=${routeId}`,
    embedEN: `${baseUrl}/embed?route=${routeId}&lang=en`,
    embedDE: `${baseUrl}/embed?route=${routeId}&lang=de`,
    iframe: `<iframe src="${baseUrl}/embed?route=${routeId}" width="100%" height="600" frameborder="0" style="border-radius: 8px;"></iframe>`,
    iframeEN: `<iframe src="${baseUrl}/embed?route=${routeId}&lang=en" width="100%" height="600" frameborder="0" style="border-radius: 8px;"></iframe>`,
    iframeDE: `<iframe src="${baseUrl}/embed?route=${routeId}&lang=de" width="100%" height="600" frameborder="0" style="border-radius: 8px;"></iframe>`,
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0b1215] border border-[#1e2a33] rounded-xl w-full max-w-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2a33]">
          <h3 className="flex items-center gap-3 text-lg font-semibold text-white">
            <i className="fas fa-share-alt text-[#088d95]"></i>
            {t('shareRoute')}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#1e2a33] rounded-lg transition-all"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div className="text-gray-400 text-sm">
            {t('route')}:{' '}
            <span className="text-white font-medium">{routeName}</span>
          </div>

          {/* Public Link */}
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <i className="fas fa-link text-[#088d95]"></i>
              {t('publicLink')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={urls.public}
                readOnly
                className="flex-1 px-4 py-2.5 bg-[#080e11] border border-[#1e2a33] rounded-lg text-white text-sm focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(urls.public, 'public')}
                className={`px-4 py-2.5 rounded-lg font-medium transition-all ${
                  copied === 'public'
                    ? 'bg-green-500 text-white'
                    : 'bg-[#1e2a33] text-gray-300 hover:bg-[#2a3a47]'
                }`}
              >
                {copied === 'public' ? (
                  <i className="fas fa-check"></i>
                ) : (
                  <i className="fas fa-copy"></i>
                )}
              </button>
            </div>
          </div>

          {/* Embed URL EN */}
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <i className="fas fa-external-link-alt text-[#088d95]"></i>
              {t('embedUrlEN')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={urls.embedEN}
                readOnly
                className="flex-1 px-4 py-2.5 bg-[#080e11] border border-[#1e2a33] rounded-lg text-white text-sm focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(urls.embedEN, 'embedEN')}
                className={`px-4 py-2.5 rounded-lg font-medium transition-all ${
                  copied === 'embedEN'
                    ? 'bg-green-500 text-white'
                    : 'bg-[#1e2a33] text-gray-300 hover:bg-[#2a3a47]'
                }`}
              >
                {copied === 'embedEN' ? (
                  <i className="fas fa-check"></i>
                ) : (
                  <i className="fas fa-copy"></i>
                )}
              </button>
            </div>
          </div>

          {/* Embed URL DE */}
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <i className="fas fa-external-link-alt text-[#088d95]"></i>
              {t('embedUrlDE')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={urls.embedDE}
                readOnly
                className="flex-1 px-4 py-2.5 bg-[#080e11] border border-[#1e2a33] rounded-lg text-white text-sm focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(urls.embedDE, 'embedDE')}
                className={`px-4 py-2.5 rounded-lg font-medium transition-all ${
                  copied === 'embedDE'
                    ? 'bg-green-500 text-white'
                    : 'bg-[#1e2a33] text-gray-300 hover:bg-[#2a3a47]'
                }`}
              >
                {copied === 'embedDE' ? (
                  <i className="fas fa-check"></i>
                ) : (
                  <i className="fas fa-copy"></i>
                )}
              </button>
            </div>
          </div>

          {/* iFrame Code */}
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <i className="fas fa-code text-[#088d95]"></i>
              {t('iframeEmbedCode')}
            </label>
            <textarea
              value={urls.iframe}
              readOnly
              rows={3}
              className="w-full px-4 py-2.5 bg-[#080e11] border border-[#1e2a33] rounded-lg text-white text-xs font-mono focus:outline-none resize-none"
            />
            <button
              onClick={() => copyToClipboard(urls.iframe, 'iframe')}
              className={`w-full mt-2 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                copied === 'iframe'
                  ? 'bg-green-500 text-white'
                  : 'bg-[#088d95] hover:bg-[#0da6ae] text-white'
              }`}
            >
              {copied === 'iframe' ? (
                <>
                  <i className="fas fa-check"></i> {t('copied')}
                </>
              ) : (
                <>
                  <i className="fas fa-copy"></i> {t('copyCode')}
                </>
              )}
            </button>
          </div>

          {/* Instructions */}
          <div className="bg-[#088d95]/10 border border-[#088d95]/30 rounded-lg p-4">
            <h4 className="flex items-center gap-2 text-[#088d95] font-medium mb-3">
              <i className="fas fa-info-circle"></i>
              {t('shopifyEmbedding')}
            </h4>
            <ol className="text-sm text-gray-400 space-y-1.5 list-decimal list-inside">
              <li>{t('shopifyStep1')}</li>
              <li>{t('shopifyStep2')}</li>
              <li>{t('shopifyStep3')}</li>
              <li>{t('shopifyStep4')}</li>
              <li>{t('shopifyStep5')}</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
