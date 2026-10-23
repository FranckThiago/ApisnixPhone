# Intégration ApisnixPhone dans un CRM — première version

État au 23 octobre 2026 : version avec administration des domaines et sessions
indépendantes des cookies tiers. Publication et preuves : [OPERATIONS](OPERATIONS.md).
Cette version livre un panneau et un SDK navigateur, pas une API publique de
création de comptes ni un accès serveur aux historiques.

**Remise aux développeurs clients :** [guide technique et kit d'intégration](integration/README.md)
(édition 1.0, PDF de 15 pages avec identité APISNIX et exemple HTML/JavaScript/CSS). Le guide client
décrit le contrat disponible, les champs transmis, la sécurité et la recette ;
il exclut l'historique d'exploitation interne présent dans ce document.

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
aucun droit et ne remplace pas l’authentification. En mode live, le serveur vérifie les accès de la ligne et son appartenance à
l’équipe autorisée pour ce CRM avant de permettre la connexion SIP.
Le CRM ne reçoit pas les mots de passe. Aucun identifiant partagé d’administrateur,
aucune reconnexion silencieuse par coffre navigateur, aucun lien de connexion
par fragment ni commande d’authentification ne sont utilisés dans l’iframe.
L’autocomplétion manuelle du navigateur reste possible.

Un seul poste actif selon les règles actuelles du service : ouvrir la même ligne
ailleurs peut reprendre sa connexion. Utiliser un phone distinct par agent.
Cette version ne crée pas les phones : ils sont créés et affectés à l’équipe
cliente dans les outils existants. Un futur SSO nécessitera un backend dédié,
pas un mot de passe placé dans le JavaScript du CRM.

## Nom dans la supervision

Le module intégré se déclare **ApisnixPhone API** ; le téléphone ouvert seul
reste **ApisnixPhone Web**. La distinction exige le téléphone et la règle de reconnaissance API dans
`supervision/static/app.js`, puis une nouvelle connexion de la ligne.

Le User-Agent SIP intégré conserve le préfixe `ApisnixPhoneWeb/0.1.0` et ajoute
`ApisnixPhoneAPI/0.1.0` avant le token SIP.js. Ce préfixe maintient la compatibilité
avec le garde-fou PBX déjà déployé contre les appels abandonnés. La supervision
reconnaît le marqueur API avant le cas Web, dans la liste, les fiches et la recherche.
Le mode vient de la fenêtre encadrée, pas d’un paramètre fourni par le CRM.
C’est une identité déclarative d’application, sans modification des droits.

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

## Administrer les intégrations

Dans **Supervision → Administration → Intégrations CRM** (superadministrateur) :

1. Créer ou choisir une équipe cliente et y affecter ses phones. Les équipes
   réservées ADMIN, Freelancer et À classer ne sont pas proposées.
2. Saisir l’origine HTTPS exacte du CRM, sans chemin, paramètres, wildcard ou
   port autre que 443 ; choisir l’équipe, puis « Autoriser ce CRM ».
3. « Copier le code » fournit le module et le conteneur à installer dans le CRM.
   Adapter ses dimensions et ajouter les événements/préparation d’appel selon
   le contrat ci-dessus. Aucun mot de passe dans ce code.
4. Modifier ou suspendre depuis cette même rubrique. Chaque modification
   révoque les sessions de données de cette intégration. La suspension bloque
   les prochaines connexions ; elle ne déconnecte pas une ligne SIP déjà
   enregistrée. Se déconnecter du téléphone pour fermer aussi cette ligne.

Un domaine correspond à une équipe ; plusieurs domaines peuvent partager une
équipe. L’autorisation d’un domaine couvre les pages de cette origine : ne pas
l’accorder à un site dont le client ne maîtrise pas tous les scripts.
Aucun domaine client n’est autorisé automatiquement. Les changements prennent
effet sans rebuild ni rechargement Caddy. Une édition concurrente est refusée
plutôt qu’écrasée. La suppression d’une équipe supprime ses intégrations.

Le CRM doit permettre `frame-src https://phone.apisnix-crm.com`, le chargement
du SDK dans `script-src` et déléguer le microphone à l’iframe (le SDK pose
`allow`). Une Permissions-Policy restrictive du CRM doit être adaptée par son
administrateur. Le site téléphone autorise les modules statiques par CORS ;
ses API restent sur la même origine, sans CORS client.

## Session et isolation entre sites

`/embed` est servi par le backend avec une CSP `frame-ancestors` dérivée des
intégrations actives ; les autres pages continuent à refuser l’encadrement.
Le handshake interroge `/api/embed-policy` avant de montrer le formulaire.
La variable de build `VITE_EMBED_ALLOWED_ORIGINS` reste un outil de démonstration
ou développement local ; elle n’accorde aucun accès dans un build live publié.

`POST /api/embed-session` vérifie les accès phone via la passerelle PBX,
l’équipe et l’intégration, puis émet un jeton opaque valable 8 h. Seule son
empreinte SHA-256 est enregistrée en base. Le jeton brut reste dans la mémoire
de l’iframe, jamais dans une URL, le stockage navigateur ou les événements SDK.
Les requêtes journal/profil/audio/TURN utilisent Authorization et omettent les
cookies ; les redirections et destinations hors `/api/` de la même origine
sont refusées. Les fichiers audio sont chargés avec ce jeton puis lus via une
URL blob révoquée à la fermeture du lecteur. L’API n’est pas un SSO pour le CRM.

Chaque requête revalide le phone, l’utilisateur, l’attribution, l’équipe et la
version de l’intégration. Les commandes administratives, exports et commandes
de contrôle d’appel n’acceptent pas ces jetons. Les protections Origin/CSRF
restent actives pour les mutations. Déconnexion/réouverture du même accès
révoquent le jeton précédent ; rechargement de l’iframe exige une connexion.
Après expiration, rouvrir la session ; aucune prolongation silencieuse.
Le mode autonome conserve son cookie SameSite=Strict et son comportement.

L’intégration navigateur n’ajoute pas de sonnerie fiable écran verrouillé sur
mobile : cela nécessite un chantier distinct (application/push/prise d’appel).

## Validation HTTPS de la release administrable — 23 octobre 2026

Essais sur un second domaine enregistrable APISNIX, avec le bundle de production
et la session sans cookies. Instrumentation temporaire du média uniquement
(tonalité synthétique, SIP/WebRTC réels), retirée après vérification.

- Entrant décroché 32 s : 1 548 paquets envoyés, 1 481 reçus avant raccrochage,
  énergie audio reçue non nulle ; événement SDK ringing-in/active/ended.
- Sortant interne 30 s : 1 446 paquets envoyés, 1 403 reçus avant raccrochage,
  énergie non nulle ; préparation SDK puis action Appeler dans l’iframe.
- Journal serveur visible dans l’iframe ; profil existant chargé et écrit.
  Contrôle HTTP sans cookies : identité agent d’un seul phone, profil GET/PUT
  200, endpoint ICE 200 (relais non activé pour ce poste), audio propre en Range
  206 (32 octets seulement), audio étranger 404, admin/autre phone/équipe 403,
  déconnexion 200 puis ancien jeton refusé 401. Aucun secret dans les événements.
- Nom SIP API vérifié sur le peer et règle de supervision publiée.
- Banc, route Echo et autorisation de test retirés ; classement initial du phone
  et attribution conservés, aucune origine cliente activée automatiquement.

Limites : le microphone physique du navigateur de test est resté en attente ;
ces essais valident le média synthétique. Matériel audio, navigateur mobile et
politique microphone du CRM réel restent à vérifier chez le client. Les premiers
sortants de 9 s n’étaient pas des preuves du circuit interne : route runtime
retirée par rechargement puis garde utilisant SIPCHANINFO(peername) vide.
Validation finale sur route temporaire persistante, limitée au canal exact du
phone, retirée avec comparaison du fichier avant/après. Aucune route opérateur
externe validée. 258 tests frontend finaux, typage/lint ; 226 tests backend release.

## Historique : premier pilote local du 23 octobre 2026

**Avis : téléphonie intégrée validée localement ; activation client non prête.**
Le pilote autorisé utilise un poste réel dédié, SIP.js et WebRTC réels, avec une
tonalité synthétique remplaçant seulement le microphone. Le SDK prépare le numéro ;
l’utilisateur déclenche l’appel dans le panneau. Appels internes uniquement :
aucune validation des routes opérateur externes, du matériel audio ou d’un mobile.

- Sortant décroché : 37 secondes, mesure avant raccrochage de 1 442 paquets
  envoyés et 1 429 reçus ; énergie audio reçue non nulle.
- Entrant décroché : 27 secondes, mesure de 1 208 paquets envoyés et 1 193 reçus ;
  énergie audio reçue non nulle. Un entrant non décroché produit `missed`.
- Le parent reçoit les phases dialing/ringing-in, active, ended et l’issue
  answered. Champs observés conformes au contrat ; mot de passe absent.
- Handshake vérifié entre deux origines locales distinctes. Les appels avec
  interaction ont été effectués sur une même origine locale : ils ne valident
  ni l’isolation du formulaire entre sites ni les cookies tiers.
- API réelle testée séparément par session HTTP : authentification 200, rôle
  agent, un seul poste dans le dashboard ; sélection d’un autre poste ou d’une
  équipe refusée 403. Session de vérification déconnectée (200).

### Blocages constatés lors du premier pilote (traités par la version ci-dessus)

1. Les en-têtes HTTPS de production refusent encore l’iframe avec
   `frame-ancestors 'none'`. Le module ES n’a pas d’autorisation CORS pour un
   import direct depuis un CRM tiers. Préparer une publication ciblée, ou
   distribuer le SDK dans le site hôte, sans ouvrir les API de données.
2. La session réelle porte `SameSite=Strict` (vérifié sur la réponse API).
   L’authentification du journal/profil/TURN dans une iframe sur un autre site
   demande un mécanisme approprié et des essais navigateur. Ne pas simplement
   désactiver globalement la protection des cookies ou les contrôles CSRF.

Le banc local n’exposait pas l’API serveur : le téléphone gardait sa connexion
SIP mais fonctionnait avec un espace de données temporaire. `state.connection`
et `sessionOpen` décrivent la session téléphonique ; ils ne garantissent pas
la disponibilité du journal, du profil ou du relais TURN. La réussite du test
HTTP séparé ne résout pas cette limite navigateur.

### Ce qui sort vers le client

Le **SDK navigateur** envoie uniquement les champs `state`/`call` documentés
ci-dessus. L’API interne sert davantage de données au téléphone authentifié
(journal, profil, métadonnées d’enregistrement), avec le périmètre de sa ligne ;
elles ne sont pas automatiquement exportées au CRM. Le numéro et l’identifiant
d’appel restent visibles par le site autorisé. Pas d’API publique d’historique,
de contacts, de qualifications ou d’enregistrements livrée dans cette version.
Les événements ne sont pas des webhooks et ne garantissent pas une livraison
après fermeture du navigateur. Le paramètre `phone` reste un préremplissage ; la version administrable ajoute
le contrôle serveur de son appartenance à l’équipe cliente.

Vérifications : 251 tests, typage, lint et build réussis. Aucune nouvelle release
frontend/backend ni migration. Réactivation, sauvegardes et retrait du circuit
interne consignés dans le dépôt privé de gestion. Preuves locales exclues de Git :
`.work/embed-live-review/`. Manuels clients inchangés.
