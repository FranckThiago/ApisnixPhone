# Téléphone Windows compact

## Besoin et comportement

Le 16 septembre 2026, Franck confirme que le premier installateur fonctionne
sur Windows et choisit un petit format vertical, comme un téléphone.

- Fenêtre principale et appel audio : base 420 × 680, avec le facteur d'écran
  Qt existant ; minimum 420 × 640. La mise à l'échelle Windows reste applicable.
- Accueil : compte, état d'enregistrement technique, numéro, clavier et appel.
  Le bouton ne lance rien sans enregistrement SIP ni numéro ; un court verrou
  évite les doubles clics pendant la création asynchrone de l'appel.
- Pendant un appel : correspondant, état, durée, réponse/refus, micro,
  mise en attente/reprise et clavier DTMF. Les commandes utilisent les mêmes
  objets d'appel et méthodes du moteur que l'interface amont.
- Historique, contacts et réglages ouvrent l'interface complète. Un bouton
  « Téléphone compact » ramène au format vertical. Les options d'appel avancées,
  conférences et vidéo conservent l'interface native complète.
- La connexion SIP s'adapte à la largeur : champs avancés empilés et défilants,
  grande illustration masquée. Les domaines et transports ne changent pas.
- L'option existante d'accès direct à la connexion SIP passe avant l'accueil
  de premier lancement Linphone. Le logo de chargement APISNIX reste présent.
  Franck n'a pas encore confirmé si son double écran apparaît à chaque ouverture
  ou seulement au premier lancement ; ne pas prétendre avoir reproduit ce cas.

## Implémentation

Quatre composants QML sont ajoutés à la liste CMake : CompactButton,
CompactDialPad, CompactPhonePage et CompactCallPage. Les deux nouvelles pages
émettent des signaux ; MainWindow et CallsWindow les relient aux modèles natifs.
Aucune modification du moteur SIP, des codecs ou du serveur Asterisk.

Les changements de Desktop sont conservés dans `patches/desktop.patch`.
Le script Windows distingue le paquet par `LINPHONEAPP_VERSION=6.2.2-apisnix.2`.
Les licences et l'écran À propos restent accessibles.

## Vérifications

`scripts/check-compact-ui.py` utilise PySide6 pour créer et afficher les vrais
composants dans un module QML temporaire, sans connexion réseau ni compte SIP :

```sh
.tools/qa/bin/python scripts/check-compact-ui.py
```

Ce contrôle couvre l'interdiction de numéroter hors connexion, l'appel,
le verrou anti-double-clic, le clavier et l'effacement, le retour à un appel
en cours et les signaux DTMF. Les aperçus sont écrits dans `.work/compact-ui-qa/`.
Ils représentent le rendu Qt du Mac, pas une capture d'un appel Windows réel.
La syntaxe QML est contrôlée séparément avec qmlformat. La compilation Windows
et un nouvel essai réel sont nécessaires pour valider l'intégration native.

À vérifier sur Windows : connexion existante et première connexion, audio,
micro, pause/reprise, DTMF, raccrochage, appel entrant, accès aux réglages et
retour au mode compact ; agrandissement/DPI 100–150 % et messages d'erreur.

## Taille du paquet et retour arrière

Le premier installateur fait 156 770 423 octets (~150 Mio). Il embarque les
bibliothèques Qt, le moteur SIP et les composants multimédias. Réduire les
dimensions de la fenêtre ne retire pas ces dépendances. Aucun allègement
de codecs, de protocoles ou de vidéo n'est effectué dans cette modification.

Conserver le premier installateur et son empreinte dans OPERATIONS.md pour
comparer ou réinstaller la version déjà testée. Ne pas effacer la configuration
des comptes pour revenir à l'ancienne interface. Les noms de produit, chemins
de données et identités SIP n'ont pas changé.
