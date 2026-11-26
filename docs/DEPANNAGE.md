# Dépannage

[← Retour au README](../README.md)

Problèmes courants rencontrés lors de l'installation ou du lancement de ny-hirako, et leurs solutions. L'installation complète est décrite dans la [section 6 du README](../README.md#6-installation-et-lancement).

| Symptôme | Cause probable | Solution |
|---|---|---|
| `connection refused` ou `ECONNREFUSED` sur le port 5432 | PostgreSQL n'est pas démarré | `sudo systemctl start postgresql`, puis `pg_lsclusters` ou `systemctl status postgresql` |
| `password authentication failed` | La base exige un mot de passe | Renseigner `utilisateur:motdepasse@` dans `DATABASE_URL` |
| `Variable d'environnement manquante : JWT_SECRET` | Le fichier `.env` n'existe pas ou est incomplet | `cp .env.example .env` puis renseigner `JWT_SECRET` |
| `permission denied to create extension "pgcrypto"` | Droits insuffisants | Lancer `schema.sql` avec un utilisateur propriétaire de la base ou administrateur |
| `function gen_random_uuid() does not exist` | PostgreSQL antérieur à la version 13 | Installer PostgreSQL 13 ou plus |
| `node: bad option: --env-file` | Node.js trop ancien | Installer Node.js 20.6 ou plus |
| `EADDRINUSE` (port 3000 déjà utilisé) | Un autre programme occupe le port | Changer `PORT` dans `.env` et la cible du proxy dans `frontend/vite.config.js` |
| Le site affiche « Impossible de joindre l'API » | L'API n'est pas lancée | Démarrer `npm run dev` dans `backend/` |
| Les accents s'affichent mal dans `psql` | Encodage du terminal | `export PGCLIENTENCODING=UTF8` avant de lancer les scripts |
| `self-signed certificate in certificate chain` (base hébergée, par exemple Aiven) | Le certificat du serveur n'est pas reconnu par Node.js | Renseigner `DATABASE_CA` avec le certificat CA fourni par l'hébergeur |
| `no pg_hba.conf entry … no encryption` | La base hébergée exige le chiffrement | Ajouter `?sslmode=require` à `DATABASE_URL` |
| `remaining connection slots are reserved` ou `too many connections` | Trop de connexions ouvertes par rapport à la limite de l'hébergeur | Réduire `DATABASE_POOL_MAX` (par exemple `3`) |
