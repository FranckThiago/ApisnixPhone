# Journal des changements

## 2026-09-25 — Sons du clavier publiés sur Hermes

- À la demande de Franck, release `20260925-keypad-tones` (source `bf357bd`,
  qui contient aussi le Journal du poste de `bb0a5d2`) publiée à 23:23:49
  Africa/Douala. Build isolé : `npm ci` sans vulnérabilité, typage, lint,
  53 tests, build live ; archive SHA-256
  `576888b9a64468b1ac5558b83bf56995ea8dada76652bcfb6df75d48810ae7db`.
- Comparée à `20260925-line-journal` alors en ligne : seuls `index.html`, le JS
  principal et le module SIP.js changent. Sauvegarde protégée, manifeste
  contrôlé, bascule atomique sans rechargement Caddy ; fichiers publics
  identiques au build, `/api/me` anonyme 401, écran de connexion sans erreur.
- Correction : l'entrée « Sons du clavier » de l'état du projet donnait
  `20260925-sonneries` comme release active alors que `20260925-line-journal`
  était déjà publiée.
- Contrôle des appels web en cours non fait (lecture PBX refusée par les
  permissions de la session) ; la bascule ne coupe aucun appel.

## 2026-09-25 — Tonalité sous chaque touche du pavé

- Demande de Franck : un petit son à chaque touche en composant, comme sur les
  téléphones classiques.
- `keypadTone` (`telephony/audio.ts`) joue la double fréquence DTMF de la
  touche (697–941 Hz × 1209–1477 Hz) pendant environ 150 ms, au volume
  d'écoute. Jouée à l'appui sur le pavé (pointeur, ou Entrée/Espace sur une
  touche), sur le pavé d'appel et pour les chiffres tapés pendant un appel.
  Purement local : l'envoi DTMF de la ligne est inchangé.
- Préférence `keypadTones` (activée par défaut), réglage « Sons du clavier ».
- Faux objets Web Audio partagés dans `tests/fakeAudio.ts` ; 2 tests ajoutés
  (53). Typage, lint réussis ; démonstration vérifiée (composition, réglage
  coupé, pavé et clavier pendant un appel). Guide et PDF mis à jour, plan des
  réglages complété. Non publié sur Hermes.

## 2026-09-25 — AGENTS.md aligné sur le téléphone web en service

- À la demande de Franck, `AGENTS.md` ne dit plus que le téléphone web n'a
  « jamais été essayé sur le PBX » : il est en service sur Hermes, avec appels
  réels confirmés le 21 septembre. Il renvoie à `docs/OPERATIONS.md` pour la
  release active et la publication, sans nom de release qui vieillirait.

## 2026-09-25 — Sonneries publiées sur Hermes

- À la demande de Franck, release `20260925-sonneries` (source `191caa9`)
  publiée à 12:03:31 Africa/Douala. Build isolé depuis Git : `npm ci` sans
  vulnérabilité, typage, lint, 50 tests, build live ; 266 fichiers sans
  fichier caché, `.env` ni source map. Archive SHA-256
  `c7b9bebd1451408b51c5b631df0fce67f40c2febce92e8742a5255cfa4076a6b`.
- Hermes vérifié, sauvegarde protégée, extraction contrôlée par manifeste,
  bascule atomique de `current` depuis `20260924-journal-rappels`, sans
  rechargement Caddy ni changement PBX, DNS ou supervision. Fichiers publics
  identiques au build ; en-têtes, repli SPA et écran de connexion contrôlés.
- Limite : le contrôle des appels web en cours sur le PBX a été refusé par
  les permissions de la session ; il n'a pas été contourné. La bascule ne
  coupe aucun appel ; un onglet ouvert avant elle doit être actualisé.

## 2026-09-25 — Sonneries plus fortes, Clairon refait

- Retour de Franck après écoute : le volume est trop bas partout, les calmes
  sont douces mais trop faibles et Clairon n'est pas assez fort.
- Niveaux relevés pour les huit sonneries, avec un maximum entre 0,84 et 0,94
  à plein volume, sous le seuil de saturation (+8 à +13 dB selon le son).
  Les calmes gardent leurs ondes douces.
- Clairon : fanfare une octave plus haut (sol 5 à sol 6), dents de scie
  doublées d'une onde carrée une octave plus bas, notes tenues, motif plus
  long. Il passe du son le plus faible (-16,6 dB efficaces) à -6,3 dB.
- Test ajouté au garde-fou : chaque sonnerie doit dépasser 0,8 de crête sans
  atteindre 1. 50 tests, typage et lint réussis ; lecture vérifiée en
  démonstration. Capture `19-sonneries.png` et PDF du guide régénérés.
  Non publié sur Hermes.

## 2026-09-25 — Bibliothèque de sonneries du téléphone web

- Demande de Franck : une petite bibliothèque de sonneries dans ApisnixPhone,
  avec des sons bruyants et d'autres plus calmes.
- `telephony/ringtones.ts` décrit huit sonneries comme des partitions de notes
  jouées par Web Audio : quatre calmes (ondes sinus et triangle) et quatre
  bruyantes (ondes carrées et en dents de scie, plus perçantes). Pas de fichier
  audio à livrer ni de licence à gérer. `Ringer` joue le son choisi et coupe
  désormais sa sortie à l'arrêt, au lieu de laisser finir la note en cours.
- Préférence `ringtoneSound` (défaut Classique, identique à l'ancienne
  sonnerie ; identifiant inconnu ramené à Classique), transmise aux
  contrôleurs réel et de démonstration. `RingtonePicker` dans Réglages → Audio :
  choix avec écoute, grisé quand la sonnerie est coupée.
- 7 tests ajoutés (50) : bibliothèque, absence de saturation à plein volume,
  durée d'écoute, planification et arrêt. Typage, lint réussis ; essai en
  démonstration dans le navigateur intégré (appel simulé, refus, mobile).
- Guide : § 6 et § 11, nouvelle capture `19-sonneries.png`, capture Réglages et
  PDF régénérés. Non publié sur Hermes.

## 2026-09-24 — Audio visible dans le menu compact

- Le CSS masquait le bouton Audio à 920 px et moins. Le bouton reste visible
  dans la barre du bas, avec une largeur de Téléphone adaptée aux petits écrans.
- Session Audio réelle d'un poste classé ouverte dans le navigateur intégré ;
  cinq fichiers listés sur sept jours. La lecture et le téléchargement ne sont
  pas encore vérifiés.
- Captures mobiles et PDF du guide actualisés. Typage, lint, 43 tests et build
  live réussis ; release `20260924-audio-mobile-nav` publiée sur Hermes.
  Sauvegarde ciblée, contrôle HTTPS et retour dans OPERATIONS.

## 2026-09-24 — Audio publié et guide client régénéré

