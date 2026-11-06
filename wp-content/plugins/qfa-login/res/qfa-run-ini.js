/*! SPDX-License-Identifier: MPL-2.0 | Copyright (c) 2026 Marc Gandar | Qovi est une marque de Marc Gandar */
/*!
 * qfa-run-ini.js — Démarrage du composant QfA en mode run (page PubTop)
 * ═══════════════════════════════════════════════════════════════════════
 * Spécifique à PubTop (la vraie page de login publique du site). Charge
 * la cascade JS du composant et crée une unique instance window.qfaRun
 * en mode 'run'. N'a aucun rôle d'édition — c'est l'équivalent côté
 * "run" de _QfA_Edt_Boot dans qfa-vjs.js, mais autonome (pas de
 * dépendance à qfa-vjs.js, jamais chargé sur cette page).
 *
 * ── Comportement au chargement de la page ────────────────────────────────
 *   Sans paramètre URL ?K= : le composant n'apparaît PAS automatiquement.
 *     Il faut un clic explicite sur le bouton Login (QfA_Run_Login, dans
 *     le modèle M_QfA_VJS) pour l'afficher et démarrer l'auth.
 *
 *   Avec ?K=<clé>[&E=<email>][&R=<raison>] : démarrage immédiat et
 *     automatique de l'authentification, sans attendre de clic. C'est
 *     le code WL de PubTop qui détecte ce paramètre et injecte
 *     window.QFA_KEY / window.QFA_EDR / window.QFA_REA en conséquence
 *     avant que ce fichier ne s'exécute.
 *
 *   Le démarrage auto est entièrement piloté par start() dans qfa-min.js :
 *   elle ne démarre que si opts.Key_Us est non vide — donc seulement si
 *   ?K= était bien présent dans l'URL. Aucun fallback de clé n'est posé
 *   ici volontairement (contrairement à QfA_Run_Login, qui applique son
 *   propre fallback générique uniquement sur action manuelle de
 *   l'utilisateur).
 *
 * ── QfA_DrwNav (point d'entrée retour serveur) ───────────────────────────
 *   Volontairement minimaliste comparé à son homonyme du modèle
 *   M_QfA_VJS (qui sait distinguer payload brut / enveloppe {Cmp,QfA}) :
 *   sur PubTop, le serveur ne renvoie jamais l'enveloppe d'édition,
 *   donc QfA_DrwNav transmet toujours directement à qfaRun.drw().
 */
console.log('[qfa-run-ini] version 2.4');

// ── _QfA_Run_Boot — Charge la cascade JS et crée l'instance qfaRun unique ─
// Protégée contre les doubles appels (window._qfaRunBooting). Centre le
// composant à l'écran une fois prêt.
function _QfA_Run_Boot() {
    if (window.qfaRun || window._qfaRunBooting) { return; }
    window._qfaRunBooting = true;
    var base = window.QFA_BASE || '../_QfA';
    var ldJs = function(src, cb) {
        var s = document.createElement('script');
        s.src = src + '?v=' + new Date().getTime();
        s.onload = cb;
        document.head.appendChild(s);
    };
    ldJs(base + '/qfa-score.js', function() {
        ldJs(base + '/qfa-mrg.js', function() {
            ldJs(base + '/qfa-min.js', function() {
                window.qfaRun = QfaCreate();
                window.qfaRun.init('qfa-container', {
                    mode      : 'run',
                    bridge    : 'C3',
                    configUrl : base + '/_QfA.json',
                    Key_Us    : window.QFA_KEY || '',
                    Edr_s     : window.QFA_EDR || '',
                    Rea_s     : window.QFA_REA || '',
                    onReady   : function() {
                        // start() ne démarre l'auth que si Key_Us est non vide
                        // (donc seulement si ?K= était présent dans l'URL)
                        window.qfaRun.start();
                        var el = window.qfaRun.getEl();
                        if (el) {
                            el.style.position  = 'fixed';
                            el.style.left      = '50%';
                            el.style.top       = '50%';
                            el.style.transform = 'translate(-50%, -50%)';
                        }
                    }
                });
            });
        });
    });
}

// ── Démarrage automatique au chargement, dès que QFA_BASE est disponible ──
window.addEventListener('load', function() {
    if (window.QFA_BASE) {
        _QfA_Run_Boot();
    } else {
        var t = setInterval(function() {
            if (window.QFA_BASE) {
                clearInterval(t);
                _QfA_Run_Boot();
            }
        }, 50);
    }
});

// ── QfA_DrwNav — point d'entrée retour serveur, propre à PubTop ──────────
// Toujours un payload brut de dessin (g/a/Tip) sur cette page, jamais
// l'enveloppe d'édition {Cmp, QfA} : transmis directement à qfaRun.drw().
function QfA_DrwNav(d_sj) {
    var d_j = (typeof d_sj === 'string') ? JSON.parse(d_sj) : d_sj;
    if (window.qfaRun) {
        window.qfaRun.drw(d_j);
    }
}