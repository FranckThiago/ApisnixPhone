# ApisnixPhone API

## Guide technique d'intégration client

**Édition 1.1 - 23 octobre 2026**

Intégrer un téléphone dans un CRM ou un site HTTPS, avec un accès individuel par phone et des événements exploitables par l'application cliente.

Ce guide s'adresse aux développeurs du CRM et à l'administrateur chargé de l'activation. Il décrit le SDK navigateur v1 de la version publiée le 23 octobre 2026.

**Service :** https://phone.apisnix-crm.com

**Module JavaScript :** https://phone.apisnix-crm.com/apisnix-embed.js

### Ce que vous pouvez réaliser

- Afficher le téléphone dans une zone de votre application.
- Permettre à chaque agent de se connecter avec son propre phone.
- Préparer le numéro d'un contact, puis laisser l'agent lancer l'appel.
- Réagir aux appels entrants, aux changements d'état et à la fin d'un appel.
- Associer les événements observés à une fiche CRM, selon vos règles métier.

### Composition du kit

Le PDF et sa source Markdown décrivent le contrat. Le dossier `exemple/` contient une page HTML, son JavaScript et sa feuille de style, sans dépendance de compilation. Son README explique l'installation et les limites.

Le kit ne contient aucun accès réel. Les identifiants et numéros des exemples sont fictifs et ne doivent pas servir à des appels de recette.

### Parcours de lecture

1. Périmètre et activation.
2. Installation et prise en main.
3. Référence SDK, états et événements d'appel.
4. Traitement CRM, sécurité et applications à navigation dynamique.
5. Diagnostic, recette et remise au client.

<!-- pagebreak -->

## 1. Périmètre et activation

### Le point d'entrée public

ApisnixPhone API est, dans cette version, un **SDK JavaScript avec une interface téléphonique embarquée dans une iframe**. Le CRM dialogue avec ce panneau. Ce n'est pas une API REST publique de création de lignes, de facturation ou d'export de données.

| Disponible dans le SDK v1 | Hors du contrat v1 |
| --- | --- |
| Montage du téléphone et suivi de son état | Création de phones, SSO ou connexion par clé API |
| Préparation d'un numéro | Appel automatique, réponse ou raccrochage depuis le CRM |
| Événements d'appel observés par le panneau | Webhooks et livraison durable au serveur CRM |
| Identifiant, sens, numéro, phase et dates d'appel | Export complet du journal, contacts, notes et qualifications |
| Issue d'appel lorsqu'elle est connue | Audio, enregistrements, DTMF et diagnostic SIP transmis au CRM |

Le journal, les contacts et les enregistrements éventuellement accessibles **dans le téléphone** ne deviennent pas des données accessibles au site parent. Les fonctions de la ligne restent soumises aux droits et services activés pour le client.

### Activation par l'administrateur APISNIX

1. Préparer une équipe cliente et lui affecter les phones concernés. Prévoir un accès distinct par agent.
2. Dans **Supervision > Administration > Intégrations CRM**, enregistrer l'origine HTTPS exacte et sélectionner cette équipe. Cette rubrique nécessite les droits de superadministrateur.
3. Autoriser le CRM, puis copier le code d'intégration. Aucun domaine n'est ouvert automatiquement.
4. Communiquer au développeur l'origine autorisée et aux agents leurs accès individuels par le canal convenu, séparément du code.

Une origine correspond au schéma et au nom d'hôte : `https://crm.exemple.fr`. Aucun chemin, paramètre, fragment, identifiant dans l'URL ou wildcard n'est accepté. Le port doit être le port HTTPS standard 443. `https://www.exemple.fr` et `https://crm.exemple.fr` sont deux origines différentes.

Une origine est associée à une équipe ; plusieurs origines peuvent partager une équipe. Préproduction et production doivent être autorisées séparément. Les équipes réservées ne sont pas proposées pour cette affectation.

### Suspension et changements

L'administrateur peut modifier ou suspendre une intégration. Une modification révoque ses sessions de données ; une suspension bloque les prochaines connexions. **Elle ne coupe pas une ligne SIP déjà enregistrée ni un appel en cours.** Déconnecter le téléphone ; pour une suspension immédiate de la ligne elle-même, demander l'intervention de l'administrateur APISNIX.

<!-- pagebreak -->

## 2. Installer le panneau

### Préparer le site

Utiliser une page HTTPS sur l'origine autorisée, un navigateur avec modules JavaScript et WebRTC, et une connexion autorisant le service téléphonique. Prévoir un microphone et une sortie audio pour les conversations. Le microphone doit être autorisé pour le téléphone embarqué.