- Release web `20260924-audio-agent` en service sur Hermes après build live,
  43 tests, typage et lint. Les 266 fichiers servis incluent l'onglet Audio ;
  le JS public correspond au build. La supervision et les deux passerelles PBX
  portent le rôle agent et la vérification de la ligne (fiche détaillée dans
  le dépôt privé). API HTTPS 200 et faux mot de passe refusé ; essai audio
  avec une ligne valide encore à faire.
- Guide client : capture de l'onglet Audio ajoutée ; toutes les captures et le
  PDF ont été régénérés. Le script de captures utilise désormais la bascule
  Favoris de Contacts.

## 2026-09-24 — Onglet Audio : l'agent écoute et télécharge ses enregistrements

- Demande de Franck : dans l'interface d'appel, remplacer Favoris par Audio,
  où l'agent retrouve ses propres enregistrements, en streaming ou en
  téléchargement, quelques minutes après l'appel ; les favoris passent dans
  Contacts.
- Webphone : vue `features/recordings/Recordings.tsx`, client
  `recordings/client.ts` (source HTTP vers l'accès agent de la supervision,
  source de démonstration hors ligne), bascule Tous / Favoris dans Contacts,
  palette enrichie, `VITE_RECORDINGS_URL` (vide = `/api` même origine).
  5 tests ajoutés (43), lint, typage et build réussis.
- Prérequis serveur documentés dans OPERATIONS (relais Caddy `/api/*`,
  `trusted_hosts`) ; rôle agent livré dans le dépôt de gestion (`53a1e2f`).
  Guide utilisateur : § 8 bis. Captures non régénérées (script absent).
- Même jour, à la demande de Franck : plus rien à saisir. Le téléphone ouvre
  l'accès avec les identifiants de la ligne (`POST /api/line-session`), que la
  supervision fait confirmer par le PBX en lecture seule ; formulaire retiré,
  bouton Réessayer en cas d'échec, identifiants gardés en mémoire de session
  seulement. Déploiement demandé mais bloqué par les permissions de la session
  (voir PROJECT_STATE).

## 2026-09-23 — Protection Fail2ban du WSS documentée

- Sur le PBX, une jail Fail2ban bloque désormais le WSS 8089 après des échecs
  répétés ; auparavant, une IP bannie gardait le WSS. `OPERATIONS.md` signale ce
  blocage possible du téléphone web. Seuils, sauvegarde et retour documentés
  dans le dépôt privé de gestion (`9b64f76`).

## 2026-09-22 — Ordre réel des callbacks SIP.js corrigé

- SIP.js termine la session avant d'appeler le callback contenant le code de
  refus de l'INVITE. La clôture d'un appel sortant non répondu attend maintenant
  la microtâche suivante pour conserver ce code dans la fiche et le Journal.
- Les tests reproduisent cet ordre pour les six refus, vérifient l'appel
  suivant et la fin sans code SIP ; typage, lint et 38 tests réussis.
  Release `20260922-sip-diagnostics-v2` (`a794199`) publiée sur Hermes :
  archive ustar SHA-256
  `77da467bfabbf3c08ea369d3ef16a64d28aaaae93fa00e1794d6c348fdfb40f5`,
  sauvegarde `/root/apisnix-phone-backups/20260922-sip-diagnostics-v2/`.
  JS public et navigateur intégrés contrôlés ; aucun retour ni appel de test.

## 2026-09-22 — Diagnostics des refus SIP en appel sortant

- Les réponses SIP 403, 404, 480, 486, 488 et 503 reçues pendant un appel
  sortant affichent leur code, leur libellé et une explication française dans
  la fiche de fin d'appel. Le diagnostic est conservé dans le Journal local.
  `480` désigne désormais un échec temporaire et `486` reste « Occupé ».
- La cause SIP est effacée au prochain appel. Deux tests couvrent les six
  réponses et l'absence de report d'une erreur sur l'appel suivant ; typage,
  lint et suite complète réussis. Aucun refus réel n'a été provoqué sur le PBX.
- Guide utilisateur et PDF actualisés. Release `20260922-sip-diagnostics`
  (`dff2b26`) publiée sur Hermes depuis une archive Git isolée, avec sauvegarde
  `/root/apisnix-phone-backups/20260922-sip-diagnostics/`. Bascule du lien
  `current` seule ; HTTPS, JS servi, cache et écran de connexion contrôlés,
  sans appel de test ni modification PBX/Caddy. Retour non effectué.

## 2026-09-22 — Reconnexion immédiate après déconnexion dans le même onglet

- Franck signale que se déconnecter puis se reconnecter aussitôt affiche
  « Cette ligne est déjà ouverte dans un autre onglet » ; une actualisation
  suffisait. Cause : la déconnexion résolvait la promesse qui tenait le verrou
  Web Locks sans attendre que le navigateur l'ait effectivement rendu, donc la
  connexion suivante, lancée dans la foulée, trouvait encore son propre verrou.
- `sipEnvironment.acquireLine` renvoie une fonction de libération qui attend
  la fin réelle de `navigator.locks.request` ; le contrôleur l'attend dans
  `teardown` avant de passer hors ligne. Nouveau test : `disconnect()` ne se
  termine pas tant que le verrou n'est pas rendu (35 tests).
- Message de la page de connexion et guide utilisateur complétés : si l'on
  vient de se déconnecter dans cet onglet, actualiser la page. Guide PDF
  reconstruit.
- Release `20260922-tab-lock` (`b6be2a4`) basculée sur Hermes ; aucun poste
  web enregistré au moment de la bascule, JS servi et cache contrôlés.

## 2026-09-22 — Tonalité d'appel sortant et confirmation de décroché

- Pendant la sonnerie distante d'un appel sortant, le navigateur génère deux
  impulsions téléphoniques « toup toup » ; un bref son de cloche « gling » joue
  quand le correspondant décroche. Aucun fichier audio ni changement PBX.
- La tonalité démarre seulement après la progression SIP et s'arrête au
  décroché, refus, raccrochage, échec ou déconnexion. Elle suit le volume
  d'écoute ; le parcours de démonstration reproduit le même comportement.
- Le contrôleur accepte un lecteur de sons substituable afin de vérifier par
  test le démarrage, l'arrêt et le gling sans dépendre de l'audio du poste.
- Typage, lint, 34 tests, build live isolé et démonstration réussis. Guide PDF
  reconstruit et ses 16 pages contrôlées visuellement.
- Release `20260922-call-sounds` (`a757eaf`) basculée à 11:12:30 Douala après
  contrôle de zéro appel web actif. Archive SHA-256
  `5c4db9f09610d8ebdf5b41cb23f5c8102883fb8bae0f12f30d247ab500dae09f`.
  JS HTTPS identique au build, cache/en-têtes/SPA et navigateur sans erreur.
  Release 2 sauvegardée ; aucun PBX, Caddy ou DNS modifié. Essai sonore réel
  par Franck encore requis pour juger le rythme et le timbre.

## 21 septembre 2026 — Clôture du déploiement et contrôle RTP réel

