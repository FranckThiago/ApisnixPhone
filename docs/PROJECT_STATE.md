# État du projet

## Release 2 remise en ligne à la demande de Franck

Le 21 septembre à **23:23:45 Africa/Douala (22:23:45 UTC)**,
`20260921-webphone-2` (**c3ecac7**) est réactivée. Franck signale que la voix
fonctionne hors du navigateur intégré de Codex et demande de remettre cette
version pour réessayer. L'échec précédent concernait son essai dans ce
navigateur intégré ; il ne permet pas de conclure à un défaut dans tous les
navigateurs. La cause propre au navigateur intégré reste non établie.

Même release, manifeste SHA-256 revérifié, 34 tests déjà réussis ; aucune
recompilation ni modification de code. Aucun appel web au contrôle préalable.
Seul le lien current est basculé, sans recharger un onglet. Caddy, DNS, PBX et
supervision inchangés. Recharger dans le navigateur habituel pour prendre la
release 2 ; nouvel essai de cette version par Franck encore attendu.

Les paragraphes suivants conservent l'historique de publication et de retour.

## Publication HTTPS du 21 septembre 2026

**Historique : version servie après le premier retour : 20260921-webphone-1**, source **d9b9da4**, sur
https://phone.apisnix-crm.com/. La release 2 (c3ecac7) a été publiée à
23:12:20 Africa/Douala (22:12:20 UTC),
après contrôle de l'absence d'appel ApisnixPhoneWeb. 34 tests, typage, lint et
build live isolé réussis. Fichiers statiques et lien current seuls modifiés ;
Caddy, DNS, PBX et supervision inchangés. Les deux releases sont conservées.

Le premier essai de la release 1 avait révélé un défaut bloquant : le
correspondant n'entendait pas l'utilisateur, aucun RTP reçu côté Asterisk.
La release 2 transmet le micro directement à 100 %, n'active la chaîne de
sensibilité que si le réglage change et prévoit le repli vers le micro brut.
Micro/sensibilité modifiés pendant un appel : effet à l'appel suivant.
Elle contient aussi la consultation du contact SIP pour détecter une ligne
remplacée et l'alerte à cinq secondes si aucun paquet audio n'est émis.

HTTPS, redirection, cache index/assets, en-têtes, repli SPA, JS servi identique
au build et connexion live/logo sans erreur console/CSP contrôlés.
**Retour effectué à 23:17:20 Africa/Douala (22:17:20 UTC)** vers
`20260921-webphone-1` après échec de l'essai de voix de la release 2.
Franck n'est toujours pas entendu. Contrairement à la release 1, Asterisk a
bien reçu **6575 paquets** sur la release 2 en 2 min 53 (8349 envoyés), avec
**21,18 % de pertes signalées en réception**. Le navigateur utilisait bien
`index-5mH053Gu.js` et le bouton Muet était désactivé. Ces observations ne
prouvent pas que les paquets contenaient une voix audible et n'identifient pas
la cause restante. La voix dans les deux sens reste non validée.

**Ne pas diffuser aux clients** : la release 1 rétablie possède le défaut de
voix connu. Aucun onglet utilisateur rechargé ni appel coupé par ce retour ;
l'onglet resté ouvert peut encore exécuter la release 2 jusqu'au rechargement.
Les deux releases restent conservées. Aucun PBX, DNS ou Caddy modifié.

Procédure, empreinte et retour ciblé dans [OPERATIONS.md](OPERATIONS.md).
Les paragraphes historiques ci-dessous relatent les étapes précédentes.

Mis à jour le 21 septembre 2026.

Publication Git préparée le 21 septembre à la demande de Franck : plan web,
maquette et documentation de reprise. La nouvelle règle est de committer et
pousser les travaux validés sans reconfirmation, avec contrôle du périmètre
et des secrets. L'application web reste à développer ; cette publication
ne compile pas les clients natifs et ne déploie aucun service.

