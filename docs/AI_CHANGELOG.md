# Journal des changements

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
