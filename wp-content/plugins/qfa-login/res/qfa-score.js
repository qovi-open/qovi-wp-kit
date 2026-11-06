/*! SPDX-License-Identifier: MPL-2.0 | Copyright (c) 2026 Marc Gandar | Qovi est une marque de Marc Gandar */
/*!
 * qfa-score.js — Système Score : CSS dynamique + HTML + SVG
 * Traduction JS fidèle des procédures WL __Msg_Html
 *
 * Convention de nommage :
 *   _xxx()   procédure/méthode privée
 *   xxx_s    string brute
 *   xxx_sj   string JSON
 *   xxx_s64  string base64
 *   xxx_j    objet JSON
 *   xxx_i    entier
 *   xxx_b    booléen
 *   xxx_ti   tableau d'entiers
 *   xxx_ati  tableau associatif d'entiers
 */
var QfaScore = (function () {

    // ── Constantes cible — 0-indexées, correspondent au JSON _QfA.json ────────
    // Identiques aux constantes WL Target_ic (Mob=1, Awp=2, Win=3) moins 1
    var TARGET_MOB = 0;   // Mobile  : px × 1.2
    var TARGET_AWP = 1;   // WebDev AWP : px → rem (÷16)
    var TARGET_WIN = 2;   // Windows : px × 1

    // ── Table de langues — index 1-basé comme WL Speak_BU_to_S2_s ────────────
    // Fid_Cmp_Pub.Speak_BU_to_S2_s = ["us","fr","de","it","es"]
    var SPEAK_TAS = [null, 'us', 'fr', 'de', 'it', 'es'];

    // Résumé : Convertit un indice de langue (1-basé) en code ISO 2 lettres
    //          Equivalent de _Spk_2s(Spk_i) en WL
    function _spk2s(spk_i) {
        return SPEAK_TAS[spk_i] || 'en';
    }

    // =========================================================================
    // _cssDynDftJ — Structure JSON de styles par défaut
    // Equivalent de _Css_Dyn_Dft_j() en WL
    // Retourne un JSON avec coefficients par cible, styles globaux, éléments h[]
    // =========================================================================
    function _cssDynDftJ() {
        var cfg_j = {};

        // Coefficients par cible (index 0-basé — correspond au JSON sérialisé)
        // mult  : multiplicateur appliqué aux valeurs de base en px
        // unit  : unité CSS cible (px ou rem)
        // prefix: préfixe des classes CSS (vide par défaut)
        cfg_j.k = [
            { mult: 1.2,    unit: 'px',  prefix: '' },  // 0 = Mobile
            { mult: 0.0625, unit: 'rem', prefix: '' },  // 1 = AWP
            { mult: 1,      unit: 'px',  prefix: '' }   // 2 = Windows
        ];

        // Styles globaux communs à toutes les cibles
        cfg_j.g = {
            font_size:   16,
            font_family: 'Questrial, sans-serif',
            color:       '#000013',
            hyphens:     'auto',
            wb:          [-1, 0, 320, 480],
            Brd:         { o: '#C4C4C9', w: 1, e: 8 }
        };

        // Éléments typographiques h[0..12] — index 0-basé comme dans _QfA.json
        // Propriétés : name (classe CSS), size (px base), line_height, margin (px base)
        var h = [];
        function _H(name_s, size_i, line_s, margin_i) {
            h.push({ name: name_s, size: size_i, line_height: line_s, margin: margin_i });
        }
        //       nom    taille  interligne  marge
        _H('p',   16,  '1.5',   3);   // [0]  paragraphe
        _H('h1',  32,  '1.3',  15);   // [1]  titre 1
        _H('h2',  24,  '1.3',  12);   // [2]  titre 2
        _H('h3',  20,  '1.3',  12);   // [3]  titre 3
        _H('h4',  18,  '1.3',  10);   // [4]  titre 4
        _H('h5',  18,  '1.3',   6);   // [5]  titre 5
        _H('h6',  10,  '1.3',   6);   // [6]  titre 6
        _H('ul',  16,  '1.3',   6);   // [7]  liste à puces
        _H('ol',  16,  '1.3',   6);   // [8]  liste numérotée
        _H('li',  16,  '1.3',   3);   // [9]  item de liste
        _H('bq',  16,  '1.4',   3);   // [10] citation
        _H('hr',   0,  '',      6);   // [11] ligne horizontale — margin seulement
        _H('sp',   0,  '',      5);   // [12] spacer invisible — height seulement
        cfg_j.h = h;

        // Styles de tableau
        cfg_j.t     = { name: 't',     width: '100%', border_collapse: 'collapse', margin_top: 5, margin_bottom: 10, font_size: 14 };
        cfg_j.thead = { name: 'th',    font_weight: 'bold', background_color: '#E8E8F0', border_bottom: 'none' };
        cfg_j.tbody = { name: 'tb',    background_color: 'white' };
        cfg_j.trow  = { name: 'tr',    border_bottom: 'none' };
        cfg_j.tcell = { name: 'th,td', padding_v: 3, padding_h: 5, border: 'none', vertical_align: 'top' };

        return cfg_j;
    }

    // =========================================================================
    // _convJsonToCss — JSON styles → feuille de style CSS
    // Equivalent de _Conv_Json_to_Css() en WL
    // styles_j : JSON issu de _cssDynDftJ() ou de _QfA.json/style
    // target_i : indice de cible 0=Mob, 1=AWP, 2=Win (défaut TARGET_AWP)
    // =========================================================================
    function _convJsonToCss(styles_j, target_i) {
        target_i = (target_i !== undefined) ? target_i : TARGET_AWP;

        // Lecture des coefficients — valeurs AWP par défaut si k absent
        var mult_i   = 0.0625;
        var unit_s   = 'rem';
        var prefix_s = '';
        if (styles_j.k && styles_j.k[target_i]) {
            mult_i   = styles_j.k[target_i].mult   || mult_i;
            unit_s   = styles_j.k[target_i].unit   || unit_s;
            prefix_s = styles_j.k[target_i].prefix || '';
        }

        // Résumé : Applique le coefficient cible à une valeur de base en px
        //          Accepte nombre ou string ("14px" → parseFloat)
        function _V(n) {
            if (typeof n === 'string') { n = parseFloat(n) || 0 }
            return (n * mult_i) + unit_s
        }

        // Résumé : Accès défensif à h[i] — JSON 0-indexé : h[0]=p, h[1]=h1...
        //          i est 1-basé (cohérence avec les boucles WL), accède à h[i-1]
        //          Normalise les anciens noms de propriétés (font_size→size, margin_bottom→margin)
        function _h(i) {
            var el = (styles_j.h && styles_j.h[i - 1]) || null;
            if (!el) return { name: 'p', size: 16, line_height: '1.5', margin: 3 }
            return {
                name:        el.name        || 'p',
                size:        el.size        != null ? el.size        : (parseFloat(el.font_size)     || 16),
                line_height: el.line_height || '1.5',
                margin:      el.margin      != null ? el.margin      : (parseFloat(el.margin_bottom) || 3)
            }
        }

        var css_s = '';

        // 1. Conteneur .score — styles globaux
        css_s += '.score {\n';
        css_s += '  font-family: '     + styles_j.g.font_family + ';\n';
        css_s += '  font-size: '       + _V(styles_j.g.font_size) + ';\n';
        css_s += '  color: '           + styles_j.g.color + ';\n';
        css_s += '  hyphens: '         + styles_j.g.hyphens + ';\n';
        css_s += '  -webkit-hyphens: ' + styles_j.g.hyphens + ';\n';
        css_s += '}\n';

        // 2. Éléments typographiques h[1..11] : p, h1-h6, ul, ol, li, bq
        for (var i = 1; i <= 11; i++) {
            var hi_j  = _h(i);
            var cls_s = '.' + prefix_s + hi_j.name;
            css_s += '.score ' + cls_s + ' {\n';
            css_s += '  font-size: '   + _V(hi_j.size)        + ';\n';
            css_s += '  line-height: ' + hi_j.line_height      + ';\n';
            css_s += '  margin: 0 0 '  + _V(hi_j.margin) + ' 0;\n';
            css_s += '}\n';
        }

        // 3. Titres gras h1-h4
        css_s += '.score .' + prefix_s + 'h1, .score .' + prefix_s + 'h2,\n';
        css_s += '.score .' + prefix_s + 'h3, .score .' + prefix_s + 'h4 { font-weight: bold; }\n';

        // 4. Titres normaux h5-h6
        css_s += '.score .' + prefix_s + 'h5, .score .' + prefix_s + 'h6 { font-weight: normal; }\n';

        // 5. Ligne horizontale HR
        css_s += '.score .' + prefix_s + 'hr { border: 0; border-top: 1px solid #ddd; margin: ' + _V(_h(12).margin) + ' 0; }\n';

        // 6. Spacer invisible SP — (02.10.2026) hauteur = UNE LIGNE VIDE de
        //    paragraphe (taille de p × interligne de p), comme le rendu sans
        //    CSS de Flutter et des mails. h[12].margin (5 px, quasi invisible)
        //    n'est plus lu ; il reste dans les JSON stockés sans effet.
        var spP_j  = _h(1);
        var spLh_n = parseFloat(spP_j.line_height) || 1.5;
        css_s += '.score .' + prefix_s + 'sp { display: block; height: ' + _V(spP_j.size * spLh_n) + '; margin: 0; line-height: 0; font-size: 0; overflow: hidden; }\n';

        // 7. Alignements
        css_s += '.score .' + prefix_s + 'c { text-align: center; }\n';
        css_s += '.score .' + prefix_s + 'l { text-align: left; }\n';
        css_s += '.score .' + prefix_s + 'r { text-align: right; }\n';
        css_s += '.score .' + prefix_s + 'j { text-align: justify; }\n';

        // 8. Niveaux de padding (indentation)
        css_s += '.score .' + prefix_s + 'p1 { padding-left: ' + _V(20) + '; }\n';
        css_s += '.score .' + prefix_s + 'p2 { padding-left: ' + _V(40) + '; }\n';
        css_s += '.score .' + prefix_s + 'p3 { padding-left: ' + _V(60) + '; }\n';

        // 9. Listes
        css_s += '.score .' + prefix_s + 'ul, .score .' + prefix_s + 'ol { padding-left: ' + _V(20) + '; }\n';

        // 10. Tableaux
        var t_j     = styles_j.t      || {};
        var thead_j = styles_j.thead  || {};
        var tbody_j = styles_j.tbody  || {};
        var trow_j  = styles_j.trow   || {};
        var tcell_j = styles_j.tcell  || {};
        var tCls_s  = prefix_s + (t_j.name || 't');
        css_s += '.score table.' + tCls_s + ' {\n';
        css_s += '  width: '           + (t_j.width           || '100%')     + ';\n';
        css_s += '  border-collapse: ' + (t_j.border_collapse || 'collapse') + ';\n';
        css_s += '  margin: '          + _V(t_j.margin_top || 5) + ' 0 ' + _V(t_j.margin_bottom || 10) + ' 0;\n';
        css_s += '  font-size: '       + _V(t_j.font_size   || 14) + ';\n';
        css_s += '}\n';
        css_s += '.score .' + prefix_s + (thead_j.name || 'th') + ' { font-weight: ' + (thead_j.font_weight || 'bold') + '; background-color: ' + (thead_j.background_color || '#E8E8F0') + '; border-bottom: ' + (thead_j.border_bottom || 'none') + '; }\n';
        css_s += '.score .' + prefix_s + (tbody_j.name || 'tb') + ' { background-color: ' + (tbody_j.background_color || 'white') + '; }\n';
        css_s += '.score .' + prefix_s + (trow_j.name  || 'tr') + ' { border-bottom: '    + (trow_j.border_bottom     || 'none') + '; }\n';
        css_s += '.score th, .score td { padding: ' + _V(tcell_j.padding_v || 3) + ' ' + _V(tcell_j.padding_h || 5) + '; border: ' + (tcell_j.border || 'none') + '; vertical-align: ' + (tcell_j.vertical_align || 'top') + '; }\n';

        // 11. CSS statique complémentaire — reset + formats inline
        css_s += [
            '.score * { margin: 0; padding: 0; box-sizing: border-box; }',
            '.score { margin: 0 !important; padding: 0 !important; }',
            '.score strong { font-weight: bold; }',
            '.score em { font-style: italic; }',
            '.score u { text-decoration: underline; }',
            '.score s { text-decoration: line-through; }',
            '.score code { background-color: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: "Courier New", monospace; }',
            '.score small { font-size: 0.85em; }',
            '.score sub { vertical-align: sub; font-size: 0.75em; }',
            '.score sup { vertical-align: super; font-size: 0.75em; }',
            '.score a { color: #0066cc; text-decoration: none; }',
            '.score a:hover { text-decoration: underline; }',
            '.score hr { border: none; border-top: 1px solid #ddd; margin: 15px 0; }'
        ].join('\n') + '\n';

        return css_s;
    }

    // =========================================================================
    // _cssDynStatMrgS — Enveloppe le CSS généré dans une balise <style>
    // Equivalent de _Css_Dyn_Stat_Mrg_s() en WL
    // =========================================================================
	function _cssDynStatMrgS(cfg_j, target_i) {
		target_i = (target_i !== undefined) ? target_i : TARGET_AWP;
		var css_s = _convJsonToCss(cfg_j, target_i);

		// CSS statique : alignement vertical — indépendant des coefficients cible
		css_s += [
			'.score { height: 100%; display: flex; flex-direction: column; }',
			'.score > .score-inner { width: 100%; flex-shrink: 0; }',
			'.score.vm > .score-inner { margin-top: auto; margin-bottom: auto; }',
			'.score.vu > .score-inner { margin-bottom: auto; }',
			'.score.vb > .score-inner { margin-top: auto; }'
		].join('\n') + '\n';

		return '<style>\n' + css_s + '\n</style>';
	}

    // =========================================================================
    // _parseVPos — Position verticale d'un texte Score (02.10.2026)
    //
    // Nouvelle forme : la 1ère ligne, SEULE, vaut [UMBumb] + 0 à 3 chiffres :
    //   U / U20  en haut, ou à 20 % de la PLACE QUI RESTE depuis le haut
    //   B / B10  en bas,  ou à 10 % de la place qui reste depuis le bas
    //   M        au milieu (défaut) — un chiffre après M est ignoré
    //   « Place qui reste » = hauteur du cadre − hauteur du message : un
    //   curseur de U0 (haut) à U100 (bas) ; U50 = M ; B20 = U80. Borné à 100,
    //   le message reste donc toujours entièrement visible.
    // Ancienne forme (toujours lue) : lettre collée devant le 1er code de
    //   ligne ([clrj][0-6], hr_, sp_), ex. « Uc1_Titre ». « Bonjour » sans
    //   code reste intact.
    // Retour : { pos: 'U'|'M'|'B'|'' (''=rien trouvé → M), pct: 0..100,
    //            body: le texte Score sans la position }
    // =========================================================================
    function _parseVPos(score_s) {
        var r_j = { pos: '', pct: 0, body: (score_s === null || score_s === undefined) ? '' : String(score_s) };
        var s = r_j.body;
        var m = /^([UMBumb])(\d{1,3})?[ \t]*(\r\n|\r|\n|$)/.exec(s);
        if (m) {
            r_j.pos  = m[1].toUpperCase();
            r_j.pct  = (r_j.pos !== 'M' && m[2]) ? Math.min(100, parseInt(m[2], 10)) : 0;
            r_j.body = s.substring(m[0].length);
            return r_j;
        }
        if (/^[UMBumb](?=[clrj][0-6]|hr_|sp_)/.test(s)) {
            r_j.pos  = s[0].toUpperCase();
            r_j.body = s.substring(1);
        }
        return r_j;
    }

    // =========================================================================
    // _convScoreToHtml — Convertit un texte Score en HTML
    // Equivalent de _Conv_Score_to_Html() en WL
    //
    // Format Score — chaque ligne : [align][type][liste][pad]_contenu
    //   align : c=centré, l=gauche, r=droite, j=justifié
    //   type  : 0=p, 1-6=h1-h6
    //   liste : b=ul, n=ol, q=blockquote (optionnel)
    //   pad   : 1-3 niveaux d'indentation (optionnel)
    //   Formats inline : b_..._b gras, i_..._i italique, u_..._u souligné,
    //                    s_..._s barré, c_..._c code, h_URL_h_texte_h lien,
    //                    __ espace insécable, _r_ saut de ligne (r_ seul :
    //                    seulement en début de contenu ou après un espace)
    //
    // score_s  : texte au format Score
    // target_i : indice de cible (défaut TARGET_AWP)
    // speak_s  : code langue ISO pour la césure (ex: "fr")
    // padding_s: padding CSS optionnel du conteneur (ex: "10px")
    // =========================================================================
	function _convScoreToHtml(score_s, target_i, speak_s, padding_s) {
		target_i  = (target_i  !== undefined) ? target_i  : TARGET_AWP;
		speak_s   = speak_s   || '';
		padding_s = padding_s || '';

		var prefix_s = '';
		if (score_s && typeof score_s !== 'string') { score_s = String(score_s) }
		// HTML brut (05.11.2026, comme les mails) : un texte qui commence par « < »
		// est déjà du HTML, rendu tel quel. Réservé aux textes de l'éditeur du
		// composant (jamais une saisie d'usager).
		if (score_s && /^[ \t\r\n]*</.test(score_s)) { return score_s; }

		// --- Position verticale (02.10.2026) : cf. _parseVPos ---
		var vp_j     = _parseVPos(score_s);
		score_s      = vp_j.body;
		var valign_s = (vp_j.pos === 'U') ? 'vu' : (vp_j.pos === 'B') ? 'vb' : 'vm';  // défaut = milieu
		// % de la PLACE QUI RESTE : deux espaceurs se partagent l'espace libre
		// dans le rapport haut:bas (flex-grow), le contenu ne bouge pas de taille.
		// U20 → 20:80, B20 → 80:20. Rien si pas de chiffre (classes vu/vb).
		var vTop_i   = (vp_j.pos === 'B') ? 100 - vp_j.pct : vp_j.pct;
		var vHas_b   = vp_j.pct > 0;
		var vSpcT_s  = vHas_b ? '<div class="' + prefix_s + 'vs" style="flex:' + vTop_i + ' 0 0;min-height:0"></div>\n' : '';
		var vSpcB_s  = vHas_b ? '<div class="' + prefix_s + 'vs" style="flex:' + (100 - vTop_i) + ' 0 0;min-height:0"></div>\n' : '';

		var langAttr_s = speak_s ? ' lang="' + speak_s + '"' : '';

        // Normalisation des fins de ligne
        var lines = (score_s || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

        // ── (05.11.2026) Échappement : le texte n'est JAMAIS du HTML ─────────
        function _esc(s) {
            // Une entité déjà écrite (&#x26A0, &#9888;, &nbsp;) est gardée :
            // elle ne peut pas créer de balise. Tout autre & est échappé.
            return s.replace(/&(?!#[0-9]+;?|#[xX][0-9a-fA-F]+;?|[A-Za-z][A-Za-z0-9]*;)/g, '&amp;')
                    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
        // Liens : seulement https:, http:, mailto:, un chemin relatif (/ ou #)
        // ou un tag (%Url) que le site remplace par sa propre valeur.
        function _urlOk(u) { return /^(https?:|mailto:|\/|#|%[A-Za-z])/i.test(u); }

        // ── Résumé : Applique les formats inline Score → HTML ─────────────────
        // Ordre : code c_..._c protégé → échappement → retours → espaces
        // insécables → liens → paires → non fermés → code restauré.
        function _applyInline(s) {
            var codes_ts = [];
            // \u0001 et \u0002 servent de marqueurs internes : retirés du texte
            s = s.replace(/[\u0001\u0002]/g, '');
            s = s.replace(/c_([\s\S]+?)_c/g, function (m, c) {
                codes_ts.push(_esc(c));
                return '\u0001' + (codes_ts.length - 1) + '\u0002';
            });
            s = _esc(s);
            // Retour à la ligne : `_r_` partout ; `r_` seul SEULEMENT en début
            // de contenu, après un espace ou juste après un autre retour ;
            // traité AVANT `__` (03.10.2026).
            s = s.replace(/_r_/g, '<br>');
            var prevBr_s;
            do { prevBr_s = s; s = s.replace(/(^|[ \t]|<br>)r_/g, '$1<br>'); } while (s !== prevBr_s);
            s = s.replace(/__/g, '&nbsp;');
            // Lien hypertexte : h_URL_h_texte_h (adresse refusée → texte seul)
            s = s.replace(/h_([\s\S]+?)_h_([\s\S]+?)_h/g, function (m, u, t) {
                return _urlOk(u) ? '<a href="' + u + '">' + t + '</a>' : t;
            });
            // Formats par paires fermées
            s = s.replace(/b_([\s\S]+?)_b/g, '<strong>$1</strong>');
            s = s.replace(/i_([\s\S]+?)_i/g, '<em>$1</em>');
            s = s.replace(/u_([\s\S]+?)_u/g, '<u>$1</u>');
            s = s.replace(/s_([\s\S]+?)_s/g, '<s>$1</s>');
            s = s.replace(/m_([\s\S]+?)_m/g, '<small>$1</small>');
            s = s.replace(/d_([\s\S]+?)_d/g, '<sub>$1</sub>');
            s = s.replace(/e_([\s\S]+?)_e/g, '<sup>$1</sup>');
            // Formats non fermés : un code en début de mot ouvre jusqu'à la
            // fin de la ligne ; fermetures dans l'ordre inverse d'ouverture.
            var NF_TS = { b: 'strong', i: 'em', u: 'u', s: 's', m: 'small', d: 'sub', e: 'sup' };
            var open_ts = [];
            s = s.replace(/(^|[ \t(;:,.!?])([biusmde])_/g, function (m, pre, k) {
                if (open_ts.indexOf(k) >= 0) return m;
                open_ts.push(k);
                return pre + '<' + NF_TS[k] + '>';
            });
            for (var oi = open_ts.length - 1; oi >= 0; oi--) { s += '</' + NF_TS[open_ts[oi]] + '>'; }
            // Restaurer le code inline
            s = s.replace(/\u0001(\d+)\u0002/g, function (m, n) { return '<code>' + codes_ts[+n] + '</code>'; });
            return s;
        }

        // ── Codes de ligne reconnus (05.11.2026) ──────────────────────────────
        var RE_CELL_J  = /^([clrj])([04])t(\d)(?:w(\d{1,2}))?_([\s\S]*)$/;  // cellule de tableau
        var RE_LIST_J  = /^([clrj])0([bn])(\d)_([\s\S]*)$/;                // élément de liste
        var RE_QUOTE_J = /^([clrj])\dq(\d)_([\s\S]*)$/;                    // citation
        var RE_LINE_J  = /^([clrj])([0-6])_([\s\S]*)$/;                    // paragraphe / titre

        // Ligne SANS code : elle prend le code de la dernière ligne de texte
        // codée (paragraphe, titre, liste, citation) ; s'il n'y en a pas
        // encore, `c4_` (comme le composant). Ligne vide, hr_, sp_ et
        // cellules de tableau restent telles quelles.
        var lastCode_s = 'c4_';
        for (var li = 0; li < lines.length; li++) {
            var l_s = lines[li], m_j;
            if (l_s === '' || l_s === 'hr_' || l_s === 'sp_' || RE_CELL_J.test(l_s)) continue;
            if ((m_j = l_s.match(/^([clrj]0[bn]\d_|[clrj]\dq\d_|[clrj][0-6]_)/))) { lastCode_s = m_j[1]; continue; }
            lines[li] = lastCode_s + l_s;
        }

        var html_s = '';
        var idx_i  = 0;
        while (idx_i < lines.length) {
            var line_s = lines[idx_i], mm;

            // ── Tableau : une ligne Score = une cellule ; une nouvelle rangée
            //    commence quand le numéro de colonne revient en arrière (ou au
            //    passage en-têtes → données). ────────────────────────────────
            if (RE_CELL_J.test(line_s)) {
                var tbl_s = '<table class="' + prefix_s + 't">';
                var inHead_b = true, theadOpen_b = false, bodyOpen_b = false;
                var rowOpen_b = false, lastCol_i = 0;
                while (idx_i < lines.length && (mm = lines[idx_i].match(RE_CELL_J))) {
                    var type_s = mm[2], col_i = +mm[3];
                    if (type_s === '0' && inHead_b) {
                        if (rowOpen_b) { tbl_s += '</tr>'; rowOpen_b = false; }
                        if (theadOpen_b) tbl_s += '</thead>';
                        tbl_s += '<tbody class="' + prefix_s + 'tb">';
                        inHead_b = false; bodyOpen_b = true;
                    }
                    if (inHead_b && !theadOpen_b) { tbl_s += '<thead class="' + prefix_s + 'th">'; theadOpen_b = true; }
                    if (rowOpen_b && col_i <= lastCol_i) { tbl_s += '</tr>'; rowOpen_b = false; }
                    if (!rowOpen_b) { tbl_s += '<tr class="' + prefix_s + 'tr">'; rowOpen_b = true; }
                    var cTag_s = (type_s === '4') ? 'th' : 'td';
                    var wSt_s  = mm[4] ? ' style="width:' + (+mm[4]) + '%"' : '';
                    tbl_s += '<' + cTag_s + ' class="' + prefix_s + 'c' + col_i + ' ' + mm[1] + '"' + wSt_s + '>' +
                             _applyInline(mm[5]) + '</' + cTag_s + '>';
                    lastCol_i = col_i;
                    idx_i++;
                }
                if (rowOpen_b) tbl_s += '</tr>';
                if (inHead_b && theadOpen_b) tbl_s += '</thead>';
                if (bodyOpen_b) tbl_s += '</tbody>';
                html_s += tbl_s + '</table>\n';
                continue;
            }

            // ── Liste ul / ol (éléments consécutifs de même type et retrait) ──
            if ((mm = line_s.match(RE_LIST_J))) {
                var lt_s = mm[2], lp_s = mm[3];
                var ltag_s = lt_s === 'b' ? 'ul' : 'ol';
                var lcls_s = prefix_s + ltag_s + ((+lp_s > 0) ? ' ' + prefix_s + 'p' + lp_s : '');
                var lst_s = '<' + ltag_s + ' class="' + lcls_s + '">';
                while (idx_i < lines.length && (mm = lines[idx_i].match(RE_LIST_J)) && mm[2] === lt_s && mm[3] === lp_s) {
                    lst_s += '<li class="' + prefix_s + 'li ' + mm[1] + '">' + _applyInline(mm[4]) + '</li>';
                    idx_i++;
                }
                html_s += lst_s + '</' + ltag_s + '>\n';
                continue;
            }

            // ── Lignes simples ────────────────────────────────────────────────
            if (line_s === 'hr_') {
                html_s += '<hr class="' + prefix_s + 'hr">\n';
            } else if (line_s === 'sp_') {
                html_s += '<div class="' + prefix_s + 'sp">&nbsp;</div>\n';
            } else if ((mm = line_s.match(RE_QUOTE_J))) {
                var qPad_s = (+mm[2] > 0) ? ' ' + prefix_s + 'p' + mm[2] : '';
                html_s += '<blockquote class="' + prefix_s + 'bq ' + mm[1] + qPad_s + '">' + _applyInline(mm[3]) + '</blockquote>\n';
            } else if ((mm = line_s.match(RE_LINE_J))) {
                var tag_s = (mm[2] === '0') ? 'p' : 'h' + mm[2];
                html_s += '<' + tag_s + ' class="' + prefix_s + tag_s + ' ' + mm[1] + '">' + _applyInline(mm[3]) + '</' + tag_s + '>\n';
            }
            idx_i++;
        }

        var stylePad_s = padding_s ? ' style="padding:' + padding_s + '"' : '';
		return '<div class="score ' + prefix_s + valign_s + '"' + langAttr_s + stylePad_s + '>\n' +
				vSpcT_s +
				'<div class="score-inner">\n' + html_s + '</div>\n' +
				vSpcB_s + '</div>';
    }

    // =========================================================================
    // _svgFitCtrlS — Adapte un SVG pour usage comme icône dans un champ HTML
    // Equivalent de _Svg_Fit_Ctrl_s() en WL
    // Supprime width/height/style fixes, ajoute preserveAspectRatio + style 100%
    // =========================================================================
    function _svgFitCtrlS(svg_s) {
        if (!svg_s) return '';
        var svgPos_i = svg_s.indexOf('<svg ');
        if (svgPos_i < 0) return svg_s;
        var endPos_i = svg_s.indexOf('>', svgPos_i);
        if (endPos_i < 0) return svg_s;

        var tag_s = svg_s.substring(svgPos_i, endPos_i + 1);
        // Supprimer les dimensions et styles fixes
        tag_s = tag_s.replace(/ width="[^"]*"/g,  '');
        tag_s = tag_s.replace(/ height="[^"]*"/g, '');
        tag_s = tag_s.replace(/ style="[^"]*"/g,  '');
        // Ajouter preserveAspectRatio si absent
        if (tag_s.indexOf('preserveAspectRatio') < 0) {
            tag_s = tag_s.replace(' viewBox=', ' preserveAspectRatio="xMidYMid meet" viewBox=');
        }
        // Style pour remplir le conteneur parent
        tag_s = tag_s.replace('<svg ', '<svg style="width:100%; height:100%; display:block;" ');

        return svg_s.substring(0, svgPos_i) + tag_s + svg_s.substring(endPos_i + 1);
    }

    // ── API publique ──────────────────────────────────────────────────────────
    return {
        TARGET_MOB:      TARGET_MOB,      // Constante cible Mobile
        TARGET_AWP:      TARGET_AWP,      // Constante cible WebDev AWP
        TARGET_WIN:      TARGET_WIN,      // Constante cible Windows
        spk2s:           _spk2s,          // Indice langue → code ISO
        cssDynDftJ:      _cssDynDftJ,     // Structure JSON styles par défaut
        convJsonToCss:   _convJsonToCss,  // JSON styles → CSS
        cssDynStatMrgS:  _cssDynStatMrgS, // JSON styles → <style>...</style>
        convScoreToHtml: _convScoreToHtml, // Score → HTML
        parseVPos:       _parseVPos,      // Position verticale (U/M/B + %)
        svgFitCtrlS:     _svgFitCtrlS     // SVG → icône adaptée
    }
}())
