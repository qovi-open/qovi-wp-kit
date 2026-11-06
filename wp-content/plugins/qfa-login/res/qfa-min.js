/*! SPDX-License-Identifier: MPL-2.0 | Copyright (c) 2026 Marc Gandar | Qovi est une marque de Marc Gandar */
/*!
 * qfa-min.js — Composant QfA — Authentification par QR code
 * ═══════════════════════════════════════════════════════════════════════
 * Composant PUBLIC du produit QfA, destiné à être intégré tel quel par
 * les clients du service dans leur site/application (PHP, WordPress,
 * Node.js, Joomla, Android...). Zéro dépendance — Vanilla JS pur.
 *
 * Dépendances : qfa-score.js (rendu Score→HTML/SVG), qfa-mrg.js (assemblage HTML)
 *
 * ── Usage par un intégrateur ─────────────────────────────────────────────
 * Une seule instance vit sur la page, créée une fois pour toute sa durée
 * de vie. Pas de concept d'instance "édition" ni "popup" côté client —
 * c'est une spécificité propre à l'outil d'édition interne (qfa-vjs.js).
 *
 *   var QfA = QfaCreate();
 *   QfA.init('mon-container', {
 *       configUrl : 'chemin/vers/_QfA.json',
 *       mode      : 'run',
 *       Key_Us    : 'clé_256bit_du_site',
 *       Rea_s     : 'Demande d\'authentification',
 *       onReady   : function() { ... },
 *       onMessage : function(data) { ... }
 *   });
 *
 * ── Communication — symétrique, agnostique du serveur utilisé ───────────
 *
 *   JS → Serveur (sortant)
 *     Chaque événement est notifié via opts.onMessage(data). C'est à
 *     l'intégrateur de transmettre ça à son serveur, par le moyen de son
 *     choix (fetch, axios, requests Python, AJAX WebDev...).
 *     Si onMessage n'est pas fourni, un mécanisme de repli WebDev-
 *     spécifique prend le relai (écrit dans un bouton caché puis
 *     déclenche .click() — voir opts.bridge). Ce repli ne concerne QUE
 *     les intégrations WebDev et peut être ignoré dans tout autre contexte.
 *
 *   Serveur → JS (retour)
 *     Une fois la réponse serveur obtenue, peu importe le moyen, appeler
 *     QfA.drw(reponseJson) pour réafficher le composant dans son nouvel
 *     état. Point d'entrée unique, symétrique à onMessage.
 *
 *   Exemple minimal, indépendant de toute techno serveur :
 *     onMessage: function(data) {
 *         monAppelServeur(data).then(function(reponse) {
 *             QfA.drw(reponse);
 *         });
 *     }
 *
 * ── Actions possibles (data.action dans onMessage) ───────────────────────
 *   ch1_run / ch1_edt : démarrage de l'authentification
 *                       (edt = usage interne éditeur uniquement, jamais
 *                        rencontré en intégration client)
 *   go_run  / go_edt  : authentification réussie
 *   ko        : erreur d'authentification
 *   close     : utilisateur ferme le composant
 *   qrc_click : utilisateur clique le QR code (seulement si le serveur a
 *               renvoyé a.Qrc.e = true, voir _bindEvents/drw)
 *
 *   NB — la mémorisation Edr (cookie navigateur) est gérée intégralement
 *   en local par ce fichier (localStorage). Le serveur n'a jamais besoin
 *   d'en être informé : aucune action cki_store/cki_clear n'est notifiée.
 *
 * ── Format de a.Qrc reçu du serveur (dans drw()) ─────────────────────────
 *   a.Qrc.svg : image SVG autonome (QR + logo) rendue par le serveur.
 *   a.Qrc.txt : (reserve) non utilise — le serveur rend le svg complet.
 *   a.Qrc.e : booléen — image cliquable (true) ou non (false). Ne change
 *             JAMAIS la taille affichée (toujours 110×110) : un visuel
 *             "logo seul" est généré par le serveur à la même taille
 *             qu'un vrai QR scannable, c'est le contenu de l'image lui-
 *             même qui diffère, pas le CSS appliqué côté JS.
 *
 * ── v49 (30.09.2026) — aperçu Studio + parité de rendu ───────────────────
 *   - init() accepte opts.config (objet _QfA.json) à la place de configUrl :
 *     aucun chargement réseau (aperçu du Studio Qovi).
 *   - setConfig() redessine le dernier état affiché (sans rouvrir CH2).
 *   - Rendu ajouté : style.g.bg (fond), style.g.Brd (bordure o/w/e),
 *     style.geo["254"] (w/h/visible de la croix), CSS généré par
 *     QfaScore (tailles corps/titres, interlignes — calculé mais jamais
 *     injecté avant v49, cloisonné par instance #id), bloc tag[] global
 *     (%Brand/%Dom/%Url…).
 *   - Mode edt + opts.onMessage : les clics d'édition (254/223/Sto-Clr)
 *     sont notifiés par onMessage ({action:'qfa_svg', i}) ; sans
 *     onMessage, repli inchangé sur le bouton WebDev C3.
 *
 * ── v50 (01.10.2026) — adaptation mobile automatique ─────────────────────
 *   - Un seul design : si l'écran est plus étroit que le composant (+16 px
 *     de marge), le composant est RÉDUIT proportionnellement (transform
 *     scale) ; x/y ignorés (posé en 0,0 — centré si setScreen() est utilisé).
 *   - Bloc FACULTATIF style.m = { bp, w, h, font_size } : sous bp px de
 *     large, w/h/font_size remplacent ceux de style.g (clé absente = valeur
 *     bureau). Sans style.m : réduction seule.
 *   - setScreen(w) : impose une largeur d'écran simulée (aperçu Studio,
 *     vue Mobile) ; 0 = largeur réelle de la fenêtre (défaut).
 *
 * ── v51 (01.10.2026) — version du schéma _QfA.json ───────────────────────
 *   - Lit cfg.version ("3.0", ou l'ancien nombre 2.3) et la compare au
 *     schéma qu'il connaît (QFA_SCHEMA 3.0). Plus récent ou autre majeure :
 *     AVERTISSEMENT console seulement, rendu avec ce qu'il connaît. Jamais
 *     d'erreur bloquante : c'est la page de connexion d'un client.
 *
 * ── v52 (01.10.2026) — schéma 3.1 : ombre, dégradé, image de fond ───────
 *   - style.g.shd = { y, blur, o, a } : ombre portée (box-shadow).
 *   - style.g.grd = { c1, c2, a }     : fond en dégradé (prioritaire sur bg).
 *   - style.geo["256"] = { visible, a, blur } : image de fond masquée /
 *     atténuée (opacité) / floutée (px).
 *   - Le conteneur parent réservé autour du composant vaut x + largeur + x
 *     (idem en hauteur) : une marge x/y laisse la place à l'ombre.
 *
 * ── v53 (01.10.2026) — schéma 3.2 : champ email stylé ─────────────────────
 *   - style.g.ctl = { bg, color, o, w, e } : fond, couleur du texte, couleur
 *     et épaisseur du contour, arrondi du champ email (.qfa-edr). Absent =
 *     apparence historique (contour gris 1 px, arrondi 4 px).
 *
 * ── v54 (01.10.2026) — icônes écartées des coins arrondis ────────────────
 *   - La croix (haut droite) et la ligne du bas (mémoriser / champ / >>)
 *     s'écartent du bord en proportion de l'arrondi style.g.Brd.e :
 *     marge = max(4, 30 % du rayon). Arrondi <= 13 px : rendu inchangé.
 *
 * ── v55 (01.10.2026) — mode 'dsp' (AFFICHAGE SEUL) ───────────────────────
 *   - Le composant DESSINE l'état reçu par drw() mais ne parle JAMAIS au
 *     serveur (pas de CH1, pas de WebSocket CH2) : la logique du login est
 *     tenue par l'hôte (contrôleur Flutter du Studio/de la home, ou natif
 *     d'une app mobile). Les gestes du visiteur sont remontés par onMessage :
 *     { action:'ui', what:'run'|'cki'|'esc'|'qrc', edr:'<champ>', has:<cookie> }.
 *
 * ── v56 (01.10.2026) — lettre de position verticale U/M/B ─────────────────
 *   - N'est reconnue que suivie d'un code de ligne ([clrj][0-6], hr_, sp_) :
 *     un texte sans code commençant par B/M/U (« Bonjour ») reste intact.
 *
 * ── v57 (02.10.2026) — Score v2 : position verticale sur sa propre ligne ─────
 *   - 1ère ligne seule « U », « U20 », « B10 », « M » (QfaScore.parseVPos) ;
 *     l'ancienne lettre collée (« Uc1_… ») reste lue.
 *   - Décalage % = espaceur flex qui cède : le message reste toujours visible.
 *   - sp_ = une ligne vide de paragraphe (CSS de qfa-score.js).
 *
 * ── v58 (02.10.2026) — % de la PLACE QUI RESTE ───────────────────────────
 *   - U20 = 20 % de (hauteur − message) depuis le haut : curseur U0 (haut)
 *     → U50 (= M) → U100 (bas) ; B20 = U80. Deux espaceurs flex-grow.
 *
 * ── v59 (02.10.2026) — mode dsp : icône mémoriser/oublier à jour ─────────
 *   - En dsp, l'adresse mémorisée appartient à l'HÔTE (contrôleur Flutter,
 *     SharedPreferences -> localStorage « flutter.qfa_edr »). Le moteur la
 *     relit à chaque drw() et après un clic sur l'icône (le contrôleur
 *     l'écrit en asynchrone), pour que l'icône suive l'état réel.
 *
 * ── v60 (02.10.2026) — lot 4 : placement générique + couleurs de texte ────
 *   - style.place.{qr|bar|bg} = { anc, dx, dy, w, h } : ancre parmi 9
 *     (t/c/b + l/c/r : tl tc tr cl cc cr bl bc br), décalage en px (nombre)
 *     ou en % du composant ("10%"), positif = vers la droite / vers le bas,
 *     w/h = taille (px ou %). qr.w = taille du QR/logo (défaut 110).
 *   - style.place.bar.layout = "side" (défaut) | "below" : boutons à côté
 *     du champ ou en dessous ; bar.icon = taille des boutons carrés (px).
 *   - style.g.tc = { p, h1..h6 } : couleur du texte par niveau Score.
 *   - Absent = rendu historique au pixel près. Schéma 3.3.
 *
 * ── v61 (02.10.2026) — lot 4, livraison 2 : nouvelles cases 291 / 292 ───
 *   - 291 = logo d'EN-TÊTE (SVG, format libre) : affiché seulement si la case
 *     contient une image ; cadre par défaut 120 x 36 en haut à gauche
 *     (16 px, 12 px), image logée sans déformation ; style.place.hdr.
 *   - 292 = TEXTE D'INVITE du champ email (placeholder, texte simple ; un
 *     code de ligne Score éventuel est ignoré ; %tags remplacés).
 *   - Schéma 3.4.
 *
 * ── v62 (02.10.2026) — aperçu (edt) : clic sur mémoriser/oublier ─────────
 *   - Comme sur le vrai composant, le clic BASCULE l'icône affichée
 *     (mémoriser -> oublier -> mémoriser), sans rien stocker, puis l'hôte
 *     reçoit l'icône désormais affichée (pour l'éditer).
 *
 * ── v63 (02.10.2026) — boutons « en dessous » : la zone QR remonte ────────
 *   - Barre en layout below et zone QR NON placée (style.place.qr absent) :
 *     la zone QR se pose automatiquement au-dessus de la barre (plus haute)
 *     au lieu de la chevaucher.
 *
 * ── v64 (02.10.2026) — aperçu (edt) : clic sur le QR ────────────────────────
 *   - Bascule l'image de la zone QR : QR code <-> logo carré seul (case 219),
 *     pour voir et éditer les deux états. Aucun effet hors aperçu.
 *
 * ── v65 (13.10.2026) — page hôte Flutter (qovi.ch) : champ d'adresse ──────
 *   - Flutter web peint la sélection des <input> en TRANSPARENT (règle
 *     globale sous flutter-view) : la sélection de l'adresse était invisible.
 *     -> style « qfa-edr-fix » qui redonne une sélection visible au champ.
 *   - Flutter capte les touches qui remontent jusqu'à lui (Ctrl+C / Ctrl+V
 *     inopérants, Entrée parfois perdue). -> les touches et le presse-papiers
 *     du champ ne remontent plus au-delà du champ (stopPropagation, SANS
 *     preventDefault : le navigateur garde son comportement normal).
 *   Sans effet visible dans une page HTML ordinaire (kits).
 *
 * ── v66 (16.10.2026) — relief par élément + typographie (schéma 3.5) ──────
 *   - style.g.rlf = { btn, field, qr : 'flat' | 'neu' | 'in', k : 0..1 } :
 *     neumorphisme (deux ombres, lumière en haut à gauche) ou enfoncé
 *     (ombres intérieures) sur les boutons (mémoriser/oublier et >>), le champ
 *     email et le cadre du QR. Ombres CALCULÉES depuis le fond du composant.
 *   - style.g.typ = { t : {w, up, ls}, p : {w, up, ls, lh} } : graisse,
 *     majuscules, espacement des lettres (em) des titres (t) et du texte (p),
 *     interligne du texte. Valeurs numériques bornées.
 *   - SÉCURITÉ : les couleurs de style.g.tc passent par _safeColor avant
 *     d'entrer dans une feuille CSS (injection « red}body{… » fermée).
 *   Absent = rendu v65 au pixel près.
 *
 * ── v67 (16.10.2026) — relief sur TOUS les éléments + marge des bords ──────
 *   - style.g.rlf.esc (croix) et style.g.rlf.hdr (logo d'en-tête) : mêmes
 *     effets que btn/field/qr.
 *   - style.g.mrg (px, 0..40) : distance de la croix et de la barre de
 *     saisie aux bords ; un relief actif ajoute la place de ses ombres.
 *   Toujours schéma 3.5 (clés ajoutées le jour même, avant toute diffusion).
 *
 * ── v68 (16.10.2026) — marges plus sobres ─────────────────────────────────
 *   - style.g.mrg = marge TOTALE (le relief ne s'y ajoute plus) ; sans mrg,
 *     un relief n'écarte les bords que de la moitié de ses ombres ; la barre
 *     de saisie garde toute sa largeur utile.
 *
 * ── v69 (16.10.2026) — SILHOUETTES + textes longs (schéma 3.6) ────────────
 *   - style.place.esc = { anc, dx, dy } : la croix, placée librement.
 *   - style.place.run = { anc, dx, dy, w } : le bouton >> détaché de la barre.
 *   - style.place.msg = { anc, dx, dy, w, h, ta } : la zone de texte ;
 *     ta = l / c / r force l'alignement.
 *   - style.place.pnl = { anc, dx, dy, w, h, bg, a, blur, e } : panneau en
 *     verre dépoli derrière le QR et la barre (silhouette immersive).
 *   - TEXTES LONGS (toutes silhouettes, classique comprise) : la zone de
 *     texte s'arrête au-dessus des éléments placés dessous ; si le texte ne
 *     tient pas, il est réduit (jusqu'à ~11,5 px), puis la zone défile à la
 *     molette / au doigt, sans ascenseur, avec un fondu haut/bas. Le texte
 *     qui tient ne bouge pas. getFit() + notification { action:'fit' }.
 *   - style.m.place : placements utilisés sur écran étroit (style.m.bp),
 *     ex. une silhouette paysage qui repasse en classique sur téléphone.
 *   - Sans champ Edr : ni mémoriser/oublier ni >> (même détaché).
 *   - Logo d'en-tête visible : un texte trop long commence sous lui.
 *   - SÉCURITÉ : couleur et police de la zone de texte filtrées (elles
 *     entraient brutes dans un attribut HTML).
 *
 * ── v70 (16.10.2026) — molette : le texte qui défile passe en premier ─────
 *   - Sur une zone de texte qui défile, la molette fait défiler le texte
 *     avant la page hôte (le Studio Flutter consommait la molette et
 *     bloquait le défilement du texte) ; en butée, la page reprend la main.
 *
 * ── v71 (27.10.2026) — visibilité par case (œil de la Librairie) ──────────
 *   - style.geo["291" | "223" | "228" | "235"].visible === false cache le logo
 *     d'en-tête, le bouton >>, l'icône cookie affichée (opacité + clics
 *     coupés). 254 (croix) et 256 (fond) l'étaient déjà.
 *
 * ── v72 (27.10.2026) — logo d'en-tête caché = place rendue au texte ──────
 *   - geo["291"].visible === false retire le logo (display:none) au lieu de
 *     le rendre transparent : un texte long peut reprendre sa place.
 *
 * ── v73 (27.10.2026) — clé silencieuse Qovi (anti-usurpation de navigateur)
 *   - À l'ouverture du CH2, le composant crée une iframe INVISIBLE
 *     qovi.ch/pk/sk.html et lui passe Prv_NaP_u : elle prouve en silence
 *     (sans geste ni dialogue) si cet appareil est reconnu ; le verdict part
 *     au serveur, puis au mobile avec la demande de vote. La page hôte ne
 *     reçoit jamais le verdict ni la clé.
 *   - Au GO, si le serveur l'indique (Sk.e, après « Valider et reconnaître »
 *     sur le mobile), l'iframe enregistre l'appareil avant la suite (3 s max).
 *   - Sans iframe possible (CSP du site, ancien navigateur) : rien ne change,
 *     le login fonctionne comme avant.
 *   - NE PAS RETIRER : _skInit, _skPost, _skEnrolThen, l'appel _skInit dans
 *     ws.onopen et _skEnrolThen dans le cas RES_GO (discussion passkey).
 *
 * ── v74 (29.10.2026) — Lay par message pour le décor ──────────────────────
 *   - cfg.Lay (aligné sur cfg.index) donne, pour chaque message, les widgets
 *     décoratifs affichés : 8 logo d'en-tête 291, 16 croix 254, 32 >> 223,
 *     64 mémoriser/vider 235/228, 128 fond 256 (bit à 1 = affiché).
 *   - Le message courant est Tip.t[0] (numéro envoyé par le serveur) ou
 *     Tip.i (aperçu du Studio). Message inconnu ou Lay absent : tout est
 *     affiché (255). Un widget s'affiche si l'œil (style.geo) ET Lay le
 *     permettent.
 *   - Les bits 1, 2, 4 (message, QR/logo, Edr) restent décidés par le
 *     serveur : le moteur ne les lit pas.
 *
 * ── v75 (29.10.2026) — logo seul : décidé par Lay ────────────────────────
 *   - a.Qrc.lg === true : le serveur n'envoie QUE le logo carré (pas de QR).
 *     Il s'affiche si le bit 2 du Lay du message est allumé, sinon la zone
 *     QR est masquée (le texte reprend la place). Un vrai QR (lg absent)
 *     s'affiche toujours (règle Marc 28.10).
 *
 * ── v79 (01.11.2026) — le conteneur prend la taille du composant ────────
 *   - À chaque affichage (start, drw, drwTip), le parent du conteneur reçoit
 *     la taille du composant (comme setScreen/setConfig le faisaient déjà) ;
 *     il la rend à la fermeture (croix en mode run). Corrige le composant
 *     décentré chez un client qui centre sa page : le #qfa-wrapper des kits
 *     (inline-block) restait de largeur nulle, la racine étant en absolu.
 *
 * ── v78 (31.10.2026) — fond superposé à un widget (site v4) ─────────────
 *   - _Edr détaché (place.edr) : taille EXTÉRIEURE w x h (border-box),
 *     h = place.edr.h sinon 36 — il ne suit plus la taille des boutons
 *     (bar.icon), qui ne concerne que la barre.
 *   - Barre (.qfa-c3) vidée par les détachements : invisible, elle ne
 *     limite plus la place du texte.
 *   - style.place.bg.on = code d'un widget (_Qrc, _Rec, _Msg...) : l'image
 *     de fond (_Bck, case 256) prend le rectangle de ce widget, le suit
 *     (replis, relatif, mobile) et reste DESSOUS. Prioritaire sur anc/w/h.
 *     Widget caché : fond de taille nulle. Code inconnu : ignoré (console).
 *
 * ── v77 (29.10.2026) — placement relatif des widgets (lot 5a) ───────────
 *   - style.place.<zone>.ref = code d'un autre widget (_Rec _Qrc _Msg _Run
 *     _Esc _Edr _Coi/_Coo), side r|l|b|t (droite gauche dessous dessus),
 *     al s|c|e (début centre fin), gap, full (_Msg pleine largeur jusqu'en
 *     bas). Nouvelles zones edr et cki : _Edr et le cookie sortent de la
 *     barre dès qu'ils ont une règle.
 *   - Repli : « droite/gauche » qui ne tient pas passe dessous (mobile sans
 *     règle propre) ; hors cadre -> ramené au bord ; caché -> place nulle ;
 *     boucle / code inconnu -> règle ignorée (console).
 *
 * ── v76 (29.10.2026) — Studio et clic sur le QR ──────────────────────────
 *   - Mode edt (Studio) : la place libre du texte (_Msg) est encadree en
 *     pointille (sous le logo d'en-tete, au-dessus du QR et de la barre).
 *   - Mode run : des le clic sur le QR, il est remplace par le logo carre
 *     (_Sqr, case 219) et n'est plus cliquable -> ni double clic, ni scan
 *     apres clic (Marc 29.10). Bit 2 du Lay du message eteint, ou pas de
 *     logo : la zone QR est masquee. La reponse suivante du serveur reprend
 *     la main.
 *   - Panneau (place.pnl, _Pnl) DESACTIVE pour le moment (PNL_ON = false) :
 *     jamais dessine, meme si le _QfA.json en contient un.
 *
 * ── API publique vs interne ──────────────────────────────────────────────
 * Seules les méthodes retournées par QfaCreate() sont publiques :
 *   init, start, drw, drwTip, setConfig, getOpts, getEl, getWb
 * Tout le reste (préfixe _) est interne et ne doit jamais être appelé
 * directement par un intégrateur.
 */
