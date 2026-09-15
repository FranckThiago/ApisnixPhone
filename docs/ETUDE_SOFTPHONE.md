# Softphone APISNIX : étude des bases et de la marque blanche

**Date de vérification : 15 septembre 2026.**

> Étude initiale conservée pour le comparatif. La réalisation Linphone a depuis
> commencé ; l’état actuel et les décisions confirmées sont dans
> [PROJECT_STATE.md](PROJECT_STATE.md).

Cette étude s'appuie sur les sites et dépôts officiels consultés dans le
navigateur intégré. Les appréciations de complexité et la recommandation sont
une analyse pour APISNIX, pas les résultats d'un benchmark ou de tests d'appels.
Les tarifs publics doivent être reconfirmés avant une commande.

## 1. Recommandation

**Privilégier une adaptation des applications Linphone pour Windows et Android,
centrée sur les appels et personnalisée sous la marque APISNIX.** Le code ouvert
est accepté par Franck ; la licence open source est donc une voie viable à étudier
sans acheter une licence propriétaire.

Le produit se distinguerait par son identité, sa simplicité, son installation,
sa configuration et le support APISNIX. Le moteur SIP/audio existant prend en
charge une grande part du travail technique. Une expérimentation reste nécessaire
pour vérifier l'interopérabilité et la qualité sur le réseau cible.

Si l'urgence commerciale porte surtout sur Windows, **MicroSIP personnalisé**
est l'alternative à tester en premier. Pour une version vraiment sur mesure,
PJSIP constitue une autre base solide, avec davantage de travail applicatif.

## 2. Comparaison

| Piste | Couverture et licence | Coût identifié | Appréciation pour APISNIX |
| --- | --- | --- | --- |
| Adapter les clients **Linphone** | Applications Windows et Android ; GPLv3 pour les clients, AGPLv3 pour Liblinphone et plusieurs composants | Pas de redevance de licence avec respect des licences libres ; rebranding réalisé par l'éditeur sur devis | Meilleur point de départ commun proposé ; simplification, compilation et maintenance à assurer |
| Adapter **MicroSIP** | Application Windows ; GPLv2 ; pas de client Android | Code libre ; prestation officielle de personnalisation dès **150 €**, paiement initial unique, installations illimitées ; évolutions facturées séparément | Très bon candidat pour une édition Windows simple ; Android impose une autre base |
| Créer notre interface autour de **PJSIP/PJSUA2** | Moteur natif, notamment Windows et Android ; GPLv2 ou ultérieure, ou licence propriétaire négociée | Pas de redevance sous GPL compatible ; licence propriétaire sur demande | Liberté d'interface, mais interface, cycle de vie mobile, distribution et intégration à développer |
| Créer notre interface autour de **baresip** | Moteur modulaire avec support Windows et Android ; cœur BSD à 3 clauses | Pas de redevance pour le cœur ; vérifier les licences des modules retenus | Intéressant pour une construction très maîtrisée, mais plus d'assemblage qu'une application existante |
| **PortSIP SDK / rebranding** | SDK Windows et Android ; offre commerciale, également utilisable avec un serveur SIP tiers | Devis ; SDK annoncé avec paiement unique et sans redevance de distribution ; première année de support/mises à jour incluse | Alternative commerciale à chiffrer, surtout si le support éditeur devient prioritaire |
| **Acrobits Cloud Softphone** sous notre marque | Offre de marque blanche, clients mobiles et desktop annoncés | Page de prix : **549 USD/mois** pour White Label App ; facturation liée à l'usage également mentionnée | Moins de développement à porter, avec coût récurrent ; inclusion Windows, volumes et options à faire détailler |
| Réécrire nous-mêmes la pile SIP et le traitement audio | Toute la base serait à construire | Pas de licence de moteur, mais effort de développement et de maintenance maximal | Disproportionné pour le besoin actuel |

