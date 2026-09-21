import { ArrowDownLeft, ArrowUpRight, Building2, Pencil, Phone, PhoneMissed, Plus, Search, Star, Trash2, UserRound, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, useData } from '../../app/AppContext';
import { Avatar } from '../../components/Avatar';
import { CallbackScheduler } from '../callbacks/CallbackScheduler';
import { Flag } from '../../components/Flag';
import { fold, formatDay, formatDuration, formatTime } from '../../domain/format';
import { countryLabel, describeNumber, parseDialInput } from '../../domain/numbers';
import { OUTCOME_LABELS, talkSeconds, type Contact, type ContactNumber } from '../../domain/types';
import { searchContacts } from '../../storage/DataStore';

function Editor({ contact, onClose }: { contact: Contact | null; onClose(savedId?: string): void }) {
  const { store } = useApp();
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(contact?.name ?? '');
  const [company, setCompany] = useState(contact?.company ?? '');
  const [note, setNote] = useState(contact?.note ?? '');
  const [numbers, setNumbers] = useState<ContactNumber[]>(contact?.numbers.length ? contact.numbers : [{ label: 'Mobile', value: '' }]);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const valid = name.trim() && numbers.some(number => parseDialInput(number.value).valid);

  return (
    <dialog ref={dialog} className="dialog" onClose={() => onClose()} aria-labelledby="editor-title">
      <form method="dialog" onSubmit={event => {
        event.preventDefault();
        if (!valid) return;
        const saved = store.saveContact({ id: contact?.id, name: name.trim(), company: company.trim() || undefined, note: note.trim() || undefined,
                                          numbers, favorite: contact?.favorite ?? false });
        onClose(saved.id);
      }}>
        <header><h2 id="editor-title">{contact ? 'Modifier le contact' : 'Nouveau contact'}</h2>
          <button type="button" className="icon-button" aria-label="Fermer" onClick={() => onClose()}><X size={18} /></button></header>
        <label>Nom<input value={name} onChange={event => setName(event.target.value)} maxLength={80} required autoFocus /></label>
        <label>Entreprise <small>facultatif</small><input value={company} onChange={event => setCompany(event.target.value)} maxLength={80} /></label>
        <fieldset><legend>Numéros <small>enregistrés exactement comme saisis</small></legend>
          {numbers.map((number, index) => (
            <div className="number-row" key={index}>
              <input aria-label="Libellé" className="label-input" value={number.label} maxLength={20} placeholder="Libellé"
                onChange={event => setNumbers(numbers.map((n, i) => (i === index ? { ...n, label: event.target.value } : n)))} />
              <input aria-label="Numéro" inputMode="tel" value={number.value} maxLength={40} placeholder="+33 1 00 00 00 00"
                onChange={event => setNumbers(numbers.map((n, i) => (i === index ? { ...n, value: event.target.value } : n)))} />
              {numbers.length > 1 && <button type="button" className="icon-button" aria-label="Retirer ce numéro" onClick={() => setNumbers(numbers.filter((_, i) => i !== index))}><X size={16} /></button>}
            </div>
          ))}
          {numbers.length < 5 && <button type="button" className="ghost small" onClick={() => setNumbers([...numbers, { label: '', value: '' }])}><Plus size={14} /> Ajouter un numéro</button>}
        </fieldset>
        <label>Note <small>facultatif</small><textarea rows={3} value={note} onChange={event => setNote(event.target.value)} maxLength={500} /></label>
        <footer><button type="button" className="ghost" onClick={() => onClose()}>Annuler</button><button type="submit" className="primary" disabled={!valid}>Enregistrer</button></footer>
      </form>
    </dialog>
  );
}

