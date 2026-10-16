# Captures d'ApisnixPhone pour le site

Série en français, densité 2 (1440 × 900 → 2880 × 1800 pour les écrans complets),
thème clair, données fictives de la démonstration, sans bandeau ni mention de
démonstration : les mêmes écrans que le guide client, plus nets pour le site
APISNIX. Demandées par Franck le 16 octobre 2026 avec le vert d'ApisnixPhone
étendu à toute l'interface.

Régénérer, démonstration lancée sur le port 5185, depuis `webphone/` :

```bash
GUIDE_SCALE=2 GUIDE_OUT=../docs/site-captures node scripts/guide-screenshots.mjs
```

`GUIDE_LANG=en` ou `es` donne la même série dans une autre langue (changer
`GUIDE_OUT` pour ne pas écraser la française).