## Besoins confirmés

- Nom commercial choisi : **ApisnixPhone**, sous la marque APISNIX.
- Clients natifs : Windows prioritaire, Android ensuite ; les interfaces peuvent être différentes.
- Nouvelle direction PC du 18 septembre : application web indépendante,
  WebRTC existant, navigateur ouvert et PC éveillé acceptés ; voir le plan web.
- Appels SIP, principalement sortants. Pas de plateforme CRM à reconstruire.
- Serveur Asterisk `apisnix-crm.com`, comptes créés par Franck dans `phones`.
  Il s'agit des clients Asterisk directs, pas d'une intégration VICIdial spécifique.
- Identifiant et mot de passe suffisent à la connexion habituelle. Domaine
  prérempli, UDP par défaut ; TCP/TLS et les possibilités du moteur restent disponibles.
- Le code personnalisé peut rester open source. Les crédits techniques sont conservés.
- Franck fournira les identifiants de test après préparation des installateurs,
  et effectuera les essais sur le PC Windows et le téléphone de son frère.
- Réception Android en veille non prioritaire. Aucune permission de localisation
  ajoutée ; ce n'est pas une garantie de maintien des appels en arrière-plan.
- Dossier de logos reçu. Le monogramme bleu et jaune fourni est intégré aux
  icônes Android/Windows et aux principaux écrans d’accueil/connexion.
- Franck dispose d’un compte GitHub et choisit la compilation Windows en ligne.
  Le compte connecté est `FranckThiago`. Dépôt public `FranckThiago/ApisnixPhone` créé avec son accord explicite.
- Intérêt pour Mac et iPhone ; la réalisation initiale reste Windows/Android.

## Résultat réel

### Webphone PC — interface construite en mode démonstration

Le 21 septembre, à la demande de Franck (« la meilleure interface de
téléphonie », carte blanche, davantage de jaune APISNIX), les lots 1 à 3 du plan
sont réalisés dans `webphone/` : connexion, journal par jour avec filtres,
recherche, détail, notes et tags, contacts et fiche avec derniers échanges,
favoris, réglages, thème clair/sombre, palette de commandes (Ctrl/⌘ K),
raccourcis M/H/chiffres, panneau d'appel persistant (sortant, entrant, muet,
attente confirmée, DTMF, fin d'appel qualifiée), bandeau d'appel sur petit
écran. Le jaune du monogramme signe l'interface : soulignés, navigation active,
anneau d'appel, focus, favoris, tags.

Le même jour, lot 4 et retours de Franck : adaptateur SIP.js 0.21.2
(`SipPhoneController`), choisi par `VITE_APP_MODE=live` ; chaîne micro avec
**sensibilité réglable** (0–200 %) et changement de micro en cours d'appel,
volume d'écoute, choix de sortie si le navigateur le permet, test du micro avec
niveau, sonnerie générée, verrou d'un seul onglet par compte. **Rappels
planifiés** : depuis la fin d'appel, le journal ou une fiche ; vue Rappels,
carte sous le clavier, pastille, alerte à l'échéance, clôture automatique quand
le numéro a été joint. Affichage des pays selon ses règles : `0…` = France,
`1` + indicatif = Amérique du Nord, Canada distingué des États-Unis par sa liste
d'indicatifs ; `1001` reste un poste interne ; les chiffres composés ne changent
jamais. Thème « Système » par défaut, menu clair en thème clair, bouton
Téléphone vert central dans la barre mobile.

**Aucun appel réel n'a encore été passé.** L'adaptateur est vérifié par 11 tests
avec un faux gestionnaire SIP et par un essai du mode réel vers une adresse
locale inexistante (SIP.js chargé, échec de connexion clair et sans boucle, mot
de passe absent des stockages). Ne sont donc **pas prouvés** : enregistrement sur
le PBX, audio dans les deux sens, DTMF, attente/reprise, codes de refus réels,
traitement du `+` et du `#` par Asterisk, sensibilité et changement de micro sur
un vrai casque, comportement derrière un réseau client. La démonstration reste
le mode par défaut, avec données fictives et mention permanente. Aucun accès
serveur ni déploiement. Restent les lots 5 (pilote réel, compte et destination à
désigner) et 6 (hébergement HTTPS).

