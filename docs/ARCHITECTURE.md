# Architecture ApisnixPhone

## Relais WebRTC par ligne — 14 octobre 2026

`mediaPath.ts` obtient les accès TURN par session HTTP, jamais par variable de
build ou stockage navigateur. Le fetch natif est appelé par une fonction
intermédiaire pour conserver son contexte navigateur, pour GET comme pour POST. `sipEnvironment.ts` configure le PeerConnection
avant création d'offre, garde la collecte directe d'origine en secours et émet
les compteurs techniques uniquement pour les lignes autorisées par le backend.
Les credentials expirent, sont revalidés au nouvel appel (cache mémoire 60 s),
et ne sont pas changés pendant la conversation. Le contrôle de disponibilité
TURN précède uniquement l'appel sortant ; il ne répare
pas automatiquement un réseau coupé en cours d'appel.
`callWakeLock.ts`, lié au cycle de vie de la page, limite la veille automatique
d'un appel visible. Le refus ou l'absence de cette API ne bloque jamais l'appel.

Early media, depuis le 14 octobre : la réponse `/api/webphone-ice` porte
`earlyMedia` et peut livrer une liste de serveurs vide (ligne gardée sur son
trajet direct). `prepareMedia` rend ce choix au contrôleur, qui le passe à
l'invitation SIP.js (`earlyMedia: true`) : la réponse SDP du 183 est appliquée
aussitôt, ICE puis DTLS se négocient pendant la sonnerie et le 200 OK ne change
plus le média (Asterisk ne fork pas, condition exigée par SIP.js). SIP.js attache
alors le flux distant dès le 183 ; le contrôleur garde la sonnerie locale et ne
l'arrête lorsqu'une piste distante vivante est non muette, soit à l'inspection
initiale, soit à l'événement `unmute`. Une piste déjà disponible est traitée
immédiatement ; les écouteurs sont retirés dès l'arrêt, au décroché et à la fin.
Cela prouve la disponibilité du média, pas une énergie sonore ou une parole audible. Sans choix du
serveur, l'invitation reste identique à avant. Cela exige aussi que le PBX livre
un SDP provisoire au navigateur : l'option `r` de `Dial` force une sonnerie
sans audio avant réponse et retient la progression opérateur. Depuis le
14 octobre à 19:34:45, la route France exécute un `Progress()` pour le seul
peer Fcadyn014 avant ce `Dial` (outil et retour dans le dépôt privé) : le 183
avec SDP part dès l'INVITE et Asterisk fait entendre sa propre tonalité de
sonnerie en bande, sans audio opérateur avant la réponse. ICE/DTLS avant
décroché restent à mesurer sur un appel réel.


## Composants

Deux adaptations natives des clients Linphone, sans moteur SIP réécrit et sans
interface Flutter. Android utilise Kotlin/XML ; Desktop utilise C++/Qt/QML.
Liblinphone assure l'enregistrement SIP, les appels et l'audio.

```text
ApisnixPhone Android ou Windows
        │ SIP UDP par défaut (TCP/TLS possibles)
        ▼
apisnix-crm.com — Asterisk
        │
        └─ Routage et comptes gérés par APISNIX
```

La signalisation SIP et le média audio sont deux flux distincts, gérés par le
moteur existant. Aucun serveur intermédiaire APISNIX supplémentaire n'a été créé.

## Application web PC

Le [plan web du 18 septembre](WEBPHONE_PLAN.md) décrit un troisième client,
indépendant des adaptations Linphone : SPA statique React/TypeScript/Vite,
SIP.js et WebRTC du navigateur. Signalisation WSS et audio DTLS-SRTP vers le
PBX existant ; pas de remplacement du webphone VICIdial ni de moteur serveur.
Journal et contacts locaux en V1, raccordement à un historique central séparé
si demandé. Aucun mot de passe SIP persistant dans l'application.

