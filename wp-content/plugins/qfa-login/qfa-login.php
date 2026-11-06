<?php
// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2026 Marc Gandar
/**
 * Plugin Name: Qovi Login
 * Plugin URI:  https://qovi.ch
 * Description: Connexion sans mot de passe Qovi pour WordPress (QR / clic, validée sur le mobile).
 * Version:     2.3.0
 * Author:      Qovi
 * Author URI:  https://qovi.ch
 * License:     GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 *
 * 2.0.0 (04.10.2026, sécurité) — réécriture sur le modèle du kit PHP :
 *   - opérations SiT_1_Edr / SiT_3_End, adresse du PuB réglable (qovi.ch) ;
 *   - la clé privée du site ne quitte jamais le serveur WordPress ;
 *   - la demande est mémorisée pour CE navigateur (session PHP, sous
 *     l'identifiant de son canal CH2 g.nap) ;
 *   - la session n'est ouverte QUE sur le « ok » du PuB (SiT_3_End), avec
 *     l'adresse CONFIRMÉE par le PuB — jamais celle du navigateur ;
 *   - accès privé contrôlé AVANT l'affichage (plus de boucle de redirection) ;
 *   - réglages réservés aux administrateurs ; clé privée jamais réaffichée.
 *
 * 2.1.0 (30.10.2026, sécurité) — aligné sur les kits PHP :
 *   - requêtes SIGNÉES (qovi_sign.php, identique dans tous les kits) : la clé
 *     privée ne voyage PLUS sur le réseau (la 2.0 l'envoyait en SaM.U, mode
 *     refusé par Qovi depuis le 07.10.2026) ; réponse du PuB vérifiée ;
 *   - le type de clé « Login » est une constante publique (qovi_key.php) :
 *     le champ « clé publique » des réglages disparaît, seule la clé privée
 *     du site reste à saisir.
 *
 * 2.2.0 (30.10.2026) — confort et garde-fous :
 *   - réglages : adresses nettoyées (espaces) et avertissement si la page de
 *     connexion ou la page après connexion n'existe pas sur le site ;
 *   - nouveau code court [qfa_login_link] : lien « Connexion » ou
 *     « Déconnexion » selon l'état, à placer dans un en-tête, un menu, etc.
 *
 * 2.3.0 (02.11.2026) — clé du site absente ou refusée : le composant affiche
 *   de nouveau un message à l'usager (573 « site pas encore opérationnel »,
 *   651 « clé du site erronée ») au lieu de rester muet.
 */

if (!defined('ABSPATH')) exit;

define('QFA_API_URL',      get_option('qfa_api_url', 'https://qovi.ch/RST'));
define('QOVI_Prv_Us',      get_option('qfa_sam_u', ''));
define('QFA_REA',          get_option('qfa_rea', "Demande d'authentification"));
define('QFA_REDIRECT_URL', get_option('qfa_redirect_url', home_url('/')));
define('QFA_LOGIN_URL',    get_option('qfa_login_url', home_url('/')));
define('QFA_SESSION_TTL',  3600);

require_once __DIR__ . '/qovi_key.php';   // type de clé « Login » (constante publique)
require_once __DIR__ . '/qovi_sign.php';  // qovi_call() : requête signée, réponse vérifiée

// ── Session PHP (demande en cours + session Qovi) ───────────────────────────
add_action('init', function () {
    if (session_status() === PHP_SESSION_NONE && !headers_sent()) {
        session_start(['cookie_httponly' => true, 'cookie_secure' => is_ssl(), 'cookie_samesite' => 'Lax']);
    }
});

function qfa_is_authenticated() {
    $token  = $_COOKIE['qfa_session'] ?? '';
    $stored = $_SESSION['qfa_token'] ?? '';
    $t      = $_SESSION['qfa_t'] ?? 0;
    return $token !== '' && $stored !== '' && hash_equals($stored, $token) && $t > time() - QFA_SESSION_TTL;
}

