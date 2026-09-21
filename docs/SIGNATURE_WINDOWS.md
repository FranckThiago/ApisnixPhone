# Signature Windows et alertes d'installation

Diagnostic et procédure préparatoire du 17 septembre 2026. **Aucune version
signée APISNIX n'a encore été produite.**

**En attente à la demande de Franck** : il reporte ce chantier et revient à
la supervision SIP. Ne pas poursuivre l'inscription Azure, engager de dépense
ou lancer une signature sans nouvelle demande. Les recherches ci-dessous
restent disponibles pour la reprise.

## Décision et prérequis

Franck demande une signature sous l'identité de son entreprise française
APISNIX. Le nom d'éditeur sera celui validé par le fournisseur du certificat,
pas un texte libre ajouté à l'installateur. La piste d'une signature Linphone
n'est plus retenue : aucun service de signature n'a été fourni avec l'accord
rapporté par Franck. Un accord ne transfère pas une signature existante à un
binaire modifié. Les signatures valides des composants tiers inchangés doivent
être conservées.

Solution proposée : **Microsoft Artifact Signing, formule Basic, Public Trust**.
Le fournisseur et la dépense restent à confirmer avant création de ressources.
Aucun abonnement Azure, profil de certificat ou accès de signature GitHub n'a
été configuré pour ce projet pendant ce diagnostic.

- Tarif public consulté : **9,99 USD par mois**, 5 000 signatures incluses ;
  dépassement à 0,005 USD par signature. Montant facturé en euros selon le
  contrat, le change et les taxes applicables. Ce n'est pas une offre gratuite.
- Les organisations de l'Union européenne sont admissibles ; cela ne dispense
  pas APISNIX de la validation de son identité. Le parcours « organisation »
  est celui à utiliser pour l'entreprise française.
- Prévoir un abonnement Azure facturable, le nom légal, l'adresse, l'identifiant
  d'entreprise, son site et deux adresses de contact distinctes sur son domaine.
  Le représentant accomplit la vérification d'identité dans le portail officiel.
- Microsoft annonce généralement 1 à 20 jours ouvrés de traitement, parfois
  davantage si des justificatifs supplémentaires sont requis. Ne pas promettre
  une signature disponible immédiatement après inscription.
- Les documents d'identité, moyens de paiement et secrets restent hors du dépôt
  et de la conversation ; ils se saisissent directement dans le portail officiel.

