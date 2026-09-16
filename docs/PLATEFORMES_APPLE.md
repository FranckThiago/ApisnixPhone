# Mac et iPhone — état et prérequis

État vérifié le 16 septembre 2026. Franck demande une suite pour ces deux
plateformes ; aucun `.dmg`, `.app` APISNIX ou `.ipa` n'a encore été produit.
Windows et Android sont les seuls pilotes construits à ce stade. Franck
confirme ensuite ne pas avoir de compte Apple Developer et demande de laisser
les versions Apple en attente. Ne pas lancer leur réalisation ou une adhésion
sans nouvelle demande.

## Mac

Le client Desktop déjà adapté inclut une cible macOS et un packaging DMG.
Le format compact, la connexion SIP et la marque peuvent donc servir de base.
Il faut encore adapter/vérifier l'icône macOS, préparer les dépendances de
compilation, produire le paquet puis effectuer des appels sur Mac.

Environnement local constaté : Apple Silicon (`arm64`), Xcode 26.6, outils
Apple actifs sous `/Applications/Xcode.app/Contents/Developer`. Le kit Qt C++
et les outils CMake/Ninja/nasm/yasm/pkg-config ne sont pas installés dans le
PATH courant. PySide6 utilisé pour les aperçus n'est pas ce kit de compilation.
La construction peut être organisée localement ou dans une CI macOS ; aucun
nouveau workflow ni téléchargement de ces dépendances n'a été lancé ici.

La signature Developer ID et la notarisation seront à organiser pour une
diffusion normale aux clients. Ne pas demander de désactiver globalement les
protections macOS. Les architectures Intel/Apple Silicon et la version minimale
de macOS réellement supportée devront être validées avec le kit choisi.

## iPhone

La base est le [client iOS officiel Linphone](https://github.com/BelledonneCommunications/linphone-iphone),
distinct du client Android. Son projet utilise Xcode et Swift Package Manager.
Il faudra verrouiller la référence source et le SDK, personnaliser le nom,
le logo et la connexion, empêcher l'ajout automatique d'indicatif, puis tester
audio et cycle de vie sur appareil. Aucun checkout iOS APISNIX ni adaptation
de cette base n'est présent actuellement.

Franck confirme ne pas avoir de compte Apple Developer et reporte cette suite.
Ne pas annoncer un TestFlight APISNIX prêt ni demander un mot de passe Apple
dans la conversation. Les prérequis ci-dessous sont conservés pour la reprise.

- Apple permet les essais personnels via Xcode avec un compte gratuit, avec
  des profils expirant au bout de sept jours et des limites de capacités/appareils.
  Cela ne remplace pas la distribution aux clients.
- L'Apple Developer Program donne accès aux moyens de distribution TestFlight
  et App Store. Apple affiche **99 USD par année d'adhésion**, avec un prix
  local pouvant varier. Aucun achat ou abonnement effectué par l'agent.
- Pour afficher la société comme vendeur sur l'App Store, Apple demande une
  inscription d'organisation et ses justificatifs ; le nom de l'application
  ApisnixPhone et le nom légal du vendeur sont deux éléments distincts.
- Le compte Apple ne remplace pas la vérification des licences des composants
  pour le canal de distribution choisi. Les conditions amont et la remise des
  sources correspondantes restent à traiter avant publication.

Sources Apple consultées : [adhésion et tarif](https://developer.apple.com/programs/enroll/),
[compte gratuit, Personal Team et adhésion](https://developer.apple.com/support/compare-memberships/).
Revérifier les conditions avant distribution.