// ── Assets JS ────────────────────────────────────────────────────────────────
add_action('wp_enqueue_scripts', function () {
    $base = plugin_dir_url(__FILE__) . 'res/';
    $v    = '2.2.0';
    wp_enqueue_script('qfa-score', $base . 'qfa-score.js', [], $v, true);
    wp_enqueue_script('qfa-mrg', $base . 'qfa-mrg.js', ['qfa-score'], $v, true);
    wp_enqueue_script('qfa-min', $base . 'qfa-min.js', ['qfa-mrg'], $v, true);
    wp_localize_script('qfa-min', 'QFA_WP', [
        'ajaxUrl'   => admin_url('admin-ajax.php'),
        'nonce'     => wp_create_nonce('qfa_nonce'),
        'key_us'    => QOVI_KEY_LOGIN_US,
        'rea'       => QFA_REA,
        'configUrl' => plugin_dir_url(__FILE__) . 'res/_QfA.json',
    ]);
});

// ── Shortcode [qfa_login] ────────────────────────────────────────────────────
add_shortcode('qfa_login', function ($atts) {
    $atts = shortcode_atts(['email' => '', 'reason' => QFA_REA], $atts);
    $cfg  = wp_json_encode(['email' => (string) $atts['email'], 'reason' => (string) $atts['reason']]);
    ob_start(); ?>
<style>
.qfa-login-page{font-family:Arial,sans-serif;min-height:60vh;display:flex;align-items:center;justify-content:center;padding:40px 20px}
.qfa-login-card{max-width:600px;width:100%;padding:40px;background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.1);text-align:center}
#qfa-btn-login{padding:12px 32px;font-size:1rem;background:#0F3ECE;color:#fff;border:none;border-radius:6px;cursor:pointer}
#qfa-wrapper{margin:24px auto 0;display:inline-block;position:relative}
</style>
<div class="qfa-login-page"><div class="qfa-login-card">
<button id="qfa-btn-login" type="button">Connexion Qovi</button>
<div id="qfa-wrapper"><div id="qfa-container"></div></div>
</div></div>
<script>
(function () {
  var CFG = <?php echo $cfg; ?>;
  function post(action, fields) {
    var body = 'action=' + action + '&nonce=' + encodeURIComponent(QFA_WP.nonce);
    Object.keys(fields).forEach(function (k) { body += '&' + k + '=' + encodeURIComponent(fields[k]); });
    return fetch(QFA_WP.ajaxUrl, { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body }).then(function (r) { return r.json(); });
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof QfaCreate === 'undefined') { console.error('[Qovi] QfaCreate non defini'); return; }
    window.qfaRun = QfaCreate();
    window.qfaRun.init('qfa-container', {
      configUrl: QFA_WP.configUrl, mode: 'run', Key_Us: QFA_WP.key_us,
      Edr_s: CFG.email, Rea_s: CFG.reason,
      onMessage: function (data) {
        if (data.action === 'ch1_run') {
          post('qfa_ch1', { edr: (data.Edr && data.Edr.s) || '', rea: (data.Rea && data.Rea.s) || '' })
            .then(function (d) {
              if (d.success) { window.qfaRun.drw(d.data); return; }
              if (d.data && d.data.drw) { window.qfaRun.drw(d.data.drw); }   // message à l'usager
              console.error('[Qovi CH1]', d.data && d.data.msg ? d.data.msg : d.data);
            });
        }
        if (data.action === 'go_run') {
          post('qfa_go', { g: JSON.stringify(data.g || {}) })
            .then(function (d) { if (d.success && d.data.url) { window.location.href = d.data.url; } else { console.error('[Qovi Go]', d.data); } });
        }
      }
    });
    document.getElementById('qfa-btn-login').addEventListener('click', function () {
      this.style.display = 'none';
      window.qfaRun.start({});
      window.qfaRun.drw({ g: {}, a: { Edr: { s: CFG.email, e: true } }, Tip: null });
    });
  });
})();
</script>
<?php
    return ob_get_clean();
});