Sources : [tarifs Microsoft](https://azure.microsoft.com/pricing/details/artifact-signing/),
[conditions et création du compte](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart),
[FAQ du service](https://learn.microsoft.com/en-us/azure/artifact-signing/faq).

## Ce qui a été vérifié dans le paquet actuel

Paquet : `dist/windows/ApisnixPhone-6.2.2-apisnix.2-win64.exe`.
La copie locale correspond à l'empreinte de build et au fichier publié décrit
dans [OPERATIONS.md](OPERATIONS.md). Aucune nouvelle lecture du serveur ni copie
du fichier reçu par le client n'a été effectuée pendant ce diagnostic.

| Élément examiné | Résultat |
| --- | --- |
| Installateur NSIS x64 | 157 022 414 octets ; table des certificats PE vide : non signé |
| Application `bin/apisnixphone.exe` extraite | 71 592 448 octets ; table des certificats PE vide : non signée |
| `bin/D3Dcompiler_47.dll` extraite | 4 173 928 octets ; structure Authenticode contenant des certificats Microsoft et d'horodatage |

SHA-256 relevés :

```text
98673a23b94363cd81ea730d91c1d893f1cf1c4247550ae065077406dc43831a  installateur
9a5118203ae59f2a4f7cd7a8ba2abc325298facff41edf1b1c3bdf2df74aaeb8  bin/apisnixphone.exe
e994847e01a6f1e4cbdc5a864616ac262f67ee4f14db194984661a8d927ab7f4  bin/D3Dcompiler_47.dll
```

L'extraction a été faite sans exécuter les binaires Windows, avec 7-Zip 26.03
obtenu depuis la page officielle. Les copies d'inspection restent dans `.work/`,
exclu du Git. Les certificats ont été lus avec OpenSSL : **leur présence ne vaut
pas validation cryptographique complète de la DLL**, de sa chaîne de confiance,
de sa révocation ou de l'état de sécurité du poste client. Aucun scan Defender
ou 360 ni essai Windows supplémentaire n'a été exécuté pendant ce diagnostic.

La construction utilise Qt 6.10.0 et le déploiement amont appelle `windeployqt`
dans `cmake/install/cleanCPack.cmake.in`. Qt prévoit la copie du compilateur D3D,
sauf option `--no-system-d3d-compiler`, absente de cette invocation. C'est cohérent
avec cette DLL dans le paquet ; ce n'est pas une preuve d'absence de malware.
Voir [déploiement Qt Windows](https://doc.qt.io/qt-6/windows-deployment.html).

## Distinguer les deux alertes

- **SmartScreen / éditeur inconnu** : cohérent avec l'absence de signature de
  l'installateur. Une signature de confiance permet d'afficher un éditeur
  vérifié. Un nouveau fichier signé peut encore déclencher SmartScreen, dont
  la réputation dépend aussi du fichier et de son historique de diffusion.
- **360 Total Security / modification d'une DLL système** : la capture vise
  `C:\Program Files\ApisnixPhone\bin\D3DCompiler_47.dll`, dans le dossier de
  l'application. Elle ne montre pas une écriture dans `System32` ni une détection
  nommée de malware. La cause précise et le caractère éventuellement erroné de
  cette alerte restent à confirmer sur Windows.

Ne pas demander aux clients de désactiver leurs protections, d'ajouter une
exclusion ou de contourner systématiquement les alertes. Ne pas retirer une
dépendance graphique pour faire disparaître une alerte sans vérifier l'impact.
Un certificat autosigné ne résout pas la confiance de Windows chez les clients.
Une signature commerciale n'est pas non plus une certification antivirus.
Voir [réputation SmartScreen](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).

## Mise en place après accord sur l'abonnement

1. Dans le portail Azure, choisir Basic, une région compatible, et faire valider
   l'organisation. Créer ensuite un profil **Public Trust**, pas « Test » ni
   « Private Trust ». Contrôler le nom d'éditeur dans l'aperçu du certificat.
2. Relier le workflow GitHub à Azure par identité fédérée OIDC. Limiter le rôle
   `Artifact Signing Certificate Profile Signer` au profil de ce projet et la
   fédération au dépôt et à son environnement de diffusion protégé. La clé de
   signature reste dans le service ; aucun PFX ni secret permanent dans Git.
3. Adapter la construction pour signer les exécutables et bibliothèques produits
   pour ApisnixPhone **avant** de fabriquer l'installateur. Préserver les composants
   tiers déjà signés et inchangés. L'amont propose un point de signature finale
   de l'installateur dans `cmake/install/packaging.cmake.in`, mais le workflow
   APISNIX actuel n'active aucune signature. Ne pas confondre ce point existant
   avec une intégration Azure déjà faite.
4. Fabriquer l'installateur, puis le signer et l'horodater en SHA-256. Vérifier
   signatures, identité d'éditeur et horodatage, puis calculer les empreintes
   finales. Aucun contenu exécutable ne doit être modifié après signature.
   L'horodatage est indispensable : les certificats Artifact Signing ont une
   durée courte et la signature doit rester vérifiable après leur expiration.
5. Sur un Windows de test avec protections actives et à jour, contrôler les
   signatures de l'installateur, de l'application et de la DLL, analyser le
   paquet puis tester installation/mise à jour, démarrage et appel. Conserver
   les résultats réels ; un build ou une extraction ne remplace pas cet essai.
6. Si 360 signale encore le paquet vérifié, préparer le hash et un rapport pour
   son éditeur. Ne soumettre de fichier ou de rapport externe qu'après accord
   explicite. Ne pas annoncer la disparition des alertes avant vérification.
7. Publier le paquet validé sous un nouveau nom, conserver l'ancien pour retour
   arrière, mettre à jour le manifeste et le bouton Windows selon la procédure
   du dépôt privé de gestion. Une signature nouvelle change le SHA-256 ; ne pas
   remplacer silencieusement le fichier `.2` déjà diffusé.

Références d'intégration : [Microsoft](https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations),
[action GitHub officielle](https://github.com/azure/artifact-signing-action).
Avant implémentation, vérifier la version de l'action et fixer sa révision,
comme les actions existantes du dépôt.

## État de cette intervention

Diagnostic local et documentation uniquement. Aucun achat, nouvelle signature,
build, publication, modification de la page d'accueil, accès serveur ou migration.
Les essais réels de sécurité Windows et l'accès de signature restent à obtenir.
