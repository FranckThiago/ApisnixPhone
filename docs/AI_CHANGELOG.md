# Journal des changements

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