Le contrôleur téléphonique reste actif pendant la navigation entre les vues.
`telephony/pageLifecycle.ts`, installé au niveau AppProvider, avertit avant
le départ puis demande `disconnect()` sur `pagehide`. Il ne traite ni
`visibilitychange` ni les navigations internes. Un `pageshow.persisted`
recharge le document afin de ne pas réutiliser une session détruite. La perte
WSS demande la terminaison SIP avant de vider la référence locale. Ces chemins
sont au mieux : l’expiration d’un dialogue inaccessible relève aussi du PBX.

Une implémentation démo sans réseau permet les tests d'interface. Les sources
sont dans `webphone/`, car `apps/` reste ignoré pour les checkouts natifs.

État au 21 septembre : l'interface, ses couches et les deux contrôleurs sont
implémentés ; **aucun appel réel n'a encore été passé**. `src/telephony/types.ts`
porte le contrat `PhoneController`. `DemoPhoneController` n'ouvre aucun WebSocket
et ne demande jamais le micro. `SipPhoneController` adapte `Web.SessionManager`
de SIP.js 0.21.2 avec les options du plan (une session, pas de boucle de
REGISTER, DTMF RTP, journaux SIP coupés, mot de passe en mémoire) ;
`sipEnvironment.ts` charge SIP.js à la demande, crée l'élément audio hors des
vues. Depuis le 8 octobre, aucun Web Lock ne bloque l’authentification. Le contrôleur est choisi au chargement :
`VITE_APP_MODE=live` avec `VITE_SIP_DOMAIN` et `VITE_SIP_WSS_URL`, sinon démo.
`audio.ts` transmet toujours la piste originale du micro à 100 %, sans chaîne
Web Audio dans l'émission. Le champ historique `micGain` est normalisé à 100
par `DataStore` avant notification/persistance ; les anciennes valeurs sont
également ignorées par la capture. Le test observe une branche analyseur
séparée, sans sortie haut-parleur. Une acquisition tardive après fermeture est
annulée et ses pistes arrêtées. La sonnerie attend un contexte audio actif
avant de programmer des notes, sans accumulation pendant sa suspension ; une
reprise tardive après raccrochage ne la relance pas. Clic, pointeur et clavier
réveillent les sorties autorisées. La sonnerie est générée, sans fichier audio,
à partir de la bibliothèque `ringtones.ts` (partitions de notes Web Audio, calmes ou bruyantes ; choix
`ringtoneSound` des préférences, identifiant inconnu ramené à Classique). `keypadTone` joue localement la
double fréquence DTMF d'une touche du pavé ; le DTMF envoyé pendant un appel reste celui de SIP.js.
`src/domain/numbers.ts` sépare saisie, numéro composé et métadonnées
d'affichage. Depuis le 13 octobre, `customerNumber` interprète le format exact
`633` suivi de neuf chiffres (premier 1–9) comme `6` + numéro français `33…`,
globalement : aucune destination Philippines n'est proposée. Variantes `+`/`00`
et séparateurs visuels acceptés ; extensions, autres préfixes et numéros
incomplets conservés. Cette règle précède la numérotation, le pays et la
comparaison de numéros. `DataStore` normalise le journal et les rappels avant
notification/persistance, y compris au chargement d'un ancien profil ; les
adaptateurs du journal central/audio normalisent aussi les réponses anciennes.
Notes, contacts, IDs, dates et tags sont conservés. Le backend applique la même
règle à l'ingestion des appels et aux profils GET/PUT, avec migration explicite
de l'historique. Le préfixe de routage reste ajouté par le PBX pour l'opérateur.
`src/domain/callbacks.ts` porte les rappels planifiés.
`src/storage/DataStore.ts` maintient le profil en mémoire et regroupe les écritures
pendant 300 ms. En ligne réelle, `ServerPersistence` charge puis sauvegarde le
profil via `/api/webphone-profile`, dans la base de supervision Hermes, sous
l'identité du poste authentifié par `/api/line-session`. Le profil reste lié au
poste ; une attribution explicite à un nouveau client le remet à zéro, incrémente
une version d’attribution et ferme les sessions. Cette version et la révision du
profil protègent les écritures contre les anciens appareils ; la version du compte
est aussi vérifiée avant sauvegarde. Changer d’abord le mot de passe SIP dans
VICIdial reste nécessaire lors d’une remise à un nouveau client.

