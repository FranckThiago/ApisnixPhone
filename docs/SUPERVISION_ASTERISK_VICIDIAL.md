# Supervision APISNIX — étude de faisabilité

Recherche et audit du 15 septembre 2026, suivis d'un correctif d'enregistrement
sur un poste pilote, puis de l'affectation autorisée de 26 postes le
16 septembre après validation du pilote. Aucun collecteur ni tableau de bord
n'était installé à cette étape historique.

**Reprise actuelle :** la supervision a depuis été réalisée dans le dépôt
privé `FranckThiago/Gestion_CRM-APISNIX`. Lire son `AGENTS.md` et
`docs/SUPERVISION_TECHNIQUE.md` pour l'implémentation et l'exploitation.
Le présent document conserve la recherche initiale, pas l'état du déploiement.

## Besoin confirmé

Afficher, pour les comptes SIP créés dans `phones`, le statut technique
connecté/déconnecté et en appel, le journal, le nombre d'appels et les
enregistrements avec écoute et téléchargement. Aucune déduction de présence
humaine. Chaque superviseur ne voit que les postes de son équipe.

L'installation VICIdial existante doit être préservée. Si l'ajout ne peut pas
être suffisamment isolé et validé, différer cette partie. Le softphone reste
indépendant de cette extension de périmètre.

## Ce que les sources établissent

### Appels directs et enregistrements des phones

