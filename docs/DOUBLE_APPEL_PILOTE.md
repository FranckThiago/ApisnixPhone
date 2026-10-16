# Double appel entrant : pilote contrôlé

## Périmètre et activation

Le pilote du 16 octobre 2026 permet de conserver une conversation, de la mettre
explicitement en attente pour répondre à un second entrant, puis de basculer
entre les deux. Aucun transfert, conférence ou second appel sortant. Aucune
réponse automatique. Le troisième appel est refusé en SIP 486.

`VITE_CALL_WAITING_LINES` contient au build une liste explicite de noms de
comptes, séparés par des virgules. Vide par défaut. La comparaison est exacte
après retrait des espaces du nom de connexion ; aucun groupe ni préfixe n’est
implicitement admis. C’est une activation produit, pas une frontière de
sécurité : les limites et droits du PBX restent déterminants. Le compte pilote,
les anciennes valeurs et le retour serveur sont documentés dans le dépôt privé
Gestion_CRM-APISNIX. Ne pas généraliser avant validation sur les appareils réels.

Les autres lignes restent à une session avec le refus anticipé du deuxième
INVITE. Une ancienne page déjà ouverte conserve son ancien comportement jusqu’à
son actualisation **hors appel**. Aucun service worker ne remplace le code au
milieu d’une conversation.

## Parcours

- Un second entrant pendant une conversation active ou déjà en attente affiche
  son identité et les boutons « Mettre en attente et répondre » / « Refuser ».
  La vue Téléphone revient au premier plan. Pas de sonnerie superposée au premier
  correspondant ; les notifications système préalablement autorisées restent
  possibles lorsque la page est masquée.
- Répondre demande d’abord l’attente du premier appel. Seule la confirmation SIP
  permet de décrocher le second. Le simple envoi de la requête ne suffit pas.
- L’autre conversation a un bouton « Reprendre cet appel ». La conversation en
  cours est mise en attente avant la reprise de l’autre. Micro, clavier DTMF et
  raccrochage concernent la conversation affichée.
- Pendant une bascule, les commandes concurrentes sont bloquées ; raccrocher
  reste possible. Un échec d’attente n’entraîne pas le décroché du second appel.
- Si le second annule ou échoue, le premier est repris s’il était actif avant
  la tentative. Si la conversation affichée se termine, l’autre devient visible
  et une conversation en attente est reprise. Un refus de reprise reste signalé
  et peut être retenté ; aucune réussite n’est présumée.
- Un entrant pendant une préparation sortante, une sonnerie initiale, une
  terminaison ou une négociation d’attente est refusé. Deux sessions vivantes
  constituent toujours la capacité maximale.

## Architecture et isolation

`CallWaitingPhoneController` compose deux `SipPhoneController`, chacun avec sa
session, ses minuteries et sa sortie audio. Un seul vrai `SessionManager`, une
seule inscription SIP et un seul propriétaire de connexion. Le second contrôleur
reçoit un adaptateur sans inscription ni fermeture de transport propres. Les
événements sont distribués par identifiant de session et les événements d’une
ancienne connexion sont ignorés. La récupération de connexion ne remplace pas
le manager si l’une des conversations est encore vivante.

Le pilote capture le micro une seule fois. Chaque session obtient un clone
natif indépendant de la piste ; arrêter une session ne doit pas arrêter la
piste de l’autre. Pas de mélange des voix, pas de nouvelle amplification, pas
de dépendance ajoutée. Chaque réception utilise son propre élément audio et
son propre `RemoteVoice`. `focusSession` n’autorise les pistes émettrices et
réceptrices que pour la session sélectionnée, non en attente ; le muet reste
respecté. Ce dernier verrou protège aussi contre une réponse tardive pendant
une tentative de retour au premier appel.

SIP.js 0.21.2 conserve sa faiblesse de capacité (`length > max` avant admission).
L’interception `onInvite` reste donc en place avant le traitement natif ; sa
capacité vaut deux uniquement pour le pilote. Les re-INVITE du dialogue déjà
établi continuent normalement.

Chaque fin d’appel, même en arrière-plan, est conservée dans `completedCalls`
(liste mémoire bornée à 32). AppContext écrit une seule entrée par identifiant
et réserve cet identifiant avant l’écriture pour éviter les doublons dus aux
notifications synchrones. La fiche de qualification reste liée à l’appel
terminé actuellement affiché ; les autres sont consultables dans le Journal.

## Vérifications reproductibles

Depuis `webphone/` : `npm run typecheck`, `npm run lint`,
`npm run test -- --run`, `npm run build`.

`tests/callWaiting.test.ts` couvre notamment les limites du pilote, inscription
unique, attente confirmée, refus/absence de confirmation, annulation pendant
l’attente, échec de réponse, retour automatique, commandes de la bonne session,
fin de l’appel en arrière-plan, réemploi du premier emplacement, déconnexion et
événements obsolètes. Les tests du refus à une session restent inchangés et
utilisent le vrai parseur SIP.js avec un transport local.

Pour la vérification **native du média** : lancer Vite, ouvrir
`/tests/browser/callWaiting.html`, cliquer « Lancer les vérifications ».
Ce banc utilise le vrai SIP.js et les vrais RTCPeerConnection du navigateur,
mais un transport SIP en mémoire et des sons synthétiques. Aucun compte PBX,
aucun microphone physique, aucun appel facturé. Il vérifie le passage de la
voix vers A, l’attente de A avant la réponse à B, la capture unique, le silence
de A pendant que B reçoit la voix, le refus du troisième entrant, l’isolation
inverse après reprise, le muet et la survie du micro B après fermeture de A.
Le résultat reste visible dans la page. Les pages sous `tests/browser/` ne sont
pas incluses dans la publication Vite de l’application.

`/tests/browser/waitingCard.html` montre le composant de double appel en largeur
390 px, avec identités fictives et commandes simulées, pour vérifier les textes
et la présentation. Ce n’est pas une conversation réelle.

## Limites et recette terrain avant généralisation

Un test WebRTC local réussi ne démontre pas la qualité acoustique d’un iPhone,
le comportement d’un réseau mobile, ni l’interopérabilité avec le PBX de
production. La recette terrain doit comprendre deux appels **réellement routés
vers le poste pilote**, attente/reprise dans les deux sens, confidentialité de
la voix de l’appel en attente, muet, raccrochage depuis chaque côté, troisième
appel, reconnexion hors appel et deux entrées correctes dans le Journal.

Faire un premier essai avec écouteurs, puis sur la route audio souhaitée.
Un appel cellulaire reçu par l’iPhone peut interrompre l’accès audio du navigateur
au niveau du système ; ce pilote traite deux appels SIP dans la page et ne
commande pas la téléphonie cellulaire. Une suspension de Safari ou un changement
de réseau reste susceptible de couper les médias. Ne pas conclure à une
validation iPhone à partir du seul navigateur intégré du Mac.

## Retour

Revenir au build précédent rétablit la protection à une session. La limite
serveur du seul compte pilote doit aussi revenir à sa valeur sauvegardée via
un changement ciblé et la génération native, sans restaurer globalement un
fichier VICIdial. Retirer la variable de build désactive le pilote ; ne pas
modifier les modèles partagés pour l’étendre ou l’annuler.