La conservation est activée par défaut et peut être désactivée dans les réglages.
Le serveur ne garde alors que le refus de conservation ; les données et réglages
utilisés ensuite restent en mémoire jusqu’à la fermeture de la session. Le bouton
d’effacement retire les collections en conservant les réglages et le choix de
conservation. Il ne touche pas au journal central ni aux fichiers audio.
Le journal observé est limité à 1000 appels / 30 jours, le journal central et les
audios aux 30 derniers jours calendaires et à la date de nouvelle attribution,
y compris les exports, lectures directes et téléchargements.

Une révision protège contre les écrasements concurrents (409). L’état de sauvegarde
et son bouton Réessayer sont affichés uniquement dans Réglages → Données, sans
bandeau global. Réessai du dernier état en mémoire, attente des écritures à la
déconnexion et avertissement avant abandon sont conservés. Une réattribution impose une nouvelle
session ; l’ancien état n’est pas réimporté. L’import automatique IndexedDB est
arrêté, les anciennes copies locales restent intactes. Aucun secret SIP conservé.
Le login est verrouillé jusqu’à la fin de l’ouverture SIP puis du profil. Un refus
ou une panne HTTP ne déconnecte plus un SIP accepté : une session mémoire protégée
s’ouvre, sans écriture serveur ni réessai de sauvegarde sur un profil jamais chargé.
Les commandes de conservation/effacement sont alors désactivées ; un message dans
les réglages demande de se reconnecter hors appel. Aucun import ni fusion de ces
ajouts temporaires lors de la reprise. Si seul le premier enregistrement du profil
chargé échoue, les données chargées et leur réessai sont conservés. Les requêtes HTTP
expirent à 15 secondes chacune ; le carillon initial annonce l’ouverture de l’espace,
pas le seul REGISTER. `lineSounds.ts` est installé dans Workspace : contrôle de la
ligne prête et du compte au prochain rendu, annulation au démontage/perte de ligne,
respect du volume et des sons désactivés, sans double annonce sous StrictMode.
Les droits HTTP restent contrôlés par le service. La démo reste fictive.

`src/announcements/client.ts` lit les annonces APISNIX publiées par le PBX
(`agc/apisnix/annonces.json.php?cible=telephone`, lecture seule, CORS ouvert,
origine déjà autorisée par la CSP `connect-src`), sans relais.
`parseAnnouncements` n'accepte que des objets avec identifiant et titre ou
texte, borne les champs comme le relais de la supervision, ramène un type
inconnu à `info`, ne garde que les liens http(s) et dix annonces au plus.
`loadAnnouncements` charge une seule fois à l'ouverture de l'espace, choix de
Franck ; un échec (réseau, HTTP, JSON) rend `null` et n'affiche rien ; une
réponse arrivée après la fermeture de l'espace est ignorée. Le masquage écrit `apisnix-annonce-vue-<id>`
= `maj` dans `localStorage`, clé partagée avec l'écran agent et la supervision,
et reste en mémoire pour la session si le stockage refuse ; les alertes ne se
masquent jamais. `features/announcements/` porte le hook et les cartes : texte
rendu par React, jamais injecté ; lien `target=_blank` `rel=noopener noreferrer`.
Les cartes sont montées dans `App.tsx` au-dessus du Journal et de ses onglets,
dans leur propre `ErrorBoundary`, hors du panneau d'appel. La démonstration
utilise `DemoAnnouncementsSource`, sans réseau. `VITE_ANNOUNCEMENTS_URL`
remplace l'adresse déduite de `VITE_SIP_DOMAIN`.

