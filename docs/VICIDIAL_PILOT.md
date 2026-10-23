# Pilote VICIdial avec l’écran APISNIX conservé

## État courant : raccordement natif administrable

Le pilote interorigine ci-dessous est désormais complété par un **module PBX
same-origin**, publié le 23 octobre 2026. Administration → ApisnixPhone API active
le remplacement par équipe à la prochaine connexion ; aucun client n’a été
activé automatiquement. Les agents conservent écran, campagnes et permissions.
Le domaine commun du CRM n’est plus utilisé comme identifiant d’équipe : la session
VICIdial authentifiée détermine le groupe et le poste affecté. Un poste suspendu,
inactif, sans configuration WebRTC ou avec mapping incohérent n’est pas converti.

Le HTML retire le téléphone natif avant chargement, puis monte
`native-conference.html` construit par `npm run build:conference`. Un jeton lié à
la session, au poste et aux droits expire après huit heures. Le secret SIP reste
dans l’iframe, sans URL ni stockage persistant. Pas de profil, journal ou TURN
dynamique Hermes ; le réseau média direct/STUN doit être recetté côté client.

Le watchdog privé confirme la présence du canal agent dans sa conférence exacte.
La disponibilité exige heartbeat navigateur de moins de 12 s, contrôle serveur
de moins de 6 s, audio actif et reprise explicite. Perte audio : pause de l’agent
libre ou demande de pause après l’appel en cours ; la surveillance ne raccroche
pas le prospect. Le serveur bloque aussi disponibilité et appel manuel sans bail
sain. L’expiration/révocation retire le panneau : prévoir la reconnexion de l’agent
avant la limite de huit heures. Une session en cours n’est pas révoquée par le
simple changement du réglage d’équipe.

Huit rubriques de fiche, texte uniquement, effacées hors appel/qualification.
Entreprise est vide par défaut ; l’administrateur peut mapper Adresse 2 ou
Référence fournisseur selon les données de l’équipe. Ce mapping n’altère pas
la fiche native. Le journal des appels prospects reste celui de VICIdial.

### Seconde recette réelle et nettoyage

Agent 5102, phone test003, campagne APX_API : manuel **138 s**, automatique
**63 s**, qualifications OKAY sur la même conférence ; mise en attente/reprise,
coupure ciblée du canal agent et pause, reprise et appel manuel refusés côté serveur
sans audio. Flux RTP dans les deux sens observés. Cette fois, capture microphone
normale du navigateur, sans source synthétique injectée. Cela ne prouve pas la
qualité d’une conversation humaine ni la compatibilité de tous les casques/réseaux.
Traces d’enregistrement présentes ; restitution audio non contrôlée.

Le transfert n’a pas été exécuté (droits de campagne conservés) et l’écoute
superviseur reste à recetter. Activation/désactivation et mapping d’entreprise
contrôlés sur un groupe sans agent connecté puis remis à zéro. Campagne/liste
de test inactives, mapping agent restauré, agent déconnecté, destinations d’écho
et exception de test désactivées, zéro session/équipe active dans le nouveau registre.
266 tests frontend, typage/lint/deux builds et 38 assertions PHP réussis.

[Captures natives et légendes](integration/captures/README.md), [guide client](integration/README.md).
Exploitation détaillée et preuves privées : dépôt de gestion,
`docs/VICIDIAL_CONFERENCE_PRODUCTION_20261023.md`.

## Première recette isolée (historique)

**Recette isolée réelle effectuée**, avec le nouvel écran agent conservé,
agent 5102, phone test003 et copie native APX_API de CampTES2. Aucun prospect
existant n’a été copié ou appelé. Le banc local reste une simulation distincte.

Le 23 octobre, appel manuel de 65 s puis appel automatique de 53 s, tous deux
qualifiés `OKAY`, sur la même conférence SIP permanente. Huit champs de la fiche
fictive affichés dans le panneau. Coupure volontaire de la conférence depuis
l’état READY : pause observée dans le navigateur **et dans VICIdial côté serveur**,
puis tentative de reprise bloquée tant que l’audio est absent.

Les flux SIP/WebRTC étaient réels, avec microphone synthétique et correspondant
SIP interne en écho. Le navigateur intégré n’a pas affiché de demande de micro :
**le microphone physique et une conversation humaine ne sont pas validés**.
Les premiers essais avec une destination Local sans canal SIP reconnu ont échoué ;
le répondeur SIP interne avec trois secondes de sonnerie a permis la recette.

Après recette : agent déconnecté, affectation téléphonique originale restaurée,
campagne et liste de test inactives, adaptateur live désactivé, origine temporaire
retirée et équipe originale du phone restaurée. Micro synthétique retiré du site ;
manifest original de la release vérifié. Aucun service Asterisk redémarré.
Frontend actif : `20261023-conference-pilot` ; backend inchangé.

