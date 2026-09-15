# Journal des changements

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
