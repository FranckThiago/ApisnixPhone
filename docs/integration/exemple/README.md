# Exemple client ApisnixPhone API

Exemple SDK inchangé, livré avec le guide édition 1.2, 23 octobre 2026. Lire le guide technique joint avant utilisation.

## Installation

1. Faire autoriser l'origine HTTPS exacte de votre CRM pour votre équipe dans Supervision > Administration > Intégrations CRM.
2. Servir `index.html`, `integration.js` et `style.css` ensemble sur cette origine. Aucun npm, backend de démonstration ou build n'est nécessaire.
3. Adapter la CSP et la Permissions-Policy du CRM selon le guide. Le SDK officiel et ses modules sont chargés depuis `https://phone.apisnix-crm.com`.
4. Ouvrir la page HTTPS. Se connecter dans le téléphone avec un phone de l'équipe autorisée.
5. Saisir un numéro de test convenu, cliquer sur Préparer l'appel, puis Appeler dans le téléphone. Valider l'audio entrant et sortant avec le matériel réel.

Le kit utilise le service réel. Aucun accès, numéro à appeler ou secret réel n'est inclus. Ni localhost ni l'ouverture directe du fichier HTML ne constituent une origine autorisée de production. Prévoir une origine HTTPS de préproduction autorisée.

## Adaptation

Le champ facultatif `phone` dans `integration.js` peut préremplir un identifiant public. Ne jamais ajouter de mot de passe. La connexion reste dans le panneau.

Remplacer la liste d'événements par votre recherche de contacts et vos écritures métier. Le kit conserve au plus 100 appels en mémoire, déduplique les mises à jour et efface la liste à la déconnexion ou au changement de phone. Il ne contient aucune synchronisation serveur, aucun historique complet, aucune télémétrie ni persistance CRM.

Garder une seule instance dans une zone persistante lors de la navigation. Réduire le téléphone ne le détruit pas. `destroy()` peut couper un appel : ne l'utiliser qu'après la fin des appels et la déconnexion.

Les valeurs externes sont affichées comme du texte. Préserver cette règle. Les erreurs de chargement, d'initialisation et de préparation sont affichées ; ne pas ajouter de boucle automatique de réessai.

## Validation et support

Appliquer la recette du guide : domaine et équipe, préparation sans appel automatique, entrant et sortant, permissions micro, audio, perte réseau, navigation et déconnexion. Tester sur le navigateur du client. L'arrière-plan mobile et l'écran verrouillé ne garantissent pas la sonnerie.

Pour le support, fournir l'origine, l'heure avec fuseau, le navigateur et les étapes, sans mot de passe, jeton, cookie ni export réseau brut.
