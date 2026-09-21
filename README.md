# ApisnixPhone

Softphone sous la marque **APISNIX**, basé sur les clients natifs Linphone.
Priorité aux appels sur Windows, puis Android. Serveur préconfiguré :
`apisnix-crm.com` ; connexion avec un identifiant et un mot de passe.
SIP UDP par défaut, autres transports conservés dans les réglages avancés.
Une application web PC distincte est en préparation pour utiliser le WebRTC
existant, avec une interface APISNIX complète et sans installateur Windows.

## État actuel

- **Web PC** : interface ApisnixPhone Web construite dans `webphone/` et
  utilisable en **mode démonstration**. L'adaptateur SIP.js est écrit et testé
  en simulation, mais n'a encore passé aucun appel réel (pilote à faire). [Plan de réalisation](docs/WEBPHONE_PLAN.md) et
  [maquette d'origine](docs/design/webphone-maquette.html).
  Interface inspirée de Ringover/Kavkom, journal, contacts, drapeaux et panneau
  d'appel. L'application SIP reste à développer ; aucun déploiement serveur.
- **Android** : APK de test `6.2.7-apisnix.3` compilé. Il corrige l’indicatif
  pays ajouté automatiquement, y compris pour les comptes existants. Android 9
  minimum, ARM 32/64 bits ; nouvel essai réel à confirmer. Voir
  [la numérotation](docs/NUMEROTATION_ANDROID.md).
- **Windows** : nouveau pilote x64 `6.2.2-apisnix.2` compilé et récupéré,
  avec [format téléphone vertical](docs/FENETRE_COMPACTE.md). Intégrité du
  fichier vérifiée ; nouvel essai Windows requis. Franck a confirmé le bon
  fonctionnement du premier pilote, conservé pour retour arrière.
- **Mac et iPhone** : en attente à la demande de Franck, qui ne possède pas
  encore de compte Apple Developer. Aucun installateur Apple produit.
  [Prérequis et état vérifiés](docs/PLATEFORMES_APPLE.md).

Le fichier Android provisoire se trouve dans
`dist/android/apisnixphone-android-debug-6.2.7-apisnix.3.apk`.
Il utilise une signature de développement et n'est pas une version client finale.

L'installateur Windows compact est `dist/windows/ApisnixPhone-6.2.2-apisnix.2-win64.exe`
(environ 150 Mio), non signé. Voir les opérations pour installation,
empreinte et ancien pilote conservé.

Depuis le 17 septembre, les versions actuelles sont disponibles depuis
l'[accueil APISNIX CRM](https://apisnix-crm.com/#apisnix-downloads), à la demande
de Franck pendant ses essais :

- [Télécharger Android](https://apisnix-crm.com/downloads/ApisnixPhone-Android-6.2.7-apisnix.3.apk).
- [Télécharger Windows](https://apisnix-crm.com/downloads/ApisnixPhone-Windows-6.2.2-apisnix.2-x64.exe).

## Documentation

- [État du projet, limites et prochaines étapes](docs/PROJECT_STATE.md)
- [Webphone PC : plan, design, fonctions, réglages et reprise](docs/WEBPHONE_PLAN.md)
- [Architecture et versions](docs/ARCHITECTURE.md)
- [Reconstruction, installation et validation](docs/OPERATIONS.md)
- [Étude des solutions](docs/ETUDE_SOFTPHONE.md)
- [Journal des changements](docs/AI_CHANGELOG.md)

Les sources de travail natives sont dans `apps/`. Les modifications conservées pour
reconstruction sont dans `patches/`, avec leurs références dans
`sources.lock.json`. Voir les procédures avant de recréer un dossier existant.
Les licences et crédits Linphone sont conservés ; la distribution des binaires
nécessitera aussi la mise à disposition des sources correspondantes.
Le code web se trouve dans `webphone/`, hors des checkouts natifs ignorés.
