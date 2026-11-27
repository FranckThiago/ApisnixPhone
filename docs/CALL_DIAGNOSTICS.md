# Motifs de fin d’appel — ApisnixPhone navigateur

État : implémenté le 27 novembre 2026 ; publication décrite dans OPERATIONS.md.
Sources : `webphone/src/telephony/callDiagnostics.ts`, contrôleur SIP,
`serverCallOutcome.ts`, `features/history/useLineHistory.ts` et dictionnaires FR/EN/ES.

## Contrat

Un échec affiche un motif lisible, une action utile et le code SIP reçu. Le
même diagnostic reste dans l’historique observé du téléphone. Le texte libre
opérateur n’est jamais affiché, enregistré ou journalisé par cette fonction.
Le code générique ne permet pas de déduire une restriction commerciale.

Ordre de lecture :

1. Motifs explicites reconnus : crédit/solde insuffisant, tarif absent, route
   absente, règle de marge, horaires autorisés, destination interdite, limite
   d’appels simultanés et autorisation requise.
2. Cause numérique de l’en-tête **Q.850 Reason**, si une seule cause connue
   concordante est présente. Un `SIP;cause=17` n’est pas une cause Q.850.
3. Phrases précises reconnues (occupé, absence de réponse, numéro non attribué).
4. Sens du code SIP seul, ou message avec le code inconnu.

Les listes Reason sont bornées ; les séparateurs dans les chaînes entre
guillemets ne sont pas interprétés comme de nouveaux protocoles/paramètres.
Les motifs sont lus à partir de la réponse de refus du même INVITE ; une réponse
tardive appartenant à l’appel précédent reste ignorée.

## Principales distinctions

| Information reçue | Affichage et issue |
| --- | --- |
| Q.850 17, SIP 486/600 ou motif occupé explicite | Appel classé occupé par le serveur ; `busy` |
| Q.850 18 | Pas de réponse du terminal ; `no-answer` |
| Q.850 19 | Aucun décroché ; `no-answer` |
| Q.850 1 | Numéro **signalé** non attribué par le réseau |
| Q.850 2/3 | Aucune route disponible |
| Q.850 20 / 27 | Abonné absent / destination hors service |
| Q.850 21 | Rejet du réseau ou du destinataire, sans cause commerciale inventée |
| Q.850 22 / 28 | Numéro changé / format invalide |
| Q.850 34/42/44/47 | Capacité ou canaux indisponibles |
| Q.850 38/41/102 | Réseau hors service / défaillance temporaire / temporisation |
| Q.850 57/58/65/88 | Service interdit / capacité audio indisponible / incompatibilité |
| 403 sans motif | Appel non autorisé, motif non transmis ; jamais crédit épuisé par déduction |
| 404/604 sans motif | Destination introuvable **sur cette route**, sans déclarer le numéro hors service |
| 480 sans motif | Destination temporairement indisponible, en attente d’une observation serveur éventuelle |
| 408/504 | Délai de réponse dépassé, sans affirmer que le correspondant a entendu sonner |
| 484/485 | Numéro incomplet / destination ambiguë |
| 487/603 | Annulation / refus de l’appel |
| 415/488/493/580/606 | Paramètres média/audio refusés |
| 500/501/502/503 | Erreur interne / fonction non prise en charge / passerelle / service-capacité indisponible |

Les 400/401/407/410/423/430/439/481/482/483/491 et codes inconnus ont aussi
un message, en conservant toujours le code effectivement reçu.

## 480 générique et classement du journal serveur

Lorsque le journal de la ligne est ouvert et autorisé, le téléphone peut
préciser un 480 générique à partir de sa première page existante (50 appels).
Trois actualisations supplémentaires, à 1, 4 et 10 secondes après l’affichage
de la fin d’appel, laissent au collecteur le temps de terminer. Elles sont
annulées à la fermeture de la carte, à la nouvelle tentative ou au résultat.
Aucune lecture si le Journal est désactivé ou son accès fermé.

La correspondance exige : appel sortant terminé sans décroché, même numéro
(formes nationales françaises/internationales reconnues sans changer la
composition), un seul candidat à ±1,5 seconde du début et une fin à ±2 secondes.
Un classement serveur définitif `busy` ou `no-answer` peut alors remplacer le
480 générique sur la carte et dans le journal observé. Le code SIP 480 reste
visible. Notes, qualifications et rappels programmés sont conservés.

Un journal périmé, une erreur d’accès, plusieurs candidats, un appel incomplet,
un écart d’horloge, un motif explicite (crédit, limite…), un décroché ou une
annulation locale empêchent ce rapprochement. La corrélation est temporelle,
ce n’est pas une identité SIP/PBX partagée : en cas de doute, le repli reste
indisponible. Aucun historique ancien n’est réécrit rétroactivement.

Le classement « occupé » est celui du serveur ; il ne prouve pas qu’une personne
est déjà au téléphone. Les refus opérateurs peuvent être traduits ainsi.

## Vérifications

Tests des causes et de la priorité des motifs, listes Reason contradictoires
ou malformées, traductions, rapprochement des numéros, tentatives proches,
réponses tardives, conservation des notes/qualifications/rappels et contrôleur.
Banc sans réseau SIP : `/tests/browser/callDiagnostics.html` sur le serveur de
développement, avec contrôleur réel et réponses simulées. Le banc n’est pas
inclus dans le build de production.

Références primaires : [RFC 3398 §7.2.4.1](https://www.rfc-editor.org/rfc/rfc3398.html#section-7.2.4.1)
et [RFC 3326](https://www.rfc-editor.org/rfc/rfc3326.html) pour l’en-tête Reason.
Pas de modification du PBX, des routes, des permissions, du backend ou des manuels.

## Cause Q.850 côté PBX — 27 novembre 2026

Jusqu’au 27 novembre au soir, le PBX n’envoyait pas l’en-tête `Reason: Q.850`
(`use_q850_reason` absent) : seuls les codes SIP nus arrivaient, et un
« 603 Decline » de l’opérateur était vu en `403`. Depuis ~21:40 Douala,
`use_q850_reason=yes` est actif dans `sip.conf` : les refus portent la cause,
donc l’étape 2 de l’ordre de lecture s’applique. Fiche, sauvegarde et retour :
dépôt de gestion, `docs/Q850_REASON_20261127.md`. Non encore observé sur un
appel réel en échec.
