# Numérotation Android sans indicatif automatique

## Comportement attendu

ApisnixPhone transmet les chiffres saisis au serveur SIP, indépendamment du
pays du réseau mobile. Un numéro national commençant par `0`, un préfixe
explicite `00`, un numéro déjà international `+…` ou une extension interne ne
doit pas recevoir un indicatif déduit de la carte SIM.

Le serveur conserve la responsabilité du routage. La suppression habituelle
des espaces de présentation par le moteur n'est pas une réécriture d'indicatif.

## Défaut signalé et cause

Le 16 septembre 2026, Franck signale qu'un numéro commençant par `07` est
transformé en `+237…`. Ne pas inscrire son numéro réel dans le dépôt public.

Le formulaire SIP tiers amont lit `TelephonyManager.networkCountryIso`, trouve
le plan de numérotation correspondant et enregistre son préfixe dans le compte.
L'option `useInternationalPrefixForCallsAndChats` est activée par défaut dans
le moteur. Le clavier et les suggestions utilisent ensuite cette option.

## Correction livrée dans 6.2.7-apisnix.3

- Suppression de la détection automatique du pays dans
  `ThirdPartySipAccountLoginFragment`.
- Nouveaux comptes SIP tiers :
  `AccountParams.useInternationalPrefixForCallsAndChats = false`.
- Comptes déjà enregistrés : `CoreContext.onCoreStarted` désactive cette
  option une fois si la version de configuration est inférieure à `602008`.
  Le traitement intervient après démarrage du moteur, avant les gestionnaires
  de contacts ; la version de configuration est ensuite enregistrée.
- Identifiants, mots de passe, domaines, transports et historique conservés.
  L'indicatif déjà stocké peut rester visible dans le profil ; il n'est plus
  appliqué aux appels. L'option reste accessible pour un choix explicite futur,
  qui ne sera pas annulé à chaque ouverture.
- `versionCode` passe de `602007` à `602008`. Identifiant Android et certificat
  de signature restent identiques : installation en mise à jour du pilote `.2`.

Les adaptations sont dans `patches/android.patch`. Aucun changement Asterisk.

## Installation et vérifications

Installer le nouvel APK par-dessus l'ancien, **sans désinstaller ni effacer les
données**. Ouvrir l'application, attendre l'enregistrement SIP et retaper le
numéro au clavier. Un ancien journal contenant déjà `+237…` conserve ce numéro ;
ne pas utiliser son bouton de rappel pour vérifier la correction.

Compilation Kotlin/Java et assemblage réussis, signature APK v2 vérifiée,
certificat comparé au pilote `.2`, manifeste et architectures ARM contrôlés.
Le patch exporté passe le contrôle inverse d'application. Aucun téléphone ni
émulateur Android connecté : le nouvel appel réel et la migration sur appareil
restent à confirmer par Franck.

À tester avec des destinations de test autorisées :

1. Après mise à jour, le numéro national garde son zéro et aucun `+237` n'apparaît.
2. Même comportement après redémarrage et avec un nouveau compte.
3. Un numéro saisi avec `+` ou `00` et une extension restent tels que saisis.
4. Audio et raccrochage fonctionnent comme sur le pilote précédent.
5. Un choix explicite ultérieur de l'option reste conservé au redémarrage.

Sur l'ancien APK, le réglage immédiat équivalent est dans **Paramètres de
compte → Formater les numéros en utilisant l'indicatif international** :
désactiver cette option puis enregistrer les paramètres.

Le fichier, sa taille et son empreinte font référence dans
[OPERATIONS.md](OPERATIONS.md).