Plusieurs onglets peuvent se connecter. Le PBX conserve un contact par compte ;
`watchLine()` interroge ce contact toutes les 45 s. Deux réponses successives
indiquant un autre contact mettent l’ancien poste en pause, hors appel seulement.
Une réponse inconnue ne déclenche aucune pause. Une petite bannière jaune propose
« Reprendre ici », sans rechargement ni reprise automatique. Les contrôles en
arrière-plan peuvent être retardés par le navigateur. La fermeture d’un poste
n’envoie un désenregistrement que si le contact lui appartient encore ; sinon,
fermeture silencieuse pour préserver la nouvelle session. Après un refus de
connexion, pas de requête supplémentaire de vérification du contact.
Un refus SIP final 403/404 signale un refus serveur (compte/configuration possible)
au lieu d’affirmer que le mot de passe est incorrect.

Les identifiants de périphériques audio et l'autorisation des notifications ne
voyagent pas entre appareils ; les volumes, sonneries, thème, langue, densité et
options audio sont enregistrés avec la ligne. Aucun secret SIP dans le profil.
`src/app/AppContext.tsx` monte un contrôleur unique hors des vues et inscrit au
journal les seuls appels observés. `src/i18n/` porte les trois dictionnaires
français/anglais/espagnol et `useI18n` ; langue et thème gardent aussi un choix
local pour l'écran de connexion, puis suivent le profil serveur connecté.
Le téléphone est en service ; références courantes dans PROJECT_STATE et OPERATIONS.

## Sources de référence

| Composant | Base | Référence |
| --- | --- | --- |
| Android | Linphone Android 6.2.7 | `1fde063979b68608e10a043b981e5ddd829a3a9e` |
| Moteur Android | SDK Maven Linphone | `5.5.21` |
| Desktop | Linphone Desktop 6.2.2 | `29e500257525bb1b10668f09bfd6c485fb27fa87` |
| Moteur Desktop | Sous-module amont `external/linphone-sdk` | Révision `29c17f19aead75a838e50bb37317e7ca8eb20f02`, verrouillée dans `desktop-sdk.lock.json` ; compilée sur Windows x64 |

`sources.lock.json` fait autorité sur les dépôts, tags et commits. Le moteur
Android est fixé dans `gradle/libs.versions.toml`. Les autres dépendances amont
sont conservées ; il ne s'agit pas d'une garantie de build identique bit pour bit.

## Organisation locale

- `apps/android`, `apps/desktop` : sources de travail, ignorées à la racine.
- `patches/*.patch` : adaptations APISNIX exportées depuis les commits fixés.
- `scripts/prepare-sources.py` : téléchargement, vérification de référence,
  application du patch ; refuse de remplacer un dossier existant.
- `scripts/export-patches.py` : sauvegarde des changements suivis par Git,
  avec contrôle du commit de base et refus des nouveaux fichiers non suivis.
- `desktop-sdk.lock.json` et `scripts/prepare-desktop-sdk.py` : miroir officiel
  GitHub du SDK et URLs des dépendances, vérifiées contre les commits Git
  inscrits dans l’arbre du SDK. Les dépendances externes sans miroir officiel
  accessible utilisent les copies publiques `a791143125-arch/external-*` ; aucune
  branche de ces miroirs n’est choisie à la place du commit d’origine.
- `scripts/build-*` : construction des fichiers de test.
- `.github/workflows/build-windows.yml` : build Windows x64 déclenché manuellement,
  Windows Server 2022, Qt 6.10.0, dépendances MSYS2, installateur conservé 14 jours.
- `branding/` et `scripts/prepare-branding.py` : logo original copié et export des
  ressources de marque ; voir [identité](../branding/README.md).
- `dist/` : binaires locaux, hors suivi source.
- `.tools/`, `.work/` : outils et travail temporaires, hors suivi source.

## Personnalisation

Les deux clients ouvrent la connexion SIP tierce native avec le domaine
`apisnix-crm.com`. Domaine, nom d'affichage et transport sont regroupés dans
les paramètres avancés. Le mot de passe Android est utilisé sans supprimer
les espaces. Le bouton Android exige identifiant et mot de passe non vides.

