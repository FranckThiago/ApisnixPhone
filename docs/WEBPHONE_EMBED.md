# Intégration ApisnixPhone dans un CRM — première version

État au 23 octobre 2026 : code et démonstration locale, **non déployés**.
La production reste celle décrite dans OPERATIONS. Cette version livre un
panneau réutilisable et un petit SDK navigateur, pas une API publique de création
de comptes ni un accès serveur aux historiques.

## Essayer localement

Depuis `webphone/` :

```sh
VITE_APP_MODE=demo npm run dev -- --port 5185
```

Ouvrir <http://127.0.0.1:5185/integration-demo>. Le mode est forcé pour ne pas
hériter d’un `.env.local` configuré en live. Le CRM Atelier et ses contacts sont
fictifs. Postes suggérés : `1001` et `1002`, mot de passe fictif `demo` ; comme
la démonstration ordinaire, tout identifiant/mot de passe non vide est accepté.
Aucun accès PBX créé, aucune communication réelle, aucun microphone demandé.

1. Choisir un poste, puis se connecter dans le panneau téléphonique.
2. Sélectionner un contact et cliquer sur « Préparer l’appel ».
3. Le numéro apparaît dans le téléphone ; cliquer sur « Appeler » pour lancer
   l’appel simulé. Le CRM reçoit les changements d’état, jusqu’au raccrochage.
4. Dans Réglages du téléphone, « Simuler un appel entrant » ouvre la fiche CRM
   correspondante lorsqu’un contact porte ce numéro.
5. Réduire le panneau conserve son iframe et l’appel. Se déconnecter avant de
   changer de poste ; le nouveau panneau demande son propre accès.

La page `/integration-demo` est réservée aux builds de démonstration. Elle
n’apparaît pas comme CRM de démonstration dans un build live.

## Utilisation dans le site du client

`npm run build` produit `dist/apisnix-embed.js` et ses modules dans `dist/assets/`.
Distribuer **l’ensemble du build**, pas le seul fichier d’entrée. Le SDK est un
module ES sans dépendance React côté hôte. Exemple d’intégration après activation
du domaine client (les domaines `.example` ci-dessous sont des exemples) :

```html
<div id="telephone" style="width:390px;height:780px"></div>
<button id="appeler">Préparer l’appel</button>
<script type="module">
  import { createApisnixPhone } from 'https://phone.example/apisnix-embed.js';

  const phone = createApisnixPhone({
    container: document.querySelector('#telephone'),
    url: 'https://phone.example',
    phone: '1001', // identifiant public facultatif, jamais le mot de passe
    onEvent(event) {
      if (event.type === 'call') {
        // Afficher event.call.phase et rapprocher event.call.number du contact.
        // Traiter les valeurs comme du texte, jamais comme du HTML.
      }
    },
    onError(code) {
      // Afficher un état indisponible ; ne pas recréer une iframe en plein appel.
    },
  });

  document.querySelector('#appeler').onclick = async () => {
    const result = await phone.prepareCall('+33100000001'); // numéro fictif
    // result === 'prepared' : inviter l’utilisateur à appuyer sur Appeler.
  };
</script>
```

L’utilisateur saisit ses accès **phone par phone** dans le formulaire
ApisnixPhone. Le champ `phone` préremplit seulement l’identifiant : il n’accorde
aucun droit et ne remplace pas l’authentification. En mode live, la connexion SIP
et l’espace de données utilisent les mécanismes existants de la ligne.
Le CRM ne reçoit pas les mots de passe. Aucun identifiant partagé d’administrateur,
aucune reconnexion silencieuse par coffre navigateur, aucun lien de connexion
par fragment ni commande d’authentification ne sont utilisés dans l’iframe.
L’autocomplétion manuelle du navigateur reste possible.

Un seul poste actif selon les règles actuelles du service : ouvrir la même ligne
ailleurs peut reprendre sa connexion. Utiliser un phone distinct par agent.
Cette version ne crée pas les phones, ne provisionne pas un client et ne prouve
pas à elle seule qu’un phone appartient au client hôte : cela reste du ressort
des accès et contrôles existants. Un futur SSO nécessitera un backend dédié,
pas un mot de passe placé dans le JavaScript du CRM.

## Contrat SDK v1

- `createApisnixPhone({container, url, phone?, title?, onEvent?, onError?})` monte
  une seule iframe vers `/embed?phone=…`. `url` est une origine HTTPS sans chemin,
  fragment, recherche ou identifiants ; HTTP est réservé au loopback local.
