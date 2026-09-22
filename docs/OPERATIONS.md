# Construction et validation

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

`style-src 'unsafe-inline'` est requis par les styles calculés (avatars, niveau
du micro). Le bloc `route` garantit que `try_files` précède les règles de cache :
`/`, `/index.html` et les routes de repli portent `no-cache`, les assets
empreintés restent immuables. Ne pas retirer cet ordre explicite.

Version active : `20260922-sip-diagnostics`, source `dff2b26`, déployée le
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
`current` vers `20260922-tab-lock`. Aucun refus réel n'a été déclenché.

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
