import { AlarmClock, BookUser, History, Moon, Phone, PhoneIncoming, Search, Settings as SettingsIcon, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApp, useData, usePhone } from '../app/AppContext';
import { applyTheme } from '../app/theme';
import { countryLabel, describeNumber, parseDialInput } from '../domain/numbers';
import { searchContacts } from '../storage/DataStore';
import { Avatar } from './Avatar';
import { Flag } from './Flag';

interface Command { id: string; icon: ReactNode; label: string; hint?: string; run(): void }

/** One field to reach anything: a number to call, a contact, a view or an action. */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, placeCall, setView, openContact, simulateIncoming, store } = useApp();
  const { contacts, preferences } = useData();
  const { demo } = usePhone();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (paletteOpen && !element.open) { setQuery(''); setIndex(0); element.showModal(); }
    if (!paletteOpen && element.open) element.close();
  }, [paletteOpen]);

  const commands = useMemo<Command[]>(() => {
    const result: Command[] = [];
    const input = parseDialInput(query);
    if (input.valid && input.dialTarget.length > 1) {
      const info = describeNumber(input.dialTarget);
      result.push({ id: 'dial', icon: <Flag info={info} size={20} />, label: `Appeler ${input.dialTarget}`, hint: countryLabel(info), run: () => placeCall(query) });
    }
    for (const contact of searchContacts(contacts, query).slice(0, query ? 5 : 3)) {
      const number = contact.numbers[0]?.value;
      result.push({ id: 'c' + contact.id, icon: <Avatar name={contact.name} size={26} />, label: contact.name, hint: number,
                    run: () => (number && query ? placeCall(number) : openContact(contact.id)) });
    }
    const actions: Command[] = [
      { id: 'journal', icon: <History size={18} />, label: 'Ouvrir le journal', run: () => setView('journal') },
      { id: 'contacts', icon: <BookUser size={18} />, label: 'Ouvrir les contacts', run: () => setView('contacts') },
      { id: 'callbacks', icon: <AlarmClock size={18} />, label: 'Ouvrir les rappels', run: () => setView('callbacks') },
      { id: 'favorites', icon: <Star size={18} />, label: 'Ouvrir les favoris', run: () => setView('favorites') },
      { id: 'settings', icon: <SettingsIcon size={18} />, label: 'Ouvrir les réglages', run: () => setView('settings') },
      { id: 'theme', icon: <Moon size={18} />, label: preferences.theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre',
        run: () => { const theme = preferences.theme === 'dark' ? 'light' : 'dark'; store.setPreferences({ theme }); applyTheme(theme); } },
      ...(demo ? [{ id: 'incoming', icon: <PhoneIncoming size={18} />, label: 'Simuler un appel entrant', run: simulateIncoming }] : []),
    ];
    const text = query.trim().toLowerCase();
    return [...result, ...actions.filter(action => !text || action.label.toLowerCase().includes(text))];
  }, [query, contacts, preferences.theme, demo, placeCall, openContact, setView, simulateIncoming, store]);

  const active = Math.min(index, Math.max(0, commands.length - 1));
  const run = (command: Command | undefined) => { if (!command) return; setPaletteOpen(false); command.run(); };

  return (
    <dialog ref={dialog} className="palette" aria-label="Recherche et commandes" onClose={() => setPaletteOpen(false)}
      onClick={event => { if (event.target === dialog.current) setPaletteOpen(false); }}>
      <div className="palette-input"><Search size={18} aria-hidden="true" />
        <input value={query} autoFocus placeholder="Un nom, un numéro, une action…" aria-label="Rechercher ou composer"
          onChange={event => { setQuery(event.target.value); setIndex(0); }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setIndex((active + 1) % Math.max(1, commands.length)); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setIndex((active - 1 + commands.length) % Math.max(1, commands.length)); }
            if (event.key === 'Enter') { event.preventDefault(); run(commands[active]); }
          }} /></div>
      <ul role="listbox" aria-label="Résultats">
        {commands.map((command, position) => (
          <li key={command.id} role="option" aria-selected={position === active} className={position === active ? 'active' : ''}
            onMouseEnter={() => setIndex(position)} onClick={() => run(command)}>
            <span className="palette-icon">{command.icon}</span><b>{command.label}</b>{command.hint && <small>{command.hint}</small>}
            {command.id === 'dial' || (command.id.startsWith('c') && query) ? <Phone size={15} className="palette-call" aria-hidden="true" /> : null}
          </li>
        ))}
        {commands.length === 0 && <li className="palette-empty">Aucun résultat.</li>}
      </ul>
      <footer><span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> naviguer</span><span><kbd className="kbd">↵</kbd> valider</span><span><kbd className="kbd">Échap</kbd> fermer</span></footer>
    </dialog>
  );
}