Lot 5 engagé le 21 septembre au soir : Franck désigne un compte de test et
autorise la préparation du serveur. `webphone/.env.local` (ignoré par Git,
sans mot de passe) pointe vers le WSS existant. Lecture seule du PBX : le poste
pilote est un poste SIP manuel, UDP seulement, sans chiffrement, avec son
contexte d'enregistrement ; **il ne peut donc pas encore s'enregistrer depuis un
navigateur**. La surcharge WebRTC à lui ajouter (lui seul, modèle, contexte,
limite d'appel et `is_webphone=N` conservés) est préparée, ses réglages actuels
sont sauvegardés sur le serveur, mais **l'écriture n'a pas été faite** : le
garde-fou de la session de l'agent l'a refusée. Détails dans le dépôt privé.
Aucun enregistrement SIP ni appel réel depuis l'application à ce jour. Le mot de
passe se saisit par Franck dans l'écran de connexion ; l'agent ne le saisit pas.
Franck a ensuite appliqué lui-même cette surcharge sur un second compte de test,
désormais pilote : contrôle en lecture seule conforme (WS/WSS, chiffrement, RTCP
mux, contexte et limite d'appel conservés). L'essai réel reste à faire.

**Premier essai réel le 21 septembre au soir**, par Franck sur le compte pilote,
observé côté Asterisk en lecture seule : enregistrement en WSS depuis le
navigateur (Safari, thème sombre), appel sortant vers un mobile décroché plus de
six minutes, numéro reçu identique à la saisie, routage d'origine respecté après
le contexte d'enregistrement, G.711 µ-law, MP3 de 388 s produit. Franck confirme
le micro muet. **Non essayés : attente/reprise, DTMF, appel entrant, réseau
client.** Relevé : environ 7 % de paquets perdus dans le sens navigateur →
serveur sur sa connexion, à surveiller. Défauts remontés et corrigés : aucun
message quand le micro est refusé (SIP.js termine l'appel sans le dire ; la
raison est maintenant captée, affichée dans la carte d'appel et en
notification), bouton de déconnexion invisible sous Safari (hauteur de page
corrigée, bouton ajouté dans la barre du haut et dans Réglages), clavier décalé
sous Safari. Deux appareils peuvent s'enregistrer sur un même compte et Asterisk
ne sert que le dernier : le poste qui a perdu la ligne l'apprend désormais en
constatant l'arrêt des contrôles périodiques du PBX et affiche une alerte rouge
avec « Reprendre la ligne ici » — mécanisme testé en simulation seulement. Deux
notes signalent la ligne prête ou perdue (désactivable). Hébergement : procédure
et nom conseillé dans OPERATIONS, rien de déployé.

Second essai réel de Franck, même soir : **appel entrant, attente/reprise et
clavier DTMF fonctionnent**. Défauts relevés : sonnerie muette, correspondant
inaudible au premier appel entrant (puis de façon intermittente) alors que lui
était entendu, carillon absent, bruit bref à la première reprise d'attente. Cause
commune des trois premiers : le navigateur ne laisse jouer un son que juste
après un clic, et SIP.js lance la voix distante sans clic récent, en taisant le
refus. Correctif : élément audio, carillon et sonnerie déverrouillés dès le clic
de connexion, réveil à chaque interaction, bouton « Activer le son » si la voix
reste bloquée. Pour le bruit : son distant coupé un instant pendant la
renégociation ; aucune erreur SRTP liée à ces appels dans les journaux Asterisk.
**Ces correctifs audio ne sont pas encore confirmés en réel.** Actualiser la
page déconnectait et obligeait à ressaisir : l'application ne stocke toujours
pas le mot de passe, mais propose de l'enregistrer dans le gestionnaire du
navigateur (Chrome, Edge), qui reconnecte après une actualisation ; ailleurs, le
remplissage automatique du formulaire fait l'affaire. Une déconnexion volontaire
désactive cette reconnexion. À noter : le PBX affiche ce poste en état UNKNOWN,
ses contrôles périodiques ne semblent donc pas aboutir au navigateur ; l'alerte
« ligne ouverte ailleurs », qui en dépend, ne se déclenchera probablement pas
en l'état — elle ne peut pas non plus donner de fausse alerte.

Troisième essai de Franck (Chrome et Safari sur le même compte) : **le son
passe bien** — sonnerie, voix du correspondant et carillon sont donc confirmés —
et **l'alerte « ligne ouverte ailleurs » s'est déclenchée en réel**, ce qui
prouve que les contrôles du PBX atteignent le navigateur (l'état UNKNOWN noté
plus haut n'était pas le signe redouté). Défauts observés et corrigés : les deux
navigateurs se reprenaient la ligne à tour de rôle à chaque renouvellement
d'inscription ; le poste qui perd la ligne **se met maintenant en pause sans se
désinscrire** (une désinscription couperait l'autre poste, Asterisk ne gardant
qu'un contact par compte) et n'y revient que sur « Reprendre la ligne ici »,
identifiants gardés en mémoire à cette seule fin ; jamais pendant une
conversation. La connexion du second navigateur a fait fermer le socket du
premier par Asterisk : l'appel décroché était classé « Échec », il reste
« Répondu » avec la mention de l'interruption. Attente restée sur « Patientez… »
une quinzaine de secondes sur un réseau instable : délai de garde de 8 s avec
message. Carte de fin d'appel qui débordait à droite en fenêtre moyenne.
**Ces derniers correctifs ne sont vérifiés qu'en simulation.**

Essais suivants de Franck, 22 h 30–22 h 50 : la mise en pause du poste remplacé
et « Reprendre la ligne ici » **fonctionnent en réel** et Asterisk ne montre plus
de va-et-vient. Mais le poste légitime s'est ensuite mis en pause à tort : le
PBX l'a déclaré injoignable quelques minutes (connexion instable), ses contrôles
périodiques ont cessé et la détection par silence a conclu à un remplacement.
**Mécanisme remplacé** : toutes les 45 s, le navigateur demande au PBX qui tient
le compte (REGISTER de consultation, sans Contact, qui ne modifie rien) et compare
le contact renvoyé au sien, qui porte un identifiant aléatoire. Deux réponses
négatives consécutives sont exigées ; une réponse absente ou illisible ne
déclenche jamais rien. **Non encore vérifié en réel** : que ce chan_sip répond
bien à cette consultation en listant le contact ; s'il ne le fait pas, il n'y
aura simplement plus d'alerte, sans fausse pause.

Application déployée le 21 septembre au soir sur `phone.apisnix-crm.com` par un
autre agent (détails dans le dépôt privé). Premier essai de Franck depuis ce
site : **voix non transmise** (0 paquet audio reçu par Asterisk), réception
correcte. Ce constat concerne la release 1. **Correctif c3ecac7 publié dans
20260921-webphone-2** ; réception RTP reçu confirmé, mais voix toujours inaudible selon Franck ; retour à la
release 1 exécuté (état courant en tête de ce document).

Corrections du même soir, après relecture du plan : la pastille des appels
manqués comptait tous ceux du jour et ne s'effaçait jamais ; elle compte
maintenant ceux non consultés et s'efface à l'ouverture du Journal. Toasts
fermables au clic. En ligne réelle, l'espace de travail reste affiché pendant
une reconnexion, avec un bandeau, et les données de session survivent à une
reconnexion du même compte. Un appel entrant amène le téléphone au premier
plan, change le titre de l'onglet et, si autorisé, notifie quand la page est
en arrière-plan. Sonnerie aussi en démonstration. Bouton « Activer le son » si
le navigateur bloque la lecture.

Vérifié : typage, lint, 28 tests (numéros, contrôleurs démo et SIP, stockage,
rappels), build,
et parcours dans le navigateur intégré à 1440, 1024 et 375 px, thèmes clair et
sombre, sans erreur console. Non vérifié : zoom 125/150 %, mesure des
contrastes, lecteur d'écran, persistance IndexedDB dans un vrai navigateur.

#### Préparation du 18 septembre

Franck choisit une véritable interface d'appels APISNIX, inspirée de
Ringover/Kavkom : espace de travail clair et coloré, journal, contacts, favoris,
drapeaux et panneau d'appel persistant. La référence complète est
[WEBPHONE_PLAN.md](WEBPHONE_PLAN.md), avec une
[maquette interactive locale](design/webphone-maquette.html), des données
fictives et un appel simulé. Recherche officielle SIP.js/API navigateur,
versions, écrans, fonctions, réglages, architecture, étapes et critères de
validation consignés. AGENTS.md oriente les nouvelles conversations vers ce plan.

Le code applicatif sera créé dans `webphone/` : React/TypeScript/Vite et SIP.js,
avec développement en démo avant raccordement. L'application n'est pas encore
construite, aucun appel réel n'a été testé depuis cette maquette. Son rendu et
les principales interactions ont été contrôlés dans le navigateur intégré.

La pile WebRTC actuellement utilisée par VICIdial est conservée. L'audit privé
du 18 septembre confirme TLS/WSS et Franck confirme les appels en production ;
aucun remplacement ou renouvellement de certificat n'est un préalable au
développement. Préserver les contextes, restrictions, enregistrements,
suspensions et le critère `is_webphone=N` des postes manuels supervisés.
L'audit et les détails serveur restent dans Gestion_CRM-APISNIX.

Le compte pilote, la destination d'essai et l'hébergement HTTPS sont à choisir
avant les essais réels et le déploiement ; ils ne bloquent pas l'interface.
Aucun accès ou changement serveur pendant la préparation du plan et de la
maquette, aucune migration, aucun commit ni push. Les clients natifs restent
disponibles dans leur état précédent.

### Extension de périmètre à l'étude : supervision

Les paragraphes suivants conservent l'historique initial de cette extension.
Son état actuel et son exploitation sur Hermes font désormais autorité dans
le dépôt privé Gestion_CRM-APISNIX, `docs/SUPERVISION_TECHNIQUE.md` ; ne pas
reprendre les mentions historiques « aucun service déployé » comme état courant.

Franck souhaite aussi superviser les postes SIP directs, y compris ceux créés
dans `phones` sur un serveur VICIdial : connexion, appels en cours, journal,
compteurs et enregistrements téléchargeables par équipe. Pas de suivi de
présence humaine. Condition explicite : préserver le VICIdial actif.
La [recherche documentation et forums](SUPERVISION_ASTERISK_VICIDIAL.md)
identifie la piste native `defaultlog` pour les enregistrements et un
collecteur séparé pour les états. Aucun collecteur de supervision déployé.

Inspection SSH en lecture seule ensuite autorisée et effectuée : contexte natif
et traitement MP3 présents ; rétention à trois mois non retrouvée. Aucun appel
de test ni changement serveur pendant cet audit. Détails opérationnels
conservés localement hors Git.

À la suite d'un essai signalé sans enregistrement, un modèle SIP imposant son
contexte restrictif a été identifié. Correctif autorisé et appliqué à un seul
poste pilote : enregistrement natif avant renvoi au routage original, sans
changer les restrictions. Sauvegardes serveur et contexte effectif vérifiés.
Aucun service de supervision déployé.

Le 16 septembre, les quatre variantes supplémentaires autorisées ont été
installées et chargées, avec sauvegarde et vérification des routes. Franck a
ensuite confirmé le bon fonctionnement des enregistrements du pilote ; des
MP3 non vides ont aussi été vérifiés sur le serveur. Sur sa demande, 26 postes
supplémentaires ont reçu leur contexte d'enregistrement par Conf Override.
Deux modèles de poste différents ont été remplacés par ceux de leur groupe
SIP classique, après confirmation. Le champ Phone Context est limité à
20 caractères : pour les noms trop longs, il conserve le routage restrictif
de repli et Conf Override porte le nom complet. Les 26 contextes effectifs et
l'attribution au compte ont été vérifiés dans Asterisk après rechargement SIP,
sans redémarrage. Cela ne remplace pas un essai réel sur chacun des 26 postes.
Le suivi programmé reste en pause ; la suite a été réalisée sur demande directe.

Franck a ensuite précisé que les modèles incompatibles servaient volontairement
à suspendre les clients impayés. Deux postes ont été remis en suspension sur
sa demande, sans changement de secrets ; disparition effective des peers
vérifiée après rechargement. Une configuration atypique ne doit donc jamais
être corrigée sans vérifier l'intention commerciale. Les références de comptes,
groupes, copies, suspensions et interventions sont maintenant documentées dans
le dépôt privé distinct `FranckThiago/Gestion_CRM-APISNIX`, dont l'entrée est
`docs/TABLEAU_DE_BORD.md`. AGENTS.md dirige les futures tâches serveur vers
cette mémoire portable ; `docs/production-privee/` reste une archive locale.
Une consultation des groupes clients et de leur source d'abonnements complète
désormais cette mémoire privée. Franck demande d'abord de comprendre l'existant,
puis de ranger pas à pas : aucun nettoyage automatique de comptes, droits,
affectations ou données. L'historique des identifiants réutilisés reste conservé.
La comparaison couvre maintenant les clients actifs, leurs offres et leurs
accès, avec les écarts et les explications métier consignés en privé. Les
identifiants en production priment sur les anciennes annotations du fichier
commercial ; les quantités et produits restent la référence de facturation.
La supervision des postes SIP directs reste la prochaine fonctionnalité demandée.
Un compte d'administration dédié, aux droits du compte de référence, a été
créé à la demande explicite de Franck ; droits comparés, secret hors Git.
L'historique reste conservé lors du recyclage des comptes, sur décision de
Franck ; une séparation éventuelle reste une évolution future. Les corrections
ciblées du fichier commercial et les règles de coupure ultérieures sont
documentées dans le dépôt de gestion, sans données client à publier ici.

### Softphone

La base Linphone a été adaptée dans deux sources officielles verrouillées.
Le nom, les identifiants applicatifs, la configuration serveur et le formulaire
simplifié sont en place. Le chat et les réunions sont masqués via les options
existantes. Les protocoles du moteur sont conservés.

### Android

- Client 6.2.7, moteur Liblinphone 5.5.21 fixé après résolution et compilation.
- APK `6.2.7-apisnix.3` de développement produit dans `dist/android/` (~127 Mio).
- Identifiant `com.apisnix.phone`, libellé ApisnixPhone, Android 9 minimum,
  architectures `armeabi-v7a` et `arm64-v8a` vérifiés dans le paquet.
- Compilation Kotlin/Java, ressources et assemblage réussis ; signature APK v2
  vérifiée. Une seconde exécution du script de construction a réussi.
- Configuration APISNIX/UDP et accès direct à la connexion vérifiés dans l'APK.
- Franck a essayé le pilote `.2` et signalé le remplacement d'un numéro
  national par un numéro préfixé `+237`. La détection automatique du pays a
  été retirée ; ajout d'indicatif désactivé à la création et migré une seule
  fois pour les comptes existants. Voir [NUMEROTATION_ANDROID.md](NUMEROTATION_ANDROID.md).
- Pilote `.3` compilé, signature v2 vérifiée et certificat identique à `.2` ;
  mise à jour possible sans supprimer le compte. Aucun téléphone ni émulateur
  connecté pour valider le correctif en appel réel ; essai de Franck attendu.

### Windows

- Sources du client Desktop 6.2.2 adaptées, formulaire réduit et paramètres
  avancés conservés. Nom et futur exécutable personnalisés.
- Syntaxe des QML modifiés vérifiée avec Qt 6.10.3 ; composants compacts
  rendus et signaux contrôlés sur le Mac, sans serveur SIP.
- Run `34985036963` réussi le 15 septembre 2026 : SDK et client compilés,
  installateur produit et artefact GitHub téléversé. Commit de construction
  `a3ae95be325337a0ddcc21777705f8e1e8a27bf5`.
- La normalisation des chemins Qt/Python corrige l'échec CMake précédent.
- SDK et 30 dépendances restent verrouillés aux commits d’origine. RNNoise
  temporairement désactivé sur Windows ; transports SIP conservés.
- Installateur `.exe` de test non signé produit pour Windows x64.
  Workflow validé avec Actionlint 1.7.12 et exécution complète réussie.
- Fichier récupéré dans `dist/windows/ApisnixPhone-6.2.2-win64.exe` ; empreinte
  SHA-256 identique à celle du runner et en-tête PE x64 vérifiés sur le Mac.
  Le binaire n’a pas été lancé sur le Mac ; Franck a ensuite confirmé son
  fonctionnement sur Windows. Voir les opérations pour le hash.
- Icône ICO multirésolution et cinq ressources SVG de marque décodées/rendues
  avec Qt. Les cas détaillés des interfaces Windows restent à tester.
- La machine de compilation Windows est fournie par GitHub Actions. Le poste
  prévu pour tester n’a besoin que de l’installateur.
- Retour du 16 septembre : Franck confirme que le premier pilote fonctionne
  sur son PC Windows. Aucun relevé détaillé des cas DTMF/reconnexion n'a été reçu.
- À sa demande, [format vertical 420 × 680](FENETRE_COMPACTE.md) ajouté aux
  sources : clavier, appel audio compact et connexion adaptée ; interface
  complète accessible. Le premier accueil Linphone est contourné quand la
  connexion SIP directe est configurée. Nouveau paquet : `6.2.2-apisnix.2`.
- Run `35115685999` réussi le 16 septembre, depuis le commit
  `a8c5171bb79d0acb2da0a95ce2541bc7dd530fb0` : SDK/client compilés,
  installateur récupéré et contrôlé (SHA-256 du runner identique, PE x64).
  Fichier : `dist/windows/ApisnixPhone-6.2.2-apisnix.2-win64.exe`.
  Premier installateur conservé ; nouvel essai réel de l’interface compacte
  encore requis. Le suivi de compilation est terminé.
- Le 17 septembre, un client signale SmartScreen (« éditeur inconnu ») et une
  alerte 360 sur `D3DCompiler_47.dll`. Inspection locale du paquet `.2` :
  installateur et application interne non signés ; DLL extraite contenant des
  certificats Microsoft. Cela ne valide pas la confiance Windows ni ne permet
  de conclure à un faux positif antivirus. Aucun scan Windows exécuté ici.
- Franck choisit la signature sous l'identité de son entreprise française
  APISNIX. Option proposée : Microsoft Artifact Signing Basic ; abonnement
  payant, validation d'identité et accès technique encore à organiser.
  Aucun certificat APISNIX ni paquet signé produit. Voir
  [diagnostic et procédure de signature](SIGNATURE_WINDOWS.md).
- Franck reporte ensuite ce chantier pour reprendre la supervision SIP.
  Signature Windows en attente ; aucun abonnement ni travail Apple relancé.

### Téléchargements depuis l'accueil APISNIX

Le 17 septembre, Franck demande de rendre les deux paquets actuels disponibles
aux clients pendant qu'il poursuit ses essais. Deux boutons Android (vert) et
Windows (bleu) sont publiés sous le formulaire de contact de
[l'accueil APISNIX CRM](https://apisnix-crm.com/#apisnix-downloads).
Les noms publics, liens et empreintes sont dans [OPERATIONS.md](OPERATIONS.md).

Android `.3` et Windows compact `.2` sont inchangés : signature de développement
Android, installateur Windows non signé. La mise à disposition ne remplace pas
les essais encore attendus. Un lien donne accès aux patches, versions verrouillées,
scripts et licences du dépôt public. Aucune compilation, migration ou modification
du moteur SIP dans cette publication. Les sauvegardes et procédures du site sont
maintenues dans le dépôt privé de gestion CRM.

### Mac et iPhone

Franck redemande une suite pour ces plateformes. Xcode 26.6 et les outils Apple
sont disponibles sur son Mac Apple Silicon ; le kit Qt C++ et les outils de
compilation Desktop manquent encore. Aucun build Mac lancé ni paquet produit.
Le client iOS officiel est une base distincte à adapter ; aucun checkout ou
paquet APISNIX iOS créé. Franck confirme ne pas avoir de compte Apple Developer
et demande de laisser les versions Apple en attente. Aucun achat ni lancement
de build Apple. Voir [PLATEFORMES_APPLE.md](PLATEFORMES_APPLE.md).

## Validations et distribution : points encore ouverts

1. Contrôler visuellement les écrans sur appareil : logos principaux intégrés,
   couleurs d’accent passées au bleu APISNIX. Les anciens écrans ou ressources
   inutilisés de Linphone n’ont pas tous été supprimés.
2. Terminer la revue des écrans secondaires : certains liens d'aide et de
   confidentialité restent ceux de Linphone. Ne pas présenter ces liens comme
   la politique APISNIX. Les mentions de licence et d'auteur doivent rester.
3. Tester les nouveaux pilotes Android `.3` et Windows compact sur les appareils
   de Franck. Le premier pilote Windows fonctionne selon son retour ; cela ne
   valide pas ces évolutions ni tous les cas détaillés ci-dessous.
4. Vérifier connexion Asterisk, audio bidirectionnel, DTMF, casques, erreurs et
   reconnexion réseau avec des comptes de test dédiés.
5. Préparer les signatures de diffusion finale, la livraison des sources
   correspondantes de tous les composants et la procédure de mise à jour.
   Les pilotes actuels sont téléchargeables sur le site à la demande de Franck ;
   cela ne crée pas de nouvelle signature ni de release GitHub.
6. Ne pas promettre la réception Android en veille : pas de service push APISNIX
   configuré. Les bibliothèques Firebase restent dans la base mais le projet
   Firebase de démonstration amont a été retiré.

## Environnement et traçabilité

- Softphone construit depuis macOS/GitHub. Des interventions Asterisk distinctes
  ont ensuite été autorisées : audit en lecture, activation d'un poste pilote,
  puis ajout de quatre contextes et affectation de 26 postes supplémentaires
  après validation du pilote. Voir l'étude de
  supervision ; détails et sauvegardes d'exploitation exclus du dépôt public.
- Racine initialisée en Git ; dépôt public créé :
  https://github.com/FranckThiago/ApisnixPhone. Publication et lancement Windows
  autorisés explicitement par Franck le 15 septembre 2026. `apps/android` et
  `apps/desktop` restent des checkouts Git locaux détachés, exclus du dépôt racine.
- Sources/reconstruction : [architecture](ARCHITECTURE.md) et
  [opérations](OPERATIONS.md). Patches exportés, contrôle inverse d'application
  et `git diff --check` réussis.
- Aucun identifiant SIP reçu ou enregistré. Aucune migration serveur.
  La migration locale du paramètre Android est décrite dans NUMEROTATION_ANDROID.md.
