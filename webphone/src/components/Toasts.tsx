import { useApp } from '../app/AppContext';

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map(toast => <button key={toast.id} type="button" className={`toast toast-${toast.tone}`} title="Fermer" onClick={() => dismissToast(toast.id)}>{toast.message}<span aria-hidden="true">×</span></button>)}
    </div>
  );
}