// ── AJAX CH1 : ouvre la demande (SiT_1_Edr) ──────────────────────────────────
add_action('wp_ajax_nopriv_qfa_ch1', 'qfa_handle_ch1');
add_action('wp_ajax_qfa_ch1', 'qfa_handle_ch1');
function qfa_handle_ch1() {
    check_ajax_referer('qfa_nonce', 'nonce');
    require_once __DIR__ . '/qfa-core.php';
    $edr_s = sanitize_email(wp_unslash($_POST['edr'] ?? ''));
    $rea_s = sanitize_text_field(wp_unslash($_POST['rea'] ?? ''));
    if ($edr_s === '') wp_send_json_error('Email obligatoire');
    $spk_i = qfa_detect_spk_i();
    $ms    = (int) round(microtime(true) * 1000);
    $utc_s = gmdate('Y-m-d\TH:i:s.') . sprintf('%03d', $ms % 1000);
    $x_j = [
        'g' => ['k' => [$spk_i, $spk_i, 1], 'u' => qfa_donne_guid_formate(),
                'p' => ['e' => $edr_s, 'r' => $rea_s], 'h' => 'SiT', 't' => [$utc_s, $utc_s]],
        'c' => ['Key' => ['U' => QOVI_KEY_LOGIN_US],
                'Sqr' => qfa_sqr_b64(__DIR__ . '/res/_QfA.json', $spk_i)],
    ];
    $data = qovi_call('SiT_1_Edr', $x_j); // signée : la clé privée ne part pas
    if (!$data) wp_send_json_error(['msg' => 'Service Qovi indisponible', 'drw' => qovi_err_drw($spk_i)]);
    // Demande mémorisée pour CE navigateur, sous l'identifiant de son canal CH2
    $_SESSION['qfa_pending'] = array_filter($_SESSION['qfa_pending'] ?? [],
        fn($p) => ($p['t'] ?? 0) > time() - 600);
    $nap_u = strtolower((string) ($data['a']['ChX']['Prv']['u'] ?? ''));
    if ($nap_u !== '') $_SESSION['qfa_pending'][$nap_u] = ['edr' => $edr_s, 't' => time()];
    wp_send_json_success($data);
}

// ── AJAX Go : fin de login VÉRIFIÉE par le PuB (SiT_3_End) ───────────────────
add_action('wp_ajax_nopriv_qfa_go', 'qfa_handle_go');
add_action('wp_ajax_qfa_go', 'qfa_handle_go');
function qfa_handle_go() {
    check_ajax_referer('qfa_nonce', 'nonce');
    $g_j   = json_decode(wp_unslash($_POST['g'] ?? ''), true);
    $nap_u = is_array($g_j) ? strtolower(trim((string) ($g_j['nap'] ?? ''))) : '';
    if ($nap_u === '' || !preg_match('/^[0-9a-f-]{32,36}$/', $nap_u)) wp_send_json_error('Paramètre g manquant');
    // 1. La demande doit avoir été lancée par CE navigateur
    $pending = $_SESSION['qfa_pending'][$nap_u] ?? null;
    if (!$pending || ($pending['t'] ?? 0) < time() - 600) wp_send_json_error('Demande inconnue pour ce navigateur');
    // 2. Le PuB confirme (requête signée, validation du mobile, 120 s, usage unique)
    $data = qovi_call('SiT_3_End', ['g' => $g_j, 'c' => [
        'Edr' => ['s' => $pending['edr']], 'NaP' => ['u' => $nap_u]]]);
    $a = is_array($data) ? ($data['a'] ?? null) : null;
    if (!is_array($a) || ($a['ok'] ?? false) !== true || empty($a['Edr'])) wp_send_json_error('Connexion refusée');
    // 3. Session avec l'adresse CONFIRMÉE par le PuB
    unset($_SESSION['qfa_pending'][$nap_u]);
    session_regenerate_id(true);
    $token = bin2hex(random_bytes(32));
    $_SESSION['qfa_token'] = $token;
    $_SESSION['qfa_email'] = sanitize_email((string) $a['Edr']);
    $_SESSION['qfa_t']     = time();
    setcookie('qfa_session', $token, ['expires' => time() + QFA_SESSION_TTL, 'path' => '/',
        'httponly' => true, 'secure' => is_ssl(), 'samesite' => 'Strict']);
    wp_send_json_success(['url' => QFA_REDIRECT_URL]);
}

