# ApisnixPhone

Softphone sous la marque **APISNIX**, basé sur les clients natifs Linphone.
Priorité aux appels sur Windows, puis Android. Serveur préconfiguré :
`apisnix-crm.com` ; connexion avec un identifiant et un mot de passe.
SIP UDP par défaut, autres transports conservés dans les réglages avancés.

## État actuel

- **Android** : premier APK de test compilé, nom et connexion personnalisés.
  Android 9 minimum, ARM 32/64 bits. Logo APISNIX intégré ; appels non testés.
- **Windows** : sources et icônes personnalisées ; procédure GitHub Actions préparée,
  première compilation en ligne restant à lancer.
- **Mac et iPhone** : extensions possibles, aucun installateur produit.

Le fichier Android provisoire se trouve dans
`dist/android/apisnixphone-android-debug-6.2.7-apisnix.2.apk`.
Il utilise une signature de développement et n'est pas une version client finale.

## Documentation

- [État du projet, limites et prochaines étapes](docs/PROJECT_STATE.md)
- [Architecture et versions](docs/ARCHITECTURE.md)
- [Reconstruction, installation et validation](docs/OPERATIONS.md)
- [Étude des solutions](docs/ETUDE_SOFTPHONE.md)
- [Journal des changements](docs/AI_CHANGELOG.md)

Les sources de travail sont dans `apps/`. Les modifications conservées pour
reconstruction sont dans `patches/`, avec leurs références dans
`sources.lock.json`. Voir les procédures avant de recréer un dossier existant.
Les licences et crédits Linphone sont conservés ; la distribution des binaires
nécessitera aussi la mise à disposition des sources correspondantes.
