import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shareLinksApi, type ShareLink, type ShareLinkExpiry } from '../../api';

interface ShareManagerProps {
  routeId: number;
  routeName: string;
  onClose: () => void;
}

/**
 * Multi-link share manager. Replaces the old static ShareModal.
 *
 * Layout:
 * - Header (route name, close button)
 * - Create-link form (expiry, optional name, optional logo URL, optional accent)
 * - List of existing links with per-link actions
 *   (copy public URL, copy iframe, edit customization, revoke/restore, delete)
 */
export default function ShareManager({
  routeId,
  routeName,
  onClose,
}: ShareManagerProps) {
  const { t } = useTranslation();
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Create-form state (reset after submit)
  const [formName, setFormName] = useState('');
  const [formExpiry, setFormExpiry] = useState<ShareLinkExpiry>('never');
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const [formPrimary, setFormPrimary] = useState('#088D95');
  const [formAccent, setFormAccent] = useState('#2dd4bf');

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await shareLinksApi.list(routeId);
      if (!res.success) throw new Error('load failed');
      setLinks(res.data);
    } catch (e) {
      console.error(e);
      setError(t('shareLoadFailed') || 'Failed to load share links');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(prev => (prev === key ? null : prev)), 1500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await shareLinksApi.create(routeId, {
        name: formName.trim() || undefined,
        expiryType: formExpiry,
        customLogoUrl: formLogoUrl.trim() || undefined,
        // Only send colors that differ from the product default — a null
        // value on the server means "inherit from global brand".
        customPrimaryColor:
          formPrimary && formPrimary.toLowerCase() !== '#088d95'
            ? formPrimary
            : undefined,
        customAccentColor:
          formAccent && formAccent.toLowerCase() !== '#2dd4bf'
            ? formAccent
            : undefined,
      });
      if (!res.success) throw new Error('create failed');
      setLinks(prev => [res.data, ...prev]);
      setFormName('');
      setFormLogoUrl('');
      setFormPrimary('#088D95');
      setFormAccent('#2dd4bf');
      setFormExpiry('never');
    } catch (e) {
      console.error(e);
      setError(t('shareCreateFailed') || 'Failed to create share link');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleRevoked = async (link: ShareLink) => {
    try {
      const res = await shareLinksApi.update(link.id, { revoked: !link.isRevoked });
      if (res.success) {
        setLinks(prev => prev.map(l => (l.id === link.id ? res.data : l)));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (link: ShareLink) => {
    if (!window.confirm(t('confirmDeleteShare') || 'Delete this share link permanently?')) {
      return;
    }
    try {
      const res = await shareLinksApi.remove(link.id);
      if (res.success) setLinks(prev => prev.filter(l => l.id !== link.id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateCustomization = async (
    link: ShareLink,
    patch: Partial<{
      name: string | null;
      customLogoUrl: string | null;
      customPrimaryColor: string | null;
      customAccentColor: string | null;
    }>
  ) => {
    try {
      const res = await shareLinksApi.update(link.id, patch);
      if (res.success) {
        setLinks(prev => prev.map(l => (l.id === link.id ? res.data : l)));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0b1215] border border-[#1e2a33] rounded-xl w-full max-w-2xl max-h-[92vh] shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2a33] shrink-0">
          <div>
            <h3 className="flex items-center gap-3 text-lg font-semibold text-white">
              <i className="fas fa-share-alt text-[#088d95]"></i>
              {t('shareLinks') || 'Share links'}
            </h3>
            <p className="text-gray-500 text-xs mt-0.5">{routeName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#1e2a33] rounded-lg transition-all"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Create form */}
          <div className="bg-[#080e11] border border-[#1e2a33] rounded-lg p-4">
            <h4 className="text-[#088d95] text-xs uppercase tracking-wider font-semibold mb-3">
              {t('createNewShareLink') || 'Create new link'}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FieldLabel icon="fa-tag" label={t('linkNameOptional') || 'Label (optional)'}>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder={t('linkNamePlaceholder') || 'e.g. Website embed'}
                  className={inputCls}
                />
              </FieldLabel>

              <FieldLabel icon="fa-hourglass-half" label={t('expiry') || 'Expiry'}>
                <select
                  value={formExpiry}
                  onChange={e => setFormExpiry(e.target.value as ShareLinkExpiry)}
                  className={inputCls}
                >
                  <option value="never">{t('expiryNever') || 'Never expires'}</option>
                  <option value="week">{t('expiryWeek') || '1 week'}</option>
                  <option value="month">{t('expiryMonth') || '1 month'}</option>
                </select>
              </FieldLabel>

              <FieldLabel
                icon="fa-image"
                label={t('customLogoUrlOptional') || 'Custom logo URL (optional)'}
              >
                <input
                  type="url"
                  value={formLogoUrl}
                  onChange={e => setFormLogoUrl(e.target.value)}
                  placeholder="https://…/logo.svg"
                  className={inputCls}
                />
              </FieldLabel>

              <FieldLabel
                icon="fa-fill-drip"
                label={t('primaryColor') || 'Primary color'}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formPrimary}
                    onChange={e => setFormPrimary(e.target.value)}
                    className="h-9 w-14 bg-transparent border border-[#1e2a33] rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formPrimary}
                    onChange={e => setFormPrimary(e.target.value)}
                    placeholder="#088D95"
                    className={`${inputCls} flex-1`}
                  />
                </div>
              </FieldLabel>

              <FieldLabel icon="fa-palette" label={t('accentColor') || 'Accent color'}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formAccent}
                    onChange={e => setFormAccent(e.target.value)}
                    className="h-9 w-14 bg-transparent border border-[#1e2a33] rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formAccent}
                    onChange={e => setFormAccent(e.target.value)}
                    placeholder="#2dd4bf"
                    className={`${inputCls} flex-1`}
                  />
                </div>
              </FieldLabel>
            </div>

            <button
              onClick={handleCreate}
              disabled={creating}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 brand-primary-bg text-white rounded-lg font-medium transition-all disabled:opacity-50"
            >
              <i className={`fas ${creating ? 'fa-spinner fa-spin' : 'fa-plus'}`}></i>
              {creating
                ? t('creating') || 'Creating…'
                : t('generateShareLink') || 'Generate share link'}
            </button>
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
              {error}
            </div>
          )}

          {/* Existing links */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[#088d95] text-xs uppercase tracking-wider font-semibold">
                {t('existingLinks') || 'Existing links'} ({links.length})
              </h4>
              <button
                onClick={load}
                className="text-gray-500 hover:text-white text-xs"
                title={t('refresh') || 'Refresh'}
              >
                <i className="fas fa-rotate"></i>
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-gray-500 text-sm">
                <i className="fas fa-spinner fa-spin mr-2"></i>
                {t('loading') || 'Loading…'}
              </div>
            ) : links.length === 0 ? (
              <p className="py-6 text-center text-gray-500 text-sm">
                {t('noShareLinksYet') || 'No share links yet. Create one above.'}
              </p>
            ) : (
              <div className="space-y-2">
                {links.map(link => (
                  <ShareLinkRow
                    key={link.id}
                    link={link}
                    baseUrl={baseUrl}
                    copiedKey={copiedKey}
                    editing={editingId === link.id}
                    onToggleEdit={() =>
                      setEditingId(prev => (prev === link.id ? null : link.id))
                    }
                    onCopy={handleCopy}
                    onToggleRevoked={() => handleToggleRevoked(link)}
                    onDelete={() => handleDelete(link)}
                    onUpdate={patch => handleUpdateCustomization(link, patch)}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const inputCls =
  'w-full px-3 py-2 bg-[#0b1215] border border-[#1e2a33] rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#088d95] focus:outline-none';

function FieldLabel({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-gray-400 text-xs mb-1.5">
        <i className={`fas ${icon} text-[#088d95] text-[0.7rem]`}></i>
        {label}
      </span>
      {children}
    </label>
  );
}

interface ShareLinkRowProps {
  link: ShareLink;
  baseUrl: string;
  copiedKey: string | null;
  editing: boolean;
  onToggleEdit: () => void;
  onCopy: (text: string, key: string) => void;
  onToggleRevoked: () => void;
  onDelete: () => void;
  onUpdate: (
    patch: Partial<{
      name: string | null;
      customLogoUrl: string | null;
      customPrimaryColor: string | null;
      customAccentColor: string | null;
    }>
  ) => void;
  t: (key: string) => string;
}

function ShareLinkRow({
  link,
  baseUrl,
  copiedKey,
  editing,
  onToggleEdit,
  onCopy,
  onToggleRevoked,
  onDelete,
  onUpdate,
  t,
}: ShareLinkRowProps) {
  const publicUrl = `${baseUrl}/s/${link.token}`;
  const embedUrl = `${baseUrl}/embed/s/${link.token}`;
  const iframeCode = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" style="border-radius: 0.5rem;"></iframe>`;

  // Local mirrors for the edit form so users can cancel changes.
  const [editName, setEditName] = useState(link.name ?? '');
  const [editLogo, setEditLogo] = useState(link.customLogoUrl ?? '');
  const [editPrimary, setEditPrimary] = useState(
    link.customPrimaryColor ?? '#088D95'
  );
  const [editAccent, setEditAccent] = useState(
    link.customAccentColor ?? '#2dd4bf'
  );

  useEffect(() => {
    // Sync form when the underlying link changes (server response).
    setEditName(link.name ?? '');
    setEditLogo(link.customLogoUrl ?? '');
    setEditPrimary(link.customPrimaryColor ?? '#088D95');
    setEditAccent(link.customAccentColor ?? '#2dd4bf');
  }, [
    link.id,
    link.name,
    link.customLogoUrl,
    link.customPrimaryColor,
    link.customAccentColor,
  ]);

  const status = useMemo(() => statusOf(link, t), [link, t]);

  return (
    <div
      className={`bg-[#080e11] border rounded-lg p-3 transition-colors ${
        link.isRevoked || link.isExpired
          ? 'border-[#1e2a33] opacity-60'
          : 'border-[#1e2a33]'
      }`}
      style={
        link.customPrimaryColor || link.customAccentColor
          ? {
              borderLeftColor:
                link.customPrimaryColor || link.customAccentColor || undefined,
              borderLeftWidth: '3px',
            }
          : undefined
      }
    >
      {/* Row header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium truncate">
              {link.name || t('unnamedLink') || 'Unnamed link'}
            </span>
            <span
              className={`text-[0.6rem] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded ${status.badgeCls}`}
            >
              {status.label}
            </span>
          </div>
          <div className="text-[0.7rem] text-gray-500 mt-0.5">
            {expiryLabel(link, t)}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <IconButton
            title={t('editCustomization') || 'Edit customization'}
            icon={editing ? 'fa-chevron-up' : 'fa-cog'}
            onClick={onToggleEdit}
          />
          <IconButton
            title={
              link.isRevoked
                ? t('restoreLink') || 'Restore'
                : t('revokeLink') || 'Revoke'
            }
            icon={link.isRevoked ? 'fa-play' : 'fa-pause'}
            onClick={onToggleRevoked}
          />
          <IconButton
            title={t('deleteLink') || 'Delete'}
            icon="fa-trash"
            danger
            onClick={onDelete}
          />
        </div>
      </div>

      {/* URL row */}
      <div className="mt-2 flex gap-2">
        <input
          value={publicUrl}
          readOnly
          className="flex-1 px-2 py-1.5 bg-[#0b1215] border border-[#1e2a33] rounded text-white text-xs focus:outline-none"
        />
        <CopyButton
          copied={copiedKey === `pub-${link.id}`}
          onClick={() => onCopy(publicUrl, `pub-${link.id}`)}
        />
      </div>

      {/* Iframe row */}
      <div className="mt-2 flex gap-2">
        <input
          value={iframeCode}
          readOnly
          className="flex-1 px-2 py-1.5 bg-[#0b1215] border border-[#1e2a33] rounded text-gray-400 text-xs font-mono focus:outline-none truncate"
        />
        <CopyButton
          label={t('iframeShort') || 'iframe'}
          copied={copiedKey === `emb-${link.id}`}
          onClick={() => onCopy(iframeCode, `emb-${link.id}`)}
        />
      </div>

      {/* Edit customization panel */}
      {editing && (
        <div className="mt-3 pt-3 border-t border-[#1e2a33] grid grid-cols-1 md:grid-cols-2 gap-3">
          <FieldLabel icon="fa-tag" label={t('linkNameOptional') || 'Label'}>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className={inputCls}
            />
          </FieldLabel>
          <FieldLabel icon="fa-image" label={t('customLogoUrlOptional') || 'Logo URL'}>
            <input
              type="url"
              value={editLogo}
              onChange={e => setEditLogo(e.target.value)}
              className={inputCls}
              placeholder="https://…/logo.svg"
            />
          </FieldLabel>
          <FieldLabel
            icon="fa-fill-drip"
            label={t('primaryColor') || 'Primary color'}
          >
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={editPrimary}
                onChange={e => setEditPrimary(e.target.value)}
                className="h-9 w-14 bg-transparent border border-[#1e2a33] rounded cursor-pointer"
              />
              <input
                type="text"
                value={editPrimary}
                onChange={e => setEditPrimary(e.target.value)}
                className={`${inputCls} flex-1`}
              />
            </div>
          </FieldLabel>
          <FieldLabel icon="fa-palette" label={t('accentColor') || 'Accent color'}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={editAccent}
                onChange={e => setEditAccent(e.target.value)}
                className="h-9 w-14 bg-transparent border border-[#1e2a33] rounded cursor-pointer"
              />
              <input
                type="text"
                value={editAccent}
                onChange={e => setEditAccent(e.target.value)}
                className={`${inputCls} flex-1`}
              />
            </div>
          </FieldLabel>
          <div className="flex items-end md:col-span-2">
            <button
              onClick={() =>
                onUpdate({
                  name: editName.trim() || null,
                  customLogoUrl: editLogo.trim() || null,
                  customPrimaryColor:
                    editPrimary && editPrimary.toLowerCase() !== '#088d95'
                      ? editPrimary
                      : null,
                  customAccentColor:
                    editAccent && editAccent.toLowerCase() !== '#2dd4bf'
                      ? editAccent
                      : null,
                })
              }
              className="w-full py-2 brand-primary-bg text-white rounded-lg text-sm font-medium transition-all"
            >
              <i className="fas fa-save mr-2"></i>
              {t('save') || 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function IconButton({
  icon,
  title,
  onClick,
  danger,
}: {
  icon: string;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`w-8 h-8 flex items-center justify-center rounded transition-all ${
        danger
          ? 'text-red-400 hover:bg-red-500/15 hover:text-red-300'
          : 'text-gray-400 hover:bg-[#1e2a33] hover:text-white'
      }`}
    >
      <i className={`fas ${icon} text-xs`}></i>
    </button>
  );
}

function CopyButton({
  copied,
  onClick,
  label,
}: {
  copied: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 rounded font-medium text-xs transition-all ${
        copied
          ? 'bg-green-500 text-white'
          : 'bg-[#1e2a33] text-gray-300 hover:bg-[#2a3a47]'
      }`}
    >
      {copied ? <i className="fas fa-check"></i> : label ? label : <i className="fas fa-copy"></i>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Status / label helpers
// ---------------------------------------------------------------------------

function statusOf(
  link: ShareLink,
  t: (key: string) => string
): { label: string; badgeCls: string } {
  if (link.isRevoked) {
    return {
      label: t('statusRevoked') || 'Revoked',
      badgeCls: 'bg-gray-500/20 text-gray-300',
    };
  }
  if (link.isExpired) {
    return {
      label: t('statusExpired') || 'Expired',
      badgeCls: 'bg-red-500/20 text-red-400',
    };
  }
  return {
    label: t('statusActive') || 'Active',
    badgeCls: 'bg-green-500/20 text-green-400',
  };
}

function expiryLabel(link: ShareLink, t: (key: string) => string): string {
  if (link.isRevoked)
    return `${t('revokedOn') || 'Revoked on'} ${formatDate(link.revokedAt)}`;
  if (!link.expiresAt) return t('neverExpires') || 'Never expires';
  const remaining = new Date(link.expiresAt).getTime() - Date.now();
  if (remaining <= 0) return `${t('expiredOn') || 'Expired on'} ${formatDate(link.expiresAt)}`;
  const days = Math.max(1, Math.round(remaining / (24 * 60 * 60 * 1000)));
  return `${t('expiresIn') || 'Expires in'} ${days} ${days === 1 ? t('day') || 'day' : t('days') || 'days'}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return '';
  }
}