À partir du pilote Android `.3`, le pays du réseau mobile ne préremplit plus
un indicatif SIP. Le paramètre `useInternationalPrefixForCallsAndChats` est
désactivé pour les nouveaux comptes tiers et migré une fois pour les comptes
existants avant `config_version=602008`. Le moteur conserve les chiffres saisis ;
un choix explicite ultérieur dans les paramètres reste possible. Voir
[NUMEROTATION_ANDROID.md](NUMEROTATION_ANDROID.md).

Ne pas remplacer le paramètre interne `default_domain` par le domaine APISNIX :
la base s'en sert pour distinguer les comptes Linphone/Flexisip des comptes SIP
tiers. Utiliser `assistant_third_party_sip_account_domain` pour notre serveur.

Le chat et les réunions sont masqués. Les transports SIP restent conservés.
Pour le pilote Windows, `ENABLE_RNNOISE=OFF` désactive le réducteur de bruit
RNNoise : son commit exact n’est pas disponible via un miroir accessible.
L’annulation d’écho WebRTC reste activée par défaut. Ce compromis est propre
au build Windows ; le SDK Android n’est pas modifié.
L'adaptation ne prétend pas avoir retiré toute la vidéo ou tous les écrans amont.

Le pilote Desktop compact ajoute deux pages QML pour la numérotation et l'appel
audio, reliées aux mêmes modèles natifs. Base de fenêtre 420 × 680 ; historique,
contacts, réglages et fonctions avancées conservent l'interface complète avec
retour au téléphone. L'assistant SIP direct précède l'accueil de premier
lancement. Voir [le format compact](FENETRE_COMPACTE.md) pour les contrôles et
les limites. Aucun changement du SDK, des codecs ou des routes SIP.

L'envoi de logs et la recherche de mise à jour vers les services Linphone sont
désactivés dans la configuration personnalisée. Les configurations Google et
la signature de démonstration amont sont retirées au moment de la préparation.
Les futurs secrets de signature restent hors sources et hors patches.

## Licences et extensions

La marque applicative change ; les licences, copyrights et auteurs amont
restent. Les clients sont proposés sous GPLv3 et le SDK inclut des composants
sous AGPLv3 : conserver les textes de chaque composant et prévoir la remise des
sources correspondantes lors de la distribution. Voir l'étude pour les sources.

Le client Desktop peut servir de base à macOS. iPhone nécessitera une adaptation
du client iOS, sa signature et son propre cycle de validation ; rien n'est encore
compilé pour ces deux plateformes. Les prérequis vérifiés et les accès Apple
à préciser sont dans [PLATEFORMES_APPLE.md](PLATEFORMES_APPLE.md).

## Reprise de session web — 13 octobre 2026

`SipPhoneController` conserve la session souhaitée après une première
inscription acceptée et retente le transport avec délai croissant plafonné à
15 s (hors durée des requêtes) ; le contrôle périodique de 45 s peut aussi déclencher la reprise. SIP.js
ne pilote plus une seconde boucle de reconnexion. `holdsLine()` renvoie true,
false, missing ou null : seul missing prouve une liaison effacée et réparable.
Le garde SessionManager bloque les inscriptions automatiques si un autre
contact détient le compte ou si le résultat est inconnu. Réparation hors appel,
réponses asynchrones revérifiées et contrôle unique en vol. Le renouvellement
natif REGISTER et son acquittement restent gérés par SIP.js ; le contrôleur
réaffiche ready seulement après acceptation, y compris lors d'un rafraîchissement.

Une réponse inconnue après le contrôle de 8 s fait remplacer le manager/socket
hors appel ; `contactName` est transmis à la nouvelle instance pour reconnaître
notre ancien contact, avec `registerGuard` activé dès sa création. Aucun REGISTER
modifiant la ligne n'est autorisé tant que le garde ne confirme pas notre contact
ou son absence. `dropSilently` retire l'ancienne instance sans UNREGISTER sur
la liaison ; un numéro de génération ignore ses callbacks retardés. Une fermeture
WSS bloquée ne retarde pas la création de son remplacement.