Dans le fil [phone extension recording, 2012–2014](https://www.vicidial.org/VICIDIALforum/viewtopic.php?t=23007),
Michael Cargile, directeur technique du ViciDial Group, décrit le choix de
`defaultlog` dans **Phone Context** et le lien **Click here for phone call
recordings** en bas de la fiche du poste. Matt Florell confirme l'utilisation
de cette fonction chez plusieurs clients. Ce sont des témoignages de l'équipe
du produit, pas une vérification de la configuration APISNIX.

Le fil contient aussi des échecs d'affichage des fichiers et des échanges sur
les scripts de déplacement/mixage/compression. Un fichier peut n'apparaître
qu'après traitement. Ne pas reprendre les modifications de cron proposées
pour ces anciennes installations sans audit de la chaîne actuelle.

Un [retour de 2020 sur ViciBox 9.0.2](https://www.vicidial.org/VICIDIALforum/viewtopic.php?t=40138)
reprend cette méthode pour des appels lancés directement depuis le softphone.
Ces retours anciens indiquent une piste native ; ils ne garantissent pas le
routage, l'enregistrement des deux sens ou la compatibilité de la version installée.

Pour un Asterisk sans cette intégration, [MixMonitor](https://docs.asterisk.org/Asterisk_20_Documentation/API_Documentation/Dialplan_Applications/MixMonitor/)
permet l'enregistrement audio. Son placement dans le parcours d'appel, les
permissions des fichiers et la finalisation doivent être validés. Ne pas
activer un enregistrement global sur tous les appels ou tous les trunks.

### Visibilité des softphones sans session agent VICIdial

Le fil [Vicidial Registered Phones, juillet 2022](https://www.vicidial.org/VICIDIALforum/viewtopic.php?t=41401)
présente un tableau listant les appareils avec `sip show peers`, indépendamment
d'une connexion à l'écran agent. Il référence le projet de son auteur
[bbakirtas/vici-phone-list](https://github.com/bbakirtas/vici-phone-list).

Le README consulté vise VICIdial 2.14-859a, suppose des extensions de quatre
caractères et propose une exécution privilégiée depuis la page PHP. Ce projet
constitue une démonstration de faisabilité ; ne pas l'installer tel quel ni le
présenter comme une solution auditée ou prête pour APISNIX. Aucune réutilisation
de son code n'est décidée.

L'[interface AMI officielle](https://docs.asterisk.org/Configuration/Interfaces/Asterisk-Manager-Interface-AMI/The-Asterisk-Manager-TCP-IP-API/)
permet de recevoir des événements et d'observer les canaux. Le détail dépend
du pilote SIP et de sa configuration. Un collecteur doit combiner un état
initial, les événements, puis une resynchronisation après déconnexion.
Les permissions AMI distinguent événements et actions : une observation peut
nécessiter des actions de consultation, sans autoriser le contrôle des appels.

## Architecture proposée, non implémentée

- Tableau de bord et base APISNIX séparés du serveur de téléphonie.
- Collecteur AMI limité aux états nécessaires, sans lancement ni interruption
  d'appel. Adaptation à chan_sip ou PJSIP après identification de la version.
- Lecture incrémentale des journaux disponibles, sans altération du schéma
  VICIdial ni requêtes lourdes répétées par chaque navigateur.
- Association serveur + extension à une équipe et un superviseur.
- Corrélation des appels et des fichiers par identifiants techniques. Les
  [CDR Asterisk](https://docs.asterisk.org/Configuration/Reporting/Call-Detail-Records-CDR/CDR-Specification/)
  peuvent contenir plusieurs lignes par appel ; ne pas les compter naïvement.
- Écoute/téléchargement authentifiés, contrôle d'équipe côté serveur à chaque
  requête, et état « en cours de traitement » avant disponibilité du fichier.
- Les comptes SIP seuls ne permettent pas cette collecte ; un accès serveur
  limité sera nécessaire après définition et validation du périmètre.

## Conditions avant tout essai serveur

1. Audit en lecture : versions Asterisk/VICIdial, nombre de serveurs et d'appels
   simultanés, pilote SIP, contexte d'un poste concerné, définition réelle de
   `defaultlog`, journaux disponibles et traitement des enregistrements.
2. Vérifier sauvegardes, charge CPU, espace disque et retour à la configuration
   précédente. L'enregistrement et la compression ajoutent une charge réelle.
3. Préférer l'enregistrement natif existant, testé sur une extension dédiée.
   Ne pas remplacer aveuglément un contexte personnalisé par `defaultlog`.
4. Contrôler routage, audio dans les deux sens, fichier final, attribution au
   bon poste, et fonctionnement inchangé d'un appel de campagne témoin.
5. Élargir seulement après validation. Si une modification globale ou une
   interruption de service est nécessaire, différer et revoir l'isolation.

## Audit serveur autorisé

Après l'étude, Franck a autorisé une inspection SSH en lecture seule. Le contexte
`defaultlog`, son script d'enregistrement natif et la chaîne de traitement MP3
ont été vérifiés sur l'installation réelle. Aucun appel de test effectué.
La suppression audio à trois mois n'a pas été retrouvée dans les emplacements
examinés ; des MP3 de plus de 90 jours subsistent. Aucun nettoyage activé.

Les détails d'exploitation sont conservés dans une note locale sous `.work/audits/`,
exclue du dépôt public. Aucun secret ou enregistrement audio copié. Les actions
AMI de consultation nécessaires sont disponibles ; les droits limités proposés
restent à tester avec un collecteur dédié. Aucun compte ou service ajouté.

La supervision peut être conçue pour fonctionner à côté de VICIdial ; cette
inspection ponctuelle ne constitue pas une validation de charge ni un essai
d'enregistrement pendant cet audit. Un pilote isolé a ensuite été activé,
puis validé avant l'affectation des postes demandés ci-dessous.

### Priorité du modèle SIP confirmée pendant le diagnostic

Un poste signalé par Franck affiche `defaultlog` dans sa fiche mais utilise
réellement le contexte restrictif imposé par son modèle SIP. Le champ de la
fiche ne suffit donc pas : vérifier le contexte effectif avec Asterisk et les
directives du modèle. Ce parcours restrictif n'active pas l'enregistrement.

Le correctif consiste à utiliser la surcharge propre au poste pilote
et un contexte d'enregistrement qui repasse par le routage restrictif original.
Ne pas changer le modèle partagé ni contourner les interdictions de destination
avec un passage direct vers `default`.

Après autorisation de Franck, le correctif a été appliqué à un seul poste :
contexte `apisnix-fr-record`, surcharge de contexte propre au poste et champ
d'affichage aligné. Sauvegardes protégées conservées sur le serveur ; génération
native puis rechargement SIP, sans redémarrage. Seule la section SIP du poste
pilote a changé ; le contexte restrictif original est inchangé. Le contexte
effectif et l'état SIP OK ont été vérifiés. Franck a ensuite confirmé les
enregistrements et des MP3 non vides ont été vérifiés sur le serveur.

Procédure et détails d'exploitation conservés localement hors Git sous
`.work/recording-pilot/`. Aucun nettoyage audio activé, aucun compte de
supervision créé et aucune autre extension modifiée.

### Reproduction sur les autres contextes

Franck souhaite pouvoir reproduire la méthode sur ses autres routes. Quatre
contextes supplémentaires ont été lus, avec leurs différences de motifs,
messagerie et journalisation. Un fragment adapté et un guide d'installation
par poste ont été préparés localement sous `.work/recording-pilot/`, puis
les variantes ont été installées le 16 septembre. Conf Override doit désigner le contexte dédié
correspondant après son installation, et non renvoyer tous les groupes vers
le contexte du premier pilote.

### Intervention programmée du 16 septembre

Les quatre variantes sont maintenant installées et chargées. Sauvegardes
protégées côté serveur et treize contrôles de résolution des routes effectués,
sans appel externe. Les contextes d'origine, le contexte du premier pilote
et la configuration SIP générée sont restés inchangés.

Au passage de 9 h, aucun nouvel appel du pilote n'avait été retrouvé depuis
son activation. Aucune nouvelle affectation n'a donc été effectuée à ce stade.
Suivi automatique mis en pause et test demandé à Franck. Détails locaux
dans `.work/recording-pilot/INTERVENTION_2026-09-16.md`, hors dépôt public.

### Affectations après validation du pilote

Franck a ensuite confirmé les appels et les enregistrements. Une vérification
serveur a retrouvé des MP3 non vides. Les 26 postes supplémentaires demandés
ont reçu leur contexte d'enregistrement par Conf Override, avec sauvegarde
des anciens réglages. Deux postes SIP utilisant un modèle PJSIP incohérent
ont reçu le modèle SIP classique de leur groupe, sur confirmation explicite.
Les modèles partagés et les fichiers du dialplan sont conservés.

La colonne Phone Context est limitée à 20 caractères dans cette installation.
Les noms longs doivent rester dans Conf Override ; le champ court conserve
un contexte restrictif de repli valide. Aucune migration de schéma nécessaire.
La génération native a changé exactement les 26 sections SIP autorisées.
Après rechargement SIP, les 26 contextes effectifs et codes d'attribution au
compte sont corrects. Asterisk est resté en service avec des appels actifs.
La preuve du pilote ne remplace pas un essai de chaque poste et de chaque
destination. Aucun collecteur de supervision ni nettoyage audio ajouté.
Détails et retour arrière dans
`.work/recording-pilot/AFFECTATION_26_POSTES_2026-09-16.md`, hors dépôt public.

### Évolution commerciale après cette affectation

Franck a précisé que certains modèles incompatibles étaient utilisés
volontairement pour suspendre des clients impayés. Deux postes ont été remis
en suspension à sa demande. Ne pas réactiver un poste sur la seule base de
la différence de modèle. Les décisions actuelles, modèles de remise en service
et limites du blocage sont dans le dépôt privé `FranckThiago/Gestion_CRM-APISNIX`,
`docs/TABLEAU_DE_BORD.md`, indiqué dans AGENTS.md. L'ancienne mémoire privée
locale est une archive. Les 26 vérifications
ci-dessus décrivent la passe initiale, pas l'état commercial permanent.