- Release 2 c3ecac7 maintenue. Asterisk en lecture seule à 23:27:46 Douala :
  WSS/ApisnixPhoneWeb, contexte conservé, 3794 paquets reçus et 3488 envoyés
  en 1 min 19, zéro perte signalée. Appel entrant décroché dans la supervision.
- HTTPS/cache/JS/en-têtes/SPA et manifeste revérifiés ; Caddy/supervision actifs,
  collecteurs frais. Aucun changement PBX/DNS/Caddy, aucun appel par l'agent.
- Franck confirme les appels entrants et sortants avec audio dans les deux
  sens hors navigateur intégré. Le test A/B reste distinct.
  Le transport RTP ne prouve pas seul le contenu audible. Documentation de
  l'état courant et limites actualisée ; historique des essais conservé.

## 21 septembre 2026 — Réactivation c3ecac7 pour essai hors navigateur intégré

- Franck signale que la voix fonctionne hors du navigateur intégré Codex et
  demande explicitement de remettre c3ecac7. Release 2 réactivée à 23:23:45
  Douala ; manifeste intact et zéro appel web au contrôle 23:23:38.
- Même artefact déjà validé par 34 tests ; seul current change, sans reload
  Caddy ni onglet, sans mutation PBX/DNS/supervision. HTTPS, JS et cache validés.
- L'échec précédent est contextualisé au navigateur intégré ; sa cause reste
  indéterminée. Nouvel essai de Franck dans son navigateur habituel attendu.
  Sources de vérité actualisées ; historique du retour conservé.

## 2026-09-21 — Release 2 publiée pour rétablir l'émission de voix

- Source c3ecac7, release `20260921-webphone-2`, bascule 23:12:20 Douala.
  34 tests, typage, lint, build live isolé réussis ; contrôles d'archive sans
  secret ni donnée pilote. Aucun appel web au contrôle préalable.
- Seuls fichiers statiques et lien current changés. Version 1 intacte,
  Caddy/DNS/PBX/supervision inchangés, aucun reload. Contrôles HTTPS,
  cache, en-têtes, SPA, JS servi et navigateur intégrés réussis.
- Micro direct à 100 %, chaîne optionnelle avec repli, contrôle d'émission
  audio et consultation du contact SIP inclus. Essai réel échoué : Franck n'est
  toujours pas entendu malgré 6575 paquets reçus en 2 min 53 (21,18 % de pertes
  signalées), bonne version chargée et micro non muet dans l'interface.
- Retour prescrit vers release 1 à 23:17:20 Douala, sans recharger l'onglet
  utilisateur ni couper l'appel. Cette version conserve son défaut connu :
  ne pas diffuser aux clients. Cause restante non établie, test A/B reporté.
  OPERATIONS/PROJECT_STATE/lot 6 actualisés.

## 2026-09-21 — ApisnixPhone Web : chaîne de sensibilité du micro activée seulement sur demande

- Franck propose de retirer le réglage s'il pose problème. Choix retenu : à
  100 %, le micro est transmis directement, sans chaîne Web Audio ; la chaîne ne
  sert qu'à ceux qui déplacent le réglage, avec repli sur le micro brut si elle
  ne démarre pas. Contrepartie assumée : un changement de sensibilité ou de micro
  pendant un appel s'applique à l'appel suivant. 34 tests. À inclure dans la
  release 20260921-webphone-2.

## 2026-09-21 — ApisnixPhone Web : voix non transmise sur le site déployé

- Premier essai de Franck sur phone.apisnix-crm.com (déployé par l'autre agent) :
  il entend son correspondant, qui ne l'entend pas. Asterisk, en lecture seule :
  0 paquet RTP reçu du navigateur en 2 min 24, 7 068 envoyés. La chaîne de
  sensibilité du micro créait sa propre sortie audio sans clic récent ; restée
  endormie, elle ne produisait aucune trame, donc aucun paquet.
- Correctif : la chaîne réutilise la sortie déverrouillée à la connexion ; si
  elle ne tourne pas, le micro brut est envoyé (la sensibilité est sacrifiée,
  pas la voix). Contrôle 5 s après le décroché : si aucun paquet audio n'est
  parti, un message le dit. 34 tests. **À redéployer et à confirmer en réel.**

## 2026-09-21 — Publication HTTPS d'ApisnixPhone Web

- Release `20260921-webphone-1`, source `d9b9da4`, publiée en mode réel sur
  https://phone.apisnix-crm.com. Build isolé depuis Git : 33 tests, typage,
  lint, compilation réussis ; aucune donnée de compte dans la release.
- DNS dédié et bloc Caddy ajouté sans modifier les sites existants. Correction
  du bloc de référence : ordre `route` explicite pour appliquer `no-cache`
  après le repli vers index.html. HTTPS, redirection, cache et en-têtes validés.
- Navigateur intégré : logo, connexion réelle, aucune erreur console/CSP.
  Nouvelle origine WSS acceptée en 101 sans inscription ni appel.
- Aucun changement PBX, compte, pare-feu ou lien d'accueil. Aucun rollback.
  Essai utilisateur depuis l'URL publique attendu. OPERATIONS, PROJECT_STATE
  et lot 6 du WEBPHONE_PLAN actualisés ; détails privés dans le dépôt de gestion.

## 2026-09-21 — ApisnixPhone Web : qui tient la ligne, demandé au PBX plutôt que deviné

- Essai de Franck : pause et reprise de ligne confirmées en réel, puis fausse
  pause du poste légitime. Journal Asterisk (lecture seule) : poste déclaré
  UNREACHABLE alors qu'il tenait l'inscription ; l'arrêt des OPTIONS n'est donc
  pas un signal fiable de remplacement.
- Détection par silence supprimée. Consultation de l'inscription par REGISTER
  sans Contact toutes les 45 s, comparaison exacte du contact, deux réponses
  négatives de suite, jamais pendant un appel, rien sur réponse inconnue.
  33 tests. À confirmer en réel par Franck.

## 2026-09-21 — ApisnixPhone Web : l'interrogation reçue avant la confirmation n'est plus oubliée

- Essai de Franck : deux navigateurs, aucun bandeau après six minutes. Asterisk
  interroge le poste à l'inscription, souvent juste avant de la confirmer ; la
  confirmation remettait le repère à zéro et le poste remplacé croyait n'avoir
  jamais été interrogé. La confirmation vaut désormais preuve de tenue de
  ligne, et le rythme ne se mesure qu'entre deux vraies interrogations.
- Safari : carillon toujours muet ; Franck déconseille ce navigateur à ses
  clients et demande de ne pas insister. Guide mis à jour.
- Alerte de partage d'identifiants préparée dans la supervision (dépôt privé),
  sans blocage, à sa demande. 33 tests ici, 90 côté supervision.

## 2026-09-21 — ApisnixPhone Web : détection de ligne prise dès la première interrogation

- Essai de Franck : deux navigateurs connectés à 17 s d'intervalle, aucun ne se
  met en pause après 4 minutes. Journal Asterisk (lecture seule) : le second
  tient la ligne. Cause : la détection exigeait deux interrogations du PBX pour
  en connaître le rythme ; un poste remplacé aussitôt n'en voit qu'une. Une
  seule suffit désormais, avec le rythme chan_sip par défaut de 60 s, et la
  pause intervient après environ deux minutes de silence.
- Franck précise l'intention : empêcher le partage d'identifiants entre
  plusieurs personnes ; la coupure du poste remplacé est donc voulue.
- Carillon non entendu sous Safari : la sortie audio y passe aussi par l'état
  « interrupted » ; réveil sur tout état non actif et notes programmées
  seulement une fois la sortie active. À confirmer par Franck. 33 tests.

## 2026-09-21 — ApisnixPhone Web : un compte sur deux appareils, sans va-et-vient

- Essai de Franck avec deux navigateurs sur le même compte : son confirmé bon,
  alerte de ligne prise confirmée en réel, mais reprise de ligne alternée toutes
  les quelques minutes, appel décroché classé en échec à la coupure du socket,
  attente bloquée sur réseau instable, carte de fin d'appel débordante.
- Le poste qui perd la ligne se met en pause : socket fermé avant l'arrêt de
  SIP.js pour qu'aucune désinscription ne parte (vérifié dans le code de la
  bibliothèque : `stop()` désinscrit si le transport est ouvert). Reprise sur
  demande seulement. Issue réelle conservée pour un appel interrompu, délai de
  garde sur l'attente, grille de la carte d'appel corrigée.
