# Pilote VICIdial avec l’écran APISNIX conservé

## État au 23 octobre 2026

**Banc local simulé, pas une intégration de campagne publiée.** Franck a choisi
de conserver le nouvel écran agent VICIdial et d’explorer le remplacement de
son téléphone par ApisnixPhone API. Le banc réutilise les véritables `agent.js`
et `agent.css` du dépôt privé de gestion, sur un DOM de démonstration. Il ne
charge ni le moteur PHP VICIdial, ni une campagne ou un compte client réel.
La release de production `20261023-embed-api` reste inchangée.

Le panneau utilise `DemoPhoneController`. Une seule session simulée reste
active entre plusieurs clients, avec micro simulé, coupure et reconnexion
explicites. L’agent reste en pause tant que l’audio n’est pas connecté. Terminer
un client ouvre sa qualification et ne termine pas la session audio. La reprise
après coupure reste manuelle. Notes et qualifications sont volatiles.
Aucun microphone, média réel, appel SIP, secret ou journal client n’est utilisé.
Ce panneau n’emploie pas `AppProvider` et ne persiste donc pas la conférence
comme un appel client dans le Journal.

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

Le SDK `apisnix-embed.js`, son protocole et son guide restent inchangés.
Ce pilote n’ajoute aucune capacité automatique à l’API destinée aux clients.

## Passage à une vraie campagne : travail restant

1. **Accès CRM** : résoudre le lien utilisateur VICIdial / phone / client.
   L’inventaire supervision actuel porte sur les phones `is_webphone=N` ; les
   phones web CRM `Y` ne sont pas couverts. Plusieurs clients partagent le même
   domaine CRM, alors que la politique générique lie une origine à une seule
   équipe. Prévoir une authentification serveur dédiée à la session agent et au
   poste, sans élargir toutes les équipes ni transmettre de secret SIP par URL
   ou par le canal du parent.
2. **Un seul téléphone** : sélectionner le pilote avant le chargement du
   webphone natif. Monter les deux puis masquer l’ancien peut provoquer une
   double connexion. Aucun remplacement live n’est implémenté par ce banc.
3. **Conférence agent** : établir et identifier la session permanente, conserver
   les actions VICIdial pour les clients. Un `call_dead` client ne doit pas
   devenir un BYE de la session SIP. Ne pas accepter automatiquement toute
   invitation entrante ni journaliser la conférence comme un client.
4. **Événements et reprise** : brancher les événements natifs avec identifiants,
   dédoublonnage et réconciliation serveur. Une coupure doit demander une pause
   native et vérifier son acquittement ; le blocage local ne suffit pas.
5. **Recette isolée** : agent, phone et campagne identifiés, anciens réglages
   sauvegardés, activation limitée et retour ciblé. Vérifier deux clients
   successifs, audio physique bidirectionnel, raccroché client, qualification,
   pause/reprise, perte réseau, expiration/suspension, rechargement, transferts,
   écoute et enregistrements, et absence de double connexion.

Les points d’extension natifs ont été examinés en lecture seule dans le dépôt
de gestion et sur le serveur courant. L’adaptateur live et la recette de campagne
restent à réaliser. Ne pas présenter la compatibilité automatique VICIdial comme
commercialement validée à partir de ce banc.

## Vérifications

`webphone/tests/conferencePilot.test.ts` couvre la garde, le cycle de session,
l’isolation du canal et le timeout/rechargement. Dans le dépôt privé,
`agent-skin/tests/conference-pilot.test.mjs` couvre deux clients sur une session,
qualification, coupure/reprise et événements dupliqués. La vérification locale
ne remplace pas une recette avec VICIdial et audio réels.

Recette du 23 octobre : 262 tests frontend et 4 tests du banc privé passent ;
typage, lint et build passent (avertissement habituel de taille du bundle).
Protocole et chemin du pilote absents du JavaScript compilé. Dans le navigateur
intégré : deux clients qualifiés sur `demo-1`, micro simulé, coupure bloquant la
disponibilité, reprise explicite sur `demo-2` avec historique conservé. Rendu
observé en largeur de bureau et dans le panneau étroit. Les interactions dans
l’iframe ont été réalisées au clavier, le clic automatisé interorigine du
navigateur de test signalant une cible indisponible.