// ── Accès privé : contrôlé AVANT l'affichage ─────────────────────────────────
add_action('template_redirect', function () {
    if (isset($_GET['qfa_logout']) && wp_verify_nonce($_GET['_wpnonce'] ?? '', 'qfa_logout')) {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) session_destroy();
        setcookie('qfa_session', '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Strict']);
        wp_safe_redirect(QFA_LOGIN_URL);
        exit;
    }
    $post = get_queried_object();
    if (!($post instanceof WP_Post) || !has_shortcode($post->post_content, 'qfa_private')) return;
    if (qfa_is_authenticated() || current_user_can('manage_options')) return;
    // Pas de boucle : si la page de login est elle-même la page privée, on n'y redirige pas
    if (untrailingslashit(get_permalink($post)) === untrailingslashit(QFA_LOGIN_URL)) return;
    wp_safe_redirect(QFA_LOGIN_URL);
    exit;
});

// ── Shortcode [qfa_private]contenu[/qfa_private] ─────────────────────────────
add_shortcode('qfa_private', function ($atts, $content = '') {
    if (!qfa_is_authenticated() && !current_user_can('manage_options')) {
        return '<p class="qfa-private-locked">Contenu réservé : connectez-vous avec Qovi.</p>';
    }
    $email      = esc_html($_SESSION['qfa_email'] ?? '');
    $logout_url = wp_nonce_url(add_query_arg('qfa_logout', '1', get_permalink()), 'qfa_logout');
    return '<div class="qfa-page" style="max-width:600px;margin:40px auto;padding:32px;background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.1);text-align:center">'
         . '<h2>Espace privé</h2><p style="color:#0F3ECE">' . $email . '</p>'
         . '<div style="text-align:left;margin:24px 0">' . do_shortcode($content) . '</div>'
         . '<a href="' . esc_url($logout_url) . '">Déconnexion</a></div>';
});

// ── Shortcode [qfa_logout] ───────────────────────────────────────────────────
add_shortcode('qfa_logout', function () {
    $url = wp_nonce_url(add_query_arg('qfa_logout', '1', get_permalink()), 'qfa_logout');
    return '<a href="' . esc_url($url) . '" class="qfa-logout-btn">Déconnexion</a>';
});

// ── Shortcode [qfa_login_link] (2.2.0) ──────────────────────────────────────
// Connexion / Déconnexion selon l'état — à placer où l'on veut (en-tête, menu,
// page d'accueil). Attributs : login="…" logout="…" (libellés).
add_shortcode('qfa_login_link', function ($atts) {
    $atts = shortcode_atts(['login' => 'Connexion', 'logout' => 'Déconnexion'], $atts);
    if (qfa_is_authenticated()) {
        $url = wp_nonce_url(add_query_arg('qfa_logout', '1', QFA_LOGIN_URL), 'qfa_logout'); // déconnexion puis retour à la page de connexion
        return '<a href="' . esc_url($url) . '" class="qfa-login-link qfa-logout-btn">' . esc_html($atts['logout']) . '</a>';
    }
    return '<a href="' . esc_url(QFA_LOGIN_URL) . '" class="qfa-login-link">' . esc_html($atts['login']) . '</a>';
});

// Une adresse saisie dans les réglages désigne-t-elle une page de CE site ?
// (2.2.0) l'accueil est accepté ; sinon la page doit exister (url_to_postid).
function qfa_url_is_site_page($url) {
    if ($url === '') return false;
    if (untrailingslashit($url) === untrailingslashit(home_url('/'))) return true;
    return url_to_postid($url) > 0;
}

// ── Réglages (administrateurs seulement) ─────────────────────────────────────
add_action('admin_menu', function () {
    add_options_page('Qovi Login', 'Qovi Login', 'manage_options', 'qfa-login', 'qfa_settings_page');
});