- 33 tests, lint, typage, build ; guide et PDF mis à jour. Non vérifié en réel.

## 2026-09-21 — ApisnixPhone Web : son des appels entrants et reconnexion après actualisation

- Essai réel de Franck : entrant, attente et DTMF validés ; sonnerie muette,
  premier correspondant inaudible, carillon absent, bruit à la reprise d'attente.
  Diagnostic dans le code de SIP.js : lecture du son distant hors clic, refus
  silencieux. Déverrouillage audio au clic de connexion, réveil sur interaction,
  filet « Activer le son », coupure brève pendant la renégociation d'attente.
  Journaux Asterisk consultés en lecture seule : rien de lié à ces appels.
- Actualisation de page : reconnexion par le gestionnaire de mots de passe du
  navigateur (Credential Management), sans stockage applicatif du secret ;
  écart assumé et documenté par rapport à « mémoire de session uniquement ».
- Franck a proposé que l'agent saisisse le mot de passe : refusé, règle non
  négociable de l'agent ; les essais restent faits par lui. 31 tests, lint,
  typage, build. Correctifs audio à confirmer en réel.

## 2026-09-21 — ApisnixPhone Web : guide PDF, carillon en ligne réelle, raccourci K

- Franck demande un PDF du guide à envoyer aux clients :
  `docs/ApisnixPhone-Guide-utilisateur.pdf` (17 pages, couverture APISNIX),
  produit par `webphone/scripts/build-guide-pdf.mjs` depuis le Markdown et les
  captures ; le relire page par page après chaque régénération.
- Il n'entendait pas le carillon en ligne réelle alors qu'il sonnait en
  démonstration : l'enregistrement réel dure quelques secondes et le navigateur
  ne permet un son que juste après un clic. L'audio est maintenant déverrouillé
  dès le clic sur Se connecter, avec un contexte audio partagé par le carillon
  et la sonnerie. **Non réentendu par l'agent : à confirmer par Franck.**
- Pastille d'état qui pouvait être coupée sur mobile : la barre du haut ne
  rétrécit plus que le champ de recherche. Vérifié à 375 px.
- Oubli repéré en écrivant le guide : le raccourci K affiché sur le bouton
  Clavier n'était pas branché. Il l'est. Franck indique que la connexion en un
  clic fonctionnait déjà chez lui ; la correction d'attente est conservée, car
  le défaut dépend de la vitesse de réponse du PBX.

## 2026-09-21 — ApisnixPhone Web : connexion en un clic, carillon et guide illustré

- Bug signalé par Franck : il fallait cliquer deux fois sur Se connecter. En
  ligne réelle, `connect()` rend la main dès que le socket est ouvert ;
  l'ouverture de session n'attendait pas l'acceptation de l'enregistrement.
  Elle attend maintenant l'état final. La démonstration masquait le défaut.
- À sa demande : carillon d'annonce de type aéroport (trois notes de cloche
  générées, environ 2,5 s) pour la ligne prête ; bouton de déconnexion rouge et
  pied de menu sans retour à la ligne ; libellé « Ce navigateur », qu'il ne
  comprenait pas, remplacé par « Appels de cet appareil uniquement » avec
  explication ; nom `phone.apisnix-crm.com` validé, rien de déployé.
- Guide d'utilisation client `docs/GUIDE_UTILISATEUR.md` avec 17 captures
  produites par `webphone/scripts/guide-screenshots.mjs` (Chrome sans interface,
  démonstration, données fictives). 31 tests, lint, typage et build réussis.

## 2026-09-21 — ApisnixPhone Web : premier appel réel et corrections de l'essai

- Franck se connecte avec le compte pilote et appelle un mobile ; contrôles
  Asterisk en lecture seule conformes (WSS, numéro exact, routage, µ-law, MP3).
  Résultats et ce qui reste à essayer dans PROJECT_STATE ; détails serveur dans
  le dépôt privé.
- Corrigé d'après ses retours : raison d'un échec micro affichée, déconnexion
  toujours accessible, mise en page Safari (clavier, hauteur), alerte rouge quand
  la ligne est ouverte sur un autre appareil — il avait choisi l'avertissement
  plutôt qu'une coupure ; le poste averti est celui qui ne reçoit plus les
  appels, seul cas détectable depuis un navigateur. Sons de ligne prête/perdue,
  qu'il comparait à l'annonce de VICIdial. Agent utilisateur `ApisnixPhoneWeb`.
- 30 tests, lint, typage, build. Procédure d'hébergement et avis sur le
  sous-domaine ajoutés à OPERATIONS ; aucun déploiement.

## 2026-09-21 — ApisnixPhone Web : pastille des rappels et poste pilote prêt

- Retour de Franck : la pastille des Rappels était rouge. La règle jaune était
  déclarée avant la règle générale et perdait ; corrigée. Elle suit maintenant
  la même logique que les appels manqués : elle annonce les rappels arrivés à
  échéance depuis la dernière ouverture de la vue (`callbacksSeenAt`), la carte
  sous le clavier continuant de montrer ce qui reste à faire.
- Collecte ICE bornée à 2 s pour ne pas retarder l'envoi des appels.
- Franck a appliqué lui-même la surcharge WebRTC sur un autre compte de test ;
  contrôle en lecture seule : WS/WSS autorisés, chiffrement et RTCP mux actifs,
  contexte d'enregistrement et limite d'appel conservés. Détails dans le dépôt
  privé. **Aucun enregistrement ni appel réel depuis l'application à ce stade** :
  la connexion se fait par Franck, l'agent ne saisit pas de mot de passe.

