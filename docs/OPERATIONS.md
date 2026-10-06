# Construction et validation

## Raccrochage au départ de page — 6 octobre 2026

Release préparée `20261006-call-lifecycle`, retour prévu vers
`20261006-incoming-identity`. Correctif `pagehide` installé au niveau global,
avertissement avant départ conservé ; retour bfcache rechargé et terminaison
explicitement demandée à la perte WSS. Pas de coupure au simple changement de
rubrique ou de visibilité. Message 480 prudent FR/EN/ES. Tests de régression
sur les cinq chemins de navigation et la fermeture WSS propre : 92 tests au
total, typage, lint, build live réussis. Aucune migration, dépendance ni compte
modifié dans le frontend. Les garanties PBX sont documentées dans le dépôt
privé ; un envoi au départ n’est jamais garanti en cas de crash ou de coupure.

Après publication, recharger hors appel pour charger le nouveau JavaScript.
Les captures des guides ne montrent aucun des chemins techniques modifiés ;
les trois textes de fin de guide sont corrigés sans nouvelle mise en page.


## Numéros entrants et sons — publié le 6 octobre 2026

**En service : 20261006-incoming-identity**, source `6383a37`, bascule à
**17:18:03 Africa/Douala** (16:18:03 UTC). Entrants nationaux ambigus sans pays forcé, récupération
conditionnelle d’une identité internationale fournie par SIP P-Asserted-Identity
ou nom numérique concordant. Numéro initial conservé en local, rappel/contact
avec numéro récupéré. Le PBX doit transmettre l’identité complète : le client
ne peut pas récupérer un indicatif absent de toutes les informations reçues.
Aucun accès opérateur, DID, dialplan ou service de supervision modifié.
Le journal central reste fondé sur son numéro AMI brut ; sans préfixe fiable,
son pays devient indéterminé, sans modification des anciens enregistrements.

Retour d’appel local 0,13 → 0,21, chime de décroché ×1,6, mêmes fréquences et
durées ; volume zéro muet, limiteur conservé et somme des enveloppes du chime
inférieure à 1 même à 200 %. Le ressenti dépend du casque et du volume système.
Sonnerie entrante, volume voix, micro et clavier inchangés.

86 tests, typage, lint, build ; fixture navigateur avec numéros fictifs Canada,
France, Pérou, information absente/concordante et commandes des deux sons,
sans erreur console. Aucun appel réel ni onglet client rechargé. Guides FR/EN/ES
alignés sur la prudence d’affichage ; captures existantes non affectées par
ce correctif de métadonnées/son, trois PDF reconstruits.


Build live isolé depuis Git, npm ci et variables publiques usuelles ; archive
ustar 266 fichiers, SHA-256
`d0d24ac1883e08a7dad58757de97a0cff1d2e55dde68b3597ad8e6bf189e1fd7`.
Hermes 167.233.244.152 identifié ; ancien lien vérifié à deux reprises,
manifestes avant/après contrôlés, root 0755/0644, Caddy lit sans écrire.
Sauvegarde protégée `/root/apisnix-phone-backups/20261006-incoming-identity/` :
ancienne cible, deux manifestes, archive, empreinte, source et heure.
Bascule atomique, aucun rechargement de service. Index et assets HTTPS
identiques au build : JS `index-Cf4_ZASg.js`, CSS `index-soO7B-ST.css`.
Formulaire live ouvert dans le navigateur intégré, bon JS, aucune erreur
console. Les trois guides restent à huit pages ; page modifiée rendue et relue.
Pas de migration ni test d’appel opérateur. La récupération depuis les
identités SIP est validée par tests simulés, pas par un nouvel appel DIDWW.

Retour : contrôler que `current` pointe encore sur cette release puis le
rebasculer atomiquement sur `/srv/apisnixphone/releases/20261006-call-closes-wrapup`,
conservée intacte ; aucune restauration de base ou de configuration PBX.
Un onglet déjà ouvert doit être rechargé **hors appel** pour obtenir la correction.

## Appeler ferme la carte de fin d'appel — publié le 6 octobre 2026

**En service : 20261006-call-closes-wrapup**, source `0141698`, bascule le
6 octobre à **17:00:37 Africa/Douala** (16:00:37 UTC). Lancer un appel depuis
le Journal, les Contacts, les Rappels ou la palette alors qu'un appel terminé
attend « Terminer » ferme la carte et passe l'appel ; un appel en cours garde
le refus. Aucun changement SIP, PBX, API ni Caddy ; pas de migration.

Build live isolé depuis `git archive` du commit, npm ci, trois variables
publiques usuelles ; 266 fichiers, archive ustar SHA-256
`9b4a1abd46baef6bddc8b9c57b26391a3502d910d7b4e39c337014516d8e8261`.
Hôte Hermes vérifié ; cible de `current` contrôlée avant extraction et avant
bascule (`20261006-settings-identity`) ; 266 empreintes identiques entre le
build local et le dossier extrait ; droits root 0755/0644, lecture Caddy sans
écriture ; lien basculé atomiquement, sans rechargement Caddy. Sauvegarde
protégée `/root/apisnix-phone-backups/20261006-call-closes-wrapup/` :
ancienne cible, manifestes ancien et nouveau, archive, empreinte, source et
heure. Release précédente conservée.

HTTPS : index 200 no-cache, JS `index-D5GY42xK.js` et CSS `index-soO7B-ST.css`
200 immuables, JS servi identique au build ; `/api/me` anonyme 401. Navigateur
intégré : écran de connexion live, nouveau JS chargé, aucune erreur console.
Aucune connexion SIP ni appel lancé, aucun onglet client rechargé ; le
comportement s'applique au prochain chargement de page, hors appel.

Retour : vérifier que `current` vise encore cette release, puis repointer
atomiquement vers `/srv/apisnixphone/releases/20261006-settings-identity`,
sans recharger Caddy ni restaurer de base.

## Poste connecté dans les Réglages — publié le 6 octobre 2026

**En service : 20261006-settings-identity**, source `d7bc5c6`, bascule le
6 octobre à **15:31:00 Africa/Douala** (14:31:00 UTC). Carte « Poste
connecté » en tête des Réglages (identifiant, serveur, état de la ligne) et
serveur dans la rubrique Compte, pour identifier un poste depuis une capture
téléphone. Aucun changement SIP, PBX, API ni Caddy ; pas de migration.

Build live isolé depuis `git archive` du commit, npm ci, trois variables
publiques usuelles ; 266 fichiers, archive ustar SHA-256
`ae6fad3eb8c9fdec05ea869f6a4010ab0737284ed76c1e1d2d76b2b36dcf0f80`.
Hôte et IP Hermes vérifiés ; cible de `current` relevée avant transfert
(`20261006-display-recovery`) ; 266 empreintes de fichiers identiques entre le
build local et le dossier extrait ; droits root 0755/0644, lecture Caddy sans
écriture ; lien basculé atomiquement, sans rechargement Caddy. Sauvegarde
protégée `/root/apisnix-phone-backups/20261006-settings-identity/` :
ancienne cible, manifestes ancien et nouveau, archive, empreinte, source et
heure. Release précédente conservée.

HTTPS : index 200 no-cache, JS `index-sQm09a3C.js` et CSS `index-soO7B-ST.css`
200 immuables, octets identiques au build ; `/api/me` anonyme 401. Navigateur
intégré : écran de connexion live, nouveau JS chargé, aucune erreur console.
Aucune connexion SIP ni appel lancé, aucun onglet client rechargé ; le nouvel
affichage apparaît au prochain chargement de page, hors appel.