Servir les fichiers du dossier `exemple/` depuis votre application. L'ouverture directe d'un fichier HTML ou d'un site localhost ne valide pas l'intégration de production : l'origine doit être autorisée. Le kit charge le service réel ; il ne simule pas les appels.

### Exemple minimal

Dans la page HTML, charger votre fichier JavaScript externe :

```html
<div id="telephone"></div>
<button id="preparer" type="button">Préparer l'appel</button>
<p id="message" role="status"></p>
<script type="module" src="./integration.js"></script>
```

Donner une hauteur au conteneur dans votre feuille de style, par exemple `width: 390px; max-width: 100%; height: 780px;`. Adapter les dimensions à la fenêtre et conserver le panneau utilisable sur petit écran.

Dans `integration.js` :

```js
import { createApisnixPhone } from
  'https://phone.apisnix-crm.com/apisnix-embed.js';

const phone = createApisnixPhone({
  container: document.querySelector('#telephone'),
  url: 'https://phone.apisnix-crm.com',
  // phone: '1001', // Préremplissage facultatif, jamais un secret.
  title: 'ApisnixPhone API',
  onEvent(event) {
    if (event.type === 'state') {
      document.querySelector('#preparer').disabled =
        !event.state.sessionOpen || event.state.inCall ||
        event.state.connection !== 'ready';
    }
  },
  onError() {
    document.querySelector('#message').textContent =
      'Téléphone indisponible : vérifier son chargement.';
  },
});
```

Ce fragment illustre le montage. Le kit contient la gestion complète du bouton, des erreurs, du chargement du module et des événements. Ne pas recopier uniquement ce fragment comme intégration complète.

### Première connexion

L'agent saisit l'identifiant et le mot de passe de son phone **dans le panneau ApisnixPhone**. Le serveur vérifie son appartenance à l'équipe autorisée pour le CRM. L'option `phone` facilite la saisie ; elle n'authentifie pas l'agent et ne limite pas à elle seule les droits.

<!-- pagebreak -->

## 3. Référence du SDK

### createApisnixPhone(options)

Monte une iframe et retourne un objet avec `prepareCall(number)`, `setContact(contact, callId?)` et `destroy()`. Appeler cette fonction une seule fois pour le panneau conservé pendant la session de travail.

| Option | Type et règle |
| --- | --- |
| `container` | Élément HTML existant, obligatoire. Il accueille l'iframe. |
| `url` | Origine du téléphone, obligatoire : `https://phone.apisnix-crm.com`. Ne pas ajouter `/embed` ou une query string. |
| `phone` | Chaîne facultative ; 1 à 100 caractères parmi lettres ASCII, chiffres, `_`, `.`, `-`. Identifiant public uniquement. |
| `title` | Titre accessible de l'iframe ; défaut : `ApisnixPhone`. |
| `onEvent` | Fonction recevant `ready`, `state`, `call` et `result`. |
| `onError` | Fonction recevant le code `handshake-timeout`. |

Une origine incorrecte provoque l'exception synchrone `invalid-phone-origin` ; un identifiant non conforme provoque `invalid-phone-id`. Un conteneur absent est une erreur d'intégration à détecter avant le montage.

### prepareCall(number): Promise

Prépare le numéro et affiche le clavier. **L'agent doit ensuite cliquer sur Appeler dans le téléphone.** Le résultat n'indique ni qu'un appel est lancé, ni qu'un correspondant a répondu.

| Résultat résolu | Action conseillée |
| --- | --- |
| `prepared` | Inviter l'agent à vérifier le numéro puis à appuyer sur Appeler. |
| `not-connected` | Attendre une session ouverte et `connection === 'ready'`. |
| `call-in-progress` | Attendre la fin des conversations en cours. |
| `invalid-number` | Corriger le numéro, sans réessai automatique. |

La chaîne d'entrée est limitée à 40 caractères. Les espaces, parenthèses, points et tirets de présentation sont retirés ; le résultat accepté est limité à 32 caractères. Chiffres, `*` et `#` sont acceptés ; un `+` initial est accepté seulement devant des chiffres. La validité syntaxique ne garantit pas que la destination est autorisée ou joignable.

Privilégier un numéro international explicite pour les contacts. Le téléphone applique son plan de numérotation : `+33` devient `0033`, et le `+` des autres indicatifs est retiré. Les zéros nationaux sont conservés. Le préfixe APISNIX `633` suivi de neuf chiffres est converti en `33` suivi de ces chiffres. Ne pas inventer une règle de numérotation côté CRM.

### Rejets de la promesse

`phone-not-ready` : panneau non prêt ou déjà détruit. `phone-reloaded` : document rechargé pendant la demande. `command-timeout` : absence de résultat après 5 secondes. `phone-destroyed` : demande interrompue par `destroy()`. Utiliser `try/catch`, informer l'agent et vérifier l'état avant une nouvelle action ; ne pas supposer qu'une commande expirée n'a jamais été traitée.

