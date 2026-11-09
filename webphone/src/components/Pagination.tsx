import { useI18n } from '../i18n';
import type { PageInfo } from '../recordings/types';

export function Pagination({ page, pageCount, busy, onChange }: PageInfo & {
  busy: boolean;
  onChange(page: number): void;
}) {
  const { t } = useI18n();
  if (pageCount < 2) return null;
  const numbers = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter(number => number >= 1 && number <= pageCount);
  return (
    <nav className="history-pager" aria-label={t('pagination.label')}>
      <div className="history-pager-buttons">
        <button type="button" aria-label={t('pagination.first')} disabled={busy || page === 1} onClick={() => onChange(1)}>«</button>
        <button type="button" aria-label={t('pagination.previous')} disabled={busy || page === 1} onClick={() => onChange(page - 1)}>‹</button>
        {numbers.map((number, index) => (
          <span key={number} className="history-pager-number">
            {index > 0 && number > numbers[index - 1]! + 1 && <span aria-hidden="true">…</span>}
            <button type="button" aria-current={number === page ? 'page' : undefined}
              aria-label={t('pagination.number', { number })} disabled={busy && number !== page}
              onClick={() => { if (number !== page) onChange(number); }}>{number}</button>
          </span>
        ))}
        <button type="button" aria-label={t('pagination.next')} disabled={busy || page === pageCount} onClick={() => onChange(page + 1)}>›</button>
        <button type="button" aria-label={t('pagination.last')} disabled={busy || page === pageCount} onClick={() => onChange(pageCount)}>»</button>
      </div>
      <small aria-live="polite">{t('pagination.position', { page, count: pageCount })}</small>
    </nav>
  );
}
