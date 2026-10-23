// Origine officielle. Faire autoriser l'origine HTTPS de votre CRM avant l'essai.
const PHONE_ORIGIN = 'https://phone.apisnix-crm.com';
const SDK_URL = `${PHONE_ORIGIN}/apisnix-embed.js`;
const container = document.querySelector('#telephone');
const connection = document.querySelector('#connection');
const message = document.querySelector('#message');
const prepare = document.querySelector('#prepare');
const input = document.querySelector('#number');
const toggle = document.querySelector('#toggle');
const callsList = document.querySelector('#calls');
const calls = new Map();
let phone;
let state;
let pending = false;

const connectionLabels = {
  offline: 'Déconnecté', connecting: 'Connexion en cours',
  registering: 'Enregistrement en cours', ready: 'Prêt',
  'auth-error': 'Connexion refusée', 'network-error': 'Erreur réseau',
  reconnecting: 'Reconnexion en cours',
  'other-tab-active': 'Un autre onglet utilise la ligne',
  blocked: 'Connexions temporairement bloquées',
};
const phaseLabels = {
  dialing: 'Composition', 'ringing-out': 'Sonnerie distante',
  'ringing-in': 'Appel entrant', active: 'En conversation',
  held: 'En attente', ending: 'Fin en cours', ended: 'Terminé',
};
const outcomeLabels = {
  answered: 'Répondu', 'no-answer': 'Sans réponse', busy: 'Occupé',
  failed: 'Échec', cancelled: 'Annulé', declined: 'Refusé',
  missed: 'Manqué', unknown: 'Issue inconnue',
};
const resultLabels = {
  prepared: 'Numéro préparé. Vérifiez-le et cliquez sur Appeler dans le téléphone.',
  'not-connected': 'Connectez votre phone et attendez que la ligne soit prête.',
  'call-in-progress': 'Terminez les conversations en cours avant de préparer un appel.',
  'invalid-number': 'Numéro invalide : vérifiez les caractères et la longueur.',
};
const errorLabels = {
  'phone-not-ready': 'Le téléphone n’est pas prêt. Vérifiez le panneau.',
  'phone-reloaded': 'Le téléphone a été rechargé. Reconnectez votre phone.',
  'command-timeout': 'Pas de confirmation reçue. Vérifiez le clavier du téléphone.',
  'phone-destroyed': 'Le panneau a été fermé.',
};

function updateButton() {
  prepare.disabled = !phone || pending || !state?.sessionOpen ||
    state.connection !== 'ready' || state.inCall;
}

function showPhone(visible) {
  // Conserver l'iframe et son instance : aucun destroy ni changement de src.
  container.hidden = !visible;
  toggle.setAttribute('aria-expanded', String(visible));
  toggle.textContent = visible ? 'Réduire le téléphone' : 'Afficher le téléphone';
}

function displayCalls() {
  // Affichage texte uniquement, jamais innerHTML avec des données d'appel.
  const rows = [...calls.values()].reverse().map(call => {
    const row = document.createElement('li');
    const direction = call.direction === 'inbound' ? 'Entrant'
      : call.direction === 'outbound' ? 'Sortant' : 'Sens inconnu';
    const phase = phaseLabels[call.phase] ?? call.phase;
    const outcome = call.outcome ? ` · ${outcomeLabels[call.outcome] ?? call.outcome}` : '';
    row.textContent = `${direction} · ${call.number} · ${phase}${outcome}`;
    return row;
  });
  callsList.replaceChildren(...rows);
}

function onEvent(event) {
  if (event.type === 'ready') {
    state = undefined;
    connection.textContent = 'Panneau disponible. Connectez votre phone.';
    updateButton();
  }
  if (event.type === 'state') {
    // Ne pas conserver à l'écran les observations d'un agent précédent.
    if (state?.phone !== event.state.phone || !event.state.sessionOpen) {
      calls.clear();
      displayCalls();
    }
    state = event.state;
    connection.textContent = state.sessionOpen
      ? `Phone ${state.phone ?? ''} · ${connectionLabels[state.connection] ?? state.connection}`
      : 'Connectez votre phone dans le panneau.';
    updateButton();
  }
  if (event.type === 'call') {
    const call = event.call;
    if (JSON.stringify(calls.get(call.id)) === JSON.stringify(call)) return;
    calls.delete(call.id);
    calls.set(call.id, call);
    if (calls.size > 100) calls.delete(calls.keys().next().value);
    displayCalls();
    // Ajouter ici la recherche de contact et les écritures vers votre backend.
    // Prévoir authentification, autorisation et idempotence côté CRM.
  }
  // result est déjà traité via la promesse prepareCall : pas de double effet.
}

document.querySelector('#prepare-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (prepare.disabled || !phone) return;
  pending = true;
  updateButton();
  message.textContent = 'Préparation en cours…';
  try {
    const code = await phone.prepareCall(input.value);
    message.textContent = resultLabels[code] ?? 'Résultat inconnu : vérifiez le téléphone.';
    if (code === 'prepared') showPhone(true);
  } catch (error) {
    message.textContent = errorLabels[error?.message] ?? 'Préparation impossible. Vérifiez le téléphone.';
  } finally {
    pending = false;
    updateButton();
  }
});

toggle.addEventListener('click', () => showPhone(container.hidden));

try {
  const { createApisnixPhone } = await import(SDK_URL);
  phone = createApisnixPhone({
    container,
    url: PHONE_ORIGIN,
    // phone: '1001', // Facultatif : identifiant public, jamais un mot de passe.
    title: 'ApisnixPhone API',
    onEvent,
    onError() {
      state = undefined;
      updateButton();
      connection.textContent = 'Initialisation incomplète : vérifiez le domaine autorisé et le chargement du panneau.';
    },
  });
  updateButton();
} catch {
  connection.textContent = 'Chargement impossible : vérifiez le réseau, la CSP et l’URL du SDK.';
}

// Application dynamique : monter ce panneau dans une zone persistante.
// Appeler phone.destroy() uniquement après fin des appels et déconnexion,
// lorsque le panneau doit réellement être retiré. Il peut couper une ligne.
