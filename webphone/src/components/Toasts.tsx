import { useApp } from '../app/AppContext';

export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map(toast => <div key={toast.id} className={`toast toast-${toast.tone}`}>{toast.message}</div>)}
    </div>
  );
}