Le snapshot expose `recoverySince` continu pendant la panne et `retryAt` pour
limiter les clics à une tentative par 10 s. Après 10 s, `App` affiche le bouton
`reconnect()` dans toutes les vues, hors appel. Il remplace la connexion sans
fermer le compte, ni relire/écraser le profil ; identifiants en mémoire uniquement.
Le bouton ne contourne pas la protection d'une ligne prise ailleurs.

`pageLifecycle` recontrôle au retour visible, online, resume et lors du
`change` de NetworkInformation si disponible. Le transport
envoie un double CRLF toutes les 24–30 s ; expiration demandée 300 s et
renouvellement à mi-parcours selon la valeur négociée. Aucun Worker ou nouveau
service de fond : une page gelée ne peut pas promettre de rester joignable.
Comparaison : [Zoiper réagit aux changements réseau du système](https://www.zoiper.com/en/support/home/article/66/Network%20change%20detected) ;
[Chrome peut geler les tâches d'un onglet](https://developer.chrome.com/docs/web-platform/page-lifecycle-api).
Aucun constat public sur des comptes clients dans ce dépôt.


## Notifications du navigateur — 14 octobre 2026

`NotificationOffer` propose l'autorisation une seule fois après un appel
sortant terminé ou entrant répondu puis terminé, hors appel actif. Le clic
Activer appelle `enableNotifications()` dans le geste utilisateur. Le module
`telephony/notifications.ts` conserve seulement le choix de notifications et
le fait que la proposition a été vue dans deux clés locales au navigateur ;
aucun identifiant client ni secret. La permission reste propre à l'origine.
La connexion restaure l'activation locale ; le profil serveur conserve toujours
`notifications: false`, conformément à la séparation des appareils.

Le script statique `/notifications-sw.js` permet `showNotification()` sur
Android, où le constructeur `Notification` est généralement interdit. Il
ramène une fenêtre du téléphone au premier plan au clic ou ouvre `/`. Aucun
fetch, cache, push, secret ou contrôle SIP dans ce worker. Son enregistrement
est déclenché à l'activation ou au premier événement autorisé ; échec ou refus
ne casse jamais l'interface d'appel. Une notification entrante en attente de
création est annulée lorsque l'appel finit ; les alertes créées sont fermées
par tag unique. Il ne garantit pas l'arrivée d'appels si la page est gelée.

## Admission d’un appel entrant — 16 octobre 2026

Le téléphone gère une seule conversation. `sipEnvironment.ts` intercepte le
nouvel INVITE du UserAgent avant le handler de SessionManager : la version
SIP.js 0.21.2 compare `length > max` avant l’ajout et sa limite seule est donc
insuffisante. Si une session gérée existe, si le manager est retiré ou si
`ManagerDelegate.canReceiveCall()` refuse, l’invitation reçoit 486 Busy Here.
Le handler natif n’est pas appelé : pas de onCallCreated/onCallReceived, de
remplacement de la référence du contrôleur ni de nettoyage audio partagé
pour cette invitation. Le rejet échoué reste isolé de la conversation.

La disponibilité du contrôleur exige une connexion prête et voulue, une
génération courante et aucun appel non terminé. Elle protège notamment
l’intervalle de préparation TURN/early media où managedSessions est encore
vide. Les re-INVITE du dialogue existant restent gérés par SIP.js (attente et
reprise), cette interception concerne les nouvelles invitations. La fiche
de fin d’appel ne bloque pas la réception après libération des sessions.
Le PBX peut refuser le deuxième appel avant qu’il n’arrive au navigateur :
ni notification universelle ni journal local exhaustif des refus promis.

Le double appel demanderait deux sessions identifiées et des états/médias
séparés, une seule émission active, confirmation de mise en attente avant
acceptation du second, restauration du premier en cas d’échec, commandes et
journaux ciblés, puis limites PBX adaptées sur un pilote. Ce travail n’est
pas activé par la correction de protection.