### destroy(): void

Retire le panneau et ses écouteurs, et rejette les demandes en attente. Cette action peut couper la ligne et l'appel. Attendre la fin des appels et la déconnexion de l'agent avant de démonter. Pour réduire le panneau, conserver l'iframe montée.

<!-- pagebreak -->

## 4. Événements de disponibilité

### ready

```js
{ type: 'ready' }
```

Le canal entre le CRM et le panneau est prêt. **Ce n'est pas une confirmation de connexion de la ligne.** Un nouveau `ready` peut être reçu après un rechargement de l'iframe. Attendre ensuite l'état approprié avant d'activer les commandes.

### state

```js
{
  type: 'state',
  state: {
    connection: 'ready',
    phone: '1001',
    sessionOpen: true,
    demo: false,
    inCall: false
  }
}
```

| Champ | Signification |
| --- | --- |
| `connection` | Chaîne décrivant la connexion téléphonique, valeurs ci-dessous. |
| `phone` | Identifiant de la ligne ; `null` avant ouverture de session. |
| `sessionOpen` | Session téléphonique ouverte dans le panneau. |
| `demo` | Vrai pour une démonstration ; faux pour le service réel. |
| `inCall` | Vrai lorsqu'une conversation n'est pas terminée, y compris sonnerie ou attente. Prend en compte la seconde conversation lorsqu'elle existe. |

| Valeur actuelle de connection | Interprétation |
| --- | --- |
| `offline` | Ligne déconnectée. |
| `connecting`, `registering` | Connexion ou enregistrement en cours. |
| `ready` | Ligne enregistrée et prête. |
| `reconnecting` | Tentative de rétablissement. |
| `auth-error` | Authentification téléphonique refusée. |
| `network-error` | Erreur de connexion réseau. |
| `other-tab-active` | Un autre onglet détient la session active. |
| `blocked` | Connexions temporairement bloquées après des refus répétés. |

Activer la préparation d'appel lorsque `sessionOpen && connection === 'ready' && !inCall`. Le serveur et le téléphone restent décisionnaires au moment de la commande. Ces champs ne garantissent pas la disponibilité du journal, des enregistrements ou d'un relais média.

### result et erreurs d'initialisation

`{ type: 'result', requestId: '...', code: 'prepared' }` correspond au résultat d'une commande. Le SDK résout déjà la promesse `prepareCall` : ne pas déclencher deux fois votre traitement métier dans la promesse et dans `onEvent`.

`onError('handshake-timeout')` signale l'absence d'initialisation après 12 secondes. Ce délai est relancé après chargement de l'iframe. Ce signal ne couvre pas toutes les erreurs réseau ou téléphoniques : utiliser aussi `state` et les indications du panneau. Une réponse tardive peut encore produire `ready` ; rétablir alors l'affichage selon les événements reçus.

<!-- pagebreak -->

## 5. Événements d'appel

### call

```js
{
  type: 'call',
  call: {
    id: 'identifiant-exemple',
    direction: 'inbound',
    number: '+33100000001',
    phase: 'ended',
    startedAt: 1792742400000,
    answeredAt: 1792742405000,
    endedAt: 1792742435000,
    outcome: 'answered'
  }
}
```

Exemple fictif : les dates sont des nombres en **millisecondes depuis l'époque Unix**, pas des secondes. Utiliser `new Date(value)` pour les afficher dans le fuseau choisi par votre CRM.

| Champ | Contrat |
| --- | --- |
| `id` | Chaîne identifiant l'appel observé ; clé de rapprochement des mises à jour de cet appel. Pas une clé garantie de l'historique serveur. |
| `direction` | `inbound` ou `outbound`. |
| `number` | Chaîne portant la destination composée ou l'identité appelante reçue. Pas nécessairement au format E.164. |
| `phase` | Phase de l'appel ; valeurs ci-dessous. |
| `startedAt` | Date de début d'observation de l'appel. Obligatoire. |
| `answeredAt` | Date de réponse, facultative. |
| `endedAt` | Date de fin, facultative. |
| `outcome` | Issue, facultative et seulement lorsqu'elle est connue. |

### Phases actuelles

`dialing` : lancement sortant. `ringing-out` : sonnerie distante. `ringing-in` : appel entrant. `active` : conversation établie. `held` : conversation en attente. `ending` : fin demandée. `ended` : terminé.

Un sortant peut suivre `dialing > ringing-out > active > ended`, et un entrant `ringing-in > active > ended`. Ce sont des exemples, pas une séquence obligatoire : une phase peut manquer et plusieurs appels peuvent évoluer en parallèle. Suivre chaque `id` séparément.

