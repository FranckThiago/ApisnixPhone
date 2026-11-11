# Équipe, rappels partagés et transferts

## Parcours

Le menu Équipe fournit consignes avec confirmation de lecture, réponses aux
objections, demande d’aide/réponse du superviseur, objectifs collectifs par
qualification et évaluations personnelles. Un badge signale les consignes,
réponses et évaluations à consulter. Les réponses aux objections sont également
accessibles pendant l’appel, près du script et du volume. Texte brut, pas de HTML.
Les nouveaux libellés de l’interface sont disponibles en français, anglais et espagnol.

Planifier un rappel propose Personnel (par défaut) ou Groupe si l’équipe autorise
les outils partagés. Le menu Rappels conserve la liste personnelle et ajoute la
file de groupe avec recherche, pagination et terminés. Prendre en charge et appeler
réserve d’abord le rappel côté serveur. Seul son titulaire peut terminer, rouvrir,
reporter d’une heure ou libérer le rappel ; le superviseur peut réattribuer.
La clôture d’un rappel partagé reste explicite, même après un appel répondu.
L’agent peut partager un rappel personnel existant. Le superviseur peut consulter
les rappels de ses agents et en promouvoir un dans Gestion, sans accès à leurs
contacts ni notes d’appels. Un marqueur serveur empêche l’ancien profil de recréer
un rappel promu ; la mémoire du téléphone est nettoyée au prochain relevé.

Transférer apparaît pendant un appel actif quand le superviseur l’a activé pour
le groupe. Choix d’un autre poste connecté du même groupe et du même PBX ; contrôle
serveur au clic et à la résolution téléphonique. Pas de transfert pendant la mise
en attente, une bascule ou un double appel. La référence interne fournie par le
serveur ne permet pas de choisir un numéro externe. REFER est suivi jusqu’au
NOTIFY final (45 s maximum) ; l’acceptation initiale n’est pas un succès. Refus ou
délai : aucun raccrochage local. Succès : seul le dialogue d’origine est quitté,
jamais une nouvelle conversation après une réponse tardive.

Freelancer : pas de file partagée, annuaire, consignes collectives ou transfert.
Rappels personnels, script activé explicitement et évaluations individuelles
conservés. Le build conférence VICIdial reste séparé et n’utilise pas ce parcours.

## Contrat

`team/` : client HTTP avec sessionFetch et CSRF existants, données en mémoire,
provider monté uniquement dans l’espace connecté. Relevé toutes les 30 secondes
si visible, au focus/retour réseau. Un seul relevé à la fois : celui demandé pendant
un autre (action enregistrée, nouvel accès) le suit immédiatement. Arrêt et rejet des résultats tardifs après
fermeture/changement d’accès ; 401/403 masque les données. Aucune nouvelle
permission microphone, stockage de clé ou dépendance. Démonstration exclusivement
fictive, en mémoire et sans réseau.

API sous `/api/team-workspace` : état/ressources/aide/destinataires, `callbacks`
(recherche, page, état, promotion et actions), `quality`, `objectives`, `read`,
`help`, `transfer`. Les identifiants d’équipe ne sont jamais choisis par le client.
Un conflit 409 demande de recharger ; pas d’écrasement ni de relance automatique
à l’aveugle. La clé du raccord PBX reste exclusivement côté serveurs.

Le serveur est la référence pour réservations, promotions, révisions et droits.
Le contrôle des transferts s’applique à ce parcours ; il ne modifie pas les droits
SIP généraux d’un autre logiciel. L’état « connecté » est une observation récente,
pas une garantie que le destinataire décrochera.

## Validation et livraison

299 tests téléphone réussis avant préparation de livraison ; tests dédiés au
succès/refus/délai du transfert, et à une réponse tardive après une nouvelle
conversation. Typage/lint et recette navigateur locale : consigne lue, rappel de
groupe créé et réservé, transfert simulé, qualification de fin d’appel conservée.
En service **20261107-team-tools**, source `572c489`, depuis **13:07:02 Douala**
le 7 novembre. Backend à 13:05:27, raccord interne PBX à 13:11:52. Aucun groupe
réel activé à la livraison. Ressources HTTPS conformes et formulaire public
chargé sans erreur console. Aucun appel réel provoqué ; conversation et audio
transférés restent à valider. Sauvegardes, reçus et retour dans [OPERATIONS](OPERATIONS.md).
Correctifs de relevé et d'accessibilité en service depuis le 11 novembre,
release **20261111-team-refresh**.
