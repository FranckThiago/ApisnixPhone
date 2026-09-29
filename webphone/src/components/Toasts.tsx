import { useApp } from '../app/AppContext';
import { useI18n } from '../i18n';

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  const { t } = useI18n();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map(toast => <button key={toast.id} type="button" className={`toast toast-${toast.tone}`} title={t('action.close')} onClick={() => dismissToast(toast.id)}>{toast.message}<span aria-hidden="true">×</span></button>)}
    </div>
  );
}