### Issues actuelles

`answered` : répondu. `no-answer` : sans réponse. `busy` : occupé. `failed` : échec. `cancelled` : annulé. `declined` : refusé. `missed` : manqué. `unknown` : issue indéterminée.

Ne pas attribuer une issue lorsqu'elle manque. Une durée de conversation ne se calcule que si `answeredAt` et `endedAt` sont connus : `Math.max(0, endedAt - answeredAt) / 1000`. Cette mesure du navigateur n'est pas une donnée de facturation ni une durée garantie de parole effective ; elle peut inclure une mise en attente.

<!-- pagebreak -->

## 6. Exploiter les événements dans le CRM

### Ouvrir une fiche contact

À réception d'un appel entrant en `ringing-in`, rechercher le numéro dans le CRM. Présenter les correspondances ; en cas de doublon ou d'ambiguïté, laisser l'agent choisir. Éviter d'ouvrir de nouveau la fiche à chaque changement d'état du même appel.

Ne pas comparer uniquement les derniers chiffres. Conserver la valeur d'origine et normaliser selon les pays explicitement connus de votre référentiel. Les numéros reçus peuvent être nationaux, internationaux, internes, incomplets ou non numériques. L'identité appelante est une information non fiable pour authentifier une personne.

### Mettre à jour une activité

```js
const calls = new Map();

function receiveCall(call) {
  const previous = calls.get(call.id);
  if (JSON.stringify(previous) === JSON.stringify(call)) return;
  calls.set(call.id, call);
  // Mettre à jour la même activité CRM, sans la dupliquer.
  // Afficher les champs avec textContent ou le rendu texte du framework.
  if (call.phase === 'ended') {
    // Enregistrer les champs connus via votre propre backend authentifié.
    // Votre backend doit rendre cette écriture idempotente.
  }
}
```

Ce fragment explique la déduplication en mémoire, pas une persistance complète. Borner le cache dans une application de longue durée. Le kit conserve au maximum 100 événements d'appel distincts en mémoire et n'enregistre aucune donnée sur un serveur CRM.

Si vous persistez des activités, associer l'identifiant d'appel à votre contexte d'intégration, d'agent et de session. Ne pas supposer une unicité globale ou une correspondance directe avec un enregistrement serveur APISNIX. Protéger votre endpoint CRM par vos contrôles habituels d'authentification, d'autorisation et de validation ; les événements du navigateur ne sont pas des attestations signées.

### Disponibilité et rattrapage

Les événements décrivent les appels observés par ce panneau lorsqu'il est ouvert. Ils ne sont ni des webhooks, ni une file de messages persistante. Ne pas supposer une livraison exactement une fois, une réception de toutes les phases ou un rattrapage après fermeture du CRM.

Le journal **du téléphone** peut récupérer des appels manqués à la reconnexion ; cette récupération ne produit pas un export historique équivalent vers le CRM. Un besoin de synchronisation exhaustive, de statistiques certifiées ou d'enregistrement serveur doit faire l'objet d'une interface supplémentaire avec APISNIX.

### Compatibilité

Le protocole est `apisnixphone.embed.v1`. Utiliser le SDK officiel plutôt que des messages `postMessage` fabriqués manuellement. Il contrôle l'origine, la fenêtre source, le protocole et le canal. Les propriétés techniques d'enveloppe ne sont pas des données métier à persister.

Les types `connection`, `direction`, `phase` et `outcome` sont des chaînes. Prévoir une valeur inconnue affichable et ignorer les champs supplémentaires pour rester compatible avec des évolutions additives. L'URL du module pointe sur la release publiée ; elle n'est pas une version immuable. Refaire la recette lors des évolutions annoncées.

<!-- pagebreak -->

## 7. Sécurité et politiques du site hôte

### Séparer les accès du CRM et du téléphone

Les accès phone sont saisis dans l'iframe du domaine APISNIX. Ne jamais les placer dans le code, une URL, une variable publique de build, un stockage du CRM, des journaux, un outil d'analyse ou une capture de support. L'identifiant public facultatif `phone` ne remplace pas le mot de passe.

Le canal SDK ne transmet ni mot de passe ni jeton de session. Les API utilisées à l'intérieur du téléphone restent privées au service : ne pas les appeler directement depuis votre backend ou le navigateur CRM. Aucun secret administrateur n'est requis par cette intégration.

Une autorisation d'origine couvre toutes les pages de cette origine, pas un chemin précis. Le client doit maîtriser les scripts exécutés sur son CRM, y compris ceux de ses prestataires. Un script du CRM peut lire les événements confiés au CRM.

### Content-Security-Policy du CRM