function qfa_settings_page() {
    if (!current_user_can('manage_options')) wp_die('Accès refusé');
    $ok_key = fn($v) => (bool) preg_match('/^[0-9a-f]{64}$/i', $v);
    if (isset($_POST['qfa_save'])) {
        check_admin_referer('qfa_settings');
        $api = esc_url_raw(wp_unslash($_POST['qfa_api_url'] ?? ''));
        if (strpos($api, 'https://') === 0) update_option('qfa_api_url', $api);
        delete_option('qfa_key_us'); // (2.1.0) ancien réglage « clé publique », devenu inutile
        $prv = trim(sanitize_text_field(wp_unslash($_POST['qfa_sam_u'] ?? '')));
        if ($prv !== '' && $ok_key($prv)) update_option('qfa_sam_u', strtolower($prv), false); // vide = inchangée
        update_option('qfa_rea', sanitize_text_field(wp_unslash($_POST['qfa_rea'] ?? '')));
        // (2.2.0) espaces retirés AVANT le nettoyage d'URL (sinon « %20 » final)
        $red = esc_url_raw(trim(wp_unslash($_POST['qfa_redirect_url'] ?? '')));
        $log = esc_url_raw(trim(wp_unslash($_POST['qfa_login_url'] ?? '')));
        update_option('qfa_redirect_url', $red);
        update_option('qfa_login_url', $log);
        echo '<div class="updated"><p>Réglages enregistrés.</p></div>';
        foreach (['Page de connexion' => $log, 'Page après connexion' => $red] as $lbl => $u) {
            if (!qfa_url_is_site_page($u)) {
                echo '<div class="notice notice-warning"><p>' . esc_html($lbl) . ' : aucune page publiée de ce site ne correspond à <code>'
                   . esc_html($u) . '</code>. Ouvrez la page voulue et copiez son adresse exacte.</p></div>';
            }
        }
    }
    $has_prv = get_option('qfa_sam_u', '') !== '';
    ?>
    <div class="wrap"><h1>Qovi Login — Réglages</h1>
    <form method="post"><?php wp_nonce_field('qfa_settings'); ?>
    <table class="form-table">
      <tr><th>Adresse du service Qovi</th><td><input type="url" name="qfa_api_url" value="<?php echo esc_attr(QFA_API_URL); ?>" size="50" /></td></tr>
      <tr><th>Clé privée du site</th><td><input type="password" name="qfa_sam_u" value="" size="70" autocomplete="off" />
        <p class="description"><?php echo $has_prv ? 'Enregistrée (jamais réaffichée). Laisser vide pour ne pas la changer.' : 'Obligatoire : clé privée de ch.qovi@votredomaine.'; ?></p></td></tr>
      <tr><th>Raison par défaut</th><td><input type="text" name="qfa_rea" value="<?php echo esc_attr(QFA_REA); ?>" size="50" /></td></tr>
      <tr><th>Page de connexion</th><td><input type="url" name="qfa_login_url" value="<?php echo esc_attr(QFA_LOGIN_URL); ?>" size="50" /></td></tr>
      <tr><th>Page après connexion</th><td><input type="url" name="qfa_redirect_url" value="<?php echo esc_attr(QFA_REDIRECT_URL); ?>" size="50" /></td></tr>
    </table>
    <p class="submit"><input type="submit" name="qfa_save" class="button-primary" value="Enregistrer" /></p>
    </form><hr><h2>Utilisation</h2>
    <p>Page de connexion : <code>[qfa_login]</code> — Page privée (une AUTRE page) : <code>[qfa_private]contenu[/qfa_private]</code> — Bouton : <code>[qfa_logout]</code> — Lien Connexion/Déconnexion : <code>[qfa_login_link]</code></p>
    <p>Écrivez les codes courts <b>avec leurs crochets</b>, dans un paragraphe ou un bloc « Shortcode » (jamais dans un bloc « Code »).</p>
    </div>
    <?php
}
