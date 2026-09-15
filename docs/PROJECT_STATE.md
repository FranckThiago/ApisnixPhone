# État du projet

Mis à jour le 15 septembre 2026.

## Besoins confirmés

- Nom commercial choisi : **ApisnixPhone**, sous la marque APISNIX.
- Windows prioritaire, Android ensuite ; les interfaces peuvent être différentes.
- Appels SIP, principalement sortants. Pas de plateforme CRM à reconstruire.
- Serveur Asterisk `apisnix-crm.com`, comptes créés par Franck dans `phones`.
  Il s'agit des clients Asterisk directs, pas d'une intégration VICIdial spécifique.
- Identifiant et mot de passe suffisent à la connexion habituelle. Domaine
  prérempli, UDP par défaut ; TCP/TLS et les possibilités du moteur restent disponibles.
- Le code personnalisé peut rester open source. Les crédits techniques sont conservés.
- Franck fournira les identifiants de test après préparation des installateurs,
  et effectuera les essais sur le PC Windows et le téléphone de son frère.
- Réception Android en veille non prioritaire. Aucune permission de localisation
  ajoutée ; ce n'est pas une garantie de maintien des appels en arrière-plan.
- Dossier de logos reçu. Le monogramme bleu et jaune fourni est intégré aux
  icônes Android/Windows et aux principaux écrans d’accueil/connexion.
- Franck dispose d’un compte GitHub et choisit la compilation Windows en ligne.
  Le compte connecté est `FranckThiago`. Dépôt public `FranckThiago/ApisnixPhone` créé avec son accord explicite.
- Intérêt pour Mac et iPhone ; la réalisation initiale reste Windows/Android.

## Résultat réel

La base Linphone a été adaptée dans deux sources officielles verrouillées.
Le nom, les identifiants applicatifs, la configuration serveur et le formulaire
simplifié sont en place. Le chat et les réunions sont masqués via les options
existantes. Les protocoles du moteur sont conservés.

### Android

- Client 6.2.7, moteur Liblinphone 5.5.21 fixé après résolution et compilation.
- APK `6.2.7-apisnix.2` de développement produit dans `dist/android/` (~127 Mio).
- Identifiant `com.apisnix.phone`, libellé ApisnixPhone, Android 9 minimum,
  architectures `armeabi-v7a` et `arm64-v8a` vérifiés dans le paquet.
- Compilation Kotlin/Java, ressources et assemblage réussis ; signature APK v2
  vérifiée. Une seconde exécution du script de construction a réussi.
- Configuration APISNIX/UDP et accès direct à la connexion vérifiés dans l'APK.
- Aucun appareil connecté ni test d'interface ou d'appel réel effectué.

### Windows

- Sources du client Desktop 6.2.2 adaptées, formulaire réduit et paramètres
  avancés conservés. Nom et futur exécutable personnalisés.
- Syntaxe des deux fichiers QML modifiés vérifiée avec Qt 6.10.3.
- Deux exécutions GitHub réalisées : préparation des sources, Qt, MSYS2 et
  Pystache réussis après correction. Le second run `34980016908` s’arrête au
  téléchargement du SDK, car GitLab Linphone est inaccessible depuis le runner.
- Préparation du SDK adaptée pour utiliser des miroirs GitHub, avec contrôle
  des commits d’origine pour le SDK et 30 dépendances. RNNoise temporairement
  désactivé sur Windows, son commit exact étant inaccessible ; transports SIP
  conservés. Préparation complète du SDK validée localement. Nouveau build à
  lancer ; aucun `.exe` produit à ce stade.
- Workflow validé statiquement avec Actionlint 1.7.12.
- Icône ICO multirésolution et cinq ressources SVG de marque décodées/rendues
  avec Qt. Les interfaces Windows complètes restent à tester.
- La machine de compilation Windows est fournie par GitHub Actions. Le poste
  prévu pour tester n’a besoin que du futur installateur.

## Limites avant remise aux clients

1. Contrôler visuellement les écrans sur appareil : logos principaux intégrés,
   couleurs d’accent passées au bleu APISNIX. Les anciens écrans ou ressources
   inutilisés de Linphone n’ont pas tous été supprimés.
2. Terminer la revue des écrans secondaires : certains liens d'aide et de
   confidentialité restent ceux de Linphone. Ne pas présenter ces liens comme
   la politique APISNIX. Les mentions de licence et d'auteur doivent rester.
3. Achever la compilation Windows depuis le dépôt GitHub autorisé
   et corriger les éventuels problèmes du runner. Tester
   l’installateur Windows et l’APK sur les appareils de Franck.
4. Vérifier connexion Asterisk, audio bidirectionnel, DTMF, casques, erreurs et
   reconnexion réseau avec des comptes de test dédiés.
5. Préparer signatures de distribution, sources correspondantes et procédure
   de mise à jour avant une diffusion commerciale. Sources du projet publiables dans le dépôt autorisé ; aucune release binaire.
6. Ne pas promettre la réception Android en veille : pas de service push APISNIX
   configuré. Les bibliothèques Firebase restent dans la base mais le projet
   Firebase de démonstration amont a été retiré.

## Environnement et traçabilité

- Travail local sur macOS ; aucune opération sur Asterisk ou la production.
- Racine initialisée en Git ; dépôt public créé :
  https://github.com/FranckThiago/ApisnixPhone. Publication et lancement Windows
  autorisés explicitement par Franck le 15 septembre 2026. `apps/android` et
  `apps/desktop` restent des checkouts Git locaux détachés, exclus du dépôt racine.
- Sources/reconstruction : [architecture](ARCHITECTURE.md) et
  [opérations](OPERATIONS.md). Patches exportés, contrôle inverse d'application
  et `git diff --check` réussis.
- Aucun identifiant SIP reçu ou enregistré. Aucune migration.
