/*! SPDX-License-Identifier: MPL-2.0 | Copyright (c) 2026 Marc Gandar | Qovi est une marque de Marc Gandar */
/*!
 * qfa-mrg.js — Assemblage document HTML complet
 * Traduction JS fidèle de _Conv_Mrg_s() en WL
 *
 * Résumé : Assemble un document HTML autonome <html>...<html> incluant
 *          le CSS, le fond SVG positionné en absolu, et le contenu Score.
 *          Utilisé pour alimenter l'iframe .qfa-msg du composant.
 */
var QfaMrg = (function () {

    // =========================================================================
    // _convMrgS — Assemble un document HTML complet
    // Equivalent de _Conv_Mrg_s() en WL
    //
    // css_s       : <style>...</style> à injecter dans <head>
    // scoreHtml_s : contenu HTML du message (issu de QfaScore.convScoreToHtml)
    // dim_ti      : dimensions [largeur, hauteur] du composant en px
    // bckSvg_s    : SVG de fond (optionnel — séparé du texte pour indépendance)
    // pad_i       : marge interne en px (défaut 10 = Cfg_Pad_ic)
    // vert_s      : alignement vertical "top" ou "middle"
    // =========================================================================
    function _convMrgS(css_s, scoreHtml_s, dim_ti, bckSvg_s, pad_i, vert_s) {
        bckSvg_s = bckSvg_s || '';
        pad_i    = (pad_i !== undefined && pad_i !== null) ? pad_i : 10;
        vert_s   = vert_s || 'top';

        var w_i = dim_ti[0] || 320;
        var h_i = dim_ti[1] || 480;

        // ── SVG de fond — positionné en absolu, z-index:-1 ───────────────────
        // Déborde du padding pour couvrir toute la zone visible
        // preserveAspectRatio="xMidYMid slice" : remplit et coupe le surplus
        var svgFond_s = '';
        if (bckSvg_s) {
            var svgPos_i = bckSvg_s.indexOf('<svg ');
            if (svgPos_i >= 0) {
                var endPos_i = bckSvg_s.indexOf('>', svgPos_i);
                if (endPos_i >= 0) {
                    var svgTag_s = bckSvg_s.substring(svgPos_i, endPos_i + 1);
                    // Supprimer dimensions et styles fixes
                    svgTag_s = svgTag_s.replace(/ width="[^"]*"/g,  '');
                    svgTag_s = svgTag_s.replace(/ height="[^"]*"/g, '');
                    svgTag_s = svgTag_s.replace(/ style="[^"]*"/g,  '');
                    // Forcer slice : remplit toute la zone, coupe le surplus
                    if (svgTag_s.indexOf('preserveAspectRatio') >= 0) {
                        svgTag_s = svgTag_s.replace(/preserveAspectRatio="[^"]*"/, 'preserveAspectRatio="xMidYMid slice"');
                    } else {
                        svgTag_s = svgTag_s.replace('<svg ', '<svg preserveAspectRatio="xMidYMid slice" ');
                    }
                    // Positionnement absolu en fond — déborde du padding
                    var svgStyle_s = 'position:absolute;'
                        + 'top:-'   + pad_i + 'px;'
                        + 'left:-'  + pad_i + 'px;'
                        + 'width:'  + (w_i + pad_i * 2) + 'px;'
                        + 'height:' + (h_i + pad_i * 2) + 'px;'
                        + 'z-index:-1;'
                        + 'pointer-events:none;';
                    svgTag_s  = svgTag_s.replace('<svg ', '<svg style="' + svgStyle_s + '" ');
                    svgFond_s = bckSvg_s.substring(0, svgPos_i) + svgTag_s + bckSvg_s.substring(endPos_i + 1);
                }
            }
        }

        // ── Alignement vertical du contenu ────────────────────────────────────
        // "middle" : flexbox centrage vertical | "top" : comportement par défaut
        var flexAlign_s = '';
        if (vert_s === 'middle') {
            flexAlign_s = 'display:flex; flex-direction:column; justify-content:center; align-items:stretch;';
        }

        // Style de la div de contenu — padding + hauteur + alignement vertical
        var divStyle_s = 'position:relative;'
            + 'z-index:1;'
            + 'padding:'      + pad_i + 'px;'
            + 'height:'       + h_i   + 'px;'
            + 'box-sizing:border-box;'
            + (flexAlign_s ? ' ' + flexAlign_s : '');

        // ── Document HTML complet ─────────────────────────────────────────────
        return '<!DOCTYPE html>\n'
            + '<html style="margin:0; padding:0;">\n'
            + '<head>\n'
            + '<meta charset="UTF-8">\n'
            + css_s + '\n'
            + '</head>\n'
            + '<body style="margin:0; padding:0; position:relative; overflow:hidden;">\n'
            + (svgFond_s ? svgFond_s + '\n' : '')
            + '<div style="' + divStyle_s + '">\n'
            + scoreHtml_s + '\n'
            + '</div>\n'
            + '</body>\n'
            + '</html>';
    }

    // ── API publique ──────────────────────────────────────────────────────────
    return {
        convMrgS: _convMrgS   // Assemble document HTML complet pour iframe
    }
}())
