# Identité APISNIX

`apisnix-mark.png` est une copie exacte du fichier fourni par Franck :
`favicon_Apisnix/android-chrome-512x512.png` dans son dossier de logos.
Monogramme bleu et jaune, 512 × 512 pixels avec transparence. Les originaux
restent inchangés. Le nom de produit affiché est **ApisnixPhone**.

`scripts/prepare-branding.py` produit les tailles natives Android, l'icône
Windows multirésolution et les ressources d'accueil Desktop. Il conserve le
logo fourni ; les SVG Desktop encapsulent son PNG sans le redessiner.
Les tailles supérieures à 512 pixels sont agrandies depuis ce fichier.

Le script d'export utilise `sips` de macOS. Il n'est pas nécessaire dans la
compilation Windows : les ressources préparées sont incluses dans les patches.
Après un changement d'assets, exporter à nouveau les patches.

Couleurs d'interface : bleu principal `#1010FF`, fond d'accent `#EEEEFF`.
Le jaune est conservé dans le logo ; les couleurs des appels et erreurs gardent
leur signification. La notification Android utilise la silhouette du logo.

Les marques et visuels APISNIX ne remplacent pas les licences et crédits des
composants open source. L'icône et l'installateur macOS ne sont pas encore traités.
