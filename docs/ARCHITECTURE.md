# Architecture ApisnixPhone

## Composants

Deux adaptations natives des clients Linphone, sans moteur SIP réécrit et sans
interface Flutter. Android utilise Kotlin/XML ; Desktop utilise C++/Qt/QML.
Liblinphone assure l'enregistrement SIP, les appels et l'audio.

```text
ApisnixPhone Android ou Windows
        │ SIP UDP par défaut (TCP/TLS possibles)
        ▼
apisnix-crm.com — Asterisk
        │
        └─ Routage et comptes gérés par APISNIX
```

La signalisation SIP et le média audio sont deux flux distincts, gérés par le
moteur existant. Aucun serveur intermédiaire APISNIX supplémentaire n'a été créé.

## Sources de référence

| Composant | Base | Référence |
| --- | --- | --- |
| Android | Linphone Android 6.2.7 | `1fde063979b68608e10a043b981e5ddd829a3a9e` |
| Moteur Android | SDK Maven Linphone | `5.5.21` |
| Desktop | Linphone Desktop 6.2.2 | `29e500257525bb1b10668f09bfd6c485fb27fa87` |
| Moteur Desktop | Sous-module amont `external/linphone-sdk` | Révision inscrite dans le commit Desktop ; pas encore compilée |

`sources.lock.json` fait autorité sur les dépôts, tags et commits. Le moteur
Android est fixé dans `gradle/libs.versions.toml`. Les autres dépendances amont
sont conservées ; il ne s'agit pas d'une garantie de build identique bit pour bit.

## Organisation locale

- `apps/android`, `apps/desktop` : sources de travail, ignorées à la racine.
- `patches/*.patch` : adaptations APISNIX exportées depuis les commits fixés.
- `scripts/prepare-sources.py` : téléchargement, vérification de référence,
  application du patch ; refuse de remplacer un dossier existant.
- `scripts/export-patches.py` : sauvegarde des changements suivis par Git,
  avec contrôle du commit de base et refus des nouveaux fichiers non suivis.
- `scripts/build-*` : construction des fichiers de test.
- `.github/workflows/build-windows.yml` : build Windows x64 déclenché manuellement,
  Windows Server 2022, Qt 6.10.0, dépendances MSYS2, installateur conservé 14 jours.
- `branding/` et `scripts/prepare-branding.py` : logo original copié et export des
  ressources de marque ; voir [identité](../branding/README.md).
- `dist/` : binaires locaux, hors suivi source.
- `.tools/`, `.work/` : outils et travail temporaires, hors suivi source.

## Personnalisation

Les deux clients ouvrent la connexion SIP tierce native avec le domaine
`apisnix-crm.com`. Domaine, nom d'affichage et transport sont regroupés dans
les paramètres avancés. Le mot de passe Android est utilisé sans supprimer
les espaces. Le bouton Android exige identifiant et mot de passe non vides.

Ne pas remplacer le paramètre interne `default_domain` par le domaine APISNIX :
la base s'en sert pour distinguer les comptes Linphone/Flexisip des comptes SIP
tiers. Utiliser `assistant_third_party_sip_account_domain` pour notre serveur.

Le chat et les réunions sont masqués, mais le moteur conserve ses capacités.
L'adaptation ne prétend pas avoir retiré toute la vidéo ou tous les écrans amont.

L'envoi de logs et la recherche de mise à jour vers les services Linphone sont
désactivés dans la configuration personnalisée. Les configurations Google et
la signature de démonstration amont sont retirées au moment de la préparation.
Les futurs secrets de signature restent hors sources et hors patches.

## Licences et extensions

La marque applicative change ; les licences, copyrights et auteurs amont
restent. Les clients sont proposés sous GPLv3 et le SDK inclut des composants
sous AGPLv3 : conserver les textes de chaque composant et prévoir la remise des
sources correspondantes lors de la distribution. Voir l'étude pour les sources.

Le client Desktop peut servir de base à macOS. iPhone nécessitera une adaptation
du client iOS, sa signature et son propre cycle de validation ; rien n'est encore
compilé pour ces deux plateformes.
