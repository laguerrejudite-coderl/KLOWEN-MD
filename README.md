# 👑 KLOWEN-MD

Un bot WhatsApp moderne, puissant et entièrement automatisé, développé par **LORMIL**.

## 🚀 Déploiement Rapide

Cliquez sur le bouton ci-dessous pour déployer instantanément votre propre instance de **KLOWEN-MD** sur Heroku :

[![Deploy to Heroku](https://herokucdn.com)](https://heroku.com)

## ⚙️ Configuration Requise

Lors du déploiement, vous devrez remplir les variables d'environnement suivantes fournies par votre fichier `app.json` :
* **SESSION_ID** : Votre identifiant de session WhatsApp crypté (Obligatoire).
* **OWNER_NAME** : Votre nom de créateur (Par défaut : `LORMIL`).
* **PREFIX** : Le symbole pour déclencher les commandes (Par défaut : `!`).
* **MODE** : Définir sur `public` ou `private`.
* **AUTO_STATUS_SEEN** : Mettre `true` pour visionner les statuts automatiquement.
