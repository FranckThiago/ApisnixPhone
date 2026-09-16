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
- APK `6.2.7-apisnix.3` de développement produit dans `dist/android/` (~127 Mio).
- Identifiant `com.apisnix.phone`, libellé ApisnixPhone, Android 9 minimum,
  architectures `armeabi-v7a` et `arm64-v8a` vérifiés dans le paquet.
- Compilation Kotlin/Java, ressources et assemblage réussis ; signature APK v2
  vérifiée. Une seconde exécution du script de construction a réussi.
- Configuration APISNIX/UDP et accès direct à la connexion vérifiés dans l'APK.
- Franck a essayé le pilote `.2` et signalé le remplacement d'un numéro
  national par un numéro préfixé `+237`. La détection automatique du pays a
  été retirée ; ajout d'indicatif désactivé à la création et migré une seule
  fois pour les comptes existants. Voir [NUMEROTATION_ANDROID.md](NUMEROTATION_ANDROID.md).
- Pilote `.3` compilé, signature v2 vérifiée et certificat identique à `.2` ;
  mise à jour possible sans supprimer le compte. Aucun téléphone ni émulateur
  connecté pour valider le correctif en appel réel ; essai de Franck attendu.

### Windows

- Sources du client Desktop 6.2.2 adaptées, formulaire réduit et paramètres
  avancés conservés. Nom et futur exécutable personnalisés.
- Syntaxe des QML modifiés vérifiée avec Qt 6.10.3 ; composants compacts
  rendus et signaux contrôlés sur le Mac, sans serveur SIP.
- Run `34985036963` réussi le 15 septembre 2026 : SDK et client compilés,
  installateur produit et artefact GitHub téléversé. Commit de construction
  `a3ae95be325337a0ddcc21777705f8e1e8a27bf5`.
- La normalisation des chemins Qt/Python corrige l'échec CMake précédent.
- SDK et 30 dépendances restent verrouillés aux commits d’origine. RNNoise
  temporairement désactivé sur Windows ; transports SIP conservés.
- Installateur `.exe` de test non signé produit pour Windows x64.
  Workflow validé avec Actionlint 1.7.12 et exécution complète réussie.
- Fichier récupéré dans `dist/windows/ApisnixPhone-6.2.2-win64.exe` ; empreinte
  SHA-256 identique à celle du runner et en-tête PE x64 vérifiés sur le Mac.
  Le binaire n’a pas été lancé sur le Mac ; Franck a ensuite confirmé son
  fonctionnement sur Windows. Voir les opérations pour le hash.
- Icône ICO multirésolution et cinq ressources SVG de marque décodées/rendues
  avec Qt. Les cas détaillés des interfaces Windows restent à tester.
- La machine de compilation Windows est fournie par GitHub Actions. Le poste
  prévu pour tester n’a besoin que de l’installateur.
- Retour du 16 septembre : Franck confirme que le premier pilote fonctionne
  sur son PC Windows. Aucun relevé détaillé des cas DTMF/reconnexion n'a été reçu.
- À sa demande, [format vertical 420 × 680](FENETRE_COMPACTE.md) ajouté aux
  sources : clavier, appel audio compact et connexion adaptée ; interface
  complète accessible. Le premier accueil Linphone est contourné quand la
  connexion SIP directe est configurée. Nouveau paquet : `6.2.2-apisnix.2`.
- Run `35115685999` réussi le 16 septembre, depuis le commit
  `a8c5171bb79d0acb2da0a95ce2541bc7dd530fb0` : SDK/client compilés,
  installateur récupéré et contrôlé (SHA-256 du runner identique, PE x64).
  Fichier : `dist/windows/ApisnixPhone-6.2.2-apisnix.2-win64.exe`.
  Premier installateur conservé ; nouvel essai réel de l’interface compacte
  encore requis. Le suivi de compilation est terminé.

### Mac et iPhone

Franck redemande une suite pour ces plateformes. Xcode 26.6 et les outils Apple
sont disponibles sur son Mac Apple Silicon ; le kit Qt C++ et les outils de
compilation Desktop manquent encore. Aucun build Mac lancé ni paquet produit.
Le client iOS officiel est une base distincte à adapter ; aucun checkout ou
paquet APISNIX iOS créé. Franck confirme ne pas avoir de compte Apple Developer
et demande de laisser les versions Apple en attente. Aucun achat ni lancement
de build Apple. Voir [PLATEFORMES_APPLE.md](PLATEFORMES_APPLE.md).

## Limites avant remise aux clients

1. Contrôler visuellement les écrans sur appareil : logos principaux intégrés,
   couleurs d’accent passées au bleu APISNIX. Les anciens écrans ou ressources
   inutilisés de Linphone n’ont pas tous été supprimés.
2. Terminer la revue des écrans secondaires : certains liens d'aide et de
   confidentialité restent ceux de Linphone. Ne pas présenter ces liens comme
   la politique APISNIX. Les mentions de licence et d'auteur doivent rester.
3. Tester les nouveaux pilotes Android `.3` et Windows compact sur les appareils
   de Franck. Le premier pilote Windows fonctionne selon son retour ; cela ne
   valide pas ces évolutions ni tous les cas détaillés ci-dessous.
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
- Aucun identifiant SIP reçu ou enregistré. Aucune migration serveur.
  La migration locale du paramètre Android est décrite dans NUMEROTATION_ANDROID.md.
