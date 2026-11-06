<?php
// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2026 Marc Gandar
/**
 * QfA — Fonctions communes à toutes les intégrations PHP
 * Ne pas modifier
 *
 * Inclure ce fichier dans chaque endpoint QfA :
 *   require_once __DIR__ . '/qfa-core.php';        // depuis api/
 *   require_once __DIR__ . '/../api/qfa-core.php'; // depuis une autre profondeur
 *
 * Fournit :
 *   qfa_detect_spk_i()            — langue du navigateur → indice QfA (1=us 2=fr 3=de 4=it 5=sp)
 *   qfa_donne_guid_formate()      — UUID v4 formaté (équivalent WL DonneGUID(guidFormaté))
 *   qfa_svg_for($code_i, $spk_i) — SVG depuis _QfA.json par indice et langue
 *   qfa_sqr_b64($spk_i)          — SVG Sqr (indice 219) encodé en base64 — prêt pour c.Sqr.g
 */

// ── Détection de la langue du navigateur ─────────────────────────────────────
// Mapping QfA : 1=us, 2=fr, 3=de, 4=it, 5=sp
// Retourne l'indice de langue QfA (défaut : 1 = us)
function qfa_detect_spk_i() {
    $map    = ['en' => 1, 'fr' => 2, 'de' => 3, 'it' => 4, 'es' => 5];
    $accept = $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '';
    if (preg_match('/^([a-z]{2})/i', $accept, $m)) {
        $lang = strtolower($m[1]);
        if (isset($map[$lang])) { return $map[$lang]; }
    }
    return 1;
}

// ── Génération d'un UUID v4 formaté ──────────────────────────────────────────
// Équivalent WL : DonneGUID(guidFormaté)
// Format : xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
function qfa_donne_guid_formate() {
    // (04.10.2026 sécurité) tirage cryptographique (random_bytes), plus mt_rand
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    $h = bin2hex($b);
    return substr($h, 0, 8) . '-' . substr($h, 8, 4) . '-' . substr($h, 12, 4) . '-'
         . substr($h, 16, 4) . '-' . substr($h, 20, 12);
}

// ── Extraction d'un SVG depuis _QfA.json ─────────────────────────────────────
// Reproduit la logique WL : TableauCherche(Ind_ti, tcDichotomique, code_i)
// puis M_tj[position] dans la langue cible (spk_i 1-based, Msg 0-based)
// $cfg_path : chemin absolu vers _QfA.json
// $code_i   : indice SVG (ex. 219 = Sqr, 256 = Bck, 254 = Esc)
// $spk_i    : indice de langue QfA (1=us, 2=fr, 3=de, 4=it, 5=sp)
// Retourne la chaîne SVG, ou '' si non trouvé
function qfa_svg_for($cfg_path, $code_i, $spk_i) {
    static $cfgs = [];
    if (!isset($cfgs[$cfg_path])) {
        $cfgs[$cfg_path] = file_exists($cfg_path)
            ? json_decode(file_get_contents($cfg_path), true)
            : false;
    }
    $cfg = $cfgs[$cfg_path];
    if (!$cfg || empty($cfg['index']) || empty($cfg['Msg'])) { return ''; }

    $pos = array_search($code_i, $cfg['index'], true);
    if ($pos === false) { return ''; }

    $langIdx = max(0, $spk_i - 1);
    if (!isset($cfg['Msg'][$langIdx])) { $langIdx = 0; }
    return $cfg['Msg'][$langIdx][$pos] ?? '';
}

// ── SVG Sqr encodé en base64 — prêt pour c.Sqr.g ────────────────────────────
// Contournement du bug de décodage base64 WL sur les longues chaînes avec
// caractères échappés : le SVG est pré-encodé en base64 avant insertion
// dans le JSON. Le serveur QfA décode c.Sqr.g une seconde fois si c.Sqr.enc = 'b64'.
// $cfg_path : chemin absolu vers _QfA.json
// $spk_i    : indice de langue QfA
// Retourne ['g' => '<base64>', 'enc' => 'b64']
function qfa_sqr_b64($cfg_path, $spk_i) {
    $svg = qfa_svg_for($cfg_path, 219, $spk_i);
    return ['g' => base64_encode($svg), 'enc' => 'b64'];
}
