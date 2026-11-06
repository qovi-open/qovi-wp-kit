<?php
// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2026 Marc Gandar
/**
 * qovi_sign.php — requêtes SIGNÉES vers le PuB Qovi (07.10.2026)
 * Ne pas modifier — fichier IDENTIQUE dans tous les kits PHP.
 *
 * La clé privée du site (QOVI_Prv_Us, config.php) ne quitte JAMAIS ce
 * serveur : elle sert seulement à SIGNER la requête et à VÉRIFIER la réponse.
 *
 * Requête : POST <QFA_API_URL>/<Op>, corps JSON
 *   {"v":1, "k":<id public du site>, "t":<secondes UTC>, "n":<nonce hex32>,
 *    "p":<base64 du JSON x_j>, "s":<HMAC-SHA256 hex>}
 *   k = sha256("qovi-sit-pub-v1:" + clé privée)
 *   s = HMAC(clé privée en octets, "qovi-sit-v1\n"+Op+"\n"+k+"\n"+t+"\n"+n+"\n"+sha256hex(p))
 * Réponse : {"p":<base64 du JSON d_j>, "s":HMAC(même clé,
 *   "qovi-pub-v1\n"+Op+"\n"+n+"\n"+sha256hex(p))}
 *   Une réponse non signée, ou signée pour un autre nonce, est REJETÉE.
 *
 * Prérequis : l'horloge de ce serveur doit être à l'heure (NTP), à ±60 s.
 *
 * (02.11.2026) qovi_last_err() donne la cause du dernier échec de
 * qovi_call(), et qovi_err_drw() le message à montrer à l'usager dans le
 * composant : clé absente ou mal formée -> 573 (« site pas encore
 * opérationnel ») ; clé refusée par Qovi ou réponse falsifiée -> 651 (« clé
 * du site erronée ») ; Qovi injoignable -> 573. Le détail reste dans le
 * journal du serveur, jamais dans la réponse au navigateur.
 */

/**
 * Cause du dernier échec de qovi_call() : '' (pas d'échec), 'key' (clé
 * absente ou mal formée), 'net' (Qovi injoignable), 'refused' (réponse non
 * signée : refus du PuB), 'sig' (signature de la réponse invalide), 'bad'
 * (réponse signée mais illisible).
 */
function qovi_last_err(?string $set = null): string
{
    static $err = '';
    if ($set !== null) { $err = $set; }
    return $err;
}

/**
 * Message du composant correspondant au dernier échec (à passer à drw), ou
 * null s'il n'y a pas eu d'échec. $spk_i : langue de l'usager (1=us … 5=sp).
 */
function qovi_err_drw(int $spk_i): ?array
{
    $err = qovi_last_err();
    if ($err === '') { return null; }
    $msg_i = in_array($err, ['refused', 'sig'], true) ? 651 : 573;
    return ['g' => ['k' => [$spk_i, $spk_i, 1]], 'a' => new stdClass(), 'Tip' => ['t' => [$msg_i]]];
}

/** Identifiant public du site, dérivé de sa clé privée. */
function qovi_sit_pub(string $prv): string
{
    return hash('sha256', 'qovi-sit-pub-v1:' . strtolower(trim($prv)));
}

/**
 * Appelle l'Op $proc du PuB avec la charge $x_j.
 * Renvoie le JSON d_j décodé, ou null (erreur réseau, refus, réponse non
 * signée ou falsifiée). Aucun secret n'est journalisé.
 */
function qovi_call(string $proc, array $x_j): ?array
{
    qovi_last_err('');
    $prv = strtolower(trim((string)QOVI_Prv_Us));
    if (!preg_match('/^[0-9a-f]{64}$/', $prv)) {
        error_log('qovi_call : cle privee absente ou mal formee dans config.php');
        qovi_last_err('key');
        return null;
    }
    $key = hex2bin($prv);

    $p   = base64_encode(json_encode($x_j));
    $k   = qovi_sit_pub($prv);
    $t   = time();
    $n   = bin2hex(random_bytes(16));
    $s   = hash_hmac('sha256', "qovi-sit-v1\n$proc\n$k\n$t\n$n\n" . hash('sha256', $p), $key);
    $req = json_encode(['v' => 1, 'k' => $k, 't' => $t, 'n' => $n, 'p' => $p, 's' => $s]);

    // Le certificat TLS du PuB est vérifié (comportement par défaut de PHP).
    $ctx = stream_context_create([
        'http' => [
            'method'        => 'POST',
            'header'        => "Content-Type: application/json\r\nUser-Agent: Qovi_Kit_PHP\r\n",
            'content'       => $req,
            'timeout'       => 15,
            'ignore_errors' => true,
        ],
    ]);
    $raw = @file_get_contents(rtrim(QFA_API_URL, '/') . '/' . rawurlencode($proc), false, $ctx);
    if ($raw === false) {
        error_log("qovi_call $proc : erreur reseau");
        qovi_last_err('net');
        return null;
    }

    $o = json_decode($raw, true);
    if (!is_array($o) || !is_string($o['p'] ?? null) || !is_string($o['s'] ?? null)) {
        error_log("qovi_call $proc : reponse non signee (refus du PuB ?)");
        qovi_last_err('refused');
        return null;
    }
    $exp = hash_hmac('sha256', "qovi-pub-v1\n$proc\n$n\n" . hash('sha256', $o['p']), $key);
    if (!hash_equals($exp, strtolower($o['s']))) {
        error_log("qovi_call $proc : signature de la reponse INVALIDE");
        qovi_last_err('sig');
        return null;
    }

    $d = json_decode((string)base64_decode($o['p'], true), true);
    if (!is_array($d)) {
        error_log("qovi_call $proc : reponse signee mais illisible");
        qovi_last_err('bad');
        return null;
    }
    return $d;
}