Retour : vérifier que `current` vise encore cette release, puis repointer
atomiquement vers `/srv/apisnixphone/releases/20261006-display-recovery`,
sans recharger Caddy ni restaurer de base.

## Récupération de l’affichage — 6 octobre 2026

Protection des erreurs de rendu React : une rubrique défaillante est isolée
sans démonter les commandes du téléphone ; une erreur plus haute affiche un
écran de récupération. Aucun rechargement automatique. Revenir à la connexion
exige un second clic après avertissement d’interruption d’un éventuel appel.
Le lien `https://phone.apisnix-crm.com/?connexion=manuelle` ignore le coffre du
navigateur et les liens de connexion automatiques ; il conserve les données.
Un marqueur par onglet bloque aussi la reconnexion automatique après une erreur
de rendu, jusqu’à une connexion manuelle réussie. Une erreur d’initialisation
du profil referme la ligne et s’affiche sur le formulaire.

Les erreurs de scripts avant démarrage, extensions du navigateur et profils
locaux défectueux ne sont pas automatiquement réparés. L’incident signalé
fonctionne en navigation privée selon Franck ; sa cause exacte reste inconnue.
Aucun effacement de contacts, historique, réglages ou mots de passe. Aucun
changement SIP, PBX ou API. Pas de nouvelle dépendance. Guides FR/EN/ES alignés.
81 tests, typage et lint réussis. Test navigateur sur erreur synthétique :
isolation de rubrique, commandes voisines conservées, FR/EN/ES, annulation et
retour au formulaire manuel. Guides PDF régénérés, huit pages chacun.
**En service : 20261006-display-recovery**, source `4b671aa`, publication le
6 octobre à **15:17:18 Africa/Douala** (14:17:18 UTC). Build live isolé depuis
le commit, npm ci, variables publiques habituelles ; 266 fichiers. Archive
SHA-256 `04ca596b8109a314ee1b32fc147f5b103819652e7d56257464264c10b39e30e9`.
Hermes 167.233.244.152 vérifié, permissions root 0755/0644, manifeste et lecture
Caddy contrôlés. Sauvegarde protégée
`/root/apisnix-phone-backups/20261006-display-recovery/` : ancienne cible,
manifestes, archive, source et heure. Bascule atomique sans redémarrage.

Index public normal et manuel, JS `index-D1bJ0PrW.js` et CSS
`index-DR8OwYTZ.css` identiques au build. Formulaire manuel vérifié dans le
navigateur intégré, aucune erreur console. Aucun appel réel lancé et aucun
onglet client rechargé. Le nouveau code se charge au prochain chargement de
page, hors appel. Retour : après contrôle de la cible courante, repointer
atomiquement `/srv/apisnixphone/current` vers la release conservée
`/srv/apisnixphone/releases/20261006-audio-numbers`. Aucune restauration DB.


## Audio 30 jours et numéros — publiés le 6 octobre 2026

Release précédente **20261006-audio-numbers**, source **2ff280d**, à 12:48:50
Africa/Douala (11:48:50 UTC). Audio : Aujourd’hui / Hier / 7 / 30 jours,
message si résultats limités. Numérotation : +33 → 0033, autres + retirés,
préfixes carrier conservés. Pays d’un entrant national français de neuf chiffres
et du préfixe sortant 90033 ; numéros reçus bruts inchangés. Contacts/rappels
compatibles avec les numéros déjà enregistrés. Limites dans WEBPHONE_PLAN.

76 tests, typage, lint ; contrôle intégré en démo FR/EN/ES, captures utiles
et trois PDF huit pages refaits. PDF rendus depuis le HTML local du générateur,
sans piloter une session navigateur ; rendu et sommaires contrôlés.
Build live isolé depuis git archive, npm ci et trois variables publiques usuelles.
266 fichiers ; SHA-256 de l’archive ustar :
`caf83ec5a12c79aa2e0de7897205277edfeec43a80d29456c4de89a41d4923d2`.

Sauvegarde protégée `/root/apisnix-phone-backups/20261006-audio-numbers/` :
ancienne cible, manifeste précédent, nouvelle archive, manifeste, source et
heure de bascule. Ancienne release `20260930-sign-in-link` conservée.
Hôte/IP Hermes vérifiés ; empreintes contrôlées avant et après extraction,
droits root 0755/0644, lecture Caddy sans écriture, lien basculé atomiquement.
Pas de redémarrage Caddy ni du service Audio, pas de migration de données.

HTTPS : index 200 no-cache, JS `index-Cc4JAuZt.js` et CSS
`index-BL9yqqXC.css` 200 immuables, octets identiques au build ; API anonyme
401. Navigateur intégré : écran live, nouveau JS chargé, aucune erreur console.
Aucun onglet client rechargé, aucune connexion SIP ou conversation extérieure
lancée pendant ce contrôle. Le nouvel affichage est disponible au prochain
chargement, hors appel. La qualité audio doit être contrôlée par un appel réel.

Retour : vérifier que current vise encore cette release, puis repointer
atomiquement vers `/srv/apisnixphone/releases/20260930-sign-in-link`, sans
recharger Caddy ni restaurer une base. Les changements PBX de cette demande
(8502 et route Canada) sont indépendants et documentés dans le dépôt privé.


## Téléchargements publics — 17 septembre 2026