## 2026-09-21 — ApisnixPhone Web : préparation du pilote et corrections d'interface

- Franck fournit un compte de test et demande le lot 5. Configuration locale du
  mode réel créée hors Git. Audit en lecture seule du poste pilote : pas encore
  compatible navigateur (UDP, sans chiffrement). Sauvegarde de ses réglages sur
  le serveur ; **l'ajout des capacités WebRTC n'a pas été appliqué**, l'écriture
  en production ayant été refusée par le garde-fou de la session. Aucun secret
  écrit dans un fichier ; l'agent ne saisit pas le mot de passe à la place de Franck.
- Bug signalé par Franck : pastille des appels manqués qui ne s'effaçait pas.
  Corrigée, avec `missedSeenAt` dans les préférences. Toasts fermables.
- Relecture du plan demandée par Franck : espace de travail conservé pendant une
  reconnexion, données de session préservées, appel entrant mis au premier
  plan, titre d'onglet, notification d'appel entrant, sonnerie en démo, bouton
  « Activer le son ». 28 tests, lint, typage et build réussis ; pastille et appel
  entrant vérifiés dans le navigateur en démonstration.
- Restent non faits : transfert, tonalité de retour d'appel locale, export de
  diagnostic, Playwright, zoom 125/150 % et contrastes mesurés.

## 2026-09-21 — ApisnixPhone Web : adaptateur SIP.js, rappels et retours de Franck

- Lot 4 demandé par Franck : `SipPhoneController` sur `Web.SessionManager` de
  SIP.js 0.21.2 (dépendance figée), liaison navigateur chargée à la demande,
  Web Lock par compte, contrôleur choisi par `VITE_APP_MODE`. Chaîne micro Web
  Audio pour la **sensibilité du micro** qu'il a demandée, test du micro,
  périphériques réels, sonnerie générée.
- **Rappels planifiés**, qu'il signalait comme oubliés : domaine, stockage
  (données anciennes sans rappels acceptées), vue, planificateur, alertes.
- Règles de pays à l'affichage selon ses consignes (0 = France, 1 = Amérique du
  Nord, liste d'indicatifs canadiens fournie) ; chiffres composés inchangés.
- Interface : thème Système par défaut, menu clair en thème clair (il restait
  sombre), bouton Téléphone vert central sur mobile, Favoris accessible depuis
  Contacts sur petit écran.
- Vérifications : typecheck, lint, 27 tests dont 11 sur l'adaptateur avec un faux
  gestionnaire, build, parcours visuel, essai du mode réel vers une adresse
  locale inexistante. **Aucun appel réel, aucun accès au PBX, aucun déploiement** :
  ce qui reste à prouver est listé dans PROJECT_STATE. Suite : lot 5, pilote.

## 2026-09-21 — ApisnixPhone Web : interface construite en mode démonstration

- Demande de Franck : la meilleure interface de téléphonie à partir du plan et
  de la maquette, avec davantage de jaune APISNIX, carte blanche. Références
  consultées : Aircall (actions en appel, notes, tags, raccourcis), OpenPhone/Quo,
  Dialpad, Ringover et Kavkom déjà cités dans le plan.
- `webphone/` créé : React 19, TypeScript 6, Vite 8, lucide-react,
  libphonenumber-js, country-flag-icons, Vitest ; versions du plan installées et
  figées avec lockfile, `@eslint/js` 10.0.1 ajouté car requis par la configuration.
- Couches : contrat `PhoneController` et contrôleur de démonstration sans réseau,
  domaine des numéros (chiffres jamais réécrits), stockage mémoire avec IndexedDB
  sur choix explicite, contexte applicatif à contrôleur unique, écrans Journal,
  Contacts, Favoris, Réglages, Connexion, panneau d'appel et palette de commandes.
- Vérifications : typecheck, lint, 13 tests, build, parcours visuel à trois
  largeurs et deux thèmes. Logo copié intact depuis `branding/`, favicons depuis
  le dossier de Franck. `.gitignore` : `webphone/node_modules/`, `.claude/`.
- **Aucun appel réel, WebSocket, micro, accès serveur ni déploiement.** Suite :
  lot 4, adaptateur SIP.js. État et limites dans PROJECT_STATE et le plan.

## 2026-09-21 — Publication de la préparation web et nouvelle règle Git

- Franck demande de retirer la règle de confirmation des commits/push et de
  publier les travaux. Instructions globales et AGENTS du projet actualisés ;
  le plan reprend le workflow de publication après validation.
- Plan, maquette et documents de reprise regroupés dans le dépôt softphone
  public. La supervision et les détails d'exploitation restent dans le dépôt
  privé Gestion_CRM-APISNIX ; archives locales et secrets restent exclus.
- Contrôle des liens, syntaxe de la maquette et contenu destiné à Git.
  Aucun build natif, changement serveur, migration ou déploiement dans cette
  publication documentaire. Authentification Git reliée au compte CLI existant.

## 2026-09-18 — Plan et maquette du webphone PC

- Recherche demandée par Franck pour démarrer le développement dans une
  nouvelle conversation : références Ringover/Kavkom, API navigateur,
  SIP.js 0.21.2 et contraintes de réutilisation du WebRTC existant.
- WEBPHONE_PLAN devient la référence produit/technique : écrans, tokens,
  fonctions et réglages, données locales, numérotation préservée, architecture,
  versions, lots de réalisation, pilote et critères d'acceptation.
- Maquette HTML autonome ajoutée : journal, contacts, favoris, réglages et
  appel simulé. Rendu contrôlé à 1280, 1024 et 390 px, navigation pendant
  l'appel, commandes simulées et syntaxe JavaScript vérifiés. Aucun appel réel.
- README, AGENTS, état et architecture reliés au plan. Détails d'exploitation
  conservés dans le dépôt privé ; aucun secret ou journal client ajouté ici.
- Application web à développer dans webphone/. Pas d'accès ou modification
  serveur pendant cette préparation, migration, déploiement, commit ou push.

## 2026-09-17 — Signature Windows reportée

- Franck demande de garder le chantier de signature pour plus tard et de
  revenir à la supervision SIP. État, opérations et fiche de signature
  actualisés pour la reprise ; aucune activation Azure ou dépense.
- Le pilote de supervision répond toujours sur le Mac, page de connexion
  vérifiée dans le navigateur intégré. Son exploitation reste documentée
  dans le dépôt privé Gestion_CRM-APISNIX. Aucun changement de production.

## 2026-09-17 — Diagnostic des alertes Windows et préparation de la signature

- Après signalement SmartScreen et 360, contrôle du SHA-256 du paquet `.2`,
  lecture des tables de certificats PE et extraction sans exécution de
  l'application et de la DLL graphique. Installateur/application non signés ;
  certificats Microsoft présents dans la DLL. Aucune conclusion de faux positif
  ni validation antivirus/Windows tirée de cette seule inspection.
