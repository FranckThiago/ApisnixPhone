# Documentation technique à remettre aux clients

Édition française 1.0 du 23 octobre 2026, contrat SDK navigateur v1.

- [Guide maintenable](INTEGRATION_API_FR.md).
- [PDF prêt à transmettre](../../output/pdf/ApisnixPhone-API-Guide-integration-FR.pdf), 13 pages.
- [Kit client](../../output/ApisnixPhone-API-Kit-integration-FR.zip) : PDF, source Markdown et dossier [exemple](exemple/README.md).
- [Contrat interne et historique de validation](../WEBPHONE_EMBED.md), non inclus dans le kit.

Ce document est distinct des manuels d'utilisation existants ; ceux-ci ne sont
pas modifiés. La remise du kit n'active aucun domaine et ne crée aucun accès.
Les identifiants individuels doivent être transmis séparément. Le kit ne contient
ni information d'exploitation privée, ni secret, ni accès réel.

## Régénérer

Depuis la racine, avec Python 3 et ReportLab :

```sh
python3 scripts/build-integration-guide.py
```

Le script construit le PDF depuis le Markdown et assemble le ZIP avec les seuls
fichiers clients. Les polices Vera sont fournies par ReportLab ; aucun chemin de
runtime propre à une machine n'est inscrit dans le script. Les sorties sont
déterministes pour des sources et une version de ReportLab identiques.

Lors d'une nouvelle édition, aligner la date et le numéro d'édition dans le guide,
l'exemple et le générateur. Vérifier le contrat contre `webphone/src/embed/`, les
types téléphoniques et la politique d'administration réellement publiée. Rendre
le PDF avec Poppler et relire toutes ses pages avant de livrer les deux sorties.

## Vérifications de l'édition 1.0

- 20 tests SDK/session ciblés réussis dans le projet webphone.
- Syntaxe JavaScript de l'exemple vérifiée ; banc sans réseau avec SDK simulé :
  montage unique, disponibilité, préparation sur action seulement, verrou pendant
  une demande, erreurs, texte non interprété, déduplication, limite de 100 appels,
  réduction sans démontage et effacement à la fermeture de session.
- 13 pages PDF rendues et relues ; contenu et composition de l'archive contrôlés.

Ces vérifications portent sur le kit documentaire. Elles ne sont pas de nouveaux
appels réels et ne remplacent pas la recette sur le domaine et le matériel client.
La release en production reste `20261023-embed-api`, sans migration ni déploiement
pour cette livraison documentaire.