À la demande de Franck, deux boutons sous le formulaire de contact de
[l'accueil APISNIX CRM](https://apisnix-crm.com/#apisnix-downloads) distribuent
les paquets actuels :

| Plateforme | Lien direct | Taille |
| --- | --- | --- |
| Android `.3` | [APK](https://apisnix-crm.com/downloads/ApisnixPhone-Android-6.2.7-apisnix.3.apk) | 133 229 927 octets |
| Windows compact `.2` | [EXE x64](https://apisnix-crm.com/downloads/ApisnixPhone-Windows-6.2.2-apisnix.2-x64.exe) | 157 022 414 octets |

Les fichiers sont identiques aux paquets locaux décrits plus bas ; seules les
copies publiques ont des noms plus lisibles. Leurs SHA-256 figurent aussi dans
[SHA256SUMS.txt](https://apisnix-crm.com/downloads/SHA256SUMS.txt).
Signature Android de développement et absence de signature Windows conservées.
Les versions restent en cours d'essai ; aucun lancement automatique de logiciel
ni changement Asterisk n'est associé aux boutons.

Le lien « Code source et licences » pointe sur la révision publique
`2b31cd214ffd03deca0177fa2101a6e29eff6968`, contenant les adaptations des deux
versions et les scripts de reconstruction. Voir NOTICE.md pour la livraison
des sources correspondantes de tous les composants. L'exploitation de l'accueil,
ses sauvegardes et le retrait des boutons sont documentés exclusivement dans
`docs/TELECHARGEMENTS_SOFTPHONES.md` du dépôt privé Gestion_CRM-APISNIX.
Publier les prochaines versions sous de nouveaux noms avant de changer les liens.

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

APK actuel : `apisnixphone-android-debug-6.2.7-apisnix.3.apk`.
Il est signé avec une clé de développement locale. Le logo et les couleurs
APISNIX sont intégrés ; certains écrans secondaires restent à revoir.
Franck a essayé le pilote précédent et signalé un ajout erroné de `+237`.
Le correctif `.3` et sa migration doivent encore être essayés sur son téléphone.
Voir [NUMEROTATION_ANDROID.md](NUMEROTATION_ANDROID.md).

Pour le test, transférer le fichier au téléphone
Android 9 ou supérieur, l'ouvrir et autoriser cette source d'installation si
Android le demande. Saisir uniquement l'identifiant et le mot de passe de test.
Autoriser le microphone ; les autres permissions dépendent des fonctions utilisées.

L'APK inclut ARM 32 et 64 bits, pas de x86. La signature et le manifeste ont été
vérifiés ; cela ne valide ni l'interface ni les appels sur téléphone.

### Mise à jour Android `.3` — chiffres saisis conservés

- Fichier : `dist/android/apisnixphone-android-debug-6.2.7-apisnix.3.apk`.
- Taille : 133 229 927 octets (~127 Mio).
- SHA-256 : `c5fb9aac821e43ad9b1df248741a8f32aa1afd73ec41777953506c3c527f2488`.
- `versionCode=602008`, contre `602007` pour le pilote `.2` ; même application
  `com.apisnix.phone` et même certificat de développement, comparé et vérifié.
- Compilation Kotlin/Java et assemblage réussis le 16 septembre ; signature
  APK v2 valide, nom et architectures ARM 32/64 vérifiés dans le paquet.

Installer par-dessus l'ancien APK, sans désinstaller ni effacer les données.
La première ouverture désactive l'ajout automatique d'indicatif sur les comptes
existants. Retaper un numéro au clavier pour le test : les anciens appels déjà
stockés en `+237…` ne sont pas réécrits. Vérifier le numéro, l'audio et le
raccrochage avec une destination de test autorisée. Aucun changement du serveur.

Le pilote `.2` reste conservé pour comparaison. Son numéro de version étant
inférieur, une réinstallation directe par-dessus `.3` peut être refusée ; ne
pas désinstaller automatiquement et perdre les données pour forcer un retour.

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

## Windows — compilation et packaging exécutés avec succès

Machine Windows x64 avec Visual Studio 2022 (C++/Windows SDK), Qt 6.10 ou plus
récent avec kit MSVC x64, NetworkAuth et ShaderTools, CMake/CPack, NSIS, Git et
les dépendances MSYS2 du SDK. Le PDF, le gestionnaire de crash et RNNoise sont désactivés
pour ce build. Voir aussi `apps/desktop/README.md` pour les dépendances amont.

Depuis un environnement développeur Visual Studio, exemple à adapter :

```powershell
./scripts/build-windows.ps1 -QtRoot 'C:\Qt\6.10.0\msvc2022_64' -Jobs 4
```

Le script prépare le SDK avec `prepare-desktop-sdk.py`, compile, appelle
l’installation/packaging amont
et récupère les `.exe` dans `dist/windows/`. Les vérifications d'outils Windows
amont peuvent installer des dépendances MSYS2 manquantes. Utiliser une machine
de compilation dédiée. Cette procédure a réussi sur le runner GitHub Windows ;
Franck a confirmé le fonctionnement du premier pilote sur Windows.
Le nouvel installateur compact nécessite son propre essai sur PC.

### Compilation en ligne choisie : GitHub Actions

Le workflow `.github/workflows/build-windows.yml` est préparé et sa syntaxe
validée avec Actionlint. Il est exécuté dans le dépôt public
[FranckThiago/ApisnixPhone](https://github.com/FranckThiago/ApisnixPhone),
créé après autorisation explicite de Franck.

Il utilise `windows-2022`, Visual Studio 2022 du runner, Qt 6.10.0 et MSYS2.
Les actions sont fixées par commit. Pystache 0.6.8 est installé via pip dans
le Python MSYS2 : le paquet MSYS2 `python-pystache` est indisponible. Déclenchement manuel uniquement, droits du
workflow limités à la lecture du contenu ; aucune publication de release et
aucun accès Asterisk nécessaires. Le GitLab Linphone étant inaccessible depuis le runner, les sources du SDK
sont obtenues sur GitHub. `desktop-sdk.lock.json` conserve chaque URL et commit.
La préparation contrôle les commits d’origine inscrits dans Desktop/SDK, refuse
les révisions et changements locaux inattendus, puis vérifie les checkouts.
Le SDK utilise son miroir officiel ; plusieurs dépendances utilisent un miroir
communautaire au même commit Git. Ne pas suivre les branches de ces miroirs.
RNNoise est omis explicitement et désactivé dans CMake pour le pilote Windows.
Le Python utilisé par CMake est celui qui reçoit Pystache, pour éviter les
interférences avec le Python installé par l’action Qt. Les chemins Qt et Python
sont normalisés avec des slashs avant leur passage à CMake, car les antislashs
Windows peuvent devenir des échappements dans les projets de test générés.

Les dépendances système MSYS2 évoluent avec leur dépôt. La compilation a réussi
dans le run `34985036963` ; une reconstruction ultérieure reste à contrôler.

Après publication : onglet Actions → ApisnixPhone Windows installer → Run workflow.
Le résultat est l’archive `ApisnixPhone-Windows-x64-test`, conservée
14 jours, contenant le `.exe` non signé et son empreinte SHA-256. Télécharger
et extraire cette archive, puis installer le `.exe` sur le poste de test.

Les runners standard sont gratuits pour les dépôts publics. Un dépôt privé
consomme le quota du compte, puis peut être facturé. Source consultée le
15 septembre 2026 : [documentation GitHub](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
Aucun achat. Le dépôt public et le lancement de la compilation ont été
autorisés le 15 septembre 2026. Compilation et packaging validés ; le premier
pilote fonctionne selon Franck. Les nouveaux écrans et les cas détaillés
d’appel restent à tester sur le nouveau pilote.
Le poste de test n’a besoin que de l’installateur ; la signature Windows de
diffusion reste à organiser.

### Signature Windows et alertes de sécurité

Depuis le signalement du 17 septembre, suivre
[SIGNATURE_WINDOWS.md](SIGNATURE_WINDOWS.md) pour le diagnostic et la future
signature sous l'identité APISNIX. Les tables de certificats de l'installateur
`.2` et de l'application extraite sont vides. La DLL graphique signalée contient
des certificats Microsoft, sans validation complète de confiance effectuée ici.

Microsoft Artifact Signing Basic est proposé pour l'entreprise française ;
accord sur la dépense, abonnement et validation d'identité encore nécessaires.
Le workflow actuel produit toujours des pilotes non signés. La future chaîne
devra signer les binaires applicatifs avant packaging, puis l'installateur,
vérifier l'horodatage et calculer les nouveaux hashes avant publication.
Aucun fichier public n'a été remplacé pendant ce diagnostic.
Franck reporte ensuite le chantier de signature au profit de la supervision
SIP : procédure conservée pour plus tard, aucune activation Azure à poursuivre.

### Premier pilote Windows conservé

- Fichier : `dist/windows/ApisnixPhone-6.2.2-win64.exe`.
- Taille : 156 770 423 octets (environ 150 Mio).
- SHA-256 : `b296a10522e795e1cbc012d2f171962fe4c07a9a5609bbcc8c350b3cf0229260`.
- [Compilation réussie](https://github.com/FranckThiago/ApisnixPhone/actions/runs/34985036963),
  commit `a3ae95be325337a0ddcc21777705f8e1e8a27bf5`.
- Artefact `ApisnixPhone-Windows-x64-test` récupéré le 15 septembre 2026 ;
  empreinte comparée à `SHA256SUMS` du runner, en-tête PE x64 vérifié localement.
  Le binaire n'a pas été exécuté sur le Mac.

Transférer l'installateur au PC Windows x64, l'ouvrir puis lancer ApisnixPhone.
Le pilote n'est pas signé avec un certificat de diffusion : Windows peut
afficher un avertissement d'éditeur inconnu. Le domaine est préconfiguré ;
saisir l'identifiant et le mot de passe de test puis vérifier un appel avec
audio dans les deux sens. Ne pas distribuer ce pilote comme version client
validée avant les essais ci-dessous.

## Évolution Windows : téléphone compact

Franck confirme le bon fonctionnement du premier pilote le 16 septembre.
Le nouveau format vertical est décrit dans [FENETRE_COMPACTE.md](FENETRE_COMPACTE.md).
La commande de build distingue son paquet par la version `6.2.2-apisnix.2`.
Les composants ont été rendus et leurs signaux testés avec Qt sans serveur SIP.
La [compilation 35115685999](https://github.com/FranckThiago/ApisnixPhone/actions/runs/35115685999)
a réussi le 16 septembre pour le commit
`a8c5171bb79d0acb2da0a95ce2541bc7dd530fb0`, branche `codex/windows-compact`.

- Fichier : `dist/windows/ApisnixPhone-6.2.2-apisnix.2-win64.exe`.
- Taille : 157 022 414 octets (environ 150 Mio).
- SHA-256 : `98673a23b94363cd81ea730d91c1d893f1cf1c4247550ae065077406dc43831a`.
- Artefact `ApisnixPhone-Windows-x64-test` récupéré dans un nouveau dossier ;
  empreinte comparée au `SHA256SUMS` du runner, format PE x64 vérifié.
- Installateur de test non signé. Aucun lancement du nouvel exécutable sur
  Windows ni appel réel effectué par l’agent.

Fermer ApisnixPhone, installer le nouveau pilote puis vérifier connexion,
appel audio, micro, attente/reprise, DTMF et raccrochage. Vérifier également
l’accès aux réglages et le retour au petit format. Garder les comptes et
l’ancien installateur pour retour arrière ; ne pas effacer les données.
Le suivi de compilation est terminé. Aucun changement Asterisk ou migration
serveur lié à ce paquet.

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
passe ou numéro de client dans le dépôt. Franck confirme le fonctionnement
général du premier pilote Windows ; les cas individuels de cette liste n'ont
pas été consignés. Android et le nouveau format compact restent à tester.

## Production et retour arrière

Pour une intervention serveur, commencer par
le dépôt privé `FranckThiago/Gestion_CRM-APISNIX`, son AGENTS.md puis
`docs/TABLEAU_DE_BORD.md`. Il décrit les modèles fonctionnels, les suspensions commerciales,
le workflow de réaffectation, les comptes d'administration et leurs mécanismes
d'accès protégés. L'ancien dossier `docs/production-privee/` est une archive
locale ; maintenir désormais les procédures dans le dépôt privé de gestion.
Les détails ne sont pas destinés au dépôt public. La copie
native d'un user ou d'une campagne peut reprendre des affectations et des
droits ; changer seulement le nom ne suffit pas à isoler un nouveau client.

La construction des softphones ne nécessite pas de modification du PBX.
Des interventions d'enregistrement séparées ont ensuite été autorisées : un
poste pilote activé, quatre contextes supplémentaires chargés, puis 26 postes
affectés après validation des enregistrements du pilote. Deux postes ont
ensuite été suspendus pour motif commercial sur demande de Franck ; leurs
modèles SIP fonctionnels sont conservés dans la procédure de réactivation. Voir
[l'état de la supervision](SUPERVISION_ASTERISK_VICIDIAL.md). Les sauvegardes
restent protégées sur le serveur et les procédures détaillées hors dépôt.
Pour les postes avec modèle SIP, Conf Override porte le contexte effectif.
Phone Context est limité à 20 caractères dans la base actuelle : conserver
un contexte restrictif de repli valide si le nom complet dépasse cette limite.
Toujours contrôler le résultat dans Asterisk après génération native et
rechargement SIP. Le retour arrière restaure les champs sauvegardés des seuls
postes concernés, y compris le modèle s'il a été modifié, puis suit la même
génération et vérification ; ne pas supprimer les enregistrements.
Aucun changement DNS/pare-feu ni migration de schéma. Les applications de test sont distinctes du Linphone standard par
leur identifiant. Pour arrêter le pilote, fermer/désinstaller ApisnixPhone et
réutiliser le softphone habituel avec les accès existants, sans changement du PBX.
Pour finaliser la distribution après ces pilotes : terminer l'identité,
l'aide/confidentialité, les essais, la signature, les sources correspondantes
et le canal de mise à jour. La demande de publication du 17 septembre porte
sur les fichiers actuels, sans présenter ces validations comme terminées.

## ApisnixPhone Web — construire et héberger

Application statique : l'hébergement sert des fichiers, il ne transporte ni la
signalisation ni l'audio, qui vont du navigateur au PBX (WSS 8089, RTP).

Fail2ban protège le WSS depuis le 23 septembre 2026 : des échecs d'identification
répétés depuis une même IP, tous postes du site confondus, bloquent le 8089
pendant plusieurs jours. Symptôme : le téléphone web ne se connecte plus depuis
ce site mais fonctionne ailleurs. Seuils et levée ciblée : dépôt privé de gestion,
`docs/PARE_FEU_ET_FAIL2BAN.md` ; ne pas les publier ici.

```sh
cd webphone
npm ci
VITE_APP_MODE=live VITE_SIP_DOMAIN=apisnix-crm.com \
  VITE_SIP_WSS_URL=wss://apisnix-crm.com:8089/ws npm run build
```

Le dossier `webphone/dist/` est la release. Aucune de ces trois valeurs n'est un
secret ; ne jamais ajouter de mot de passe dans une variable `VITE_*`. Sans ces
variables, le build est une démonstration.

Hébergement réalisé le 21 septembre : Hermes, derrière le Caddy existant, à côté
de la supervision et sans la modifier ; dossier versionné
`/srv/apisnixphone/releases/<version>/` et lien `current`. HTTPS est obligatoire :
hors `localhost`, un navigateur refuse le microphone sans lui. Nom validé :
`phone.apisnix-crm.com`, préféré à `sip.` — un nom `sip.*` désigne d'ordinaire un
serveur SIP, attire les robots qui sondent ces noms et laisserait croire que la
téléphonie passe par cette machine. Bloc Caddy de départ :

```
phone.apisnix-crm.com {
    bind 0.0.0.0
    root * /srv/apisnixphone/current
    encode zstd gzip
    route {
        try_files {path} /index.html
        @assets path /assets/*
        header @assets Cache-Control "public, max-age=31536000, immutable"
        header /index.html Cache-Control "no-cache"
        file_server
    }
    header {
        Strict-Transport-Security "max-age=31536000"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "no-referrer"
        Permissions-Policy "microphone=(self), camera=(), geolocation=()"
        Content-Security-Policy "default-src 'self'; connect-src 'self' wss://apisnix-crm.com:8089; img-src 'self' data:; style-src 'self' 'unsafe-inline'; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'"
    }
}
```

Onglet **Audio** (24 septembre, en service) : le webphone appelle `/api/*` sur
sa propre origine (`VITE_RECORDINGS_URL` vide). Pour la mise en service, ajouter
avant `try_files`, dans le même bloc `route`, un relais vers la supervision de
Hermes, qui expose l'accès agent :

```
        @apisnix_api path /api/*
        reverse_proxy @apisnix_api 127.0.0.1:8766
```

Côté supervision, ajouter `phone.apisnix-crm.com` à `trusted_hosts` de la
configuration ; les cookies restent propres à chaque nom d'hôte. Aucune
modification de la CSP : `connect-src 'self'` et `media-src 'self'` couvrent le
relais. L'accès s'ouvre **avec la ligne elle-même** : à la connexion, le
téléphone envoie l'identifiant et le mot de passe SIP à `POST /api/line-session`
(HTTPS, même origine) ; la supervision demande au PBX, par la passerelle en
lecture seule (mode `verify`), si ce poste présente bien son mot de passe, puis
ouvre une session agent liée au poste. Rien n'est saisi ni stocké ; le poste
doit être classé dans une équipe et actif. Prérequis PBX et supervision :
dépôt privé de gestion, `docs/DEPLOIEMENT_AUDIO_AGENT.md`. Une autre origine
imposerait `VITE_RECORDINGS_URL`, CORS avec cookies et une CSP élargie : non
retenu.

`style-src 'unsafe-inline'` est requis par les styles calculés (avatars, niveau
du micro). Le bloc `route` garantit que `try_files` précède les règles de cache :
`/`, `/index.html` et les routes de repli portent `no-cache`, les assets
empreintés restent immuables. Ne pas retirer cet ordre explicite.

### Lien de connexion d'un client

En service depuis le 30 septembre 2026 (release `20260930-sign-in-link`) :

```
https://phone.apisnix-crm.com/#u=<identifiant>&p=<mot de passe>
```

- **Générateur : https://phone.apisnix-crm.com/lien.** Saisir l'identifiant et
  le mot de passe de la ligne, puis **Copier le lien** (ou **Partager** sur un
  téléphone). Tout se fait dans le navigateur : rien n'est envoyé ni enregistré,
  et le téléphone n'y est pas chargé. La page est ouverte sans connexion : elle
  ne fait que mettre en forme ce qu'on y tape. Un petit lien discret « Créer un
  lien de connexion », en bas de l'écran de connexion, y mène au cas où.
- Tout ce qui suit `#` reste dans le navigateur : ni Caddy ni un journal ne le
  voient. Ne jamais écrire `?u=` : ce serait envoyé au serveur.
- À la main, encoder dans le mot de passe `&` en `%26`, `#` en `%23`, `%` en
  `%25` et l'espace en `%20` ; `+` et `=` restent tels quels. Le générateur le
  fait seul.
- À l'ouverture, la page lit le lien, l'efface de la barre d'adresse, remplit le
  formulaire et l'envoie : mêmes contrôles qu'à la main, puis Chrome et Edge
  proposent d'enregistrer l'accès pour les actualisations suivantes. Collé dans
  un onglet déjà ouvert, il connecte depuis l'écran de connexion ; si une ligne
  est déjà connectée, il est effacé et ignoré.
- Le lien vaut le mot de passe, comme les liens VICIdial : qui le détient a la
  ligne, et le client en est responsable (choix de Franck). Changer le mot de
  passe SIP, notamment lors d'une suspension, le rend inutilisable.
- Un lien faux affiche « Identifiant ou mot de passe refusé » et chaque clic
  compte comme un échec pour Fail2ban : plusieurs clics depuis un même site
  peuvent bloquer tous ses postes (voir plus haut).

## Lien de connexion et générateur publiés — 30 septembre 2026

Release active **`20260930-sign-in-link`**, publiée à **18:02:28 Africa/Douala
(17:02:28 UTC)** à la demande de Franck. Source `258cfcc` : la release
précédente plus le lien de connexion `#u=…&p=…`, le générateur `/lien` et son
petit lien sur l'écran de connexion. Build isolé depuis `git archive` :
`npm ci` sans vulnérabilité, typage, lint, 75 tests, build live avec les trois
variables publiques. Mode live et WSS attendu dans le bundle ; ni source map ni
`.env`. Pas de migration ni changement PBX, Caddy, DNS, supervision ou compte.

Archive ustar de 266 fichiers, SHA-256
`083a56677e1a1c634122586bababb94b1d344ac3b309702d34f942f37d38b55f`.
Sauvegarde protégée `/root/apisnix-phone-backups/20260930-sign-in-link/` :
ancienne cible, manifeste antérieur, archive, manifeste, SHA256SUMS,
source.json et heure de bascule. Empreinte vérifiée avant extraction,
manifeste identique au build ; release root 0755/0644, lue par caddy sans
écriture. Bascule atomique après contrôle de la cible précédente, sans
rechargement Caddy.

Contrôles : HTTPS 200, HTTP 308, `/` et `/lien` 200 `no-cache` servant l'index
du build, JS `index-DRewTJMh.js`, `lib-DBcT_Opp.js` et CSS
`index-BL9yqqXC.css` identiques au build, assets immuables, CSP et en-têtes
inchangés, `/api/me` anonyme 401. Navigateur intégré : écran de connexion live
sans Démonstration, lien discret menant à `/lien`, lien produit sur
`https://phone.apisnix-crm.com/`, aucune erreur console. Aucun lien ouvert,
aucune connexion SIP ni appel : un faux mot de passe compterait pour Fail2ban.
Un onglet ouvert avant doit être actualisé **hors appel**.

Retour ciblé : vérifier que `current` vise cette release puis le repointer
atomiquement vers `/srv/apisnixphone/releases/20260929-languages`, conservée
intacte. Ne pas restaurer de configuration globale.

## État précédent — choix de la langue, 29 septembre 2026

Release **`20260929-languages`**, remplacée le 30 septembre par
`20260930-sign-in-link` qui la contient, publiée à **17:28:03 Africa/Douala
(16:28:03 UTC)** à la demande de Franck. Source `0324bbc` : la release
précédente (thème clair, correctif micro, volume) plus le choix de la langue
français, anglais, espagnol. Build isolé depuis `git archive` : `npm ci` sans
vulnérabilité, typage, lint, 69 tests, build live avec les trois variables
publiques. Mode live et WSS attendu dans le bundle ; ni source map ni `.env`.
Pas de migration ni changement PBX, Caddy, DNS, supervision ou compte.

Archive ustar de 266 fichiers, SHA-256
`196a1207068e32703063d4f7b16d65c608945873ee7dd6604ad95dfcfc41f7e1`.
Sauvegarde protégée `/root/apisnix-phone-backups/20260929-languages/` :
ancienne cible, manifeste antérieur, archive, manifeste, SHA256SUMS,
source.json et heure de bascule. Empreinte vérifiée avant extraction,
manifeste identique au build ; release root 0755/0644, lue par caddy sans
écriture. Bascule atomique après contrôle de la cible précédente, sans
rechargement Caddy.

Contrôles : HTTPS 200, HTTP 308, index `no-cache` et identique au build, JS
`index-BYCFfM-u.js`, `lib-DDTI8ldE.js` et CSS `index-CYVI7wZm.css` servis
identiques au build, assets immuables, CSP inchangée, repli SPA 200,
`/api/me` anonyme 401. Écran de connexion live vérifié dans le navigateur
intégré : français par défaut, bascule anglais et espagnol, aucune erreur
console ; aucune connexion SIP ni appel lancé. Aucun onglet client rechargé à
distance : un onglet ouvert avant doit être actualisé **hors appel** pour
obtenir le choix de la langue.

Retour ciblé : vérifier que `current` vise cette release puis le repointer
atomiquement vers `/srv/apisnixphone/releases/20260928-call-card-theme`,
conservée intacte. Ne pas restaurer de configuration globale.

## État précédent — carte d'appel en thème clair, 28 septembre 2026

Release **`20260928-call-card-theme`**, publiée à **16:36:54
Africa/Douala (15:36:54 UTC)** à la demande de Franck. Source `e05e2e0` : la
release précédente (volume, correctif micro) plus la carte d'appel qui suit le
thème clair. Build isolé depuis `git archive` : `npm ci` sans vulnérabilité,
typage, lint, 63 tests, build live avec les trois variables publiques. Mode
live et WSS attendu dans le bundle ; ni source map ni `.env`. Pas de migration
ni changement PBX, Caddy, DNS, supervision ou compte.

Archive ustar de 266 fichiers, SHA-256
`2888b705811a72486fd596d0ee9cb56bad18e1046e8e8bf07b383bac06ce73de`.
Sauvegarde protégée `/root/apisnix-phone-backups/20260928-call-card-theme/` :
ancienne cible, manifeste antérieur, archive, manifeste, SHA256SUMS,
source.json et heure de bascule. Empreinte et manifeste vérifiés après
extraction ; release root 0755/0644, lue par caddy sans écriture. Bascule
atomique après contrôle de la cible précédente, sans rechargement Caddy.

Contrôles : HTTPS 200, HTTP 308, index `no-cache`, `index.html`, JS
`index-GZv_vCIa.js` et CSS `index-DpADt8xd.css` servis identiques au build,
assets immuables, repli SPA 200, `/api/me` anonyme 401, supervision 200. Écran
de connexion live vérifié dans le navigateur intégré, sans erreur console ;
aucune connexion SIP ni appel lancé. Aucun onglet client rechargé à distance :
un onglet ouvert avant doit être actualisé **hors appel**.
Franck confirme ensuite le 28 septembre le bon rendu en thème clair en service.

Retour ciblé : vérifier que `current` vise cette release puis le repointer
atomiquement vers `/srv/apisnixphone/releases/20260928-mic-lifecycle`,
conservée intacte (correctif micro sans le thème clair). Ne pas restaurer de
configuration globale.

## État précédent — correctif micro, 28 septembre 2026

Release précédente **`20260928-mic-lifecycle`**, publiée à **16:18:11 Africa/Douala
(15:18:11 UTC)**. Build isolé de la base active `06a8cc3`, avec seulement
`webphone/src/telephony/audio.ts` et son test de régression issus de `e7cd2ab`.
Le thème clair de la carte d'appel n'y figurait pas. La piste amplifiée arrêtée
par SIP.js n'est plus réutilisée à l'appel suivant ; capture directe à 100 %
conservée. 63 tests, typage, lint et build live réussis. Régression reproduite
avant correction. Pas de migration ni changement PBX, Caddy, DNS ou compte.

Archive de 266 fichiers, SHA-256
`0f01bc019ed9acf6cebd49f74ab394fdea5cd4949a03bf965151024db7ec115f`.
Sauvegarde protégée `/root/apisnix-phone-backups/20260928-mic-lifecycle/` :
ancienne cible, manifeste antérieur, archive, SHA256SUMS, source.json et heure
de bascule. Manifeste extrait vérifié ; release root 0755/0644 lisible par
Caddy. Bascule atomique après contrôle de la cible précédente. HTTPS 200,
index no-cache, index/JS principal/CSS identiques au build ; écran de connexion
vérifié dans le navigateur intégré. Aucun onglet client rechargé à distance.

Un onglet déjà ouvert doit être actualisé **hors appel**. **Franck confirme
le 28 septembre que la correction a rétabli le son chez le client.** Cette
validation humaine complète les tests ; aucune nouvelle mesure serveur après
correction n’a été réalisée. Retour ciblé :
vérifier que `current` vise cette release puis le repointer atomiquement vers
`/srv/apisnixphone/releases/20260928-volume-micro`, conservée intacte ; cette
ancienne version conserve le défaut de piste amplifiée. Ne pas restaurer de
configuration globale.

Version précédente : `20260928-volume-micro`, source `06a8cc3`, publiée le
28 septembre à 15:23:14 Africa/Douala (14:23:14 UTC) : volume d'écoute de 100 %
par défaut, réglable jusqu'à 200 % (amplification Web Audio avec limiteur
au-delà de 100 %, repli sur l'élément audio), ligne « Autorisation du micro »
dans Réglages → Audio. Build isolé depuis `git archive` : `npm ci` sans
vulnérabilité, typage, lint, 59 tests et build live réussis. Archive ustar de
266 fichiers, SHA-256
`6c10867edeaf428eda30ad1b10dfa5fa52400aad743779bc68373e5997b72edd`, manifeste
contrôlé après extraction ; release root 0755/0644, lue par Caddy sans droit
d'écriture. Face à la release en ligne, `index.html`, le JS principal, le CSS
et le module SIP.js changent. Ancienne cible, manifestes, archive et reçu
protégés dans `/root/apisnix-phone-backups/20260928-volume-micro/`. Bascule
atomique de `current` depuis `20260928-country-code`, sans rechargement Caddy.
HTTPS 200, HTTP 308, index `no-cache` identique au build, assets immuables,
repli SPA 200, JS `index-Dqi51cEz.js`, CSS `index-zU-iFouS.css` et module
SIP.js servis identiques au build, `/api/me` anonyme 401, supervision 200 ;
écran de connexion live sans erreur console. Appels web en cours non contrôlés
sur le PBX ; un onglet ouvert avant doit être actualisé. Amplification et
bouton d'autorisation confirmés ensuite par Franck sur la ligne réelle. Retour ciblé :
après contrôle de la cible courante, repointer `current` vers
`20260928-country-code`.

Version précédente : `20260928-country-code`, source `8890bb6`, publiée le
28 septembre à 13:25:24 Africa/Douala (12:25:24 UTC) : pays affiché pour les
numéros internationaux composés sans `+`, comme le fait le PBX. Build isolé
depuis `git archive` : `npm ci` sans vulnérabilité, typage, lint, 54 tests et
build live réussis. Archive ustar de 266 fichiers, SHA-256
`f97f1cc50e75bf96fc0b057386a9e0d2e08f6cf5df1566278b9f691979b4ef7d`, manifeste
contrôlé après extraction ; release root 0755/0644, lue par Caddy sans droit
d'écriture. Face à la release en ligne, seuls `index.html`, le JS principal et
le module SIP.js changent. Ancienne cible, manifestes, archive et reçu protégés
dans `/root/apisnix-phone-backups/20260928-country-code/`. Bascule atomique de
`current` depuis `20260925-keypad-tones`, sans rechargement Caddy. HTTPS 200,
HTTP 308, index `no-cache` identique au build, assets immuables, repli SPA 200,
JS `index-DLOJX2SC.js`, CSS et module SIP.js servis identiques au build,
`/api/me` anonyme 401, supervision 200 ; écran de connexion live sans erreur
console. Appels web en cours non contrôlés sur le PBX : la bascule ne coupe
aucun appel, mais un onglet ouvert avant doit être actualisé pour voir le
changement. Franck confirme ensuite le drapeau suisse sur le site en service.
Retour ciblé : après contrôle de la cible courante, repointer
`current` vers `20260925-keypad-tones`.

Version précédente : `20260925-keypad-tones`, source `bf357bd`, publiée le
25 septembre à 23:23:49 Africa/Douala : tonalité DTMF locale sous chaque touche
du pavé, en plus du Journal du poste de `bb0a5d2`. Build isolé : `npm ci` sans
vulnérabilité, typage, lint, 53 tests et build live réussis. Archive ustar de
266 fichiers, SHA-256
`576888b9a64468b1ac5558b83bf56995ea8dada76652bcfb6df75d48810ae7db`, manifeste
contrôlé après extraction ; release root 0755/0644, lue par Caddy sans droit
d'écriture. Face à la release en ligne, seuls `index.html`, le JS principal et
le module SIP.js changent ; CSS et autres fichiers identiques. Ancienne cible,
manifestes, archive et reçu protégés dans
`/root/apisnix-phone-backups/20260925-keypad-tones/`. Bascule atomique de
`current` depuis `20260925-line-journal`, sans rechargement Caddy. HTTPS 200,
HTTP 308, index `no-cache` identique au build, assets immuables, repli SPA 200,
JS `index-DPUJlmWg.js`, CSS et module SIP.js servis identiques au build,
`/api/me` anonyme 401, supervision 200 ; écran de connexion live sans erreur
console. Contrôle des appels web en cours non fait (lecture PBX refusée par les
permissions de la session) : la bascule ne coupe aucun appel, mais un onglet
resté sur l'écran de connexion depuis avant la bascule doit être actualisé.
Retour ciblé : après contrôle de la cible courante, repointer `current` vers
`20260925-line-journal`.

Version précédente : `20260925-line-journal`, publiée le 25 septembre à
14:18:31 Africa/Douala. Le Journal réel lit par défaut les appels de la ligne
sur 30 jours via `/api/dashboard` et conserve une vue locale distincte pour
les notes et tags. Aucun changement du PBX, de la supervision ou de Caddy.
Typage, lint, 51 tests et build live réussis ; guide, captures et PDF
régénérés. Archive ustar de 268 entrées, SHA-256
`46054ed68d57b46280bf9353fd2a92e887c5c0a45ae40c2135b9f6718ad61a93`.
Ancienne cible et archive protégées dans
`/root/apisnix-phone-backups/20260925-line-journal/`. Bascule atomique de
`current` après vérification de la cible précédente. Caddy et supervision
actifs, HTTPS 200, index `no-cache` identique au build par SHA-256 et accès
anonyme `/api/me` refusé (401). L’écran de connexion s’ouvre dans le navigateur
intégré ; une session `edu001` connectée n’a pas été essayée, faute de mot de
passe dans cette session. Retour historique : repointer atomiquement `current`
vers `20260925-sonneries`.

Version précédente : `20260925-sonneries`, source `191caa9`, publiée le
25 septembre à 12:03:31 Africa/Douala pour la bibliothèque de huit sonneries
(calmes et bruyantes, niveaux relevés après écoute de Franck). Build isolé :
`npm ci` sans vulnérabilité, typage, lint, 50 tests et build live réussis.
Archive ustar de 266 fichiers, SHA-256
`c7b9bebd1451408b51c5b631df0fce67f40c2febce92e8742a5255cfa4076a6b`, manifeste
contrôlé après extraction ; release root 0755/0644, lue par Caddy sans droit
d'écriture. Ancienne cible, manifestes, archive et reçu de bascule protégés
dans `/root/apisnix-phone-backups/20260925-sonneries/`. Lien `current`
basculé atomiquement, sans rechargement Caddy. HTTPS 200, HTTP 308, index
`no-cache` identique au build, assets immuables, repli SPA 200 ; JS
`index-Iyuyyrmg.js`, CSS et module SIP.js servis identiques au build par
SHA-256 ; écran de connexion live sans erreur console. Le contrôle des appels
web en cours sur le PBX n'a pas pu être fait (lecture de production refusée
par les permissions de la session) : la bascule ne coupe aucun appel, mais un
onglet resté sur l'écran de connexion depuis avant la bascule doit être
actualisé avant de se connecter, car le module SIP.js a changé de nom.
Retour ciblé : après contrôle de la cible courante, repointer `current` vers
`20260924-journal-rappels`.

Version précédente : `20260924-journal-rappels`, publiée le 24 septembre pour
ramener la barre compacte à cinq boutons et placer Appel au centre. Rappels
reste accessible dans Journal, par la palette et depuis le téléphone. Build
live, typage, lint et 43 tests réussis ; captures et PDF du guide régénérés.
Archive ustar propre de 266 fichiers, SHA-256
`d28a4f11204154157589cde0b761a66dc5729256f8973674a87ebad1b0d2f112`.
Ancienne release et cible protégées dans
`/root/apisnix-phone-backups/20260924-journal-rappels/`. Lien `current`
basculé atomiquement ; Caddy actif, HTTPS 200. JS et CSS publics ont la même
empreinte SHA-256 que le build. Aucun rechargement Caddy, changement PBX ou
supervision. Retour historique : repointer `current` vers
`20260924-audio-mobile-nav`.

Version précédente : `20260924-audio-mobile-nav`, publiée le 24 septembre pour
afficher Audio dans la barre du bas à 920 px et moins. Le CSS public
`index-Bnz9I4Xn.css` correspond au build (SHA-256
`a9e473c089302876498fbec4f82f976791ab1e09738774e6c976959b0a00cda6`).
Archive ustar de 266 fichiers, SHA-256
`ce475e26db3e7f441a40c2146143f20c869a6a30b47c1d0695dd8cf06cb01341`.
Ancienne cible et copie protégée dans
`/root/apisnix-phone-backups/20260924-audio-mobile-nav/` (0700/0600).
Bascule atomique du lien `current`, sans recharger Caddy ni toucher au PBX ou
à la supervision. HTTPS 200, Caddy actif et nouveaux fichiers publics vérifiés.
Retour ciblé : repointer `current` sur `20260924-audio-agent` après contrôle de
la cible actuelle. La session ouverte avant publication conserve son ancien
style jusqu'à actualisation, qui déconnecte la ligne.

Version précédente : `20260924-audio-agent`, source `67775d0`, déployée le
24 septembre. Archive SHA-256
`7fcf867eb8e7d220f305924abd441253a30763951a9fea3cb09e297064f610b3` ;
les métadonnées Apple de l'archive macOS ont été retirées du dossier de
release avant activation (266 fichiers servis). Sauvegarde
`/root/apisnix-phone-backups/20260924-audio-agent/` avec l'ancienne cible.
Typage, lint, 43 tests et build live réussis ; HTTPS 200, API 200 JSON, refus
401 d'un faux mot de passe, JS servi identique au build (SHA-256
`0fe8de8febf48c7fa10b755dc2ec9ce911f3d2eb1fab25a2583598e59a670325`)
et écran de connexion contrôlés. Retour historique : repointer `current` vers
`20260922-sip-diagnostics-v2`. Une session avec ligne classée et cinq fichiers
listés a ensuite été validée ; lecture et téléchargement restent à essayer.
Détails PBX, supervision et Caddy dans le
dépôt privé, `docs/DEPLOIEMENT_AUDIO_AGENT.md`.

Version précédente : `20260922-sip-diagnostics-v2`, source `a794199`, déployée le
22 septembre. Elle attend le callback du code SIP après la fin de session
signalée par SIP.js, pour préserver le diagnostic dans la fiche et le Journal.
Build Git isolé : typage, lint, 38 tests et build live réussis ; 266 fichiers,
archive ustar SHA-256
`77da467bfabbf3c08ea369d3ef16a64d28aaaae93fa00e1794d6c348fdfb40f5`.
Sauvegarde `/root/apisnix-phone-backups/20260922-sip-diagnostics-v2/` avec la
release précédente ; bascule atomique du lien seule, sans rechargement Caddy.
HTTPS et nouvel asset 200, JS servi égal au build (SHA-256
`d215b6f6d5b3594eb377cf44b2b1140ad6104248653572a089e71eae946bae18`),
navigateur intégré sans erreur. Retour ciblé si nécessaire : repointer
`current` vers `20260922-tab-lock`, version fonctionnelle antérieure aux
diagnostics. Aucun refus réel n'a été provoqué.

Version transitoire : `20260922-sip-diagnostics`, source `dff2b26`, déployée le
22 septembre à 21:45 Africa/Douala. Les refus d'appel SIP 403, 404, 480, 486,
488 et 503 affichent le code et son explication en fin d'appel et dans le
Journal local. Build isolé depuis Git : typage, lint, 37 tests et build live
réussis ; 266 fichiers, aucun `.env`, source map ou fichier Apple dans la
release. Archive ustar SHA-256
`31bceec5fedd2576b93ec23a08453411281f2e8580369b2d40f71d12d3031d20`.
Sauvegarde protégée `/root/apisnix-phone-backups/20260922-sip-diagnostics/`
avec la release précédente et l'ancienne cible de `current`. Bascule atomique
du lien seule, sans rechargement Caddy. HTTPS 200, HTTP 308, JS servi égal au
build, cache et navigateur intégré sans erreur contrôlés. Retour : repointer
`current` vers `20260922-tab-lock`. Le contrôle de SIP.js a ensuite révélé que
la fin de session précédait le code de refus ; cette version pouvait donc ne
pas afficher les six diagnostics. Remplacée par la v2, sans retour effectué.

Version précédente : `20260922-tab-lock`, source `b6be2a4`, déployée le
22 septembre après-midi : la déconnexion attend la libération du verrou
d'onglet, ce qui permet une reconnexion immédiate dans le même onglet. Archive
SHA-256 `4c9b5f98b7338302d8f59365a42301977e0990dcd9602d656d73120ee7c9fc00`,
266 fichiers, 35 tests, typage, lint et build live isolés ; JS servi contenant
le nouveau message, index en `no-cache`, écran de connexion sans erreur
console. Sauvegarde `/root/apisnix-phone-backups/20260922-tab-lock/`
(archive et cible précédente de `current`). Retour : repointer `current` vers
`20260922-call-sounds`.

Version précédente : `20260922-call-sounds`, source `a757eaf`, déployée à
11:12:30 Douala le 22 septembre. Elle ajoute la tonalité locale d'appel
sortant puis le bref gling au décroché, sans fichier audio ni changement PBX.
Archive de release : SHA-256
`5c4db9f09610d8ebdf5b41cb23f5c8102883fb8bae0f12f30d247ab500dae09f`.
Installation sous `/srv/apisnixphone/releases/20260922-call-sounds/`, lien
`/srv/apisnixphone/current`, fichiers appartenant à root, lisibles mais non
inscriptibles par Caddy. Aucun service applicatif, base ou secret d'hébergement.
Les sauvegardes et détails d'infrastructure restent dans le dépôt privé.

Contrôlé sur la release `20260922-call-sounds` : 34 tests, typage, lint, build live ; WSS attendu dans le bundle,
aucun identifiant pilote ni fichier `.env`, `.local` ou source map dans la
release. HTTPS public 200, HTTP 308, en-têtes ci-dessus, assets immuables,
index et repli SPA 200 sans cache ; empreinte du JS servi identique au build.
Logo et connexion live visibles, console/CSP sans erreur. Zéro appel web actif
au contrôle préalable ; `current` seul a changé, sans rechargement Caddy.
Sauvegarde protégée :
`/root/apisnix-phone-backups/20260922-call-sounds/`. Le timbre et le rythme des
deux nouveaux sons restent à confirmer par Franck sur un appel réel.

La release 2 avait été retirée à 23:17:20 après un essai dans le navigateur
intégré de Codex (voix inaudible malgré réception de paquets RTP). Franck
signale ensuite un fonctionnement hors de ce navigateur et demande sa remise
en ligne. Réactivation du même artefact après contrôle du manifeste et absence
d'appel web ; nouveau JS et cache HTTP vérifiés. L'hypothèse d'un problème
propre au navigateur intégré reste à confirmer. Contrôle Asterisk après
réactivation : 3794 paquets reçus / 3488 envoyés en 1 min 19, aucune perte
signalée ; WSS et contexte conservés. Franck signale le fonctionnement hors
Codex et confirme les appels entrants/sortants avec audio dans les deux sens.
Le test A/B de cette version reste à réaliser séparément. Release 1 conservée pour retour ciblé.

### Publier une release suivante

1. Inspecter Git et choisir le commit validé ; construire dans un dossier
   isolé avec seulement les trois variables publiques ci-dessus, après
   `npm ci`, typage, lint et tests. Contrôler les fichiers et calculer le SHA-256.
2. Faire essayer la version avant publication pendant les heures d'appel.
   Une actualisation perd la ligne et tout appel en cours.
3. Relever la cible réelle de `current`. Transférer dans un nouveau dossier
   versionné, vérifier l'empreinte, les droits de lecture Caddy et l'absence
   d'écriture par Caddy ; basculer le lien atomiquement. Aucun rechargement
   Caddy requis si le bloc ne change pas.
4. Vérifier HTTPS, assets, cache, interface live et essai pilote. En cas de
   défaut, remettre atomiquement le lien sur la release précédente.

### Retour ciblé et retrait complet

Pour retirer seulement les sons d'appel, repointer atomiquement `current` vers
`/srv/apisnixphone/releases/20260921-webphone-2/`, sans recharger Caddy. Cette
release précédente conserve la voix validée et n'inclut pas les deux nouveaux
sons. La sauvegarde et les manifestes sont sous
`/root/apisnix-phone-backups/20260922-call-sounds/`.

Pour retirer ensuite la release 2 historique, repointer atomiquement `current` vers
`/srv/apisnixphone/releases/20260921-webphone-1/`, sans recharger Caddy.
Attention : cette release antérieure a le défaut de voix connu ; prévenir
Franck que le site n'est pas validé pour émettre et ne pas le diffuser aux
clients. Retour effectué à 23:17:20 Douala, puis release 2 réactivée à 23:23:45
sur demande de Franck après son constat hors navigateur intégré.

Pour un retrait complet de l'hébergement, enlever
uniquement le bloc entre `# APISNIX PHONE début` et `# APISNIX PHONE fin`,
valider puis recharger Caddy gracieusement. Garder les fichiers ; ne jamais
restaurer tout le Caddyfile ni toucher aux autres sites. Le DNS se retire
seulement sur demande et après contrôle de sa valeur. Aucun lien vers le
téléphone n'a été ajouté sur l'accueil CRM.