- Choix de Franck : signature APISNIX, entreprise française. Proposition
  Microsoft Artifact Signing Basic, conditions et tarif officiels vérifiés.
  Accord sur l'abonnement et validation d'identité restent à obtenir.
- Fiche SIGNATURE_WINDOWS ajoutée, état et opérations actualisés avec limites,
  procédure OIDC proposée, ordre de signature/packaging et contrôles à réaliser.
  Aucun code de signature activé, achat, build, certificat créé ou paquet publié.
  Aucun accès production ni migration. Documentation conservée localement,
  sans commit ni push.

## 2026-09-17 — Téléchargements sur l'accueil APISNIX CRM

- À la demande de Franck, APK Android `.3` et Windows compact `.2` publiés
  derrière deux boutons sombres sous le formulaire de contact de l'accueil.
  Fichiers identiques aux builds existants ; signature de développement Android
  et installateur Windows non signé conservés. Nouveaux essais toujours attendus.
- Tailles et SHA-256 des fichiers publics contrôlés. Android téléchargé depuis
  le bouton et empreinte cliente vérifiée ; Windows servi en HTTP 200 avec sa
  taille complète, sans comparaison d'une copie locale par ce navigateur.
  Rendu des boutons vérifié sur ordinateur et mobile.
- README, état et opérations actualisés avec les liens et les limites.
  Sources du fragment web, sauvegardes et procédure de retrait maintenues dans
  le dépôt privé Gestion_CRM-APISNIX. Aucune compilation, migration, modification
  du moteur SIP ou redémarrage Asterisk. Aucun commit ni push.

## 2026-09-16 — Installateur Windows compact disponible

- Run `35115685999` réussi sur le commit `a8c5171` : SDK, client et paquet
  `6.2.2-apisnix.2` construits. Artefact récupéré, SHA-256 identique au runner
  et en-tête PE x64 vérifiés ; ancien installateur et son hash conservés.
- README, état, opérations et fiche du mode compact actualisés. Le premier
  pilote a été testé par Franck ; le nouvel écran reste à essayer sur PC.
- Aucun changement de production ni nouvelle migration. Suivi de compilation
  terminé ; versions Apple toujours en attente à la demande de Franck.

## 2026-09-16 — Versions Apple en attente

- Franck confirme ne pas posséder de compte Apple Developer et reporte les
  versions Apple. README, état et fiche Apple actualisés ; aucun achat ou
  build Apple lancé. Le nouveau Windows compact compile encore dans le run
  35115685999 ; seul le premier installateur reste disponible localement.

## 2026-09-16 — Correction de l’indicatif Android et état Apple

- Signalement de Franck : Android remplace un numéro national par `+237…`.
  Cause retrouvée dans la détection du pays réseau de l'assistant SIP tiers
  et l'option de formatage activée par défaut dans le moteur.
- Pilote `6.2.7-apisnix.3`, code `602008` : détection retirée, option désactivée
  pour les nouveaux comptes et migration unique des comptes enregistrés.
  Identifiants, transport et historique conservés ; aucun changement Asterisk.
- Compilation Kotlin/Java et APK réussis, signature v2 valide, certificat égal
  au pilote `.2`, manifeste et ARM 32/64 vérifiés. Patch exporté et contrôle
  inverse d'application réussi. Pas d'appareil Android pour un nouvel appel.
- README, architecture, état, opérations et NUMEROTATION_ANDROID mis à jour.
  PLATEFORMES_APPLE consigne l'environnement vérifié, les bases et prérequis :
  aucun paquet Apple produit ; compte développeur demandé à Franck.

## 2026-09-16 — Téléphone Windows vertical

- Premier pilote Windows confirmé fonctionnel par Franck ; demande explicite
  d'un petit format vertical. Numérotation et appel audio compacts ajoutés,
  connexion réorganisée en largeur réduite, retour à l'interface complète
  pour les fonctions avancées. Aucun changement du moteur SIP ni du serveur.
- Accès SIP direct prioritaire sur l'accueil Linphone du premier lancement.
  Le signalement précis des deux écrans de démarrage reste à confirmer.
- Quatre composants QML ajoutés, exportés dans le patch Desktop. Version du
  prochain paquet : 6.2.2-apisnix.2. Sources de vérité et procédure mises à jour.
- Contrôles Qt sans serveur : création/rendu, numéro vide ou hors connexion,
  appel, anti-double-clic, clavier, effacement, retour à l'appel et DTMF.
  Syntaxe des QML et application inverse du patch contrôlées. La compilation
  Windows et le test réel de cette nouvelle interface restent à effectuer.

## 2026-09-16 — Séparation du référentiel de gestion CRM

- À la demande de Franck, mémoire d'exploitation transférée dans le dépôt
  privé distinct `FranckThiago/Gestion_CRM-APISNIX`, pour reprise Mac/Hermes.
- AGENTS.md et les sources d'état/exploitation renvoient à ce référentiel.
  L'ancienne mémoire privée locale reste une archive, sans publication ici.
- Les corrections commerciales et règles de comptes sont détaillées dans
  le dépôt privé. Aucun changement du code softphone, aucun commit ni push
  de ce dépôt public pendant cette séparation.

## 2026-09-16 — Compréhension des clients et abonnements, sans correction

- Consultation en lecture seule de six groupes VICIdial et de la source
  commerciale dans Google Sheets. Nombres de lignes, offres, comptes et
  exceptions documentés exclusivement dans la mémoire privée hors Git.
- Consigne précisée : comprendre l'existant avant de ranger avec Franck.
  Correction d'affectations précédemment autorisée mise en attente avant
  toute écriture. Historique des comptes réutilisés conservé sur sa décision.
- Index, modèles, procédure de réaffectation, état et journal actualisés.
  Aucun changement serveur, de facturation ou du classeur, aucune migration.
- Après explications du propriétaire, comparaison étendue aux clients actifs.
  Précédence des sources, anciens parcs, identifiants réutilisés, exceptions
  commerciales et questions restantes documentés en privé. Supervision SIP
  conservée comme suite du projet ; aucun déploiement pendant cette lecture.

## 2026-09-16 — Mémoire d'exploitation et suspensions commerciales

- Demande de Franck : mémoire durable pour les futurs agents. Références de
  phones/users, groupe de supervision, workflow SQL et mécanismes de copie
  vérifiés en base et dans le code installé, puis documentés en privé sous
  docs/production-privee/. Index de lecture ajouté à AGENTS.md et exclusion Git.
- Une incompatibilité de modèle peut être une suspension commerciale volontaire.
  Deux phones suspendus sur demande explicite ; mots de passe conservés,
  sauvegarde protégée, exactement deux sections SIP modifiées, peers absents
  après prise en compte du rechargement. Pas de changement du modèle partagé,
  du dialplan ou de Fail2ban. Le filtre actif peut aussi bannir un peer inconnu.