Ajouter l'origine du téléphone aux directives concernées de votre politique existante. Exemple partiel à fusionner, **pas un remplacement de votre politique complète** :

```text
script-src 'self' https://phone.apisnix-crm.com;
frame-src https://phone.apisnix-crm.com;
```

Si votre politique définit `script-src-elem`, des nonces, des hashes ou `strict-dynamic`, adapter également ces règles à votre mécanisme de chargement. Les fichiers du kit évitent les scripts et styles inline. Le SDK importe ses modules associés depuis le domaine APISNIX.

Ne pas ajouter de wildcard, de `unsafe-inline` ou désactiver la CSP pour faire fonctionner le panneau. Un simple ajout peut être insuffisant avec des politiques multiples : toutes les politiques effectives doivent permettre les ressources nécessaires.

### Permissions-Policy et microphone

Le SDK pose l'attribut `allow` sur l'iframe. Si le CRM restreint ces permissions au niveau HTTP, les autoriser également dans son en-tête, par exemple :

```text
Permissions-Policy: microphone=(self "https://phone.apisnix-crm.com"),
 autoplay=(self "https://phone.apisnix-crm.com")
```

Cet exemple est un seul en-tête HTTP, présenté sur deux lignes pour la lecture. Fusionner avec vos autres directives. L'agent doit toujours donner les autorisations demandées par le navigateur. Ne pas ajouter un attribut `sandbox` restrictif sans une recette spécifique ; il peut empêcher les scripts, l'origine ou les permissions attendues.

Le téléphone autorise l'encadrement de `/embed` seulement pour les intégrations actives. Le SDK construit cette route : ne pas encadrer la page d'accueil à sa place. Si le CRM est lui-même dans une iframe, chaque ancêtre peut ajouter des restrictions ; le kit est prévu pour une page CRM principale et les montages imbriqués nécessitent une validation dédiée.

<!-- pagebreak -->

## 8. Sessions, données et environnement

### Session individuelle

Le panneau utilise une session de données limitée à la ligne, conservée en mémoire et valable au maximum 8 heures. Elle ne dépend pas des cookies tiers du CRM. Le CRM n'a pas à récupérer ni renouveler son jeton. Un rechargement de l'iframe exige une nouvelle connexion ; à expiration, rouvrir la session dans le téléphone.

La connexion téléphonique et la session des données sont distinctes. Une session de données expirée ou révoquée ne garantit pas l'arrêt immédiat de SIP. Les états SDK décrivent la téléphonie ; consulter aussi les messages dans le panneau pour le journal et les autres données.

L'ouverture de la même ligne ailleurs peut reprendre sa connexion. Utiliser un phone par agent, éviter plusieurs panneaux pour le même accès et organiser les changements de poste après déconnexion.

### Données confiées au CRM

| Donnée | Transmise par le SDK |
| --- | --- |
| Identifiant du phone connecté et état téléphonique | Oui, dans `state`. |
| Numéro, sens, phases, dates et issue connue de l'appel observé | Oui, dans `call`. |
| Mot de passe, jeton ou secret SIP | Non. |
| Historique complet et appels manqués récupérés du serveur | Non. |
| Contacts, noms privés, notes, qualifications, rappels | Non. |
| Audio, enregistrements et DTMF | Non. |

Les numéros et événements d'appel peuvent constituer des données personnelles. Définir les accès CRM, l'information des utilisateurs, les champs conservés, la durée de conservation et les modalités d'effacement selon votre contexte. Désactiver la capture de ces données dans les outils d'analyse ou de replay non nécessaires. Le kit n'ajoute aucun stockage persistant ni télémétrie côté CRM.

### Réseau et audio

Le site doit pouvoir charger le service HTTPS et permettre la signalisation et le média WebRTC gérés par le téléphone. Un iframe visible ne prouve pas que le réseau laisse passer les appels. En réseau filtré, demander à APISNIX les exigences applicables à votre configuration ; ne pas ouvrir des ports au hasard. La disponibilité d'un relais média dépend de la ligne et de l'environnement.

Valider le navigateur réellement utilisé, ses restrictions d'entreprise, les autorisations système, le casque et la sortie audio. Une interaction de l'agent peut être nécessaire pour autoriser le son. Une sonnerie seule ne prouve pas que le microphone fonctionne pour une conversation.

### Téléphone mobile et arrière-plan

Cette intégration web ne garantit pas la sonnerie ou le maintien du téléphone lorsque l'écran est verrouillé, que le navigateur est suspendu ou que l'application passe en arrière-plan. Ne pas la présenter comme une application native avec notifications push. Tester le comportement mobile réel avant de proposer ce mode d'utilisation au client.

<!-- pagebreak -->