function Detail({ contact, onEdit }: { contact: Contact; onEdit(): void }) {
  const { store, placeCall, openContact, notify } = useApp();
  const { calls } = useData();
  const targets = contact.numbers.map(number => parseDialInput(number.value).dialTarget);
  const history = calls.filter(call => targets.includes(call.dialTarget)).slice(0, 8);

  return (
    <article className="contact-detail" aria-label={`Fiche de ${contact.name}`}>
      <header>
        <Avatar name={contact.name} size={72} ring />
        <h2>{contact.name}</h2>
        {contact.company && <p className="company"><Building2 size={14} />{contact.company}</p>}
        <div className="detail-tools">
          <button type="button" className={'icon-button star' + (contact.favorite ? ' on' : '')} aria-pressed={contact.favorite}
            aria-label={contact.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} onClick={() => store.toggleFavorite(contact.id)}><Star size={18} /></button>
          <button type="button" className="icon-button" aria-label="Modifier" onClick={onEdit}><Pencil size={17} /></button>
          <button type="button" className="icon-button danger" aria-label="Supprimer le contact" onClick={() => {
            if (!window.confirm(`Supprimer ${contact.name} de cet appareil ? Le journal d’appels est conservé.`)) return;
            store.removeContact(contact.id);
            openContact(null);
            notify('Contact supprimé.');
          }}><Trash2 size={17} /></button>
        </div>
      </header>
      <ul className="numbers">
        {contact.numbers.map((number, index) => {
          const info = describeNumber(parseDialInput(number.value).dialTarget);
          return (
            <li key={index}><Flag info={info} size={22} />
              <span><b className="mono">{number.value}</b><small>{number.label || 'Numéro'} · {countryLabel(info)}</small></span>
              <button type="button" className="mini-call" onClick={() => placeCall(number.value)}><Phone size={16} /> Appeler</button></li>
          );
        })}
      </ul>
      {contact.numbers[0] && <CallbackScheduler number={contact.numbers[0].value} name={contact.name} />}
      {contact.note && <p className="contact-note">{contact.note}</p>}
      <h3>Derniers échanges</h3>
      {history.length === 0 ? <p className="muted">Aucun appel avec ce contact depuis ce navigateur.</p> : (
        <ol className="timeline">
          {history.map(call => (
            <li key={call.id} className={call.outcome === 'missed' ? 'missed' : ''}>
              {call.outcome === 'missed' ? <PhoneMissed size={15} /> : call.direction === 'inbound' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
              <span><b>{formatDay(call.startedAt)} · {formatTime(call.startedAt)}</b>
                <small>{call.outcome === 'answered' ? formatDuration(talkSeconds(call)) : OUTCOME_LABELS[call.outcome]}{call.note ? ` — ${call.note}` : ''}</small></span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

export function Contacts({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const { selectedContactId, openContact, placeCall, setView } = useApp();
  const { contacts } = useData();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Contact | 'new' | null>(null);

  const list = useMemo(() => searchContacts(contacts.filter(contact => !favoritesOnly || contact.favorite), query)
    .sort((a, b) => fold(a.name).localeCompare(fold(b.name), 'fr')), [contacts, favoritesOnly, query]);
  const selected = contacts.find(contact => contact.id === selectedContactId) ?? null;
  const letters = useMemo(() => {
    const groups = new Map<string, Contact[]>();
    for (const contact of list) {
      const letter = /[A-Z]/.test(fold(contact.name).charAt(0).toUpperCase()) ? fold(contact.name).charAt(0).toUpperCase() : '#';
      groups.set(letter, [...(groups.get(letter) ?? []), contact]);
    }
    return [...groups];
  }, [list]);

  return (
    <div className="page">
      <header className="page-head">
        <div><p className="eyebrow">{favoritesOnly ? 'Vos raccourcis' : 'Votre carnet'}</p>
          <h1><span className="swoosh">{favoritesOnly ? 'Favoris' : 'Contacts'}</span></h1>
          <p className="lead">{favoritesOnly ? 'Les personnes que vous appelez le plus, à un clic.' : 'Enregistrés sur cet appareil, jamais importés automatiquement.'}</p></div>
        <div className="head-actions">
          {/* Favourites leave the bottom bar on a narrow screen, so they stay one tap away from here. */}
          <button type="button" className="ghost only-narrow" onClick={() => setView(favoritesOnly ? 'contacts' : 'favorites')}><Star size={16} /> {favoritesOnly ? 'Tous les contacts' : 'Favoris'}</button>
          <button type="button" className="primary" onClick={() => setEditing('new')}><Plus size={17} /> Nouveau contact</button>
        </div>
      </header>

      {favoritesOnly ? (
        <section className="favorites">
          {list.length === 0 && <div className="empty panel"><Star size={28} /><b>Aucun favori</b><p>Ouvrez une fiche contact et touchez l’étoile.</p></div>}
          {list.map(contact => {
            const first = contact.numbers[0];
            const info = describeNumber(parseDialInput(first?.value ?? '').dialTarget);
            return (
              <article key={contact.id} className="favorite-card">
                <Star size={16} className="favorite-star" aria-hidden="true" />
                <button type="button" className="favorite-open" onClick={() => openContact(contact.id)}>
                  <Avatar name={contact.name} size={56} /><b>{contact.name}</b><small>{contact.company ?? ' '}</small>
                  <span className="favorite-number"><Flag info={info} size={18} />{first?.value}</span>
                </button>
                {/* A distinct action: opening a card never places a call by accident. */}
                <button type="button" className="mini-call wide" disabled={!first} onClick={() => first && placeCall(first.value)}><Phone size={16} /> Appeler</button>
              </article>
            );
          })}
        </section>
      ) : (
        <div className="contacts-layout">
          <section className="panel contact-list">
            <div className="toolbar"><label className="search wide"><Search size={16} aria-hidden="true" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher un nom, une entreprise, un numéro" aria-label="Rechercher un contact" /></label></div>
            {list.length === 0 ? <div className="empty"><UserRound size={28} /><b>{contacts.length ? 'Aucun contact trouvé' : 'Votre carnet est vide'}</b><p>Créez un contact pour l’appeler en un clic.</p></div>
              : letters.map(([letter, group]) => (
                <div key={letter}><h2 className="letter">{letter}</h2>
                  <ul>{group.map(contact => (
                    <li key={contact.id}>
                      <button type="button" className={'contact-row' + (contact.id === selectedContactId ? ' selected' : '')} onClick={() => openContact(contact.id)}>
                        <Avatar name={contact.name} size={38} />
                        <span><b>{contact.name}</b><small>{contact.company ?? contact.numbers[0]?.value}</small></span>
                        {contact.favorite && <Star size={15} className="row-star" aria-label="Favori" />}
                      </button>
                    </li>))}
                  </ul>
                </div>
              ))}
          </section>
          <section className="panel contact-pane">
            {selected ? <Detail contact={selected} onEdit={() => setEditing(selected)} />
              : <div className="empty"><UserRound size={28} /><b>Sélectionnez un contact</b><p>Sa fiche, ses numéros et vos derniers échanges s’affichent ici.</p></div>}
          </section>
        </div>
      )}
      {editing && <Editor contact={editing === 'new' ? null : editing} onClose={id => { setEditing(null); if (id) openContact(id); }} />}
    </div>
  );
}