- Compte administrateur dédié créé sur demande avec les droits du compte de
  référence : 127 champs comparés, affectations de campagnes/groupes entrants
  reprises, identité et secret propres. Accès protégé local hors Git ; aucun
  nouveau phone et aucun secret dans les reçus/documentations. Connexion web
  non validée dans le navigateur intégré.
- Droits étendus de superviseur, héritages de groupes entrants et risque de
  visibilité de l'ancien historique identifiés ; aucun changement de ces
  règles sans choix métier. Pas de purge, migration ou redémarrage Asterisk.
- État et opérations actualisés. La mémoire privée est accessible aux nouvelles
  conversations de ce projet ; hors projet son chemin doit être fourni.

## 2026-09-16 — Affectation de 26 postes après validation des enregistrements

- Franck a confirmé les appels/enregistrements du pilote ; présence de MP3
  non vides vérifiée sur le serveur. Affectation des 26 postes demandés aux
  contextes adaptés à leurs routes, par surcharge individuelle.
- Deux postes avaient un modèle PJSIP incompatible avec leur protocole SIP.
  Modèles remplacés par ceux de leur groupe après confirmation explicite.
- Phone Context limité à 20 caractères : correction des valeurs tronquées
  vers des contextes restrictifs de repli, noms complets dans Conf Override.
  Aucune migration de schéma ni modification des modèles partagés.
- Sauvegardes protégées, génération VICIdial native et rechargement SIP sans
  redémarrage. Exactement 26 sections générées modifiées ; 26 contextes et
  attributions au compte vérifiés dans Asterisk. Dialplan inchangé.
- État, opérations, étude et guide local actualisés ; note privée et retour
  arrière conservés hors dépôt public. Aucun nettoyage audio ni collecteur
  de supervision ajouté. Les appels réels de chacun des postes restent à
  éprouver ; le contrôle de configuration ne remplace pas ces essais.

## 2026-09-16 — Installation des quatre variantes d'enregistrement

- Intervention programmée et autorisée : sauvegarde protégée, ajout des quatre
  contextes et rechargement du dialplan. Pas de redémarrage ni nouvel accès.
- Treize vérifications de résolution des routes réussies ; contextes originaux,
  premier pilote, configuration SIP et fichier principal inchangés.
- Aucun appel du pilote depuis son activation retrouvé dans les journaux ciblés.
  Aucun nouveau poste affecté avant validation du MP3 réel ; test utilisateur
  demandé et suivi automatique mis en pause pour éviter les répétitions.
- État, étude, opérations et guide local actualisés. Note d'intervention hors
  Git ; sauvegardes et enregistrements non copiés localement. Diff contrôlé.
- Aucune suppression audio, migration, modification réseau ou plateforme déployée.

## 2026-09-15 — Guide pour reproduire l'enregistrement par contexte

- Demande de Franck : comprendre et reproduire le correctif sur quatre autres
  contextes existants. Inspection en lecture seule de leurs règles réelles.
- Guide et fragment de quatre contextes préparés localement hors Git, avec
  correspondances, activation par Conf Override, contrôles et retour arrière.
  Motifs autorisés, refus et messagerie préservés ; journal adapté aux branches.
- Étude actualisée, diff documentaire contrôlé. Aucune modification serveur
  pendant cette préparation ; variantes non chargées, appels non testés.

## 2026-09-15 — Correctif d'enregistrement appliqué au poste pilote

- Accord explicite de Franck pour un poste. Sauvegardes protégées côté serveur,
  ajout d'un contexte dédié et surcharge propre au poste ; modèle partagé et
  routage restrictif d'origine conservés.
- Génération native VICIdial, contrôle des sections SIP puis rechargement SIP.
  Une seule section modifiée ; contexte effectif et état connecté vérifiés.
  Pas de redémarrage, d'appel lancé, de nettoyage ou de compte supplémentaire.
- Étude et état mis à jour. Détails opérationnels et retour arrière conservés
  hors Git ; aucune sauvegarde sensible copiée localement. Diff contrôlé.
- Validation restante : appel utilisateur, journal, MP3 et affichage dans les
  statistiques. Aucun déploiement de la plateforme de supervision.

## 2026-09-15 — Diagnostic d'enregistrements absents sur le poste pilote

- Comparaison en lecture seule de la fiche, du modèle SIP, du contexte chargé,
  des journaux en base et du filtre de la page de statistiques.
- Cause identifiée : le modèle impose un contexte restrictif sans enregistrement,
  malgré `defaultlog` dans la fiche. Préparation locale d'un correctif isolé
  préservant les restrictions, avec procédure de validation et retour arrière.
- Détails et configuration proposée sous `.work/recording-pilot/`, exclus de Git.
  Étude mise à jour. Aucune modification de production ni appel lancé.

## 2026-09-15 — Audit serveur en lecture seule

- SSH autorisé par Franck. Configuration réelle du contexte d'enregistrement,
  scripts audio, tâches de nettoyage et interface de supervision inspectés.
- Chaîne native disponible ; absence de règle à trois mois dans les emplacements
  examinés et présence de MP3 anciens. Aucun nettoyage ou compte ajouté.
- Note détaillée locale dans `.work/audits/`, hors dépôt public ; étude et état
  actualisés. Aucun secret ni fichier audio conservé, aucun appel lancé.
- Diff documentaire contrôlé. Ni migration, ni rechargement, ni installation,
  ni changement de configuration serveur ; validation par un pilote à faire.

## 2026-09-15 — Recherche sur la supervision des postes SIP

- Besoin précisé : état technique des postes, appels, statistiques et fichiers
  audio ; préserver le VICIdial actif, sans suivi de présence humaine.
- Lecture des forums VICIdial et de la documentation Asterisk dans le navigateur
  intégré. Piste `defaultlog` décrite par l'équipe VICIdial et exemple
  communautaire de liste des postes identifiés, avec leurs limites.
- Ajout de `SUPERVISION_ASTERISK_VICIDIAL.md` et mise à jour de l'état du projet.
  Proposition seulement : aucune modification applicative, migration ou action
  serveur. Aucun test téléphonique réalisé. Documentation relue et diff contrôlé.

## 2026-09-15 — Cadrage du softphone APISNIX

- Objectif : identifier une base pour un softphone Windows/Android sous la marque
  APISNIX, dédié aux appels SIP UDP avec TCP éventuel.
- Décision utilisateur enregistrée : le code du client personnalisé peut rester
  open source.
- Ajout du comparatif sourcé, du périmètre proposé et du plan de validation ;
  recommandation Linphone à confirmer par des essais d'interopérabilité.
- Fichiers : `README.md`, `docs/PROJECT_STATE.md`, `docs/ETUDE_SOFTPHONE.md`, ce
  journal. Aucune architecture implémentée ou dépendance installée.