## 9. Intégration dans une application dynamique

### Conserver le panneau pendant la navigation

Installer le conteneur dans la structure persistante de l'application, hors des pages qui sont remplacées lors d'un changement de contact ou de route. Garder une seule instance du SDK. Réduire visuellement le panneau conserve l'iframe et sa session ; la détruire ou changer sa clé de composant ne les conserve pas.

Éviter de modifier `src`, `url` ou `phone` à chaque changement de fiche. L'option `phone` est un préremplissage initial. Pour changer d'accès, terminer les appels, se déconnecter puis reconstruire le panneau si nécessaire.

### Exemple de montage dans React

Extrait JavaScript à placer dans un composant persistant, avec la feuille de style du kit. L'import doit rester une URL distante au moment de l'exécution ; l'exemple comporte l'indication adaptée à Vite.

```jsx
import { useEffect, useRef } from 'react';

const SDK_URL = 'https://phone.apisnix-crm.com/apisnix-embed.js';

export function PhonePanel() {
  const container = useRef(null);
  const instance = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function mount() {
      try {
        const { createApisnixPhone } = await import(
          /* @vite-ignore */ SDK_URL
        );
        if (cancelled || !container.current) return;
        instance.current = createApisnixPhone({
          container: container.current,
          url: 'https://phone.apisnix-crm.com',
          onEvent(event) { /* Transmettre au store CRM. */ },
          onError(code) { /* Afficher une erreur à l'agent. */ },
        });
      } catch {
        if (!cancelled && container.current) {
          container.current.textContent = 'Chargement impossible';
        }
      }
    }
    void mount();
    return () => {
      cancelled = true;
      instance.current?.destroy();
      instance.current = null;
    };
  }, []);

  return <div ref={container} className="phone-panel" />;
}
```

Le nettoyage évite les instances et écouteurs orphelins ; **il coupe le téléphone au démontage**. Le routeur doit donc empêcher ce démontage pendant une conversation, ou demander à l'agent de la terminer avant de quitter. Le garde `cancelled` évite qu'un import asynchrone remonte un panneau déjà fermé.

Avec un autre bundler, adapter le chargement distant sans recopier uniquement le fichier d'entrée : le SDK dépend de modules associés. Ne pas intégrer un mot de passe ou une commande d'authentification dans le composant. Le SDK ne propose pas de méthode de déconnexion : l'agent utilise celle du téléphone.

<!-- pagebreak -->

## 10. Diagnostic

| Symptôme | Vérification et correction |
| --- | --- |
| Zone vide ou hauteur nulle | Vérifier l'existence du conteneur et sa hauteur CSS. Vérifier le chargement du JavaScript. |
| Échec d'import du SDK | Vérifier l'URL officielle, les modules associés, la CSP du CRM et l'accès réseau. Ne pas recopier seulement le fichier d'entrée. |
| Refus d'encadrement dans la console | Vérifier l'origine exacte autorisée et active, la route `/embed`, `frame-src` côté CRM et l'absence d'un ancêtre bloquant. |
| Attente de connexion au CRM ou `handshake-timeout` | Vérifier l'autorisation du domaine et le chargement du service. Le code doit monter le SDK, pas seulement créer une iframe. |
| Identifiants refusés | Vérifier le phone, ses accès et son affectation à l'équipe du domaine. Éviter les essais répétés qui peuvent entraîner un blocage. |
| `phone-not-ready` | Attendre `ready` puis l'état de ligne ; vérifier que l'instance n'a pas été détruite. |
| `not-connected` | Ouvrir la session puis attendre `connection === 'ready'`. |
| `call-in-progress` | Terminer les conversations actives ou en attente. Ne pas lancer une boucle de réessais. |
| `invalid-number` | Vérifier le type chaîne, la longueur et les caractères. Ne pas passer de lien `tel:` ou d'URI SIP. |
| `phone-reloaded` / `phone-destroyed` | Vérifier le routeur, les changements de clé et le cycle de vie du panneau. |
| `command-timeout` | Vérifier la disponibilité du panneau et son contenu avant une nouvelle action manuelle. |
| Microphone indisponible | Vérifier HTTPS, Permissions-Policy, attribut `allow`, permissions navigateur/système et matériel. |
| Appel établi sans son | Vérifier sortie audio, volume, éventuel blocage de lecture et réseau WebRTC. Faire un essai dans les deux sens. |
| Ligne reprise ou `other-tab-active` | Fermer la session concurrente ; attribuer des phones distincts aux agents. |
| Journal indisponible alors que la ligne paraît prête | Vérifier le message du panneau et la session de données ; la rouvrir après expiration ou révocation. |
| Aucun événement pour un ancien appel | Comportement attendu : le SDK n'exporte pas l'historique serveur. |

