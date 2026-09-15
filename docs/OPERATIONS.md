# Construction et validation

## Recréer les sources

Depuis la racine, avec Python 3 et Git :

```sh
python3 scripts/prepare-sources.py android
python3 scripts/prepare-sources.py desktop
```

Ces commandes sont pour un environnement neuf : les dossiers existent déjà sur
le Mac de travail. Utiliser `--destination` avec un nouveau chemin pour un essai
séparé ; les scripts de build ci-dessous ciblent toujours `apps/`.

Les fichiers de configuration de service et de signature amont listés dans
`sources.lock.json` sont retirés sans recopier leurs valeurs dans les patches.
Ne jamais déposer d'accès SIP ou de clé de signature dans les sources.

Après modification des sources, inspecter les changements, puis exporter :

```sh
python3 scripts/export-patches.py
```

Le script refuse les fichiers non suivis. Une nouvelle ressource doit être prise
en compte délibérément dans le suivi local avant export, après vérification de
son contenu. Ne pas ajouter tout le checkout aveuglément.

## Android — procédure exécutée avec succès

Prérequis : JDK, Android SDK et accès aux dépôts Gradle/Maven. Le projet utilise
compileSdk/targetSdk 37 et minSdk 28. Le wrapper fournit Gradle 9.5.1 et sa
configuration provisionne la chaîne Java nécessaire.

Environnement vérifié sur ce Mac :

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools \
bash scripts/build-android.sh
```

Sur une autre machine, adapter les chemins à ses installations. Le moteur
résolu est fixé à 5.5.21. Le script place l'APK dans `dist/android/`.

### Pilote Android

APK actuel : `apisnixphone-android-debug-6.2.7-apisnix.2.apk`.
Il est signé avec une clé de développement locale. Le logo et les couleurs
APISNIX sont intégrés ; certains écrans secondaires restent à revoir.
Les appels réels et l’affichage sur appareil ne sont pas encore validés.

Pour le test, transférer le fichier au téléphone
Android 9 ou supérieur, l'ouvrir et autoriser cette source d'installation si
Android le demande. Saisir uniquement l'identifiant et le mot de passe de test.
Autoriser le microphone ; les autres permissions dépendent des fonctions utilisées.

L'APK inclut ARM 32 et 64 bits, pas de x86. La signature et le manifeste ont été
vérifiés ; cela ne valide ni l'interface ni les appels sur téléphone.

### Signature de diffusion future

Configurer hors dépôt les variables suivantes avant de produire une release :

- `APISNIX_ANDROID_KEYSTORE` : chemin de la clé privée protégée ;
- `APISNIX_ANDROID_STORE_PASSWORD` ;
- `APISNIX_ANDROID_KEY_ALIAS` ;
- `APISNIX_ANDROID_KEY_PASSWORD`.

Aucune clé de diffusion APISNIX n'a été créée. Conserver et sauvegarder la future
clé dans un espace sûr : les mises à jour doivent garder la même identité de
signature. Une version finale signée autrement que le pilote debug pourra
nécessiter la désinstallation du pilote et une nouvelle saisie des accès.

## Windows — procédure préparée, non validée

Machine Windows x64 avec Visual Studio 2022 (C++/Windows SDK), Qt 6.10 ou plus
récent avec kit MSVC x64, NetworkAuth et ShaderTools, CMake/CPack, NSIS, Git et
les dépendances MSYS2 du SDK. Le PDF et le gestionnaire de crash sont désactivés
pour ce build. Voir aussi `apps/desktop/README.md` pour les dépendances amont.

Depuis un environnement développeur Visual Studio, exemple à adapter :

```powershell
./scripts/build-windows.ps1 -QtRoot 'C:\Qt\6.10.0\msvc2022_64' -Jobs 4
```

Le script initialise le SDK, compile, appelle l'installation/packaging amont
et récupère les `.exe` dans `dist/windows/`. Les vérifications d'outils Windows
amont peuvent installer des dépendances MSYS2 manquantes. Utiliser une machine
de compilation dédiée. Cette procédure reste à éprouver en environnement réel.

### Compilation en ligne choisie : GitHub Actions

Le workflow `.github/workflows/build-windows.yml` est préparé et sa syntaxe
validée avec Actionlint. Il est prêt pour sa première exécution dans le dépôt public
[FranckThiago/ApisnixPhone](https://github.com/FranckThiago/ApisnixPhone),
créé après autorisation explicite de Franck.

Il utilise `windows-2022`, Visual Studio 2022 du runner, Qt 6.10.0 et MSYS2.
Les actions sont fixées par commit. Déclenchement manuel uniquement, droits du
workflow limités à la lecture du contenu ; aucune publication de release et
aucun accès Asterisk nécessaires. Les dépendances système MSYS2 évoluent avec
leur dépôt : le build reste à valider sur le runner, notamment l’espace disque.

Après publication : onglet Actions → ApisnixPhone Windows installer → Run workflow.
Le résultat attendu est l’archive `ApisnixPhone-Windows-x64-test`, conservée
14 jours, contenant le `.exe` non signé et son empreinte SHA-256. Télécharger
et extraire cette archive, puis installer le `.exe` sur le poste de test.

Les runners standard sont gratuits pour les dépôts publics. Un dépôt privé
consomme le quota du compte, puis peut être facturé. Source consultée le
15 septembre 2026 : [documentation GitHub](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
Aucun achat. Le dépôt public et le lancement de la compilation ont été
autorisés le 15 septembre 2026 ; aucun installateur Windows validé à ce stade.
Le poste de test n’a besoin que de l’installateur ; la signature Windows de
diffusion reste à organiser.

## Mise à jour des logos

Le fichier original retenu est copié dans `branding/apisnix-mark.png`. Sur macOS :

```sh
python3 scripts/prepare-branding.py
python3 scripts/export-patches.py
```

Le script exporte les ressources d’image ; les couleurs et thèmes sont des
modifications de code conservées dans les patches. La compilation CI n’a pas
besoin de l’outil macOS ni du dossier Pictures de Franck.

## Validation d'appels à effectuer

Avec les comptes dédiés que Franck fournira après préparation des installateurs :

1. Installation et première ouverture ; nom/icône, français, seulement les deux
   champs de connexion visibles ; paramètres avancés accessibles.
2. Bon et mauvais mot de passe : connexion ou message compréhensible.
3. Appel sortant, décrochage, son dans les deux sens, raccrochage des deux côtés.
4. Micro coupé, haut-parleur/casque et touches DTMF sur un serveur vocal.
5. Mise en attente/transfert si disponibles et nécessaires au pilote.
6. Redémarrage de l'application et coupure/reprise du réseau.
7. Appel entrant avec l'application active ; veille Android à documenter séparément.

Noter modèle/OS, version de l'app et résultat, sans identifiant sensible, mot de
passe ou numéro de client dans le dépôt. Aucun test de ce tableau n'est encore validé.

## Production et retour arrière

Aucun changement de serveur, donnée, routage, DNS ou pare-feu effectué. Aucune
migration. Les applications de test sont distinctes du Linphone standard par
leur identifiant. Pour arrêter le pilote, fermer/désinstaller ApisnixPhone et
réutiliser le softphone habituel avec les accès existants, sans changement du PBX.
Avant une diffusion commerciale : terminer l'identité, l'aide/confidentialité,
les essais, la signature, les sources correspondantes et le canal de mise à jour.
