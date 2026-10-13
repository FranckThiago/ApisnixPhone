import { useCallback, useEffect, useMemo, useState } from 'react';
import { hideAnnouncement, isHidden, loadAnnouncements, localSeenStore, type Announcement, type AnnouncementsSource } from '../../announcements/client';

/** The announcements to show on the main screen, read once when the workspace opens, minus those hidden here. */
export function useAnnouncements(source: AnnouncementsSource) {
  const [items, setItems] = useState<Announcement[]>([]);
  // Also kept in memory, so hiding works for the session even where the browser refuses to store it.
  const [hidden, setHidden] = useState<Record<string, string>>({});
  useEffect(() => loadAnnouncements(source, setItems), [source]);
  const storage = useMemo(() => localSeenStore(), []);
  const visible = useMemo(() => items.filter(item => hidden[item.id] !== item.updatedAt && !isHidden(item, storage)), [items, hidden, storage]);
  const hide = useCallback((item: Announcement) => {
    hideAnnouncement(item, storage);
    setHidden(current => ({ ...current, [item.id]: item.updatedAt }));
  }, [storage]);
  return { visible, hide };
}