### Informations utiles au support

Transmettre l'origine exacte du CRM, l'heure et le fuseau du problème, le navigateur et sa version, le système, les étapes de reproduction et le code d'erreur non sensible. Indiquer si le problème concerne le chargement, la connexion, la préparation ou l'audio.

Fournir l'identifiant du phone uniquement au support habilité. Masquer les numéros de tiers dans les captures. Ne jamais joindre mot de passe, jeton, cookie, en-tête Authorization ou export réseau brut ; ces éléments peuvent contenir des secrets et des données clients.

<!-- pagebreak -->

## 11. Recette avant ouverture aux agents

Effectuer ces essais sur l'origine de préproduction autorisée, puis refaire les points essentiels sur le CRM de production. Utiliser des phones de test et des correspondants explicitement convenus ; le kit ne lance aucun appel automatiquement.

| Contrôle | Résultat attendu |
| --- | --- |
| Domaine autorisé | Le panneau charge, `ready` puis `state` sont reçus. |
| Origine non autorisée | Le panneau ne permet pas d'ouvrir une session. |
| Phone de l'équipe | Authentification permise et ligne prête. |
| Phone d'une autre équipe | Authentification intégrée refusée. Coordonner ce test avec APISNIX. |
| Préparation de numéro | Le numéro est affiché ; aucun appel avant le clic de l'agent. |
| Numéro invalide | Retour `invalid-number`, sans appel. |
| Sortant vers destination convenue | Phases et fin reçues ; vérifier l'audio réel dans les deux sens et l'issue. |
| Entrant décroché | `ringing-in`, conversation et fin observées ; fiche CRM correcte. |
| Entrant non décroché | Issue manquée lorsqu'elle est connue ; activité non dupliquée. |
| Navigation CRM et réduction du panneau | Même instance, ligne et conversation conservées. |
| Rechargement volontaire hors appel | Nouvelle connexion demandée ; erreurs de demandes en attente gérées. |
| Perte réseau puis retour | États de récupération et commandes désactivées pendant l'indisponibilité. |
| Autorisation micro refusée | Message compréhensible et possibilité de corriger les permissions. |
| Déconnexion et nouvelle connexion | Ancienne session de données inutilisable ; nouveau contexte affiché. |
| Événement répété / champ inconnu | Pas de doublon d'activité et pas de panne du CRM. |
| Petit écran / clavier / lecteurs d'écran | Contrôles accessibles, panneau utilisable, statuts compréhensibles. |

### Critères de livraison

Consigner la date, le domaine, le navigateur, le matériel audio et les résultats. Valider les appels entrants et sortants avec les routes réellement utilisées par le client. Une conversation interne ne certifie pas une route opérateur externe.

Les essais de référence APISNIX de cette édition ont vérifié l'intégration HTTPS entre deux sites, les appels internes entrants et sortants avec média synthétique bidirectionnel, ainsi que l'isolation des données par ligne. Ils ne remplacent pas les essais du microphone physique, du réseau, du navigateur mobile ou des routes opérateur du client.

L'utilisation écran verrouillé ou navigateur suspendu n'est pas un critère garanti par cette version. Si elle est indispensable au client, convenir d'une solution distincte avant l'ouverture du service.

<!-- pagebreak -->

## 12. Remise et maintenance de l'intégration

### Informations à réunir

- Origines HTTPS exactes de préproduction et de production.
- Équipe cliente à autoriser et liste des agents avec leurs phones affectés.
- Responsable technique du CRM et interlocuteur APISNIX.
- Navigateurs, matériel audio et contraintes réseau à couvrir.
- Comportement souhaité à l'appel entrant et règles de rapprochement des contacts.
- Données d'appel conservées dans le CRM et politique de conservation.
- Résultats de recette et date prévue d'ouverture aux agents.

Les accès individuels sont remis séparément. Ni le guide, ni le kit, ni le code copié depuis l'administration ne doivent contenir les mots de passe des agents.

### Contenu du dossier exemple

`index.html` : formulaire de préparation, messages de statut, conteneur du téléphone et liste des appels observés.

`integration.js` : chargement du SDK officiel, montage unique, traitement des états et résultats, affichage des appels par identifiant, réduction du panneau sans destruction.

`style.css` : disposition adaptable à la largeur disponible, taille du panneau et présentation des contrôles.

`README.md` : installation, recette et adaptations attendues. Ce kit constitue un point de départ : la recherche de contacts, les écritures dans votre backend et les règles d'accès CRM restent à développer dans votre application.

### Gestion des évolutions