console.log('[qfa-min] version 79');

// ── Factory — crée une instance indépendante du composant QfA ────────────
function QfaCreate() {
    var RES_KO = 1, RES_GO = 2, RES_OK = 3, RES_OG = 7;
    var CFG_ESC = 254, CFG_RUN = 223, CFG_STO = 235, CFG_CLR = 228, CFG_BCK = 256, CFG_PAD = 10, CFG_SQR = 219;
    var CFG_HDR = 291, CFG_PH = 292;   // v61 : logo d'en-tête, texte d'invite

    var el = null, opts = {}, msgTj = null, msgAti = {}, cssCmpJ = null, cssCmpS = '', spk2s = 'fr';
    var layJ = null, curLay = 255;   // v74 : Lay par message (décor)
    var PNL_ON = false;   // v76 : panneau _Pnl désactivé pour le moment (Marc 29.10)
    var LAYBIT = { 291: 8, 254: 16, 223: 32, 235: 64, 228: 64, 256: 128 };   // v74
    var cookie = '';
    try { cookie = localStorage.getItem('qfa_edr') || ''; } catch(e) { cookie = ''; }
    var ws = null, chxG_j = null, chxNaP_s = '', chxUrl_s = '';
    var skIfr = null, skOrig = '', skReady = false, skPendU = '', skEnrolCb = null;   // v73 clé silencieuse
    var tagJ = {}, lastDrw_j = null;
    var screenW = 0;   // v50 : largeur d'écran simulée (0 = fenêtre réelle)   // v49 : tags globaux + dernier état drw()

    // Initialise le composant dans un conteneur HTML et charge sa config
    function init(containerId_s, options_j) {
        el   = document.getElementById(containerId_s);
        opts = options_j || {};
        if (!el) { console.error('[QfA] Conteneur introuvable : ' + containerId_s); return }
        // v49 : config fournie en objet (aperçu Studio) -> pas de XHR
        if (opts.config) {
            try {
                _boot((typeof opts.config === 'string') ? JSON.parse(opts.config) : opts.config);
            } catch (e) { console.error('[QfA] Erreur config fournie :', e) }
            return;
        }
        _loadConfig(opts.configUrl || '_QfA.json');
    }

    // Démarrage commun (config chargée par XHR ou fournie en objet)
    function _boot(cfg_j) {
        _initConfig(cfg_j);
        _buildLayout();
        _bindEvents();
        if (typeof opts.onReady === 'function') { opts.onReady() }
    }

    // Charge _QfA.json en AJAX puis construit le layout et bind les events
    function _loadConfig(url_s) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url_s + '?v=' + new Date().getTime(), true);
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    _boot(JSON.parse(xhr.responseText));
                } catch (e) { console.error('[QfA] Erreur parsing config :', e) }
            } else { console.error('[QfA] Impossible de charger : ' + url_s) }
        };
        xhr.onerror = function () { console.error('[QfA] Erreur réseau : ' + url_s) };
        xhr.send();
    }

    // v51 — schéma _QfA.json connu de ce moteur (voir qfa_draft_state.dart)
    var QFA_SCHEMA_MAJ = 3, QFA_SCHEMA_MIN = 6;   // v69 : 3.6
    function _checkVersion(v) {
        if (v === undefined || v === null) return;
        var s = (typeof v === 'number') ? (v === 2.3 ? '2.3' : String(v)) : String(v);
        if (s === '2.3') return;                         // ancien format, lu tel quel
        var p = s.split('.'), maj = parseInt(p[0], 10), min = parseInt(p[1] || '0', 10);
        if (maj !== QFA_SCHEMA_MAJ) {
            console.warn('[qfa-min] _QfA.json version ' + s + ' : majeure inconnue de ce moteur (' + QFA_SCHEMA_MAJ + '.' + QFA_SCHEMA_MIN + ') — rendu au mieux.');
        } else if (min > QFA_SCHEMA_MIN) {
            console.warn('[qfa-min] _QfA.json version ' + s + ' plus récente que ce moteur (' + QFA_SCHEMA_MAJ + '.' + QFA_SCHEMA_MIN + ') — options inconnues ignorées.');
        }
    }

    // Assigne style/messages/index depuis un objet config (total ou partiel)
    function _initConfig(cfg_j) {
        try { _checkVersion(cfg_j.version) } catch (e) {}
        var ss = cfg_j.style;
        if (ss) {
            cssCmpJ = (typeof ss === 'string') ? JSON.parse(ss) : ss;
            cssCmpS = QfaScore.cssDynStatMrgS(cssCmpJ, QfaScore.TARGET_AWP);
        }
        var msgs = cfg_j.messages || cfg_j.Msg;
        if (msgs) {
            msgTj = (msgs && Array.isArray(msgs[0])) ? msgs[0] : msgs;
        }
        // v49 : bloc tag[] global ([{s:'%Brand', v:'QfA'}, ...]) — remplacé
        // à l'affichage, insensible à la casse (miroir du widget Flutter)
        if (Array.isArray(cfg_j.tag)) {
            tagJ = {};
            for (var t = 0; t < cfg_j.tag.length; t++) {
                var tg = cfg_j.tag[t];
                if (tg && tg.s) { tagJ[String(tg.s)] = (tg.v === undefined || tg.v === null) ? '' : String(tg.v) }
            }
        }
        // v49 : config PARTIELLE (ex. {style} seul) -> on garde l'index courant
        var idx = cfg_j.index;
        if (idx) {
            msgAti = {};
            for (var i = 0; i < idx.length; i++) { msgAti[idx[i]] = i + 1 }
            // v74 : Lay aligné sur index (absent = tout affiché)
            layJ = null;
            if (Array.isArray(cfg_j.Lay) && cfg_j.Lay.length === idx.length) {
                layJ = {};
                for (var j = 0; j < idx.length; j++) { layJ[idx[j]] = Number(cfg_j.Lay[j]) }
            }
        }
    }

    // Construit le HTML interne du composant (calques bck/msg/c1/c2/c3)
    function _buildLayout() {
        var wb  = (cssCmpJ && cssCmpJ.g && cssCmpJ.g.wb) ? cssCmpJ.g.wb : [-1, 0, 320, 480];
        var w_i = wb[2], h_i = wb[3];

        el.style.cssText = [
            'position:absolute',
            'left:'   + (wb[0] < 0 ? 0 : wb[0]) + 'px',
            'top:'    + wb[1] + 'px',
            'width:'  + w_i + 'px',
            'height:' + h_i + 'px',
            'display:none',
            'overflow:hidden',
            'font-family:' + (cssCmpJ.g.font_family || 'sans-serif')
        ].join(';');

        el.innerHTML =
            '<div class="qfa-css" style="display:none"></div>' +
            '<div class="qfa-bck" style="position:absolute;top:0;left:0;width:' + w_i + 'px;height:' + h_i + 'px;z-index:0;pointer-events:none;"></div>' +
            '<div class="qfa-hdr" style="display:none;position:absolute;top:12px;left:16px;width:120px;height:36px;z-index:2;pointer-events:none;"></div>' +
            '<div class="qfa-c1" style="position:absolute;top:0;left:0;width:' + w_i + 'px;z-index:2;display:flex;justify-content:space-between;align-items:flex-start;pointer-events:none;">' +
            '<span class="qfa-msg-so" style="display:none;padding:4px 8px;font-size:0.75rem;color:#888;pointer-events:none;"></span>' +
            '<span style="flex:1;pointer-events:none;"></span>' +
            '<span class="qfa-esc" style="display:none;width:32px;height:32px;cursor:pointer;margin:4px;pointer-events:auto;flex-shrink:0;"></span>' +
            '</div>' +
            '<div class="qfa-msg" style="position:absolute;top:0;left:0;width:' + w_i + 'px;height:' + h_i + 'px;z-index:1;background:transparent;overflow:hidden;box-sizing:border-box;"></div>' +
            '<div class="qfa-c2" style="display:none;position:absolute;bottom:60px;left:0;width:' + w_i + 'px;z-index:2;text-align:center;">' +
              '<div class="qfa-qrc" style="display:inline-block;cursor:pointer;"></div>' +
            '</div>' +
            '<div class="qfa-c3" style="display:none;position:absolute;bottom:0;left:0;width:' + w_i + 'px;height:52px;z-index:2;align-items:center;justify-content:center;gap:8px;padding:0 8px;box-sizing:border-box;">' +
              '<span class="qfa-cki" style="visibility:hidden;width:36px;height:36px;cursor:pointer;flex-shrink:0;"></span>' +
              '<input type="email" class="qfa-edr" style="flex:1;height:36px;padding:0 8px;border:1px solid #ccc;border-radius:4px;font-size:0.875rem;min-width:0;" value="' + (cookie || '') + '" />' +
              '<span class="qfa-run" style="visibility:hidden;display:flex;align-items:center;justify-content:center;width:36px;height:36px;cursor:pointer;flex-shrink:0;"></span>' +
            '</div>';
        _applyDims(false);   // v50 : surcharges mobile / réduction dès la construction
        _applySkin();
    }

    // v50 — Dimensions effectives : bureau (style.g.wb), surcharges mobile
    // (style.m sous m.bp) et facteur de réduction si l'écran est trop étroit.
    function _dims() {
        var g  = (cssCmpJ && cssCmpJ.g) ? cssCmpJ.g : {};
        var wb = g.wb || [-1, 0, 320, 480];
        var m  = (cssCmpJ && cssCmpJ.m) ? cssCmpJ.m : null;
        var sw = screenW > 0 ? screenW : (document.documentElement.clientWidth || window.innerWidth || 0);
        var d  = { w: wb[2], h: wb[3], s: 1, mob: false, fs: null, x: (wb[0] < 0 ? 0 : wb[0]), y: wb[1] };
        if (m && m.bp && sw > 0 && sw < m.bp) {
            d.mob = true;
            if (m.w) { d.w = m.w }
            if (m.h) { d.h = m.h }
            if (m.font_size) { d.fs = m.font_size }
        }
        if (sw > 0 && d.w > sw - 16) {
            d.mob = true;
            d.s = Math.max(0.3, (sw - 16) / d.w);
        }
        if (d.mob) {
            d.x = (screenW > 0) ? Math.max(0, Math.round((screenW - d.w * d.s) / 2)) : 0;
            d.y = 0;
        }
        return d;
    }

    // v50 — Applique taille / position / réduction. sizeParent_b : redimensionne
    // aussi le conteneur parent (comportement historique de setConfig).
    // v79 : le parent du conteneur suit l'affichage du composant
    // (ne touche QUE le parent : les calques gardent leur placement)
    function _hostFit(show_b) {
        var p = el && el.parentElement;
        if (!p) return;
        if (!show_b) { p.style.width = ''; p.style.height = ''; return }
        var d = _dims();
        p.style.width  = (screenW > 0 && d.mob ? screenW : Math.round(2 * Math.max(0, d.x) + d.w * d.s)) + 'px';
        p.style.height = Math.round(2 * Math.max(0, d.y) + d.h * d.s) + 'px';
    }

    function _applyDims(sizeParent_b) {
        var d = _dims(), w_i = d.w, h_i = d.h;
        el.style.width  = w_i + 'px'; el.style.height = h_i + 'px';
        el.style.left   = d.x + 'px'; el.style.top    = d.y + 'px';
        el.style.transformOrigin = '0 0';
        el.style.transform = (d.s < 1) ? ('scale(' + d.s + ')') : '';
        if (sizeParent_b && el.parentElement) {
            // v52 : marge symétrique x/y autour du composant (place de l'ombre)
            el.parentElement.style.width  = (screenW > 0 && d.mob ? screenW : Math.round(2 * Math.max(0, d.x) + w_i * d.s)) + 'px';
            el.parentElement.style.height = Math.round(2 * Math.max(0, d.y) + h_i * d.s) + 'px';
            void el.parentElement.offsetHeight;   // force le navigateur à relayouter immédiatement
        }
        var bck = _q('.qfa-bck'), msg = _q('.qfa-msg'), c1 = _q('.qfa-c1'), c2 = _q('.qfa-c2'), c3 = _q('.qfa-c3');
        if (bck) { bck.style.width = w_i + 'px'; bck.style.height = h_i + 'px' }
        if (msg) { msg.style.width = w_i + 'px'; msg.style.height = h_i + 'px' }
        if (c1)  { c1.style.width  = w_i + 'px' }
        if (c2)  { c2.style.width  = w_i + 'px' }
        if (c3)  { c3.style.width  = w_i + 'px' }
    }

    // v49 — Habillage de la boîte : fond (g.bg), bordure (g.Brd o/w/e) et
    // CSS Score généré (tailles/interlignes des titres et du corps).
    function _applySkin() {
        var g = (cssCmpJ && cssCmpJ.g) ? cssCmpJ.g : {};
        var brd = g.Brd || {};
        el.style.boxSizing       = 'border-box';
        // v52 : dégradé (style.g.grd) prioritaire sur la couleur unie
        var grd = g.grd;
        if (grd && grd.c1 && grd.c2) {
            el.style.background = 'linear-gradient(' + (Number(grd.a) || 0) + 'deg, ' + grd.c1 + ', ' + grd.c2 + ')';
        } else {
            el.style.background = g.bg || '#FFFFFF';
        }
        // v52 : ombre portée (style.g.shd)
        var shd = g.shd;
        if (shd && (Number(shd.blur) > 0 || Number(shd.y) > 0)) {
            el.style.boxShadow = '0 ' + (Number(shd.y) || 0) + 'px ' + (Number(shd.blur) || 0) + 'px ' + _rgba(shd.o || '#000000', (shd.a === undefined || shd.a === null) ? 0.25 : Number(shd.a));
        } else {
            el.style.boxShadow = '';
        }
        // v53 : champ email (style.g.ctl) — sinon apparence historique
        var ctl = g.ctl, edrEl = _q('.qfa-edr');
        if (edrEl) {
            var cw = (ctl && ctl.w !== undefined && ctl.w !== null) ? Number(ctl.w) : 1;
            edrEl.style.background   = (ctl && ctl.bg) ? ctl.bg : '';
            edrEl.style.color        = (ctl && ctl.color) ? ctl.color : '';
            edrEl.style.border       = cw > 0 ? (cw + 'px solid ' + ((ctl && ctl.o) ? ctl.o : '#ccc')) : 'none';
            edrEl.style.borderRadius = ((ctl && ctl.e !== undefined && ctl.e !== null) ? Number(ctl.e) : 4) + 'px';
        }
        // v52 : image de fond 256 masquée / atténuée / floutée
        var g256 = (cssCmpJ && cssCmpJ.geo) ? cssCmpJ.geo['256'] : null;
        var bckEl = _q('.qfa-bck');
        if (bckEl) {
            bckEl.style.visibility = (g256 && g256.visible === false) ? 'hidden' : '';
            bckEl.style.opacity    = (g256 && g256.a !== undefined && g256.a !== null) ? String(Number(g256.a)) : '';
            bckEl.style.filter     = (g256 && Number(g256.blur) > 0) ? ('blur(' + Number(g256.blur) + 'px)') : '';
        }
        var bw = (brd.w !== undefined && brd.w !== null) ? Number(brd.w) : 0;
        el.style.border          = bw > 0 ? (bw + 'px solid ' + (brd.o || '#C4C4C9')) : 'none';
        var rad = (brd.e !== undefined && brd.e !== null) ? Number(brd.e) : 8;
        el.style.borderRadius    = rad + 'px';
        // v54 : écarter les icônes des coins arrondis (aucune clé : automatique)
        var pad = Math.max(4, Math.round(rad * 0.3));
        // v67 : marge des bords (style.g.mrg, px) — croix et barre de saisie
        // décollées des bords ; + la place des ombres quand un relief est
        // actif. Sans mrg ni relief : rendu v66 au pixel près.
        var mrg = (g.mrg !== undefined && g.mrg !== null) ? _num(g.mrg, 0, 40, 0) : null;
        var rlA = g.rlf && typeof g.rlf === 'object' &&
            ['btn', 'field', 'qr', 'esc', 'hdr'].some(function (x) { return g.rlf[x] === 'neu' || g.rlf[x] === 'in' });
        // v68 (Marc : « too much ») : mrg est la marge TOTALE voulue (le relief
        // ne s'y ajoute plus) ; sans mrg, le relief n'ajoute que la moitié de
        // la portée de ses ombres ; la barre ne prend plus +4 px de côté.
        if (mrg !== null) { pad = mrg }
        else if (rlA) { pad += Math.round(1 + 3 * _num(g.rlf.k, 0, 1, 0.6)) }
        var escE = _q('.qfa-esc'), c3E = _q('.qfa-c3');
        if (escE) { escE.style.margin = pad + 'px' }
        if (c3E)  { c3E.style.padding = '0 ' + ((mrg !== null || rlA) ? pad : pad + 4) + 'px'; c3E.style.bottom = ((mrg !== null || rlA) ? pad : Math.max(0, pad - 4)) + 'px' }
        // CSS Score CLOISONNÉ à cette instance (#id .score…) : une instance
        // 'edt' et une instance 'run' peuvent cohabiter sur la même page avec
        // des styles différents sans que la dernière écrase l'autre.
        if (!el.id) { el.id = 'qfa-' + Math.random().toString(36).slice(2, 10) }
        // v50 : taille de corps mobile (style.m.font_size) -> CSS regénéré
        var cssS = cssCmpS || '';
        var d = _dims();
        if (d.fs && cssCmpJ) {
            try {
                var st = JSON.parse(JSON.stringify(cssCmpJ));
                st.g = st.g || {};
                // les tailles réelles sont dans h[] (p, h1..h6) : on les met
                // toutes à l'échelle du rapport corps mobile / corps bureau
                var r = d.fs / (Number(st.g.font_size) || 16);
                if (Array.isArray(st.h)) {
                    for (var hi = 0; hi < st.h.length; hi++) {
                        if (st.h[hi] && st.h[hi].size) { st.h[hi].size = Math.round(st.h[hi].size * r * 10) / 10 }
                    }
                }
                st.g.font_size = d.fs;
                cssS = QfaScore.cssDynStatMrgS(st, QfaScore.TARGET_AWP);
            } catch (e) {}
        }
        var css = _q('.qfa-css');
        if (css) { css.innerHTML = cssS.split('.score').join('#' + el.id + ' .score') }
            // v60 : placement générique + couleurs de texte par niveau (lot 4)
        _applyPlace();
        _applyTextColors(g);
        _applyRelief(g);     // v66
        _applyType(g);       // v66
        _applyGeoVis();                        // v71 (v72 : avant _fitMsg)
        if (_q('.qfa-msgc')) { _fitMsg() }   // v69 : style changé -> refaire tenir le texte
    }

    // v52 — couleur CSS (#rgb, #rrggbb) + opacité -> rgba() ; autre forme : telle quelle
    function _rgba(c, a) {
        var h = String(c).trim();
        if (h[0] !== '#') return h;
        h = h.slice(1);
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        if (h.length !== 6) return '#' + h;
        var r = parseInt(h.slice(0, 2), 16), gg = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
        return 'rgba(' + r + ',' + gg + ',' + b + ',' + Math.max(0, Math.min(1, a)) + ')';
    }

    // v49 — Remplace les %tags globaux (bloc tag[]), insensible à la casse
    function _applyTags(s) {
        if (!s || s.indexOf('%') < 0) return s;
        for (var k in tagJ) {
            if (!tagJ.hasOwnProperty(k)) continue;
            var re = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            var v = tagJ[k];
            s = s.replace(re, function () { return v });
        }
        return s;
    }

    // v61 — logo d'en-tête (case 291) ─────────────────────────────────────
    function _drwHdr() {
        var h = _q('.qfa-hdr');
        if (!h) return;
        var pos = msgAti[CFG_HDR] || 0;
        var sv = (pos && msgTj) ? String(msgTj[pos - 1] || '') : '';
        if (sv.trim().charAt(0) !== '<') { h.innerHTML = ''; h.style.display = 'none'; return }
        h.innerHTML = '<img alt="" style="width:100%;height:100%;object-fit:contain;display:block" src="data:image/svg+xml;base64,' +
            btoa(unescape(encodeURIComponent(sv))) + '">';
        h.style.display = 'block';
        if (opts.mode === 'edt') {
            h.style.pointerEvents = 'auto'; h.style.cursor = 'pointer';
            if (!h.dataset.bound) { h.dataset.bound = '1'; h.addEventListener('click', function () { _edtPick({ action: 'qfa_svg', i: CFG_HDR }) }) }
        }
    }
    // v61 — texte d'invite (case 292) : texte simple, code Score de tête ignoré
    function _phText() {
        var pos = msgAti[CFG_PH] || 0;
        var t = (pos && msgTj) ? String(msgTj[pos - 1] || '') : '';
        t = t.split(/\r?\n/)[0].replace(/^[UMBumb]?[clrj][0-6](?:[bnq][0-3])?_/, '');
        return _applyTags(t).replace(/<[^>]*>/g, '').trim();
    }

    // v60 — placement générique ─────────────────────────────────────────
    function _place(z) {
        var pl = (cssCmpJ && cssCmpJ.place) ? cssCmpJ.place : null;
        // v69 : écran étroit + style.m.place -> placements mobiles (une
        // silhouette paysage repasse en classique sur téléphone)
        var mm = (cssCmpJ && cssCmpJ.m) ? cssCmpJ.m : null;
        if (mm && mm.place && typeof mm.place === 'object' && _dims().mob) { pl = mm.place }
        return (pl && pl[z] && typeof pl[z] === 'object') ? pl[z] : null;
    }
    // valeur px ou % (de total) -> px
    function _px(v, total) {
        if (v === undefined || v === null || v === '') return 0;
        var t = String(v).trim();
        if (t.slice(-1) === '%') return total * (parseFloat(t) || 0) / 100;
        return parseFloat(t) || 0;
    }
    function _qrSize() {
        var p = _place('qr');
        var d = _dims();
        var v = p && p.w !== undefined ? _px(p.w, d.w) : 110;
        return Math.max(24, Math.min(Math.round(v), Math.min(d.w, d.h)));
    }
    // positionne node selon l'ancre (9 points) + décalage ; dx>0 = droite, dy>0 = bas
    function _anchor(node, p, W, H) {
        var a = String(p.anc || 'cc'), v = a[0], hz = a[1] || 'c';
        var dx = _px(p.dx, W), dy = _px(p.dy, H), tx = '0', ty = '0';
        node.style.left = node.style.right = node.style.top = node.style.bottom = '';
        if (hz === 'l') { node.style.left = dx + 'px' }
        else if (hz === 'r') { node.style.right = (-dx) + 'px' }
        else { node.style.left = 'calc(50% + ' + dx + 'px)'; tx = '-50%' }
        if (v === 't') { node.style.top = dy + 'px' }
        else if (v === 'b') { node.style.bottom = (-dy) + 'px' }
        else { node.style.top = 'calc(50% + ' + dy + 'px)'; ty = '-50%' }
        node.style.transform = (tx === '0' && ty === '0') ? '' : 'translate(' + tx + ',' + ty + ')';
    }
    function _applyPlace() {
        var d = _dims(), W = d.w, H = d.h;
        var pq = _place('qr'), c2 = _q('.qfa-c2');
        if (pq && c2) {
            c2.style.width = 'auto';
            _anchor(c2, pq, W, H);
        }
        var pb = _place('bar'), c3 = _q('.qfa-c3');
        if (pb && c3) {
            if (pb.anc) { _anchor(c3, pb, W, H) }
            if (pb.w !== undefined) { c3.style.width = Math.round(_px(pb.w, W)) + 'px' }
            var ic = (pb.icon !== undefined) ? Math.max(20, Math.min(72, Math.round(Number(pb.icon) || 36))) : 36;
            ['.qfa-cki', '.qfa-run'].forEach(function (sel) {
                var e = _q(sel); if (e) { e.style.width = ic + 'px'; e.style.height = ic + 'px' }
            });
            var ed = _q('.qfa-edr');
            if (ed) { ed.style.height = Math.max(36, ic) + 'px' }
            if (pb.layout === 'below') {
                // v63 : zone QR non placée -> au-dessus de la barre (2 rangées)
                if (!pq && c2) {
                    var barH = Math.max(36, ic) + ic + 8 + 16;
                    c2.style.bottom = (barH + 8 + (parseInt(c3.style.bottom, 10) || 0)) + 'px';
                }
                c3.style.flexWrap = 'wrap';
                c3.style.height = 'auto';
                c3.style.rowGap = '8px';
                c3.style.paddingTop = c3.style.paddingBottom = '8px';
                if (ed) { ed.style.flex = '1 1 100%'; ed.style.order = '-1' }
            } else {
                c3.style.flexWrap = ''; c3.style.height = '52px'; c3.style.rowGap = '';
                if (ed) { ed.style.flex = '1'; ed.style.order = '' }
            }
        }
        var ph = _place('hdr'), hd = _q('.qfa-hdr');   // v61
        if (hd) {
            var hp = ph || { anc: 'tl', dx: 16, dy: 12 };
            hd.style.width = Math.round(hp.w !== undefined ? _px(hp.w, W) : 120) + 'px';
            hd.style.height = Math.round(hp.h !== undefined ? _px(hp.h, H) : 36) + 'px';
            _anchor(hd, { anc: hp.anc || 'tl', dx: (hp.dx !== undefined ? hp.dx : 16), dy: (hp.dy !== undefined ? hp.dy : 12) }, W, H);
        }
        var pg = _place('bg'), bk = _q('.qfa-bck');
        if (pg && bk && !pg.on) {   // v78 : avec « on », posé par _applyRel
            bk.style.width = Math.round(pg.w !== undefined ? _px(pg.w, W) : W) + 'px';
            bk.style.height = Math.round(pg.h !== undefined ? _px(pg.h, H) : H) + 'px';
            _anchor(bk, pg, W, H);
        }
        _applyPlace69(W, H);   // v69
    }
    // v65 — champ d'adresse dans une page hôte Flutter (voir l'en-tête).
    function _edrHostFix(inp) {
        if (!document.getElementById('qfa-edr-fix')) {
            var st = document.createElement('style');
            st.id = 'qfa-edr-fix';
            st.textContent =
                'flt-platform-view input.qfa-edr::selection, input.qfa-edr::selection' +
                '{background-color:#b4d5fe !important;color:#000 !important;}' +
                'input.qfa-edr{-webkit-user-select:text !important;user-select:text !important;}';
            (document.head || document.documentElement).appendChild(st);
        }
        ['keydown', 'keyup', 'keypress', 'copy', 'cut', 'paste'].forEach(function (t) {
            inp.addEventListener(t, function (e) { e.stopPropagation(); });
        });
    }

    // v60 — couleur du texte par niveau Score (style.g.tc)
    var qfaUid = 'q' + Math.random().toString(36).slice(2, 9);
    function _applyTextColors(g) {
        var st = _q('.qfa-tc');
        var tc = g && g.tc;
        if (!tc || typeof tc !== 'object') { if (st) { st.textContent = '' } return }
        if (!st) {
            st = document.createElement('style'); st.className = 'qfa-tc';
            el.appendChild(st);
        }
        el.setAttribute('data-qfa-id', qfaUid);
        var css = '';
        ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(function (k) {
            if (tc[k]) {
                // préfixe #id (comme le CSS Score) : spécificité supérieure
                var sc = (el.id ? '#' + el.id : '[data-qfa-id="' + qfaUid + '"]') + ' .qfa-msg .score ';
                var cls = (k === 'p') ? ['p', 'ul', 'ol'] : [k];   // listes = paragraphes
                var col = _safeColor(tc[k]);   // v66 : jamais de texte libre dans la feuille
                if (col) { cls.forEach(function (c) { css += sc + '.' + c + ',' + sc + '.x' + c + '{color:' + col + '}' }) }
            }
        });
        st.textContent = css;
    }

    // v66 (16.10.2026) — SÉCURITÉ : une couleur écrite dans une feuille CSS
    // (textContent) peut sortir de sa règle (« red}body{… »). Seules les
    // formes #hex, rgb()/rgba() numériques et un nom simple passent.
    function _safeColor(c) {
        var s = String(c == null ? '' : c).trim();
        if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
        if (/^rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+\s*)?\)$/.test(s)) return s;
        if (/^[a-zA-Z]{3,20}$/.test(s)) return s;
        return '';
    }
    function _num(v, lo, hi, def) {
        var n = Number(v);
        if (v === undefined || v === null || isNaN(n)) return def;
        return Math.max(lo, Math.min(hi, n));
    }
    // #rrggbb mélangé vers une autre couleur (t = 0..1) ; null si illisible
    function _mix(c, toRgb, t) {
        var h = String(c || '').trim();
        if (h[0] !== '#') return null;
        h = h.slice(1);
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return null;
        var o = [0, 2, 4].map(function (i, k) {
            var v = parseInt(h.slice(i, i + 2), 16);
            return Math.round(v + (toRgb[k] - v) * t);
        });
        return 'rgb(' + o.join(',') + ')';
    }

    // v66 — RELIEF par élément (style.g.rlf) : { btn, field, qr : 'flat' |
    // 'neu' (neumorphisme : deux ombres, lumière en haut à gauche) | 'in'
    // (enfoncé : ombres intérieures), k : intensité 0..1 }. Les couleurs des
    // ombres sont CALCULÉES depuis le fond du composant (jamais fournies).
    function _applyRelief(g) {
        var r = (g && g.rlf && typeof g.rlf === 'object') ? g.rlf : null;
        var base = (g && g.grd && g.grd.c1) ? g.grd.c1 : ((g && g.bg) || '#FFFFFF');
        var k = r ? _num(r.k, 0, 1, 0.6) : 0;
        var d = Math.round(3 + 6 * k);
        var lite = _mix(base, [255, 255, 255], 0.35 + 0.5 * k) || 'rgba(255,255,255,0.8)';
        var dark = _mix(base, [0, 0, 0], 0.12 + 0.25 * k) || 'rgba(0,0,0,0.25)';
        function sh(fx) {
            if (fx === 'neu') return (-d) + 'px ' + (-d) + 'px ' + (2 * d) + 'px ' + lite + ', ' + d + 'px ' + d + 'px ' + (2 * d) + 'px ' + dark;
            if (fx === 'in')  return 'inset ' + d + 'px ' + d + 'px ' + (2 * d) + 'px ' + dark + ', inset ' + (-d) + 'px ' + (-d) + 'px ' + (2 * d) + 'px ' + lite;
            return '';
        }
        var on = function (fx) { return r && (fx === 'neu' || fx === 'in') };
        // v67 : la croix (esc) suit son propre réglage, comme le logo d'en-tête
        [['.qfa-cki', 'btn'], ['.qfa-run', 'btn'], ['.qfa-esc', 'esc']].forEach(function (pr) {
            var e = _q(pr[0]); if (!e) return;
            var fx = r ? r[pr[1]] : '';
            e.style.boxShadow    = on(fx) ? sh(fx) : '';
            e.style.borderRadius = on(fx) ? '50%' : '';
            e.style.background   = on(fx) ? base : '';
        });
        var ed = _q('.qfa-edr');
        if (ed) { ed.style.boxShadow = (r && on(r.field)) ? sh(r.field) : '' }
        var hd = _q('.qfa-hdr');   // v67 : logo d'en-tête
        if (hd) {
            var fh = r ? r.hdr : '';
            hd.style.boxShadow    = on(fh) ? sh(fh) : '';
            hd.style.borderRadius = on(fh) ? '10px' : '';
            hd.style.background   = on(fh) ? base : '';
            hd.style.boxSizing    = on(fh) ? 'border-box' : '';
            hd.style.padding      = on(fh) ? '4px' : '';
        }
        var qr = _q('.qfa-qrc');
        if (qr) {
            var fq = r ? r.qr : '';
            qr.style.boxShadow    = on(fq) ? sh(fq) : '';
            qr.style.padding      = on(fq) ? '8px' : '';
            qr.style.borderRadius = on(fq) ? '14px' : '';
            qr.style.background   = on(fq) ? base : '';
        }
    }

    // v66 — TYPOGRAPHIE (style.g.typ) : t = titres (h1..h6), p = texte
    // (paragraphes et listes) ; chacun { w : graisse 100..900, up : majuscules,
    // ls : espacement des lettres en em -0.05..0.5 } + p.lh : interligne
    // 1..2.2. Règles posées APRÈS le CSS Score, cloisonnées à l'instance.
    // Uniquement des nombres bornés et des mots fixes : rien de libre n'entre
    // dans la feuille.
    function _applyType(g) {
        var st = _q('.qfa-typ');
        var ty = (g && g.typ && typeof g.typ === 'object') ? g.typ : null;
        if (!ty) { if (st) { st.textContent = '' } return }
        if (!st) { st = document.createElement('style'); st.className = 'qfa-typ'; el.appendChild(st) }
        el.setAttribute('data-qfa-id', qfaUid);
        var sc = (el.id ? '#' + el.id : '[data-qfa-id="' + qfaUid + '"]') + ' .qfa-msg .score ';
        function rules(o, withLh) {
            if (!o || typeof o !== 'object') return '';
            var r = '';
            if (o.w !== undefined) r += 'font-weight:' + Math.round(_num(o.w, 100, 900, 400) / 100) * 100 + ';';
            if (o.up === true) r += 'text-transform:uppercase;';
            if (o.up === false) r += 'text-transform:none;';
            if (o.ls !== undefined) r += 'letter-spacing:' + _num(o.ls, -0.05, 0.5, 0) + 'em;';
            if (withLh && o.lh !== undefined) r += 'line-height:' + _num(o.lh, 1, 2.2, 1.5) + ';';
            return r;
        }
        function sel(list) {
            return list.map(function (c) { return sc + '.' + c + ',' + sc + '.x' + c }).join(',');
        }
        var css = '', rt = rules(ty.t, false), rp = rules(ty.p, true);
        if (rt) css += sel(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) + '{' + rt + '}';
        if (rp) css += sel(['p', 'ul', 'ol', 'li']) + '{' + rp + '}';
        st.textContent = css;
    }

    // v69 — SILHOUETTES : placements de la croix, du >> détaché, du panneau,
    // et de la zone de texte (voir l'en-tête). Absents = rendu v68.
    function _applyPlace69(W, H) {
        var c1 = _q('.qfa-c1'), c3 = _q('.qfa-c3');
        // croix (place.esc) : sortie de la rangée haute, placée librement
        var pe = _place('esc'), esc = _q('.qfa-esc');
        if (esc) {
            if (pe) {
                if (esc.parentNode !== el) { el.appendChild(esc) }
                esc.style.position = 'absolute'; esc.style.zIndex = '3';
                _anchor(esc, { anc: pe.anc || 'tr', dx: pe.dx, dy: pe.dy }, W, H);
            } else if (c1 && esc.parentNode !== c1) {
                c1.appendChild(esc);
                esc.style.position = esc.style.left = esc.style.right = esc.style.top = esc.style.bottom = esc.style.transform = esc.style.zIndex = '';
            }
        }
        // bouton >> (place.run) : détaché de la barre, placé librement
        var pr = _place('run'), run = _q('.qfa-run');
        if (run) {
            if (pr) {
                if (run.parentNode !== el) { el.appendChild(run) }
                run.style.position = 'absolute'; run.style.zIndex = '3';
                if (pr.w !== undefined) { var rw = Math.max(20, Math.min(72, Math.round(_px(pr.w, W)))); run.style.width = run.style.height = rw + 'px' }
                _anchor(run, { anc: pr.anc || 'tr', dx: pr.dx, dy: pr.dy }, W, H);
            } else if (c3 && run.parentNode !== c3) {
                c3.appendChild(run);
                run.style.position = run.style.left = run.style.right = run.style.top = run.style.bottom = run.style.transform = run.style.zIndex = '';
            }
        }
        // panneau (place.pnl) : verre dépoli derrière le QR et la barre
        var pp = _place('pnl'), pn = _q('.qfa-pnl');
        if (pp && PNL_ON) {   // v76
            if (!pn) {
                pn = document.createElement('div'); pn.className = 'qfa-pnl';
                var bk = _q('.qfa-bck');
                if (bk && bk.nextSibling) { el.insertBefore(pn, bk.nextSibling) } else { el.appendChild(pn) }
            }
            pn.style.position = 'absolute'; pn.style.zIndex = '1'; pn.style.pointerEvents = 'none'; pn.style.boxSizing = 'border-box';
            pn.style.width  = Math.round(pp.w !== undefined ? _px(pp.w, W) : W - 28) + 'px';
            pn.style.height = Math.round(pp.h !== undefined ? _px(pp.h, H) : H / 2) + 'px';
            _anchor(pn, { anc: pp.anc || 'bc', dx: pp.dx, dy: (pp.dy !== undefined ? pp.dy : -14) }, W, H);
            pn.style.background = _rgba(_safeColor(pp.bg) || '#FFFFFF', _num(pp.a, 0, 1, 0.55));
            var bl = _num(pp.blur, 0, 30, 10);
            pn.style.backdropFilter = pn.style.webkitBackdropFilter = bl > 0 ? ('blur(' + bl + 'px)') : '';
            pn.style.borderRadius = _num(pp.e, 0, 60, 18) + 'px';
            pn.style.border = '1px solid rgba(255,255,255,0.6)';
            pn.style.display = '';
        } else if (pn) { pn.style.display = 'none' }
    }

    // v69 — zone de texte (place.msg = { anc, dx, dy, w, h, ta }) : posée à
    // chaque _drwTip (qui réinitialise la zone).
    function _placeMsg(msg, W, H) {
        var pm = _place('msg');
        msg.removeAttribute('data-ta');
        if (!pm) return;
        msg.style.width  = Math.round(pm.w !== undefined ? _px(pm.w, W) : W) + 'px';
        msg.style.height = Math.round(pm.h !== undefined ? _px(pm.h, H) : H) + 'px';
        _anchor(msg, { anc: pm.anc || 'tl', dx: pm.dx, dy: pm.dy }, W, H);
        if (pm.ta === 'l' || pm.ta === 'c' || pm.ta === 'r') { msg.setAttribute('data-ta', pm.ta) }
    }

    // v69 — TEXTES LONGS : la zone de texte s'arrête au-dessus du QR / de la
    // barre / du >> / du panneau s'ils sont dessous ; si le texte ne tient
    // pas : (1) zone ramenée à la place libre, (2) texte réduit (jusqu'à
    // ~11,5 px pour un corps de 16), (3) défilement à la molette / au doigt,
    // SANS ascenseur, avec un fondu haut/bas qui invite à faire défiler.
    // Rien ne change si le texte tient. État : getFit() + notification
    // { action:'fit', state:'ok'|'shrink'|'scroll' }.
    var fitState = 'ok';
    // v76 : en mode edt (Studio), cadre pointillé sur la place LIBRE du texte
    // (_Msg) : sous le logo d'en-tête, au-dessus du QR / de la barre, marges
    // intérieures déduites. Ailleurs : rien (le cadre est retiré).
    function _drwMsgZone(msg, s, top, bottom) {
        var z = _q('.qfa-msgz');
        if (opts.mode !== 'edt') { if (z) z.style.display = 'none'; return }
        if (!z) { z = document.createElement('div'); z.className = 'qfa-msgz'; el.appendChild(z) }
        var m = Math.max(0, CFG_PAD - 5);   // (lot 4c) 5 px d'air entre le texte et le pointillé
        var t = msg.offsetTop + top / s + m, h = (bottom - top) / s - 2 * m;
        z.style.cssText = 'position:absolute;pointer-events:none;z-index:3;box-sizing:border-box;'
            + 'border:1.5px dashed rgba(128,128,128,0.8);border-radius:4px;'
            + 'left:' + (msg.offsetLeft + m) + 'px;width:' + Math.max(0, msg.offsetWidth - 2 * m) + 'px;'
            + 'top:' + t + 'px;height:' + Math.max(0, h) + 'px;';
    }
    // ── v77 (29.10.2026) — placement RELATIF (lot 5a) ────────────────────
    // style.place.<zone> = { ref:'_Rec', side:'r|l|b|t', al:'s|c|e', gap:8,
    // full:true (_Msg), w, h }. Zones : hdr _Rec, qr _Qrc, msg _Msg, run _Run,
    // esc _Esc, edr _Edr, cki _Coi/_Coo. _Edr et le cookie (cki) sortent de la
    // barre dès qu'ils ont une règle (ancre ou ref), comme _Run (v60).
    // Règles : un widget caché (display:none) compte pour une place de taille
    // nulle ; « à droite / à gauche » qui ne tient pas passe DESSOUS (repli
    // mobile sans règle propre, Marc 29.10) ; ce qui sort du cadre est ramené
    // contre le bord ; référence inconnue ou boucle : règle ignorée (console).
    var REL = { _Rec: ['hdr', '.qfa-hdr'], _Qrc: ['qr', '.qfa-c2'], _Msg: ['msg', '.qfa-msg'], _Run: ['run', '.qfa-run'],
                _Esc: ['esc', '.qfa-esc'], _Edr: ['edr', '.qfa-edr'], _Coi: ['cki', '.qfa-cki'], _Coo: ['cki', '.qfa-cki'] };
    var RELK = { hdr: '_Rec', qr: '_Qrc', msg: '_Msg', run: '_Run', esc: '_Esc', edr: '_Edr', cki: '_Coi' };
    function _relSide(v) {
        var s = String(v || 'b').toLowerCase();
        return { droite: 'r', gauche: 'l', dessous: 'b', dessus: 't' }[s] || s.charAt(0);
    }
    function _relAl(v) {
        var s = String(v || 'c').toLowerCase();
        return { 'début': 's', debut: 's', centre: 'c', fin: 'e' }[s] || s.charAt(0);
    }
    // règle utilisable : ref connue et sans boucle ; sinon null (la zone
    // garde sa place par défaut, avertissement en console)
    function _relRule(k) {
        var p = _place(k); if (!p || !p.ref) return p;
        var seen = {}, cur = k, n = 0;
        while (cur && n++ < 12) {
            var pc = _place(cur); if (!pc || !pc.ref) return p;
            if (seen[cur]) { console.warn('[qfa-min] place : boucle de références sur ' + RELK[k] + ' (règle ignorée)'); return null }
            seen[cur] = 1;
            var m = REL[String(pc.ref)]; if (!m) { console.warn('[qfa-min] place : code inconnu ' + pc.ref + ' (règle ignorée)'); return null }
            cur = m[0];
        }
        return p;
    }
    // sort _Edr / cki de la barre (ou les y remet sans règle)
    function _relDock(W, H) {
        var c3 = _q('.qfa-c3'); if (!c3) return;
        var off = window.getComputedStyle(c3).display === 'none';
        ['edr', 'cki'].forEach(function (k) {
            var n = _q(k === 'edr' ? '.qfa-edr' : '.qfa-cki'); if (!n) return;
            var p = _relRule(k);
            if (p) {
                if (n.parentNode !== el) { el.appendChild(n) }
                n.style.position = 'absolute'; n.style.zIndex = '3'; n.style.flex = 'none'; n.style.order = '';
                if (k === 'edr') {   // v78 : taille extérieure, indépendante de bar.icon
                    n.style.boxSizing = 'border-box';
                    n.style.width = Math.round(p.w !== undefined ? _px(p.w, W) : 170) + 'px';
                    n.style.height = Math.round(p.h !== undefined ? Math.max(20, Math.min(96, _px(p.h, H))) : 36) + 'px';
                }
                if (!p.ref) { _anchor(n, { anc: p.anc || (k === 'edr' ? 'bc' : 'bl'), dx: p.dx, dy: p.dy }, W, H) }
                n.style.display = off ? 'none' : (k === 'cki' ? 'flex' : '');
            } else if (n.parentNode !== c3) {
                var run = _q('.qfa-run');
                if (k === 'cki') { c3.insertBefore(n, c3.firstChild) }
                else { c3.insertBefore(n, (run && run.parentNode === c3) ? run : null) }
                n.style.position = n.style.left = n.style.right = n.style.top = n.style.bottom = n.style.transform = n.style.zIndex = '';
                n.style.display = (k === 'cki') ? 'flex' : '';
                if (k === 'edr') {
                    n.style.width = ''; n.style.flex = '1'; n.style.boxSizing = '';
                    var pbb = _place('bar'), icb = (pbb && pbb.icon !== undefined) ? Math.max(20, Math.min(72, Math.round(Number(pbb.icon) || 36))) : 36;
                    n.style.height = Math.max(36, icb) + 'px';
                }
            }
        });
        // _Run détaché (v60) suit aussi la barre : pas d'e-mail, pas de >>
        var run = _q('.qfa-run');
        if (run && run.parentNode === el) { run.style.display = off ? 'none' : 'flex' }
        // v78 : barre vidée par les détachements -> invisible (elle ne
        // borne plus la zone de texte) ; display reste le signal « pas d'e-mail »
        var used = false;
        for (var ci = 0; ci < c3.children.length; ci++) { if (window.getComputedStyle(c3.children[ci]).display !== 'none') { used = true; break } }
        c3.style.visibility = used ? '' : 'hidden';
    }
    function _applyRel() {
        if (!el || !cssCmpJ) return;
        var d = _dims(), W = d.w, H = d.h;
        _relDock(W, H);
        var eR = el.getBoundingClientRect();
        var s = (el.offsetWidth > 0) ? (eR.width / el.offsetWidth) : 1; if (!(s > 0)) s = 1;
        var box = {}, busy = {}, placed = [];   // placed : boîtes déjà posées (anti-chevauchement)
        function rectOf(n) {
            var r = n.getBoundingClientRect();
            return { x: (r.left - eR.left) / s, y: (r.top - eR.top) / s, w: r.width / s, h: r.height / s };
        }
        function solve(code) {
            if (box[code]) return box[code];
            var m = REL[code]; if (!m) { console.warn('[qfa-min] place : code inconnu ' + code); return null }
            var k = m[0], n = _q(m[1]); if (!n) return null;
            var p = _relRule(k), hid = window.getComputedStyle(n).display === 'none';
            if (!p || !p.ref) {   // ancré sur le cadre : position réelle ; caché -> point d'ancrage, taille nulle
                var rr = null;
                if (!hid) { rr = rectOf(n) }
                else if (p && p.anc) {
                    var a = String(p.anc), v = a[0], hz = a[1] || 'c', dx = _px(p.dx, W), dy = _px(p.dy, H);
                    rr = { x: (hz === 'l') ? dx : (hz === 'r') ? W + dx : W / 2 + dx,
                           y: (v === 't') ? dy : (v === 'b') ? H + dy : H / 2 + dy, w: 0, h: 0 };
                }
                box[code] = rr; return rr;
            }
            if (busy[code]) return null;
            busy[code] = 1;
            var q = solve(String(p.ref));
            busy[code] = 0;
            if (!q) { q = { x: 0, y: 0, w: 0, h: 0 } }   // référence cachée/absente : coin haut-gauche
            var side = _relSide(p.side), al = _relAl(p.al);
            var g = (p.gap !== undefined) ? _px(p.gap, W) : 8;
            var w = hid ? 0 : n.offsetWidth, h = hid ? 0 : n.offsetHeight;
            if (k === 'msg') {
                w = Math.round(p.w !== undefined ? _px(p.w, W) : (p.full ? W : n.offsetWidth));
                h = Math.round(p.h !== undefined ? _px(p.h, H) : n.offsetHeight);
            }
            var x, y;
            function below() { y = q.y + q.h + g; x = (al === 'e') ? q.x + q.w - w : (al === 'c') ? q.x + (q.w - w) / 2 : q.x }
            if (side === 'r' || side === 'l') {
                x = (side === 'r') ? q.x + q.w + g : q.x - w - g;
                y = (al === 's') ? q.y : (al === 'e') ? q.y + q.h - h : q.y + (q.h - h) / 2;
                if (x + w > W + 0.5 || x < -0.5) { al = 's'; below() }   // repli : passe dessous
            } else if (side === 't') {
                y = q.y - h - g; x = (al === 's') ? q.x : (al === 'e') ? q.x + q.w - w : q.x + (q.w - w) / 2;
            } else { below() }
            // v77b : anti-chevauchement — un widget posé sur un autre est poussé
            // plus loin dans le même sens (ex. après « inverse _Coi et _Run »,
            // la croix qui suivait _Run ne recouvre plus le cookie)
            if (k !== 'msg' && !hid) {
                for (var it = 0; it < 8; it++) {
                    var hit = null;
                    for (var pi = 0; pi < placed.length; pi++) {
                        var o = placed[pi][1]; if (placed[pi][0] === code || REL[placed[pi][0]][0] === k) continue;
                        if (x < o.x + o.w - 0.5 && x + w > o.x + 0.5 && y < o.y + o.h - 0.5 && y + h > o.y + 0.5) { hit = o; break }
                    }
                    if (!hit) break;
                    if (side === 'r') { x = hit.x + hit.w + g } else if (side === 'l') { x = hit.x - w - g }
                    else if (side === 't') { y = hit.y - h - g } else { y = hit.y + hit.h + g }
                    if ((side === 'r' || side === 'l') && (x + w > W + 0.5 || x < -0.5)) { side = 'b'; al = 's'; below() }
                }
            }
            if (k === 'msg' && p.full) { x = 0; w = W; if (side !== 't') { h = Math.max(40, H - y) } else { h = Math.max(40, q.y - g); y = 0 } }
            x = Math.max(0, Math.min(x, W - w)); y = Math.max(0, Math.min(y, H - h));   // ramené au bord
            if (!hid) {
                n.style.position = 'absolute'; n.style.right = n.style.bottom = ''; n.style.transform = '';
                if (k !== 'msg') { n.style.margin = '0' }   // v78 : la boîte calculée = la boîte dessinée
                n.style.left = Math.round(x) + 'px'; n.style.top = Math.round(y) + 'px';
                if (k === 'msg') { n.style.width = w + 'px'; n.style.height = h + 'px' }
                if (n.parentNode !== el && k !== 'msg') { el.appendChild(n); n.style.zIndex = '3' }
            }
            box[code] = { x: x, y: y, w: hid ? 0 : w, h: hid ? 0 : h };
            if (!hid && k !== 'msg') { placed.push([code, box[code]]) }
            return box[code];
        }
        // obstacles fixes : widgets visibles sans règle relative (hors _Msg)
        ['_Rec', '_Qrc', '_Run', '_Esc', '_Edr', '_Coi'].forEach(function (c) {
            var m = REL[c], n = _q(m[1]), pc = _relRule(m[0]);
            if (!n || (pc && pc.ref) || window.getComputedStyle(n).display === 'none') return;
            var r = rectOf(n); if (r.w > 0 && r.h > 0) { placed.push([c, r]) }
        });
        var pl = (cssCmpJ.place && typeof cssCmpJ.place === 'object') ? cssCmpJ.place : {};
        var mm = cssCmpJ.m; if (mm && mm.place && typeof mm.place === 'object' && d.mob) { pl = mm.place }
        Object.keys(pl).forEach(function (k) { if (RELK[k] && pl[k] && pl[k].ref && _relRule(k)) { solve(RELK[k]) } });
        // v78 : fond superposé à un widget (place.bg.on), APRÈS les placements
        var pb = _place('bg'), bk = _q('.qfa-bck');
        if (pb && pb.on && bk) {
            if (!REL[String(pb.on)]) { console.warn('[qfa-min] place : code inconnu ' + pb.on + ' (fond ignoré)') }
            else {
                var rb = solve(String(pb.on)) || { x: 0, y: 0, w: 0, h: 0 };
                bk.style.position = 'absolute'; bk.style.right = bk.style.bottom = ''; bk.style.transform = '';
                bk.style.left = Math.round(rb.x) + 'px'; bk.style.top = Math.round(rb.y) + 'px';
                bk.style.width = Math.round(rb.w) + 'px'; bk.style.height = Math.round(rb.h) + 'px';
            }
        }
    }
    function _fitMsg() {
        try { _applyRel() } catch (e) { console.warn('[qfa-min] place relatif : ' + e) }   // v77
        var msg = _q('.qfa-msg'); if (!msg || !el) return;
        var box = msg.querySelector('.qfa-msgc'); if (!box) return;
        box.style.zoom = '';
        if (msg.dataset.top0 !== undefined) { msg.style.top = msg.dataset.top0; msg.style.height = msg.dataset.h0 } else { msg.dataset.top0 = msg.style.top; msg.dataset.h0 = msg.style.height }
        msg.classList.remove('qfa-scroll'); msg.removeAttribute('tabindex');
        msg.style.overflowY = 'hidden'; msg.style.pointerEvents = 'none';
        msg.style.maskImage = msg.style.webkitMaskImage = '';
        msg.onscroll = null; msg.onwheel = null; msg.scrollTop = 0;
        var mR = msg.getBoundingClientRect();
        var s = (msg.offsetHeight > 0) ? (mR.height / msg.offsetHeight) : 1;
        if (!(s > 0)) s = 1;
        // logo d'en-tête VISIBLE en haut de la zone : le texte commence sous
        // lui (fini le chevauchement) ; logo absent -> le texte reprend la
        // place. Seulement si le texte ne tient pas tel quel (rendu inchangé
        // sinon).
        var hdTop = 0, hd = _q('.qfa-hdr');
        if (hd && window.getComputedStyle(hd).display !== 'none') {
            var hR = hd.getBoundingClientRect();
            if (hR.height > 0 && hR.right > mR.left && hR.left < mR.right && hR.top < mR.top + mR.height / 3) {
                hdTop = Math.max(0, hR.bottom + 4 * s - mR.top);
            }
        }
        var limit = mR.bottom;
        ['.qfa-c2', '.qfa-c3', '.qfa-run', '.qfa-pnl', '.qfa-edr', '.qfa-cki', '.qfa-esc', '.qfa-hdr'].forEach(function (sel) {   // v77 : + _Edr / cookie détachés, croix et logo placés sous le texte
            var n = _q(sel); if (!n) return;
            var cs = window.getComputedStyle(n);
            if (cs.display === 'none' || cs.visibility === 'hidden') return;
            var r = n.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            if (r.right <= mR.left || r.left >= mR.right) return;     // pas sous la zone
            if (r.top <= mR.top + 20 * s) return;                       // au-dessus du texte
            limit = Math.min(limit, r.top - 6 * s);
        });
        _drwMsgZone(msg, s, hdTop, limit - mR.top);   // v76 : zone libre de _Msg en pointillé (Studio)
        var fits = function () { var r = box.getBoundingClientRect(); return r.bottom <= limit + 0.5 && r.top >= mR.top + hdTop - 0.5 };
        var prev = fitState;
        fitState = 'ok';
        if (!fits()) {
            // (1) zone ramenée à la place libre (sous le logo d'en-tête,
            // au-dessus du QR / de la barre)
            if (hdTop > 0) { msg.style.top = (parseFloat(msg.style.top || '0') + hdTop / s) + 'px' }
            msg.style.height = Math.max(40, Math.floor((limit - mR.top - hdTop) / s)) + 'px';
            var avail = (limit - mR.top - hdTop);
            var need = function () { return box.getBoundingClientRect().height + 2 * CFG_PAD * s };
            if (need() > avail + 0.5) {
                // (2) réduction progressive
                fitState = 'shrink';
                var fs = Number((cssCmpJ && cssCmpJ.g && cssCmpJ.g.font_size) || 16) || 16;
                var zmin = Math.min(1, 11.5 / fs);
                for (var z = 0.95; z >= zmin - 0.001 && need() > avail + 0.5; z -= 0.05) { box.style.zoom = String(Math.round(z * 100) / 100) }
                if (need() > avail + 0.5) {
                    // (3) défilement sans ascenseur + fondu
                    fitState = 'scroll';
                    box.style.zoom = String(Math.round(zmin * 100) / 100);
                    msg.style.justifyContent = 'flex-start';
                    msg.classList.add('qfa-scroll');
                    msg.style.overflowY = 'auto'; msg.style.pointerEvents = 'auto';
                    msg.setAttribute('tabindex', '0');
                    var fade = function () {
                        var top = msg.scrollTop > 2, bot = msg.scrollTop + msg.clientHeight < msg.scrollHeight - 2;
                        var g = 'linear-gradient(to bottom,' + (top ? 'transparent 0,#000 28px' : '#000 0') + ',' + (bot ? '#000 calc(100% - 28px),transparent 100%' : '#000 100%') + ')';
                        msg.style.maskImage = msg.style.webkitMaskImage = g;
                    };
                    msg.onscroll = fade; fade();
                    // v70 : la molette fait défiler le TEXTE d'abord ; elle ne
                    // remonte à la page hôte (Flutter du Studio, page du site
                    // client) que lorsque le texte est en butée.
                    msg.onwheel = function (ev) {
                        var up = ev.deltaY < 0;
                        var can = up ? msg.scrollTop > 0 : (msg.scrollTop + msg.clientHeight < msg.scrollHeight - 1);
                        if (can) { ev.stopPropagation() }
                    };
                }
            }
        }
        // aperçu (edt) seulement : un site client ne reçoit jamais cette notification
        if (opts.mode === 'edt' && (fitState !== prev || fitState !== 'ok')) { _notify({ action: 'fit', state: fitState }) }
    }
    // feuille commune : ascenseur masqué + alignement forcé de la zone de texte
    function _fitCss() {
        if (_q('.qfa-fitcss')) return;
        var st = document.createElement('style'); st.className = 'qfa-fitcss';
        var sc = el.id ? '#' + el.id : '[data-qfa-id="' + qfaUid + '"]';
        el.setAttribute('data-qfa-id', qfaUid);
        st.textContent = sc + ' .qfa-scroll{scrollbar-width:none;-ms-overflow-style:none;overscroll-behavior:auto}' +
            sc + ' .qfa-scroll::-webkit-scrollbar{display:none}' +
            ['l', 'c', 'r'].map(function (a) {
                return sc + ' .qfa-msg[data-ta="' + a + '"] .score *{text-align:' + ({ l: 'left', c: 'center', r: 'right' })[a] + '!important}';
            }).join('');
        el.appendChild(st);
    }

    // v59 — dsp : adresse mémorisée par l'hôte Flutter (SharedPreferences web)
    function _hostCookie() {
        try {
            var v = localStorage.getItem('flutter.qfa_edr');
            return v ? String(JSON.parse(v) || '') : '';
        } catch (e) { return '' }
    }

    // v55 — mode 'dsp' : remonte un geste du visiteur à l'hôte (aucun réseau)
    function _dsp(what_s) {
        var e = _q('.qfa-edr');
        _notify({ action: 'ui', what: what_s, edr: e ? e.value.trim() : '', has: !!cookie });
    }

    // v49 — Clic d'édition (mode edt) : onMessage si fourni, sinon repli WebDev C3
    function _edtPick(payload_j) {
        if (typeof opts.onMessage === 'function') { opts.onMessage(payload_j); return }
        var btn = document.getElementById('C3');
        if (!btn) return;
        btn.innerText = JSON.stringify(payload_j);
        btn.click();
    }

    // Branche tous les listeners de clic/saisie (idempotent via dataset.bound)
    function _bindEvents() {
        // v50 : rotation / redimensionnement de la fenêtre réelle
        window.addEventListener('resize', function () {
            if (screenW > 0 || !el) return;
            _applyDims(false); _applySkin();
            if (el.style.display !== 'none') { _hostFit(true) }   // v79
        });
        // Esc — mode edt : sélectionne l'icône 254 pour édition / mode run : ferme le composant
        var escEl = _q('.qfa-esc');
        if (!escEl.dataset.bound) {
            escEl.dataset.bound = '1';
            escEl.addEventListener('click', function () {
                if (opts.mode === 'edt') { _edtPick({ action: 'qfa_svg', i: 254 }); return }
                if (opts.mode === 'dsp') { _dsp('esc'); return }
                _wsClose();
                el.style.display = 'none'; _hostFit(false);   // v79
                _notify({ action: 'close' });
            });
        }

        // QR — mode edt : notifie un clic d'édition / mode run : envoie le 2e clic
        // d'appairage uniquement si le serveur a marqué l'image cliquable (Qrc.e)
        var qrcEl = _q('.qfa-qrc');
        if (!qrcEl.dataset.bound) {
            qrcEl.dataset.bound = '1';
            qrcEl.addEventListener('click', function () {
                if (opts.mode === 'edt') {
                    // v64 : bascule QR <-> logo carré seul (aperçu uniquement)
                    var sqP = msgAti[CFG_SQR] || 0;
                    var logo = (sqP && msgTj) ? String(msgTj[sqP - 1] || '') : '';
                    if (qrcEl.dataset.qrSvg && logo.trim().charAt(0) === '<') {
                        var showLogo = qrcEl.dataset.alt !== '1';
                        qrcEl.dataset.alt = showLogo ? '1' : '0';
                        var src = showLogo ? logo : qrcEl.dataset.qrSvg;
                        var im = qrcEl.querySelector('img');
                        if (im) { im.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(src))) }
                        if (showLogo) { _edtPick({ action: 'qfa_svg', i: CFG_SQR }) }
                    }
                    _notify({ action: 'qrc_click' });
                    return;
                }
                if (qrcEl.dataset.clickable !== '1') { return; }
                if (opts.mode === 'dsp') { _dsp('qrc'); return }
                _qrcToLogo();   // v76 : plus de double clic ni de scan apres clic
                _wsSendClick();
            });
        }

        // Cookie — mode edt : sélectionne l'icône Sto/Clr pour édition
        // mode run : entièrement local (jamais notifié au serveur)
        var ckiEl = _q('.qfa-cki');
        if (ckiEl && !ckiEl.dataset.bound) {
            ckiEl.dataset.bound = '1';
            ckiEl.addEventListener('click', function() {
                if (opts.mode === 'edt' && typeof opts.onMessage === 'function') {
                    // v62 : bascule VISUELLE (aucun stockage en aperçu)
                    cookie = (ckiEl.dataset.hasCookie === '1') ? '' : 'apercu@qovi';
                    ckiEl.dataset.cookieState = '';
                    _drwEdr(_q('.qfa-edr').value.trim());
                    opts.onMessage({ action: 'qfa_svg', i: cookie ? CFG_CLR : CFG_STO });
                    return;
                }
                if (opts.mode === 'edt') {
                    var btn = document.getElementById('C3');
                    if (!btn) return;
                    var ckiI = window.QFA_CONFIG && window.QFA_CONFIG.editor && window.QFA_CONFIG.editor.Cki ? window.QFA_CONFIG.editor.Cki.i : null;
                    var svgI = window.QFA_CONFIG && window.QFA_CONFIG.editor && window.QFA_CONFIG.editor.Svg ? window.QFA_CONFIG.editor.Svg.i : null;
                    var isCkiActive = (svgI === 228 || svgI === 235);
                    if (!isCkiActive) {
                        btn.innerText = JSON.stringify({ action: 'qfa_svg', i: ckiI });
                    } else {
                        var newI = (svgI === 228) ? 235 : 228;
                        btn.innerText = JSON.stringify({ action: 'qfa_Cki', i: newI });
                    }
                    btn.click();
                    return;
                }
                if (opts.mode === 'dsp') {
                    _dsp('cki');
                    // v59 : l'hôte écrit/efface l'adresse en asynchrone -> relecture
                    var edrV = _q('.qfa-edr').value.trim();
                    setTimeout(function () {
                        cookie = _hostCookie();
                        ckiEl.dataset.cookieState = '';
                        _drwEdr(edrV);
                    }, 300);
                    return;
                }
                var runEl = _q('.qfa-run');
                var Edr_s = _q('.qfa-edr').value.trim();
                if (!cookie) {
                    // Pas encore de cookie — l'enregistre et démarre l'auth si Edr valide
                    if (_checkEmail(Edr_s)) { _saveCookieAndStart(Edr_s); }
                } else {
                    // Cookie déjà présent — l'efface et réinitialise l'UI
                    cookie = '';
                    try { localStorage.removeItem('qfa_edr'); } catch(e) {}
                    _wsClose();
                    _q('.qfa-edr').value = '';
                    _q('.qfa-c2').style.display = 'none';
                    runEl.style.visibility = 'hidden';
                    ckiEl.style.visibility = 'hidden';
                }
            });
        }

        // Run (>>) — mode edt : sélectionne l'icône 223 pour édition
        // mode run : sauve le cookie et démarre l'authentification
        var runEl = _q('.qfa-run');
        if (!runEl.dataset.bound) {
            runEl.dataset.bound = '1';
            runEl.addEventListener('click', function () {
                if (opts.mode === 'edt') { _edtPick({ action: 'qfa_svg', i: 223 }); return }
                var Edr_s = _q('.qfa-edr').value.trim();
                if (opts.mode === 'dsp') { if (_checkEmail(Edr_s)) { _dsp('run') } return }
                if (_checkEmail(Edr_s)) { _saveCookieAndStart(Edr_s); }
            });
        }

        // Champ Edr — met à jour la visibilité Run/Cki à chaque frappe ;
        // Enter déclenche la sauvegarde du cookie + démarrage de l'auth
        var edrEl = _q('.qfa-edr');
        if (!edrEl.dataset.bound) {
            edrEl.dataset.bound = '1';
            _edrHostFix(edrEl);   // v65 : sélection visible + touches gardées dans le champ
            edrEl.addEventListener('input', function () { _drwEdr(this.value.trim()) });
            edrEl.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    var Edr_s = this.value.trim();
                    if (opts.mode === 'dsp') { if (_checkEmail(Edr_s)) { _dsp('run') } return }
                    if (_checkEmail(Edr_s)) { _saveCookieAndStart(Edr_s); }
                }
            });
            edrEl.addEventListener('blur', function () {
                _drwEdr(this.value.trim());
            });
        }
    }

    // API publique — met à jour la config (partielle ou totale) et réapplique le layout
    function setConfig(cfg_j) {
        if (typeof cfg_j === 'string') {
            try { cfg_j = JSON.parse(cfg_j) } catch(e) { console.error('[QfA setConfig]', e); return }
        }
        _initConfig(cfg_j);
        _applyConfig();
        _applySkin();
        // v49 : icônes mises en cache par _drwEdr -> forcer leur relecture
        var runEl = _q('.qfa-run'), ckiEl = _q('.qfa-cki');
        if (runEl) { runEl.dataset.init = '' }
        if (ckiEl) { ckiEl.dataset.cookieState = '' }
        _redraw();
    }

    // v49 — Redessine le dernier état reçu par drw(), SANS a.ChX (ne jamais
    // rouvrir CH2 sur un simple changement de config)
    function _redraw() {
        if (!lastDrw_j) return;
        var c_j;
        try { c_j = JSON.parse(JSON.stringify(lastDrw_j)) } catch (e) { return }
        if (c_j.a) { delete c_j.a.ChX }
        drw(c_j);
    }

    // Réapplique les dimensions W/H au composant et à son TD parent WebDev
    function _applyConfig() {
        _applyDims(true);   // v50 (ex-corps inline : mêmes effets + mobile)
    }

    // API publique — affiche le composant ; authentifie automatiquement
    // si un cookie Edr valide existe déjà
		function start(prm_j) {
			prm_j = prm_j || {};
			el.style.display = 'block'; _hostFit(true);   // v79
			var Key_Us = prm_j.Key_Us || opts.Key_Us || '';
			if (Key_Us) {
				var Edr_s = prm_j.Edr_s || opts.Edr_s || cookie || '';
				if (Edr_s && _checkEmail(Edr_s)) {
					opts.Key_Us = Key_Us;
					// Rea_s : seulement pertinent quand Key_Us vient du paramètre ?K= (opts.Rea_s déjà fixé à l'init)
					opts.Rea_s  = opts.Rea_s || _getDefaultRea();
					var edrEl = _q('.qfa-edr');
					if (edrEl) { edrEl.value = Edr_s; }
					_drwEdr(Edr_s);
					_saveCookieAndStart(Edr_s);
				}
			}
		}
    // Sauve l'Edr dans le cookie local (jamais transmis au serveur) puis
    // démarre un cycle d'authentification
    function _saveCookieAndStart(Edr_s) {
        cookie = Edr_s;
        try { localStorage.setItem('qfa_edr', Edr_s); } catch(e) {}
        _wsClose();
        _ch1Start(Edr_s);
    }

	// Retourne le texte par défaut de la raison d'authentification (message 779
	// de _QfA.json), utilisé quand aucune Rea_s explicite n'a été fournie
	// (ni via le paramètre URL ?R=, ni via un appel manuel)
	function _getDefaultRea() {
		var pos = msgAti[779] || 0;
		return pos ? msgTj[pos - 1] : 'Demande d\'authentification';
	}

	// Notifie le démarrage d'authentification (nom d'action selon run/edt) ;
	// Rea_s suit la priorité : valeur explicite (opts.Rea_s, fixée à l'init
	// si ?K=&R= sont présents) sinon texte par défaut du message 779
	function _ch1Start(Edr_s) {
		var action_s = (opts.mode === 'edt') ? 'ch1_edt' : 'ch1_run';
		_notify({ action: action_s, Key: { Us: opts.Key_Us || '' }, Edr: { s: Edr_s }, Rea: { s: opts.Rea_s || _getDefaultRea() } });
	}

    // API publique — point d'entrée retour serveur, réaffiche le composant
    // selon l'état JSON reçu ({g, a, Tip})
    function drw(i_j) {
        try {
            if (typeof i_j === 'string') { try { i_j = JSON.parse(i_j) } catch(e) { return } }
            lastDrw_j = i_j;
            if (opts.mode === 'dsp') { cookie = _hostCookie() }   // v59
            var g_j = i_j.g || {}, a_j = i_j.a || {}, tip_j = (i_j.Tip !== undefined) ? i_j.Tip : null;
            curLay = _layOf(tip_j);   // v74
            spk2s = QfaScore.spk2s((g_j.k && g_j.k[0]) ? g_j.k[0] : 1);
            var bckPos_i = msgAti[CFG_BCK] || 0;
            if (bckPos_i) { _q('.qfa-bck').innerHTML = QfaScore.svgFitCtrlS(msgTj[bckPos_i - 1]) }
            var bckL = _q('.qfa-bck');   // v74 : fond caché par Lay ou par l'œil
            if (bckL) { bckL.style.visibility = _hidden(CFG_BCK) ? 'hidden' : '' }
            _drwHdr();   // v61
            if (tip_j === null) {
                _drwTip('');
            } else {
                var escPos_i = msgAti[CFG_ESC] || 0;
                if (escPos_i) {
                    var escEl = _q('.qfa-esc'); escEl.style.display = 'block'; escEl.innerHTML = QfaScore.svgFitCtrlS(msgTj[escPos_i - 1]);
                    // v49 : style.geo["254"] = { w, h, visible }
                    var g254 = (cssCmpJ && cssCmpJ.geo) ? cssCmpJ.geo['254'] : null;
                    if (g254) {
                        if (g254.w) { escEl.style.width  = g254.w + 'px' }
                        if (g254.h) { escEl.style.height = g254.h + 'px' }
                        if (g254.visible === false) { escEl.style.display = 'none' }
                    }
                    if (_hidden(CFG_ESC)) { escEl.style.display = 'none' }   // v74 : Lay
                }
                var scoS = '';
                if (tip_j.s !== undefined) {
                    scoS = tip_j.s; _q('.qfa-msg-so').style.display = 'none';
                } else if (tip_j.t && tip_j.t.length) {
                    if (!isNaN(parseFloat(tip_j.t[0])) && isFinite(tip_j.t[0])) {
                        var msgI_s = tip_j.t[0];
                        scoS = msgTj[(msgAti[msgI_s] || 1) - 1] || '';
                        for (var k = 1; k < tip_j.t.length; k += 2) { scoS = scoS.split(tip_j.t[k]).join(tip_j.t[k + 1]) }
                        var soEl = _q('.qfa-msg-so'); soEl.style.display = 'inline'; soEl.textContent = msgI_s;
                    } else {
                        scoS = tip_j.t[0];
                        for (var k = 1; k < tip_j.t.length; k += 2) { scoS = scoS.split(tip_j.t[k]).join(tip_j.t[k + 1]) }
                        _q('.qfa-msg-so').style.display = 'none';
                    }
                }
                _drwTip(scoS);
            }

            // QR/logo — contrat a.Qrc = { e, txt, svg } (traduction du Dart) :
            //   svg : image SVG AUTONOME rendue par le SERVEUR (QR + logo au
            //         centre, en un seul SVG PLAT). Le composant AFFICHE, il
            //         n'encode rien (pas d'encodeur QR en JS pur).
            //   e   : cliquable (true) ou non.
            var c2 = _q('.qfa-c2');
            var _svg = (a_j.Qrc && a_j.Qrc.svg) ? a_j.Qrc.svg : '';
            if (!a_j.Qrc || _svg === '' || (a_j.Qrc.lg === true && (curLay & 2) === 0)) {   // v75
                c2.style.display = 'none';
            } else {
                c2.style.display = 'block';
                var qrcEl = _q('.qfa-qrc');
                var qs_i = _qrSize();              // v60 : style.place.qr.w
                qrcEl.style.width   = qs_i + 'px';
                qrcEl.style.height  = qs_i + 'px';
                qrcEl.style.display = 'inline-block';
                qrcEl.style.cursor  = a_j.Qrc.e ? 'pointer' : 'default';
                var qrcSrc = 'data:image/svg+xml;base64,' +
                    btoa(unescape(encodeURIComponent(_svg)));
                qrcEl.innerHTML = '<img width="' + qs_i + 'px" height="' + qs_i + 'px" src="' + qrcSrc + '">';
                qrcEl.dataset.clickable = a_j.Qrc.e ? '1' : '0';
                qrcEl.dataset.qrSvg = _svg; qrcEl.dataset.alt = '0';   // v64
            }

            var c3 = _q('.qfa-c3');
            // v69 (règle Marc) : pas de champ Edr -> ni mémoriser/oublier ni
            // >> non plus, même détaché de la barre (place.run) ; le texte
            // reprend la place (_fitMsg ne compte que les éléments visibles).
            var runD = _q('.qfa-run');
            if (runD && runD.parentNode === el) { runD.style.display = a_j.Edr ? 'flex' : 'none' }
            if (!a_j.Edr) {
                c3.style.display = 'none';
            } else {
                c3.style.display = 'flex';
                var edrEl = _q('.qfa-edr');
                var edrVal = a_j.Edr.s || cookie || '';
                edrEl.value    = edrVal;
                edrEl.disabled = !a_j.Edr.e;
                edrEl.placeholder = _phText();   // v61 : case 292
                _drwEdr(edrVal);
                if (a_j.Edr.e && !edrVal) { edrEl.focus() }
            }
            el.style.display = 'block'; _hostFit(true);   // v79
            _applyGeoVis();   // v71 (v72 : AVANT _fitMsg, qui en tient compte)
            _fitMsg();   // v69 : une fois QR et barre affichés
            if (a_j.ChX && opts.mode !== 'dsp') {   // v55 : dsp = jamais de CH2 ici
                chxG_j = g_j;
                chxNaP_s = a_j.ChX.Prv && a_j.ChX.Prv.u ? a_j.ChX.Prv.u : '';
                chxUrl_s = a_j.ChX.Url && a_j.ChX.Url.s ? a_j.ChX.Url.s : '';
                if (ws && ws.readyState <= 1) { _wsSendClick() } else { _wsOpen() }
            }
        } catch (e) { console.error('[QfA drw]', e) }
    }

    // Ouvre le WebSocket d'appairage et route les réponses selon leur code
    function _wsOpen() {
        if (!chxUrl_s) { console.error('[QfA WS] URL manquante'); return }
        ws = new WebSocket(chxUrl_s);
        ws.onopen = function () { _wsSend({ g: chxG_j, c: { i: 1, u: chxNaP_s } }); _skInit(chxNaP_s) };
        ws.onmessage = function (evt) {
            try {
                var bck_j = JSON.parse(evt.data), r_i = bck_j.Tip && bck_j.Tip.r;
                switch (r_i) {
                    case RES_OK: drw(bck_j); break;
                    case RES_KO: _wsClose(); drw(bck_j); _notify({ action: 'ko', data: bck_j }); break;
                    case RES_GO: _wsClose(); drw(bck_j); _skEnrolThen(bck_j, function () { _notify({ action: (opts.mode === 'edt' ? 'go_edt' : 'go_run'), g: bck_j.g }) }); break;
                    case RES_OG: _wsClose(); drw(bck_j); _notify({ action: 'og', data: bck_j }); break;
                    default: drw(bck_j);
                }
            } catch (e) { console.error('[QfA WS] Erreur parsing message', e) }
        };
        ws.onclose = function () { ws = null };
        ws.onerror = function (e) { console.error('[QfA WS] Erreur', e); _wsClose(); _notify({ action: 'ko', error: 'ws_error' }) };
    }

    // Envoie le 2e clic du protocole d'appairage (scan/clic confirmé)
    // v76 : apres le clic, le QR cede la place au logo carre (_Sqr) et n'est
    // plus cliquable ; sans logo ou si le bit 2 du Lay est eteint : zone masquee
    function _qrcToLogo() {
        var qrcEl = _q('.qfa-qrc'), c2 = _q('.qfa-c2');
        if (!qrcEl) return;
        qrcEl.dataset.clickable = '0';
        qrcEl.style.cursor = 'default';
        var sqP = msgAti[CFG_SQR] || 0;
        var logo = (sqP && msgTj) ? String(msgTj[sqP - 1] || '') : '';
        var im = qrcEl.querySelector('img');
        if ((curLay & 2) !== 0 && im && logo.trim().charAt(0) === '<') {
            im.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(logo)));
        } else if (c2) {
            c2.style.display = 'none';
        }
    }
    function _wsSendClick() { _wsSend({ g: chxG_j, c: { i: 2, u: chxNaP_s } }) }
    // Envoie un objet JSON brut sur le WebSocket s'il est ouvert
    function _wsSend(obj_j) {
        if (ws && ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify(obj_j)) }
    }
    // Ferme proprement le WebSocket s'il est ouvert
    function _wsClose() { if (ws) { try { ws.close() } catch(e) {} ws = null } }

    // v73 — Clé silencieuse : iframe invisible qovi.ch/pk/sk.html (même hôte
    // que le CH2). Elle seule parle au serveur ; ici on ne fait que lui passer
    // Prv_NaP_u. Toute erreur est silencieuse : le login continue comme avant.
    function _skInit(u) {
        try {
            if (!u || !chxUrl_s || !window.postMessage) return;
            var o = new URL(chxUrl_s.replace(/^ws/i, 'http')).origin;
            if (o.indexOf('https://') !== 0) return;   // jamais hors https
            skPendU = u;
            if (skIfr && skOrig === o) { if (skReady) _skPost({ qoviSk: 'init', u: u }); return }
            skOrig = o; skReady = false;
            if (!_skInit.lst) {
                _skInit.lst = true;
                window.addEventListener('message', function (ev) {
                    if (!skIfr || ev.source !== skIfr.contentWindow || ev.origin !== skOrig) return;
                    var d = ev.data || {};
                    if (d.qoviSk === 'ready') { skReady = true; if (skPendU) _skPost({ qoviSk: 'init', u: skPendU }) }
                    else if (d.qoviSk === 'enrolled' && skEnrolCb) { var cb = skEnrolCb; skEnrolCb = null; cb() }
                });
            }
            skIfr = document.createElement('iframe');
            skIfr.src = o + '/pk/sk.html';
            skIfr.title = 'Qovi';
            skIfr.setAttribute('aria-hidden', 'true');
            skIfr.tabIndex = -1;
            skIfr.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
            document.body.appendChild(skIfr);
        } catch (e) { /* silencieux */ }
    }
    function _skPost(m) { try { skIfr.contentWindow.postMessage(m, skOrig) } catch (e) {} }
    // Au GO : si le serveur demande l'enregistrement de l'appareil (Sk.e),
    // l'iframe le fait AVANT la suite (redirection), avec 3 s maximum.
    function _skEnrolThen(bck_j, next) {
        if (!(bck_j && bck_j.Sk && bck_j.Sk.e === 1 && skIfr && skReady && skPendU)) { next(); return }
        var done = false;
        var fin = function () { if (!done) { done = true; next() } };
        skEnrolCb = fin;
        setTimeout(fin, 3000);
        _skPost({ qoviSk: 'enrol', u: skPendU });
    }

    // API publique — affiche un texte Score brut, hors cycle drw() normal
    function drwTip(tip_s) {
        if (!el || !cssCmpJ) { setTimeout(function() { drwTip(tip_s) }, 200); return }
        _drwTip(tip_s); el.style.display = 'block'; _hostFit(true); _fitMsg();   // v69 (v79 : parent)
    }

    // Convertit un texte Score (avec position verticale optionnelle) en HTML
    // et l'injecte dans la zone .qfa-msg.
    // v57 (02.10.2026) : position lue par QfaScore.parseVPos — 1ère ligne seule
    // « U », « U20 », « B10 », « M » (ou ancienne lettre collée « Uc1_… »).
    // v58 : le % porte sur la PLACE QUI RESTE (cadre − message) : deux
    // espaceurs flex-grow se la partagent (U20 → 20:80, B20 → 80:20).
    // U0 = haut, U50 = M, U100 = bas ; le message reste toujours visible.
    function _drwTip(tip_s) {
        var dd = _dims();                // v50 : w/h effectifs (surcharges mobile)
        var ti = [dd.w, dd.h];
        var vp = QfaScore.parseVPos(tip_s || '');
        tip_s = vp.body;
        var valign_s = (vp.pos === 'U') ? 'flex-start' : (vp.pos === 'B') ? 'flex-end' : 'center';
        tip_s = _applyTags(tip_s);   // v49
        if (tip_s && tip_s.length >= 3 && tip_s[2] !== '_') { tip_s = 'c4_' + tip_s }
        var scoreHtml_s = QfaScore.convScoreToHtml(tip_s || '', QfaScore.TARGET_AWP, spk2s);
        var msg = _q('.qfa-msg');
        msg.style.cssText = 'position:absolute;top:0;left:0;width:' + ti[0] + 'px;height:' + ti[1] + 'px;z-index:1;background:transparent;overflow:hidden;padding:' + CFG_PAD + 'px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:' + valign_s + ';pointer-events:none;';
        // v69 SÉCURITÉ : couleur et police vont dans un attribut style d'un
        // HTML injecté -> filtrées (une valeur « "><img onerror=…> » ne sort plus).
        var color = _safeColor((cssCmpJ && cssCmpJ.g && cssCmpJ.g.color) ? cssCmpJ.g.color : '') || '#000013';
        var font  = String((cssCmpJ && cssCmpJ.g && cssCmpJ.g.font_family) ? cssCmpJ.g.font_family : 'sans-serif').replace(/[^A-Za-z0-9 ,\-']/g, '') || 'sans-serif';
        var top_i = (vp.pos === 'B') ? 100 - vp.pct : vp.pct;
        var spT_s = (vp.pct > 0) ? '<div style="flex:' + top_i + ' 0 0;min-height:0;"></div>' : '';
        var spB_s = (vp.pct > 0) ? '<div style="flex:' + (100 - top_i) + ' 0 0;min-height:0;"></div>' : '';
        msg.innerHTML = spT_s +
            '<div class="qfa-msgc" style="flex-shrink:0;color:' + color + ';font-family:' + font + ';">' + scoreHtml_s + '</div>' +
            spB_s;
        _fitCss(); _placeMsg(msg, ti[0], ti[1]);   // v69
        delete msg.dataset.top0; delete msg.dataset.h0;
    }

    // Met à jour visibilité Run/Cki selon validité syntaxique de l'Edr ;
    // neutralise un QR de pairing devenu obsolète si l'Edr a changé
    function _drwEdr(Edr_s) {
        var runEl = _q('.qfa-run'), ckiEl = _q('.qfa-cki');
        var valid_b = _checkEmail(Edr_s);

        runEl.style.visibility = valid_b ? 'visible' : 'hidden';
        ckiEl.style.visibility = valid_b ? 'visible' : 'hidden';

        if (valid_b) {
            runEl.style.display = 'flex';
            runEl.style.alignItems = 'center';
            runEl.style.justifyContent = 'center';
            var runPos_i = msgAti[CFG_RUN] || 0;
            if (runPos_i && !runEl.dataset.init) {
                runEl.innerHTML = QfaScore.svgFitCtrlS(msgTj[runPos_i - 1]);
                runEl.dataset.init = '1';
            }
            ckiEl.style.cssText += ';display:flex;align-items:center;justify-content:center;';
            var idx_i = cookie ? (msgAti[CFG_CLR] || 0) : (msgAti[CFG_STO] || 0);
            if (idx_i && ckiEl.dataset.cookieState !== String(cookie ? 1 : 0)) {
                ckiEl.innerHTML = QfaScore.svgFitCtrlS(msgTj[idx_i - 1]);
                ckiEl.dataset.cookieState = String(cookie ? 1 : 0);
            }
            ckiEl.dataset.hasCookie = cookie ? '1' : '0';
        }
        _applyGeoVis();   // v71
    }

    // v71 : œil de la Librairie — style.geo["<case>"].visible === false cache
    // l'élément : logo d'en-tête 291, bouton >> 223, icône affichée de la
    // case cookie (235 mémoriser sans cookie / 228 oublier avec cookie).
    // Par OPACITÉ (pas visibility, que le moteur pilote déjà pour >> et
    // l'icône cookie selon la validité de l'adresse) + clics désactivés.
    function _geoHidden(n) {
        var g = (cssCmpJ && cssCmpJ.geo) ? cssCmpJ.geo[String(n)] : null;
        return !!(g && g.visible === false);
    }
    // v74 : Lay du message affiché (Tip.t[0] du serveur, Tip.i de l'aperçu)
    function _layOf(t) {
        if (!t || !layJ) return 255;
        var id = (t.i !== undefined && t.i !== null) ? t.i
            : (t.t && t.t.length && !isNaN(parseFloat(t.t[0])) && isFinite(t.t[0])) ? t.t[0] : null;
        if (id === null || layJ[id] === undefined) return 255;
        var v = Number(layJ[id]);
        return (isFinite(v) && v >= 0 && v <= 255) ? v : 255;
    }
    // v74 : caché par l'œil OU par le bit Lay du message courant
    function _hidden(n) {
        var b = LAYBIT[n];
        return _geoHidden(n) || (b !== undefined && (curLay & b) === 0);
    }
    function _applyGeoVis() {
        var bk = _q('.qfa-bck');   // v74 : fond (œil ou Lay) — repris après un changement de style
        if (bk) { bk.style.visibility = _hidden(CFG_BCK) ? 'hidden' : '' }
        var hd = _q('.qfa-hdr');
        // v72 : logo d'en-tête caché = RETIRÉ (display:none) -> la place est
        // rendue au texte (_fitMsg ne le compte plus comme obstacle)
        if (hd) {
            if (_hidden(291)) { hd.style.display = 'none' }
            else if (hd.innerHTML) { hd.style.display = 'block' }
        }
        var run = _q('.qfa-run');
        if (run) { var hr = _hidden(223); run.style.opacity = hr ? '0' : ''; run.style.pointerEvents = hr ? 'none' : '' }
        var cki = _q('.qfa-cki');
        if (cki) {
            var hc = _hidden(cki.dataset.hasCookie === '1' ? 228 : 235);
            cki.style.opacity = hc ? '0' : ''; cki.style.pointerEvents = hc ? 'none' : '';
        }
    }

    // Valide syntaxiquement une adresse email
    function _checkEmail(Edr_s) {
        if (!Edr_s) return false;
        return /[-_.a-zA-Z0-9]+[@][-.a-zA-Z0-9]+[.][a-z]{2,4}/.test(Edr_s.replace(/[><\s]/g, ''));
    }

    // Notifie un événement vers opts.onMessage, ou en repli vers le bridge WebDev
    function _notify(payload_j) {
        if (typeof opts.onMessage === 'function') { opts.onMessage(payload_j); return }
        var isAuthAction = (payload_j.action === 'ch1_run' || payload_j.action === 'go_run'
            || payload_j.action === 'ch1_edt' || payload_j.action === 'go_edt');
        if (opts.mode !== 'edt' && !isAuthAction) return;
        var btn = document.getElementById(opts.bridge || 'A2');
        if (btn) { btn.innerText = JSON.stringify(payload_j); btn.click() }
    }

    // Raccourci querySelector limité au conteneur de l'instance
    function _q(sel_s) { return el.querySelector(sel_s) }

    return {
        init      : init,
        start     : start,
        drw       : drw,
        drwTip    : drwTip,
        setConfig : setConfig,
        setScreen : function (w) { screenW = (w > 0) ? w : 0; if (el) { _applyDims(true); _applySkin() } },
        getOpts   : function() { return opts },
        getFit    : function() { return fitState },   // v69 : 'ok' | 'shrink' | 'scroll'
        getEl     : function() { return el },
        getWb     : function() { return (cssCmpJ && cssCmpJ.g && cssCmpJ.g.wb) ? cssCmpJ.g.wb : [0,0,320,480] }
    }
}

var QfA = QfaCreate();