Captures [réelles et de présentation](integration/captures/README.md). Les captures
locales portent un bandeau de simulation et ne constituent pas une preuve média.

## Démarrer sur le Mac

Dans `webphone/` du dépôt Softphone :

```sh
VITE_APP_MODE=demo VITE_EMBED_ALLOWED_ORIGINS=http://127.0.0.1:8781 npm run dev -- --port 5186
```

Dans le dépôt privé `Gestion_CRM-APISNIX` :

```sh
python3 agent-skin/pilote-phone/serve.py
```

Ouvrir <http://127.0.0.1:8781/>. Le serveur Python écoute seulement la boucle
locale et sert une liste explicite d’assets, jamais le dépôt ou des sources PHP.
Arrêter ces deux processus retire le banc. Le port 5185 reste indépendant.

## Architecture et frontière avec le SDK client

- `src/vicidial/ConferencePilot.tsx` : panneau audio local, textes FR/EN/ES.
- `pilot.ts` : contrôleur de simulation et montage d’iframe dédié au banc.
- `pilotGate.ts` : garde développement, hors mode `live`, sur boucle locale.
- `/vicidial-pilot-phone` retourne au routage ordinaire dans tous les builds.
  Dans une iframe de release, le contrôle habituel `EmbeddedPhone` s’applique.
- Le canal expérimental `apisnixphone.conference-pilot.v1` est distinct du SDK
  publié et ne transmet que `{connected, bridgeId, muted}`. Aucun identifiant
  client, appel prospect, mot de passe ou commande de numérotation.
- Émetteur, origine autorisée et canal aléatoire sont vérifiés. Les messages
  répétés ne redessinent pas la fiche. Perte de heartbeat depuis plus de
  3,5 secondes, détectée au prochain contrôle de 1 seconde, ou rechargement du
  panneau invalident la disponibilité du banc. Un onglet suspendu peut retarder
  ce contrôle navigateur : ce n’est pas un mécanisme serveur de disponibilité.

Le SDK expose désormais `setContact` : huit champs et notes facultatives,
affichage volatil corrélé à l’appel. Le mode `conference` conserve une session
SIP distincte des clients VICIdial, désactive la préparation de numéros et la
journalisation locale de cette session. Un heartbeat signale la perte de panneau.
Il ne commande jamais automatiquement les appels prospects.

L’adaptateur live du dépôt de gestion se charge par un hook personnalisé, limité
au triplet de test et désactivé après recette. VICIdial conserve ses commandes
de numérotation, raccrochage et qualification. `address2` représente l’entreprise
dans cette liste de test uniquement ; ce mapping n’est pas une règle universelle.

## Blocages identifiés lors du premier pilote (historique)

- Authentification agent/phone multiéquipes : une origine générique ne peut pas
  représenter toutes les équipes CRM. Le domaine temporaire limité au poste test
  a été retiré. Aucun SSO multiéquipes n’est livré par cette recette.
- Le pilote utilise un phone `is_webphone=N` : valider la sélection exclusive du
  téléphone pour les postes ayant un webphone natif, sans double connexion.
- Renforcer la réconciliation et la surveillance serveur pour un onglet gelé,
  une perte réseau complète, une expiration ou une suspension de compte.
- Valider audio physique, transfert, écoute superviseur et enregistrement utile
  sur le navigateur, le matériel et la campagne du client. La création de traces
  d’enregistrement pendant la recette ne prouve pas leur restitution complète.

## Vérifications

`webphone/tests/conferencePilot.test.ts` couvre la garde, le cycle de session,
l’isolation du canal et le timeout/rechargement. Dans le dépôt privé,
`agent-skin/tests/conference-pilot.test.mjs` couvre deux clients sur une session,
qualification, coupure/reprise et événements dupliqués. La vérification locale
ne remplace pas une recette avec VICIdial et audio réels.

Recette du 23 octobre : 266 tests frontend et 5 tests du banc privé passent ;
typage, lint et build passent (avertissement habituel de taille du bundle).
Le protocole de simulation local reste absent du JavaScript de production ;
le mode conférence du SDK y est désormais présent. Dans le navigateur
intégré : deux clients qualifiés sur `demo-1`, micro simulé, coupure bloquant la
disponibilité, reprise explicite sur `demo-2` avec historique conservé. Rendu
observé en largeur de bureau et dans le panneau étroit. Les interactions dans
l’iframe ont été réalisées au clavier, le clic automatisé interorigine du
navigateur de test signalant une cible indisponible.