Conserver votre propre code d'intégration dans votre dépôt, avec sa recette. Lors d'une évolution du CRM, vérifier particulièrement le routeur, la CSP, la Permissions-Policy et les scripts de sécurité ou de mesure qui pourraient interagir avec le panneau.

Utiliser l'URL officielle du SDK. Ne pas maintenir une copie isolée de `apisnix-embed.js` sans ses modules et une procédure de mise à jour convenue. Le contrat décrit ici porte sur la version v1 ; une extension REST, un SSO, des webhooks ou des commandes supplémentaires doivent être documentés séparément avant utilisation.

### Références de cette édition

Guide fondé sur les exports publics du SDK et les projections d'événements de la release du 23 octobre 2026 : `client.ts`, `protocol.ts`, `state.ts`, les types téléphoniques et les règles de validation du numéro. Il décrit les fonctions disponibles, leurs limites et les contrôles attendus pour une intégration cliente.

**Nom de la solution intégrée : ApisnixPhone API.** Le téléphone ouvert seul reste identifié comme ApisnixPhone Web dans la supervision. L'utilisation du panneau ne change pas les droits de la ligne.

**Fin du guide - édition 1.0.**

<!-- pagebreak -->

## 9. Fiche client fournie par le CRM — extension 1.1

Le SDK expose aussi `setContact(contact, callId?)`. Cette commande remplace la
fiche affichée dans le téléphone ; elle ne crée pas un contact enregistré.
L’agent doit être connecté. Le CRM ne reçoit aucune fiche du téléphone en retour.

| Champ | Limite en caractères |
| --- | --- |
| `firstName`, `lastName` | 100 chacun |
| `phone` | 40 |
| `email` | 254 |
| `company` | 200 |
| `address` | 400 |
| `city` | 120 |
| `country` | 100 |
| `id` (facultatif, référence CRM) | 100 |
| `notes` (facultatif) | 2 000 |

Tous les champs sont des chaînes facultatives. Les huit rubriques principales
restent visibles dans la fiche dépliée ; une valeur absente affiche un tiret.
Aucun HTML n’est interprété. Les champs inconnus sont refusés. Limiter les données
à celles utiles à l’agent ; ne jamais transmettre de mots de passe dans la fiche.

```js
const result = await phone.setContact({
  id: 'crm-123', firstName: 'Camille', lastName: 'Martin',
  phone: '+33100000001', email: 'camille@example.invalid',
  company: 'Atelier Lumen', address: '12 rue des Exemples',
  city: 'Paris', country: 'France', notes: 'Fiche fictive de démonstration',
}, currentCallId);
```

Pendant un appel, `currentCallId` doit être l’`id` du dernier événement `call`
correspondant à l’appel principal. Un résultat de recherche CRM arrivé après le
changement d’appel est refusé (`stale-call`). Sans appel, omettre cet argument.
Effacer explicitement avec `phone.setContact(null, currentCallId)`. À chaque
changement d’appel ou déconnexion, le panneau retire la fiche précédente.
L’application CRM doit renvoyer la fiche lorsqu’elle reçoit le nouvel appel.

Résultats : `contact-updated`, `invalid-contact`, `stale-call`, `not-connected`.
Les mêmes rejets de promesse que `prepareCall` s’appliquent (chargement, expiration,
rechargement ou destruction). Le traitement demeure uniquement en mémoire de
l’iframe : ni journal, stockage navigateur, enregistrement audio, ni HTTP.

### Pilote de conférence VICIdial — périmètre séparé

L’option expérimentale `mode: 'conference'` affiche le panneau de conférence.
VICIdial reste responsable des appels clients automatiques et manuels, de leur
raccrochage et qualification. `prepareCall` y retourne `call-in-progress`.
L’agent répond explicitement à l’invitation de conférence ; aucun décrochage
automatique d’invitation inconnue n’est ajouté. La conférence n’est pas enregistrée
par le panneau comme un appel client dans son Journal.

Les événements `call` concernent alors **la session audio agent**, pas les appels
prospects. Un même identifiant de conférence peut couvrir plusieurs fiches CRM.
Le CRM doit remplacer/effacer leur contexte au changement de client. Un contrôle
périodique déclenche `onError('heartbeat-timeout')` après plus de cinq secondes
sans réponse, au prochain contrôle d’une seconde, ou lors du rechargement de
l’iframe. Le CRM doit demander la pause native et vérifier son état serveur.
Un navigateur suspendu peut retarder ce contrôle : il ne remplace pas une
surveillance serveur. Une reconnexion ne rend pas l’agent disponible automatiquement.

Ce mode reste un pilote isolé, sans engagement de compatibilité générale, SSO,
transfert ou écoute. La recette réelle et ses limites sont consignées dans
`docs/VICIDIAL_PILOT.md` avant toute remise commerciale.
