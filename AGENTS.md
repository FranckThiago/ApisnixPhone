# Contexte de travail APISNIX

## Sources de vérité

- Softphone : lire `docs/PROJECT_STATE.md`, puis les documents pertinents
  parmi `docs/ARCHITECTURE.md` et `docs/OPERATIONS.md`.
- Téléphone web PC : lire `docs/WEBPHONE_PLAN.md`, référence du périmètre,
  du design, des fonctions, des réglages et de l'ordre de réalisation.
  Sa maquette est `docs/design/webphone-maquette.html`. Le code web est dans
  `webphone/` (React/TypeScript/Vite) : interface complète en mode démonstration,
  **sans adaptateur SIP.js ni appel réel à ce jour**. Commandes depuis `webphone/` :
  `npm ci`, `npm run dev`, `npm run typecheck`, `npm run lint`,
  `npm run test -- --run`, `npm run build`.
- Avant toute tâche concernant le serveur, VICIdial, Asterisk, des comptes,
  des groupes, une suspension ou des enregistrements : lire d'abord
  le dépôt privé `FranckThiago/Gestion_CRM-APISNIX` : `AGENTS.md`, puis
  `docs/TABLEAU_DE_BORD.md` et les fiches qu'il indique. Clone Mac :
  `/Users/franckabouna/Projets_Claude/Gestion_CRM-APISNIX`.
  L'ancien `docs/production-privee/` reste une archive locale exclue du dépôt
  public ; les nouvelles règles se maintiennent dans le dépôt de gestion.
  Si le clone manque, ne pas supposer les règles commerciales ; retrouver
  le dépôt privé ou demander son emplacement tout en
  poursuivant les contrôles en lecture seule accessibles.
- Le tableau de bord est une mémoire datée, pas une preuve d'état actuel.
  Vérifier l'état réel avant chaque mutation et préserver les changements
  intervenus depuis le dernier passage.

## Règles durables de production

- Une configuration inhabituelle peut représenter une suspension commerciale.
  Ne jamais réactiver un compte ou « réparer » son modèle sur la seule base
  d'une incohérence technique. Vérifier l'intention de suspension documentée.
- Distinguer utilisateur VICIdial, téléphone, groupe client, modèle technique
  et contexte d'appel. Copier un objet peut aussi copier des permissions,
  des routes et des affectations : inspecter ces dépendances.
- Une demande de génération SQL produit une proposition ; elle n'autorise
  pas son exécution. Une demande explicite d'application autorise le périmètre
  décrit, avec sauvegarde et contrôle du résultat.
- Avant mutation de production : cible exacte, anciens réglages sauvegardés
  de façon protégée, effets compris, retour arrière ciblé, puis vérification.
  Ne pas restaurer globalement une configuration générée par VICIdial.
- Ne jamais enregistrer de secrets, journaux bruts de clients ou sauvegardes
  serveur dans les documents ou le Git public. Documenter les mécanismes
  d'accès, noms de champs et emplacements protégés uniquement.
- Mettre à jour les fiches du dépôt privé de gestion après une intervention et
  conserver les raisons métier des choix, les résultats et les limites.
- Finaliser les travaux demandés et validés par un commit cohérent et un push
  vers le dépôt approprié, sans redemander de confirmation, sauf consigne
  contraire. Contrôler le périmètre, les secrets et les changements concurrents ;
  conserver les travaux indépendants à part.

Ces instructions permettent aux nouvelles conversations ouvertes dans ce
projet de retrouver le contexte local. Elles ne chargent pas automatiquement
ces fichiers dans une conversation ouverte ailleurs.
