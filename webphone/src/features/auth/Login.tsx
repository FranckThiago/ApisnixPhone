import { ArrowRight, Eye, EyeOff, Headphones, ShieldCheck, Zap } from 'lucide-react';
import { useState } from 'react';
import { useApp, usePhone } from '../../app/AppContext';

export function Login() {
  const { login } = useApp();
  const { connection, error, demo } = usePhone();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const busy = connection === 'connecting' || connection === 'registering';

  return (
    <main className="login">
      <section className="login-brand" aria-hidden="true">
        <div className="login-glow" />
        <img src="/apisnix-mark.png" alt="" width={120} height={120} />
        <h2>Vos appels,<br /><span className="swoosh">tout simplement.</span></h2>
        <ul>
          <li><Zap size={18} /> Aucune installation : ouvrez, connectez-vous, appelez.</li>
          <li><Headphones size={18} /> Pensé pour le casque et le clavier.</li>
          <li><ShieldCheck size={18} /> Votre mot de passe n’est jamais enregistré.</li>
        </ul>
      </section>
      <section className="login-form">
        <form onSubmit={event => { event.preventDefault(); if (!busy) void login({ username, password }); }}>
          <img src="/apisnix-mark.png" alt="APISNIX" width={56} height={56} className="login-mark" />
          <p className="eyebrow">ApisnixPhone</p>
          <h1>Bon retour parmi nous</h1>
          <p className="lead">Connectez votre ligne pour passer et recevoir vos appels.</p>
          {demo && <p className="callout">Démonstration : saisissez n’importe quel identifiant et mot de passe. Aucun appel réel n’est passé.</p>}
          <label>Identifiant<input value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" maxLength={100} required autoFocus /></label>
          <label>Mot de passe
            <span className="password"><input type={visible ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" maxLength={256} required />
              <button type="button" className="icon-button" aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="primary big" disabled={busy}>{busy ? (connection === 'connecting' ? 'Connexion…' : 'Enregistrement de la ligne…') : <>Se connecter <ArrowRight size={18} /></>}</button>
          <p className="fine">Le domaine est préconfiguré par APISNIX. Besoin d’aide ? Contactez votre administrateur.</p>
        </form>
      </section>
    </main>
  );
}
