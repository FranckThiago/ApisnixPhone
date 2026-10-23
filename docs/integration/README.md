# Documentation technique à remettre aux clients

Édition française 1.1 du 23 octobre 2026, contrat SDK navigateur v1.

- [Guide maintenable](INTEGRATION_API_FR.md).
- [PDF prêt à transmettre](../../output/pdf/ApisnixPhone-API-Guide-integration-FR.pdf), 17 pages.
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

La présentation reprend le logo original `branding/apisnix-mark.png`, sans
modification, sur la couverture et en tête de chaque page. Couleurs APISNIX bleu
et jaune, tableaux contrastés, encadrés de code en texte sélectionnable,
pagination complète, 14 signets de sections et trois liens de navigation en
couverture. Les chapitres restent groupés ; le générateur refuse une réduction
excessive du texte et exige alors de revoir la pagination.

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
- Refonte visuelle demandée : 15 pages PDF rendues et relues, contenu technique
  intégralement conservé, logo original vérifié, signets et liens contrôlés,
  texte dans les limites des pages et archive contenant le PDF courant.

Ces vérifications portent sur le kit documentaire. Elles ne sont pas de nouveaux
appels réels et ne remplacent pas la recette sur le domaine et le matériel client.
La release frontend courante est `20261023-conference-pilot`, backend
`20261023-embed-api` inchangé. Voir OPERATIONS et VICIDIAL_PILOT pour la recette
réelle et ses limites.

## Édition 1.1 et captures

Chapitres 13 et 14 : `setContact`, huit rubriques bornées, corrélation et mode
conférence expérimental. PDF de 17 pages rendu et contrôlé, 14 signets et ZIP
contenant le PDF courant. [Captures avec légendes](captures/README.md) disponibles
séparément pour la documentation, les manuels et le site ; aucune publication
automatique de ces visuels dans les manuels existants ou le site commercial.
