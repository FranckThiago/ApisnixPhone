# ApisnixPhone

Softphone sous la marque **APISNIX**, basé sur les clients natifs Linphone.
Priorité aux appels sur Windows, puis Android. Serveur préconfiguré :
`apisnix-crm.com` ; connexion avec un identifiant et un mot de passe.
SIP UDP par défaut, autres transports conservés dans les réglages avancés.

## État actuel

- **Android** : APK de test `6.2.7-apisnix.3` compilé. Il corrige l’indicatif
  pays ajouté automatiquement, y compris pour les comptes existants. Android 9
  minimum, ARM 32/64 bits ; nouvel essai réel à confirmer. Voir
  [la numérotation](docs/NUMEROTATION_ANDROID.md).
- **Windows** : installateur de test x64 compilé avec succès sur GitHub Actions,
  nom et icônes personnalisés. Franck confirme son bon fonctionnement sur PC.
  Le [format téléphone vertical](docs/FENETRE_COMPACTE.md) est préparé pour un
  nouveau pilote ; sa compilation et son essai Windows restent à valider.
- **Mac et iPhone** : en attente à la demande de Franck, qui ne possède pas
  encore de compte Apple Developer. Aucun installateur Apple produit.
  [Prérequis et état vérifiés](docs/PLATEFORMES_APPLE.md).

Le fichier Android provisoire se trouve dans
`dist/android/apisnixphone-android-debug-6.2.7-apisnix.3.apk`.
Il utilise une signature de développement et n'est pas une version client finale.

L'installateur Windows de test est `dist/windows/ApisnixPhone-6.2.2-win64.exe`
(environ 150 Mio), non signé. Voir la procédure de test dans les opérations.

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
