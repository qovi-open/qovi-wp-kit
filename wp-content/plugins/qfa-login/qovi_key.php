<?php
// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2026 Marc Gandar
/**
 * qovi_key.php — type de clé générique « Login » (30.10.2026)
 * Ne pas modifier — fichier IDENTIQUE dans tous les kits PHP.
 *
 * C'est l'identifiant PUBLIC du TYPE de clé (k_Login_Uc côté Qovi), le même
 * pour tous les sites : ce n'est PAS une clé, rien de secret. Il n'est donc
 * plus demandé dans config.php ; seule la clé privée du site y reste.
 * Utilisé par api/ch1.php (Key.U) et index.php (Key_Us du composant).
 */
if (!defined('QOVI_KEY_LOGIN_US')) {
    define('QOVI_KEY_LOGIN_US', '6a9e175844d0ef2012fe7848af6c1924f1eb22fee7ac1ee8a589427c72e83613');
}