- Vérifications : dossier inspecté, absence de Git/code confirmée ; sites et
  dépôts officiels consultés ; liens locaux et cohérence documentaire relus.
- Tests d'appels et compilation : non réalisés, étude uniquement.
- Migration, impact production, achat, publication et push Git : aucun.
- Suivi : identifier le serveur de test, les appareils et la stratégie de
  réception des appels Android en veille.

## 2026-09-15 — Première adaptation native ApisnixPhone

- Besoins confirmés : nom ApisnixPhone, Asterisk `apisnix-crm.com`, identifiant et
  mot de passe, Windows prioritaire, UDP par défaut et autres transports conservés.
- Sources officielles verrouillées : Android 6.2.7/SDK 5.5.21, Desktop 6.2.2.
- Identités applicatives, connexion simplifiée, fonctions chat/réunions masquées ;
  configuration de services et signature amont retirées pour Android. Mot de passe
  Android conservé exactement, sans suppression d'espaces.
- Ajout de `sources.lock.json`, `patches/`, scripts de préparation/export/build,
  exclusions locales et documentation d'architecture/opérations. Sources de
  travail dans `apps/`. Aucun commit ou push.
- Vérifications : build Android debug réussi, puis script de build rejoué avec
  succès ; signature APK v2, libellé, identifiant, architectures, niveau Android
  et paramètres APISNIX intégrés vérifiés. Aucun droit de localisation dans le
  manifeste final. Syntaxe QML, Python et shell vérifiée, patches contrôlés en
  sens inverse et diff sans erreurs d'espacement.
- Limites : logos attendus ; liens d'aide/confidentialité et écrans secondaires
  à revoir ; pas d'appel réel ou d'essai sur appareil. Windows non compilé,
  procédure PowerShell non exécutée. Aucun installateur Mac/iPhone.
- Environnement : uniquement Mac local ; ni accès SIP fourni, ni migration,
  changement de production, achat ou publication.
- Sources de vérité actualisées : README, PROJECT_STATE, ARCHITECTURE, OPERATIONS ;
  étude conservée comme historique avec renvoi vers l'état actuel.

## 2026-09-15 — Logos APISNIX et préparation de la compilation GitHub

- Logo reçu : monogramme bleu/jaune du dossier fourni, copié sans modifier
  l’original dans `branding/`. Export reproductible des ressources natives.
- Android : icône adaptative avec marge, splashscreen, accueil, connexion/tablette
  et silhouette de notification ; suppression du wordmark Linphone du splash,
  boutons bleus. Nouveau pilote `6.2.7-apisnix.2` compilé et signature vérifiée.
- Desktop : ICO de 16 à 256 pixels, icônes PNG, SVG avec PNG original incorporé,
  accents bleus ; ancienne bannière Linphone retirée du packaging NSIS.
- GitHub choisi par Franck. Workflow manuel Windows 2022/Qt 6.10.0 préparé,
  actions fixées par commit et installateur conservé comme artefact 14 jours.
  Aucune création de dépôt, publication ou compilation Windows effectuée.
- Vérifications : build Android réussi, marque présente dans l’APK, SHA-256,
  fidélité de la copie du logo, rendu Qt de cinq SVG et décodage ICO, syntaxe
  QML/Python, Actionlint 1.7.12, patches et diff contrôlés.
- Documentation : README, PROJECT_STATE, ARCHITECTURE, OPERATIONS, identité et
  attributions/licence mis à jour. Tests sur appareils et appels toujours à faire.
- Migration, modification de production, achat, commit ou push : aucun.

## 2026-09-15 — Publication autorisée sur GitHub

- Franck autorise explicitement la création du dépôt public, l’envoi des sources
  et le lancement de la compilation Windows.
- Dépôt créé : `FranckThiago/ApisnixPhone`. Initialisation Git locale avec liste
  explicite des fichiers ; sources de travail, binaires et secrets exclus.
- Contrôles : fichiers publiables inspectés, absence de motifs de jetons et clés
  privées vérifiée, Actionlint réussi. Première compilation Windows à lancer.
- Aucune modification du PBX, donnée client ou infrastructure de production.

## 2026-09-15 — Correction du premier essai Windows

- Run GitHub `34979644374` : sources personnalisées et Qt installés ; arrêt
  avant compilation car `mingw-w64-x86_64-python-pystache` est introuvable.
- Installation de Pystache 0.6.8 via pip dans le Python MSYS2 ; autres paquets
  conservés. Actionlint vérifié, nouvelle compilation à lancer.
- Aucun changement applicatif, migration ou impact production.

## 2026-09-15 — Sources SDK accessibles pour le build Windows

- Run `34980016908` : outils et Pystache installés ; échec de connexion au
  GitLab Linphone pendant le clonage du SDK, avant compilation C++.
- Ajout d’un verrou des sources SDK et de leur préparation contrôlée. SDK
  sur miroir officiel GitHub ; 30 dépendances disponibles aux commits
  d’origine, certaines sur miroir communautaire. Pas de remplacement par
  une branche ou une version différente.
- RNNoise désactivé pour le pilote Windows : le commit requis est inaccessible.
  Transports conservés et SDK Android inchangé. Python CMake sélectionné
  explicitement pour utiliser les modules installés dans MSYS2.
- Préparation complète du SDK exécutée localement avec succès : SDK et
  30 dépendances vérifiés contre les gitlinks officiels. Syntaxe Python,
  Actionlint et diff contrôlés. Documentation
  d’architecture, opérations et état mise à jour dans le même commit.
- Aucun accès téléphonique, changement de production ou migration.

## 2026-09-15 — Chemins Windows compatibles avec CMake

- Run `34983081292` : récupération SDK réussie ; configuration arrêtée par
  un antislash du chemin Qt interprété comme échappement dans `try_compile`.
- Normalisation des chemins Qt, Qt6_DIR, QT_ROOT_DIR et Python vers des slashs
  dans le script Windows. Aucun changement du code applicatif ou du SDK.
- Diff contrôlé ; validation effective par la prochaine exécution Windows.
  État et procédure mis à jour avec le correctif. Aucun impact production.

## 2026-09-15 — Installateur Windows de test disponible

- Run `34985036963` réussi : SDK, application et packaging Windows x64 compilés
  depuis `a3ae95be325337a0ddcc21777705f8e1e8a27bf5`.
- Artefact récupéré dans `dist/windows/` : `ApisnixPhone-6.2.2-win64.exe`,
  156 770 423 octets. SHA-256 identique au manifeste du runner et en-tête PE x64
  vérifiés localement. Aucun binaire ajouté aux sources Git.
- README, état, architecture et opérations actualisés avec la procédure de
  test. Contrôle du diff documentaire. Aucune modification du code applicatif.
- Limites : pilote non signé pour diffusion ; installation, interface sur PC,
  audio et appels SIP non testés. Identifiants de test attendus de Franck.
- Aucune migration ou modification du PBX. Suivi automatique à mettre en pause
  lors de la remise de l'installateur.