- `prepareCall(number): Promise<ResultCode>` prépare uniquement le numéro et
  affiche le clavier. Résultats : `prepared`, `not-connected`, `call-in-progress`,
  `invalid-number`. Rejet si le panneau n’est pas prêt/détruit si le document est rechargé ou si la commande
  expire (5 s). Les deux conversations du pilote sont prises en compte.
  Une fiche d’appel déjà terminé est fermée à cette action ; les données déjà
  saisies restent dans le journal. Pas de réponse, raccrochage ou appel automatique.
- `destroy()` retire l’iframe et les écouteurs ; **peut couper la ligne/l’appel**.
  Attendre la fin de l’appel et la déconnexion avant de démonter. Pour replier
  visuellement le téléphone, garder l’iframe montée.
- Événements `ready`, `state`, `call`, `result`. `state` contient `connection`,
  `phone` (null avant ouverture de session), `sessionOpen`, `demo`, `inCall`.
  `call` contient `id`, `direction`, `number`, `phase`, `startedAt`, et si connus
  `answeredAt`, `endedAt`, `outcome` (timestamps en millisecondes).
- Pas de liste de contacts, historique complet, audio, DTMF, noms privés,
  diagnostic SIP ou secrets sur ce canal. Les numéros courants sont visibles
  par le CRM autorisé ; informer le client de cette portée.
- `onError('handshake-timeout')` signale une initialisation absente après 12 s
  (le canal est réinitialisé après rechargement de l’iframe). Les événements navigateur
  ne constituent pas un journal serveur durable : pas de rattrapage après
  fermeture du CRM, ni webhook. Le journal interne du téléphone reste existant.

Le protocole `apisnixphone.embed.v1` utilise `postMessage` avec origine cible
exacte et identifiant aléatoire de canal. Chaque côté vérifie l’origine,
la fenêtre source, le protocole et le canal. Le téléphone n’accepte que
`hello` puis `prepare-call` ; données bornées et numéro validé avec les mêmes
règles que le clavier. L’ouverture du formulaire exige d’abord un parent autorisé.
Toutes les routes chargées en iframe passent par cette barrière, y compris `/`
et `/lien`. `/embed` ouvert seul affiche une explication, pas une connexion.

## Activation future chez un client — non effectuée

1. Définir `VITE_EMBED_ALLOWED_ORIGINS` au build avec les origines HTTPS exactes
   des CRM autorisés, séparées par des virgules (port compris si présent).
   En live, la liste vide refuse tous les parents ; aucune origine issue d’une
   URL utilisateur n’est considérée comme une autorisation. Pas de wildcard.
   En démo seulement, l’origine du téléphone et les loopbacks explicitement
   configurés sont admis. Exemple local : `http://127.0.0.1:5187`.
2. Héberger le téléphone sur une origine distincte du CRM pour que la séparation
   navigateur protège le formulaire. La démo locale partage volontairement une
   origine ; elle illustre le flux, pas l’isolation de deux sites de production.
3. Préparer les en-têtes **uniquement pour `/embed`** : CSP `frame-ancestors`
   avec ces mêmes origines, sans interdiction contradictoire `X-Frame-Options`.
   Garder le refus d’iframe sur les autres routes. Ne pas retirer globalement
   les protections du site. Le CRM autorise cette origine dans `frame-src` et
   délègue le microphone ; le SDK ajoute `allow` sur l’iframe mais ne peut pas
   élargir une Permissions-Policy restrictive du parent.
4. Autoriser la lecture CORS des modules SDK statiques par les domaines clients
   (et leur `script-src`). Ne pas ouvrir les API de données pour cela.
5. Vérifier en HTTPS les sessions HTTP, cookies tiers/partitionnés, stockage,
   SIP WebSocket, permissions microphone, lecture audio et reconnexion sur les
   navigateurs clients. Les mécanismes actuels de session peuvent demander une
   adaptation pour un usage entre sites distincts : **non validé en appel réel**.
6. Prévoir pilote sur phone dédié, sauvegarde des en-têtes/build et retour ciblé,
   puis seulement publier selon OPERATIONS. Cette livraison ne modifie aucun
   en-tête, backend, PBX, compte client ou déploiement de production.

L’intégration navigateur n’ajoute pas de sonnerie fiable écran verrouillé sur
mobile : cela nécessite un chantier distinct (application/push/prise d’appel).
