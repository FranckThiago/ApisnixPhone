import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp, useData, usePhone } from '../../app/AppContext';
import { useI18n } from '../../i18n';
import { shouldOfferAfterCall, enableNotifications, markNotificationsOffered } from '../../telephony/notifications';

/** Offer once after the first ended outgoing/answered call, never over an active call. */
export function NotificationOffer() {
  const { phone, store, notify } = useApp();
  const { preferences } = useData();
  const { call, demo } = usePhone();
  const { t } = useI18n();
  const [offered, setOffered] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => phone.subscribe(() => {
    if (!shouldOfferAfterCall(phone.getSnapshot(), store.getSnapshot().preferences.notifications)) return;
    markNotificationsOffered();
    setOffered(true);
  }), [phone, store]);
  if (!offered || demo || preferences.notifications || (call && call.phase !== 'ended')) return null;
  const enable = async () => {
    setBusy(true);
    const permission = await enableNotifications();
    store.setPreferences({ notifications: permission === 'granted' });
    setBusy(false);
    setOffered(false);
    notify(t(permission === 'granted' ? 'notifications.enabled' : permission === 'denied' ? 'notifications.denied' : 'settings.notificationsUnavailable'), permission === 'granted' ? 'success' : 'info');
  };
  return <section className="line-alert notification-offer" aria-label={t('notifications.offerTitle')}>
    <Bell size={18} aria-hidden="true" />
    <p><b>{t('notifications.offerTitle')}</b> {t('notifications.offerText')}</p>
    <button type="button" disabled={busy} onClick={() => void enable()}>{t('notifications.enable')}</button>
    <button type="button" disabled={busy} onClick={() => setOffered(false)}>{t('notifications.later')}</button>
  </section>;
}