Sources des offres : [Linphone et licences](https://www.linphone.org/en/faq/),
[rebranding Linphone](https://www.linphone.org/en/white-label-softphone/),
[MicroSIP](https://www.microsip.org/),
[personnalisation MicroSIP](https://www.microsip.org/custom),
[licence PJSIP](https://www.pjsip.org/licensing.htm),
[baresip](https://github.com/baresip/baresip),
[tarifs PortSIP](https://www.portsip.com/portsip-pricing/),
[SDK PortSIP](https://www.portsip.com/portsip-voip-sdk/),
[Acrobits](https://acrobits.net/cloud-softphone/),
[tarifs Acrobits](https://acrobits.net/cloud-softphone/pricing/).

### Lecture des prix

- Les 150 € de MicroSIP sont un **prix de départ de prestation**, pas un tarif
  garantissant toutes les demandes d'APISNIX. La page annonce des installateurs
  signés ; l'identité du signataire et le processus des mises à jour sont à
  préciser dans le périmètre commandé.
- Chez PortSIP, « royalty-free » signifie absence de redevance de distribution
  après acquisition des droits. Le SDK n'est pas simplement gratuit pour un
  usage avec n'importe quel PBX. L'offre gratuite liée à PortSIP PBX est une autre
  condition commerciale. Ne pas confondre son application utilisateur, son SDK
  et sa licence serveur.
- Chez Acrobits, le prix a été lu avec **Branded softphone** sélectionné. Les
  inclusions de la grille citent explicitement iOS et Android. Le site présente
  aussi des clients Windows, mais cette grille seule ne prouve pas que Windows
  est inclus dans les 549 USD/mois, ni que ce montant représente le coût total.
- Avec une base libre, restent le développement, les essais, les appareils, la
  signature et la publication, l'éventuel serveur de notifications et la
  maintenance. Zéro redevance n'équivaut pas à zéro coût d'exploitation.

## 3. Ce que permet la marque APISNIX

L'application peut avoir son nom, son logo, ses couleurs, ses textes, son écran
de connexion, ses liens d'aide et sa distribution APISNIX. Les mentions des
auteurs et des licences doivent être préservées dans les éléments requis.

La commercialisation d'une version modifiée sous GPL est permise, avec les
obligations de mise à disposition des sources correspondantes et les droits
des destinataires. Une édition libre reste compatible avec une offre commerciale
de téléphonie, d'intégration et de support. Le code à fournir n'inclut pas les
mots de passe, données clients ou secrets d'exploitation.
[FAQ GNU sur la commercialisation](https://www.gnu.org/licenses/gpl-faq.html#GPLCommercially).

La FAQ Linphone distingue bien **clients GPLv3** et **moteur Liblinphone AGPLv3**.
Les fichiers de licence et dépendances des versions réellement sélectionnées
feront foi pour préparer la distribution. Un dépôt public avec les sources
correspondant aux versions livrées faciliterait ce suivi ; aucun dépôt public
n'a été créé à ce stade. [Licences Linphone](https://www.linphone.org/en/faq/).

## 4. Architecture proposée et faisabilité

### Réutiliser les applications existantes

- **Windows :** client Linphone Desktop en C++/Qt/QML, adapté et simplifié.
- **Android :** client Linphone Android natif, adapté et simplifié.
- **Moteur commun :** Liblinphone pour SIP et l'audio.
- **Téléphonie :** connexion au PBX SIP choisi par APISNIX.

Il s'agit de deux interfaces à maintenir autour d'un moteur commun. Ce n'est
pas une promesse de code d'interface unique entre Windows et Android.

Les guides actuels confirment SIP UDP, TCP et TLS, les appels, DTMF, mise en
attente, transferts et les codecs notamment G.711 et Opus.
[Guide Liblinphone](https://wiki.linphone.org/xwiki/wiki/public/view/Lib/#HFeatures).

Le dépôt Android documente le changement du nom de paquet et l'utilisation d'un
SDK précompilé. Son README annonce Android 9 minimum pour le client 6.x, ce qui
diffère du minimum du SDK. Le dépôt Desktop utilise Qt6 et documente Windows
x64/Visual Studio 2022 ; la compatibilité des postes clients devra être vérifiée
pour la version retenue. Les branches de développement consultées ne sont pas
des versions figées pour livraison.
[Source Android](https://gitlab.linphone.org/BC/public/linphone-android),
[source Desktop](https://gitlab.linphone.org/BC/public/linphone-desktop).

### Place de Flutter

La présence de Flutter sur le Mac n'impose pas son utilisation. Une interface
Flutter autour d'un moteur natif reste une piste de développement sur mesure,
mais introduit une intégration supplémentaire par rapport à l'adaptation des
clients existants. Elle ne constitue pas la recommandation de démarrage.

### SIP UDP et TCP

UDP doit être le transport initial à tester, conformément au besoin. TCP peut
être proposé en option. Le transport de la signalisation SIP est distinct du
transport de la voix, généralement RTP : passer SIP en TCP ne fait pas passer
automatiquement tout l'audio en TCP. TLS/SRTP pourront être exposés si le serveur
les prend en charge ; TCP seul n'est pas du chiffrement.
[Transports PJSIP](https://docs.pjsip.org/en/latest/overview/features_sip.html),
[signalisation et média Liblinphone](https://wiki.linphone.org/xwiki/wiki/public/view/Lib/#HFeatures).

## 5. Android en veille : le risque principal du pilote

Un appel réussi lorsque l'application est ouverte ne prouve pas que le téléphone
sonnera après une longue veille. Android peut suspendre l'accès réseau avec Doze.
Google préconise FCM pour les notifications urgentes visibles par l'utilisateur.
[Documentation Android](https://developer.android.com/training/monitoring-device-state/doze-standby).

La piste proposée pour une réception en arrière-plan est une intégration de
notifications push : le serveur avertit Android d'un appel entrant, puis
l'application se réveille et reprend l'échange SIP. Avec Linphone, cela peut
s'appuyer sur Flexisip en complément du PBX existant, sous réserve de valider
l'architecture et la compatibilité. Installer tout Flexisip n'est pas une
condition préalable à un premier appel SIP classique.
[Intégration PBX et notifications Linphone](https://www.linphone.org/en/white-label-softphone/).

Les notifications associées au service public Linphone ne doivent pas être
supposées utilisables telles quelles pour le paquet APISNIX et son serveur SIP.
Le client personnalisé nécessitera la configuration Firebase correspondant à son
identité et une intégration serveur appropriée. Aucun accès ou fichier sensible
ne doit être publié. [Guide Android](https://gitlab.linphone.org/BC/public/linphone-android).

Les essais doivent distinguer application ouverte, en arrière-plan, téléphone
en veille, application balayée des tâches récentes et arrêt forcé par
l'utilisateur. Un mécanisme push ne garantit pas la réception dans tous ces cas.

## 6. Première version proposée

### Expérience utilisateur

- Identité APISNIX et interface française.
- Connexion à un compte SIP et statut d'enregistrement compréhensible.
- Clavier, appel entrant/sortant, réponse, refus et raccrochage.
- Muet, mise en attente/reprise et touches DTMF pendant l'appel.
- Choix microphone/casque sous Windows ; écouteur/haut-parleur sous Android.
- Historique et rappel d'un numéro.
- Codecs G.711 A-law/µ-law comme base d'interopérabilité, Opus selon le PBX.

### Après validation du socle

Transfert d'appel, contacts simples et configuration par QR code/lien temporaire
peuvent suivre. Le périmètre demandé ne nécessite pas de messagerie, vidéo,
conférences, IA ou CRM intégré pour la première édition.

L'audit de personnalisation doit couvrir aussi les paramètres par défaut,
l'actualisation, les rapports d'erreur, les journaux et les éventuels liens vers
les services de l'éditeur : le rebranding dépasse le changement de logo.

## 7. Plan de validation avant distribution

1. Identifier un PBX de test et deux comptes dédiés, sans toucher la production.
2. Établir une référence avec les applications officielles : enregistrement UDP,
   appel dans les deux sens et audio bidirectionnel sur Windows et Android.
3. Tester DTMF, appels refusés/occupés, raccrochage, mise en attente et changement
   d'appareil audio. Vérifier le comportement Wi-Fi et réseau mobile, la perte
   de réseau et la reconnexion.
4. Vérifier la réception Android en veille et choisir l'intégration push adaptée.
5. Figer les versions des sources et dépendances, puis appliquer la marque et
   simplifier l'interface. Préparer les licences et sources correspondant aux
   binaires.
6. Tester les installateurs signés, les mises à jour et le retour à la version
   précédente sur un petit groupe pilote, avant diffusion aux clients.

Les versions et comptes de test, le matériel disponible, le nombre d'utilisateurs
du pilote et la gestion des notifications restent à préciser. Aucun appel réel,
test de performance, achat, message fournisseur ou déploiement n'a été réalisé
pour cette étude.
