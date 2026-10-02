/* ═══════════════ CharArt — generador de personajes en SVG ═══════════════
   Cada personaje usa el mismo esqueleto (cabeza, cuello, torso, brazos de dos
   segmentos, manos) con ropa, peinado y accesorios propios. Las expresiones
   se regeneran al cambiar de ánimo; la animación es solo CSS (transform/opacity). */
const CharArt=(function(){
  'use strict';
  let counter=0;
  const OL='#4a2c17';                      /* contorno suave de la piel */
  const lin=(id,stops,v)=>`<linearGradient id="${id}" ${v?'x1="0" y1="0" x2="0" y2="1"':'x1="0" y1="0" x2="1" y2="0"'}>${stops.map(s=>`<stop offset="${s[0]}" stop-color="${s[1]}"${s[2]!=null?` stop-opacity="${s[2]}"`:''}/>`).join('')}</linearGradient>`;

  /* ── datos por personaje ── */
  const SPEC={
    rey:{skin:['#f8ddc2','#eac19b','#c8956a'],iris:'#4f7597',brow:'#d8d4ca',browW:5.2,age:2,rosy:.22,
      robe:['#7a3fb0','#55278a','#2e1250'],sleeve:'#5b2b91',sleeveD:'#2e1250',cuff:'#f4ecd8',trim:'#e2b653'},
    escriba:{skin:['#f9ddc2','#ecc49d','#cd9b70'],iris:'#6a5230',brow:'#5b3d24',browW:3.4,age:0,rosy:.2,
      robe:['#a5773d','#7c5528','#4b3018'],sleeve:'#8a6030',sleeveD:'#4b3018',cuff:'#efe2c2',trim:'#5b3d24'},
    consejero:{skin:['#f2d5b6','#e0b791','#b98a62'],iris:'#7b5a26',brow:'#1c1917',browW:3.2,age:1,rosy:.1,
      robe:['#3b727a','#27525a','#132c31'],sleeve:'#2c5a62',sleeveD:'#132c31',cuff:'#cfd7de',trim:'#cfd7de'},
    bufon:{skin:['#fce2c6','#f0c7a1','#d19d72'],iris:'#2f7f6e',brow:'#7b3a1a',browW:3.4,age:0,rosy:.5,
      robe:['#d13a35','#b02a2a','#7a1a1c'],sleeve:'#e5b62a',sleeveD:'#8a6a12',cuff:'#f4ecd8',trim:'#e5b62a'},
    caballero:{skin:['#e9c097','#d3a377','#a9784f'],iris:'#5b4630',brow:'#2e1d12',browW:4.2,age:1,rosy:.12,
      robe:['#d0d8e2','#93a0af','#4f5a68'],sleeve:'#8b95a2',sleeveD:'#4a5461',cuff:'#5a4636',trim:'#e2b653'},
    maestro:{skin:['#f5d8ba','#e4bb92','#c38f66'],iris:'#5b7fa0',brow:'#e9e6df',browW:5.6,age:3,rosy:.25,
      robe:['#5f81a8','#40628c','#243a58'],sleeve:'#476a94',sleeveD:'#243a58',cuff:'#efe6cf',trim:'#d8b458'},
    aprendiz:{skin:['#f7d6b4','#e7b98f','#c48d62'],iris:'#5a7a3c',brow:'#5a3a22',browW:3.4,age:0,rosy:.32,
      robe:['#c9b28a','#a89068','#6d5a3c'],sleeve:'#9a8460',sleeveD:'#5c4a30',cuff:'#efe2c2',trim:'#5c4a30'}
  };

  /* ── cara: cejas + ojos + boca según ánimo ── */
  const MOODS={
    neutral:{brow:'n',eye:'open',mouth:'flat'},
    pleased:{brow:'p',eye:'open',mouth:'soft'},
    happy:{brow:'h',eye:'open',mouth:'grin'},
    radiant:{brow:'r',eye:'arc',mouth:'beam'},
    stern:{brow:'s',eye:'angry',mouth:'stern'},
    wary:{brow:'w',eye:'half',mouth:'wary'},
    sad:{brow:'d',eye:'sad',mouth:'sad'},
    surprised:{brow:'u',eye:'wide',mouth:'gasp'},
    smirk:{brow:'m',eye:'half',mouth:'smirk'},
    thinking:{brow:'t',eye:'half',mouth:'hmm'}
  };
  const BROWS={
    n:['M94,88 Q104,84 114,88','M126,88 Q136,84 146,88'],
    p:['M94,87 Q104,82 114,86','M126,86 Q136,82 146,87'],
    h:['M94,85 Q104,79 114,84','M126,84 Q136,79 146,85'],
    r:['M94,83 Q104,75 114,82','M126,82 Q136,75 146,83'],
    s:['M93,83 L115,92','M147,83 L125,92'],
    w:['M94,84 Q104,78 114,84','M126,89 L146,87'],
    d:['M93,91 L115,84','M147,91 L125,84'],
    u:['M94,80 Q104,72 114,79','M126,79 Q136,72 146,80'],
    m:['M94,88 Q104,85 114,88','M126,86 Q138,78 146,84'],
    t:['M94,85 Q104,79 114,85','M126,90 L146,88']
  };
  function eye(c,u,cx,cy,mode,side){
    const s=side; /* -1 izquierda del espectador, +1 derecha */
    const iris=c.iris, cyI=mode==='sad'?cy+1.4:cy+.3;
    const sclera=`<path d="M${cx-9.5},${cy} Q${cx},${cy-8.5} ${cx+9.5},${cy} Q${cx},${cy+6.5} ${cx-9.5},${cy}Z" fill="#fbf7ee" stroke="#3a2416" stroke-width=".9"/>`;
    const ball=r=>`<circle cx="${cx}" cy="${cyI}" r="${r}" fill="${iris}"/><circle cx="${cx}" cy="${cyI}" r="${r*.5}" fill="#120a05"/><circle cx="${cx+1.5}" cy="${cyI-1.4}" r="1.1" fill="#fff"/>`;
    const lash=`<path d="M${cx-10},${cy-.4} Q${cx},${cy-9.4} ${cx+10},${cy-.4}" fill="none" stroke="#2a170b" stroke-width="1.9" stroke-linecap="round"/>`;
    if(mode==='arc') return `<path d="M${cx-8.5},${cy+1.5} Q${cx},${cy-8} ${cx+8.5},${cy+1.5}" fill="none" stroke="#2a170b" stroke-width="2.4" stroke-linecap="round"/>`;
    if(mode==='wide') return `<path d="M${cx-10.5},${cy} Q${cx},${cy-11} ${cx+10.5},${cy} Q${cx},${cy+9} ${cx-10.5},${cy}Z" fill="#fbf7ee" stroke="#3a2416" stroke-width=".9"/>${ball(3.6)}`+lash;
    let lid='';
    if(mode==='half') lid=`<path d="M${cx-10.5},${cy-1.4} L${cx+10.5},${cy-1.4} L${cx+10.5},${cy-10} L${cx-10.5},${cy-10}Z" fill="${c.skin[1]}"/><path d="M${cx-10},${cy-1.4} L${cx+10},${cy-1.4}" stroke="#2a170b" stroke-width="1.9" stroke-linecap="round"/>`;
    if(mode==='angry'){ const a=cy-4.6,b=cy+1; /* párpado inclinado hacia el centro */
      lid=s<0?`<path d="M${cx-10.5},${a} L${cx+10.5},${b} L${cx+10.5},${cy-10} L${cx-10.5},${cy-10}Z" fill="${c.skin[1]}"/><path d="M${cx-10},${a} L${cx+10},${b}" stroke="#2a170b" stroke-width="1.9" stroke-linecap="round"/>`
                  :`<path d="M${cx+10.5},${a} L${cx-10.5},${b} L${cx-10.5},${cy-10} L${cx+10.5},${cy-10}Z" fill="${c.skin[1]}"/><path d="M${cx+10},${a} L${cx-10},${b}" stroke="#2a170b" stroke-width="1.9" stroke-linecap="round"/>`; }
    return sclera+ball(4.5)+(lid||lash)+`<path d="M${cx-8},${cy+3.6} Q${cx},${cy+7.4} ${cx+8},${cy+3.6}" fill="none" stroke="${c.skin[2]}" stroke-width=".9" opacity=".55"/>`;
  }
  const MOUTHS={
    flat:'<path d="M110,133 Q120,135.5 130,133" fill="none" stroke="#8a3f33" stroke-width="2.4" stroke-linecap="round"/>',
    soft:'<path d="M109,131.5 Q120,138 131,131.5" fill="none" stroke="#8a3f33" stroke-width="2.5" stroke-linecap="round"/>',
    grin:'<path d="M107,129 Q120,146 133,129 Q120,134 107,129Z" fill="#fffaf0" stroke="#7a2f26" stroke-width="2" stroke-linejoin="round"/>',
    beam:'<path d="M105,128 Q120,151 135,128 Q120,134 105,128Z" fill="#fffaf0" stroke="#7a2f26" stroke-width="2.2" stroke-linejoin="round"/><path d="M110,137 Q120,142 130,137" fill="none" stroke="#c46a5c" stroke-width="1.5"/>',
    stern:'<path d="M109,135 Q120,131 131,135" fill="none" stroke="#7a3428" stroke-width="2.8" stroke-linecap="round"/>',
    wary:'<path d="M110,135 Q119,131.5 131,136" fill="none" stroke="#8a3f33" stroke-width="2.5" stroke-linecap="round"/>',
    sad:'<path d="M110,137 Q120,130.5 130,137" fill="none" stroke="#8a3f33" stroke-width="2.5" stroke-linecap="round"/>',
    gasp:'<ellipse cx="120" cy="136" rx="6" ry="8" fill="#3b0f0a" stroke="#7a2f26" stroke-width="1.6"/><ellipse cx="120" cy="140" rx="3.4" ry="2.6" fill="#b5544a"/>',
    smirk:'<path d="M110,134 Q123,137.5 133,129.5" fill="none" stroke="#8a3f33" stroke-width="2.5" stroke-linecap="round"/>',
    hmm:'<path d="M112,134.5 Q120,132.5 128,135.5" fill="none" stroke="#8a3f33" stroke-width="2.4" stroke-linecap="round"/>'
  };
  function face(c,u,mood,id){
    const m=MOODS[mood]||MOODS.neutral, b=BROWS[m.brow];
    const rosy=c.rosy+(mood==='happy'||mood==='radiant'||mood==='pleased'?.2:0);
    const bw=c.browW;
    return `<ellipse cx="96" cy="118" rx="9" ry="5.5" fill="#e0715f" opacity="${rosy}"/><ellipse cx="144" cy="118" rx="9" ry="5.5" fill="#e0715f" opacity="${rosy}"/>`
      +eye(c,u,104,100,m.eye,-1)+eye(c,u,136,100,m.eye,1)
      +`<g fill="none" stroke="${c.brow}" stroke-width="${bw}" stroke-linecap="round">${b.map(d=>`<path d="${d}"/>`).join('')}</g>`
      +`<g class="lids"><ellipse class="lid" cx="104" cy="99" rx="11.5" ry="9" fill="${c.skin[1]}"/><ellipse class="lid" cx="136" cy="99" rx="11.5" ry="9" fill="${c.skin[1]}"/></g>`
      +MOUTHS[m.mouth]
      +`<g class="talk"><ellipse cx="120" cy="134" rx="7.4" ry="5" fill="#3b0f0a"/><ellipse cx="120" cy="137" rx="4" ry="2" fill="#b5544a"/></g>`
      +(mood==='sad'?`<path d="M151,108 Q153,114 151,118 Q149,114 151,108Z" fill="#9fd0ea" opacity=".85"/>`:'');
  }

  /* ── piezas reutilizables ── */
  function hand(u,c,x,y,pose,glove){
    const sk=glove?glove:`url(#${u}sk)`, ol=glove?'#333b45':OL;
    if(pose==='fist') return `<g transform="translate(${x},${y})"><path d="M-10,-8 C-10,-16 10,-16 10,-8 L11,6 C11,14 -11,14 -11,6Z" fill="${sk}" stroke="${ol}" stroke-width="1.2"/><path d="M-6,-6 L-6,4 M0,-7 L0,4 M6,-6 L6,4" stroke="${ol}" stroke-width=".9" opacity=".55"/></g>`;
    if(pose==='point') return `<g transform="translate(${x},${y})"><path d="M-9,-6 C-9,-14 9,-14 9,-6 L10,8 C10,15 -10,15 -10,8Z" fill="${sk}" stroke="${ol}" stroke-width="1.2"/><path d="M4,-8 L6,-24 Q8,-27 10,-24 L9,-6Z" fill="${sk}" stroke="${ol}" stroke-width="1.2"/><path d="M-9,0 C-15,1 -15,9 -10,11" fill="${sk}" stroke="${ol}" stroke-width="1.1"/></g>`;
    return `<g transform="translate(${x},${y})"><path d="M-9,-7 C-9,-15 9,-15 9,-7 L10,8 C10,16 -10,16 -10,8Z" fill="${sk}" stroke="${ol}" stroke-width="1.2"/><path d="M-9,-1 C-16,1 -16,10 -10,12" fill="${sk}" stroke="${ol}" stroke-width="1.1"/><path d="M-3,5 L-3,14 M2,5 L2,15 M6.5,5 L6.5,13" stroke="${ol}" stroke-width=".9" opacity=".45"/></g>`;
  }
  function arm(u,c,side,o){
    o=o||{}; const L=side==='L';
    const S=L?[72,184]:[168,184], E=L?[54,254]:[186,254], W=L?[60,306]:[180,306];
    const slv=o.sleeve||c.sleeve, sd=o.sleeveD||c.sleeveD, w1=o.w1||34, w2=o.w2||30;
    return `<g class="arm arm${side}" style="transform-origin:${S[0]}px ${S[1]}px">
      <path d="M${S}L${E}" fill="none" stroke="${sd}" stroke-width="${w1+3}" stroke-linecap="round"/>
      <path d="M${S}L${E}" fill="none" stroke="${slv}" stroke-width="${w1}" stroke-linecap="round"/>
      <path d="M${S[0]+(L?-6:6)},${S[1]+4}L${E[0]+(L?-6:6)},${E[1]-2}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="7" stroke-linecap="round"/>
      ${o.pauldron||''}
      <g class="fore fore${side}" style="transform-origin:${E[0]}px ${E[1]}px">
        <path d="M${E}L${W}" fill="none" stroke="${sd}" stroke-width="${w2+3}" stroke-linecap="round"/>
        <path d="M${E}L${W}" fill="none" stroke="${slv}" stroke-width="${w2}" stroke-linecap="round"/>
        <path d="M${E[0]+(L?-5:5)},${E[1]+4}L${W[0]+(L?-5:5)},${W[1]-4}" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="6" stroke-linecap="round"/>
        ${o.cuffSVG||`<ellipse cx="${W[0]}" cy="${W[1]+1}" rx="${(o.cuffW||16)}" ry="6.5" fill="${o.cuff||c.cuff}" stroke="${sd}" stroke-width="1.2"/>`}
        ${hand(u,c,W[0],W[1]+12,o.pose,o.glove)}
        ${o.held||''}
      </g>
    </g>`;
  }
  const gold=u=>`url(#${u}gold)`;
  const folds=(color,op)=>`<g fill="none" stroke="${color}" stroke-opacity="${op}" stroke-width="2.2" stroke-linecap="round"><path d="M92,262 C88,312 84,352 78,388"/><path d="M120,268 C120,320 120,356 120,390"/><path d="M150,262 C154,312 158,352 164,388"/><path d="M70,240 C64,300 58,350 52,388"/></g>`;
  const hem=(u,c)=>`<path d="M40,376 L200,376 L201,392 L39,392Z" fill="${gold(u)}" opacity=".9"/><path d="M40,376 L200,376" stroke="#fff5cf" stroke-opacity=".5" stroke-width="1"/>`;

  /* ── hairstyles / headgear ── */
  function hair(style,col){
    const b=col[0],s=col[1];
    const strands=(d,st)=>`<path d="${d}" fill="none" stroke="${st}" stroke-width="1.1" opacity=".6"/>`;
    switch(style){
    case 'king': return {
      back:`<path d="M84,86 C68,104 70,146 86,172 L104,150 L100,110Z M156,86 C172,104 170,146 154,172 L136,150 L140,110Z" fill="${b}" stroke="${s}" stroke-width="1"/>`,
      front:`<path d="M83,92 C80,62 98,50 120,50 C144,50 160,62 157,92 C152,76 142,68 128,66 C118,72 102,72 92,68 C88,74 85,82 83,92Z" fill="${b}" stroke="${s}" stroke-width="1"/>${strands('M96,64 Q92,74 88,86',s)}${strands('M144,64 Q148,74 152,86',s)}
        <path d="M83,92 C79,108 82,126 89,138 L93,120 C89,112 88,102 90,92Z M157,92 C161,108 158,126 151,138 L147,120 C151,112 152,102 150,92Z" fill="${b}" stroke="${s}" stroke-width="1"/>`};
    case 'bowl': return {
      back:'',
      front:`<path d="M84,94 C80,64 98,52 120,52 C142,52 160,64 156,94 C152,84 146,80 138,80 C132,73 108,73 102,80 C94,80 88,84 84,94Z" fill="${b}" stroke="${s}" stroke-width="1"/>${strands('M100,58 Q94,70 90,84',s)}${strands('M120,54 Q120,64 122,72',s)}
        <path d="M84,94 C82,106 84,116 88,120 L92,102Z M156,94 C158,106 156,116 152,120 L148,102Z" fill="${b}" stroke="${s}" stroke-width="1"/>`};
    case 'slick': return {
      back:`<path d="M84,90 C68,110 70,160 78,196 L100,170 L102,110Z M156,90 C172,110 170,160 162,196 L140,170 L138,110Z" fill="${b}"/>`,
      front:`<path d="M83,96 C78,60 100,48 122,50 C146,52 160,66 157,96 C152,80 142,70 124,66 C110,64 94,72 83,96Z" fill="${b}" stroke="${s}" stroke-width="1"/>${strands('M100,58 Q120,56 148,68','#5b5651')}${strands('M96,66 Q120,62 152,78','#5b5651')}`};
    case 'messy': return {
      back:'',
      front:`<path d="M83,96 C76,62 96,46 118,48 C140,44 162,60 157,96 C154,84 150,78 142,74 L148,84 L134,70 L136,82 L122,68 L118,80 L108,68 L104,82 L94,72 C88,78 85,86 83,96Z" fill="${b}" stroke="${s}" stroke-width="1"/>`};
    case 'short': return {
      back:'',
      front:`<path d="M84,94 C78,62 98,50 120,50 C144,50 162,62 156,94 C154,82 148,74 138,72 C128,68 110,68 100,72 C92,74 86,82 84,94Z" fill="${b}" stroke="${s}" stroke-width="1"/>${strands('M96,60 Q110,54 132,58',s)}`};
    case 'elder': return {
      back:`<path d="M84,100 C72,112 74,140 84,160 L96,136Z M156,100 C168,112 166,140 156,160 L144,136Z" fill="${b}"/>`,
      front:`<path d="M84,96 C80,80 84,68 92,62 C88,76 88,90 92,104 C90,116 90,124 92,132 C86,124 82,110 84,96Z M156,96 C160,80 156,68 148,62 C152,76 152,90 148,104 C150,116 150,124 148,132 C154,124 158,110 156,96Z" fill="${b}" stroke="${s}" stroke-width="1"/>`};
    default: return {back:'',front:''};
    }
  }
  function ageLines(a,skin){
    if(!a) return '';
    const op=.16+.08*a;
    return `<g fill="none" stroke="${skin[2]}" stroke-width="1.1" stroke-linecap="round" opacity="${op*2.4}"><path d="M98,72 Q120,68 142,72"/>${a>1?'<path d="M100,77 Q120,73 140,77"/>':''}<path d="M88,102 L84,104 M88,106 L84,109 M152,102 L156,104 M152,106 L156,109"/><path d="M104,122 Q100,130 106,138 M136,122 Q140,130 134,138" opacity=".7"/></g>`;
  }

  /* ── ropa: cuerpo completo de cada personaje ── */
  function longRobe(u,c,extra){
    return `<path d="M120,168 C96,168 74,172 62,184 C54,192 52,210 50,240 L40,392 L200,392 L190,240 C188,210 186,192 178,184 C166,172 144,168 120,168Z" fill="url(#${u}rb)" stroke="${c.robe[2]}" stroke-width="1.5"/>
      <path d="M150,180 C176,190 186,220 190,250 L200,392 L150,392Z" fill="#000" opacity=".16"/>
      ${folds('#000',.22)}${folds('#fff',.05)}${extra||''}${hem(u,c)}`;
  }
  function neck(u,c){
    return `<path d="M104,134 L104,172 Q120,182 136,172 L136,134Z" fill="url(#${u}sk)" stroke="${OL}" stroke-width="1"/><path d="M104,140 Q120,158 136,140 L136,150 Q120,168 104,150Z" fill="#000" opacity=".2"/>`;
  }
  const ITEM={
    sceptre:u=>`<g><rect x="184.5" y="196" width="5" height="212" rx="2" fill="${gold(u)}" stroke="#7a5416" stroke-width=".8"/><circle cx="187" cy="188" r="11" fill="${gold(u)}" stroke="#7a5416" stroke-width="1.2"/><circle cx="187" cy="188" r="6" fill="#a12522" stroke="#5a1210" stroke-width="1"/><circle cx="184.6" cy="185.6" r="1.8" fill="#fff" opacity=".8"/><path d="M182,199 h10" stroke="#7a5416" stroke-width="2"/><path d="M182,204 h10" stroke="#7a5416" stroke-width="1.4"/></g>`,
    scroll:u=>`<g><rect x="40" y="298" width="42" height="15" rx="7" fill="#efe0b6" stroke="#8a6a35" stroke-width="1.2" transform="rotate(-14 61 305)"/><ellipse cx="42" cy="306" rx="4" ry="7.5" fill="#d8c08a" stroke="#8a6a35" stroke-width="1" transform="rotate(-14 61 305)"/><path d="M50,304 h26 M52,308 h22" stroke="#8a6a35" stroke-width=".8" opacity=".6" transform="rotate(-14 61 305)"/></g>`,
    quill:u=>`<g><path d="M181,298 C186,262 196,230 210,198 C208,226 198,266 186,304Z" fill="#f6efe0" stroke="#8a7a5a" stroke-width="1"/><path d="M181,304 C188,262 198,232 210,198" fill="none" stroke="#8a7a5a" stroke-width="1.2"/><path d="M204,214 L192,244 M200,224 L189,252" stroke="#a89a7a" stroke-width=".8"/></g>`,
    ledger:u=>`<g transform="rotate(-8 56 308)"><rect x="34" y="296" width="44" height="34" rx="2.5" fill="#5e3a1e" stroke="#2c1a0c" stroke-width="1.4"/><rect x="38" y="299" width="36" height="28" rx="1.5" fill="#efe2bd"/><path d="M42,306 h28 M42,311 h28 M42,316 h20" stroke="#6b4a2a" stroke-width="1" opacity=".7"/><path d="M34,296 v34" stroke="#c99b3e" stroke-width="3"/></g>`,
    marotte:u=>`<g><rect x="177.5" y="222" width="4.5" height="140" rx="2" fill="#7b4a22" stroke="#3b2210" stroke-width=".8"/><circle cx="180" cy="212" r="12" fill="#f3d3ac" stroke="#4a2c17" stroke-width="1.2"/><path d="M168,208 L174,190 L180,204 L186,190 L192,208Z" fill="#c1272d" stroke="#4a2c17" stroke-width="1"/><circle cx="174" cy="190" r="3" fill="#e5b62a"/><circle cx="186" cy="190" r="3" fill="#e5b62a"/><circle cx="176" cy="212" r="1.5" fill="#222"/><circle cx="184" cy="212" r="1.5" fill="#222"/><path d="M175,217 Q180,221 185,217" stroke="#7a2f26" stroke-width="1.3" fill="none"/></g>`,
    sword:u=>`<g><path d="M178,258 L182,258 L184,392 L180,404 L176,392Z" fill="url(#${u}steel)" stroke="#39424c" stroke-width="1"/><path d="M180,262 L180,392" stroke="#fff" stroke-opacity=".5" stroke-width="1"/><rect x="164" y="248" width="32" height="7" rx="3" fill="${gold(u)}" stroke="#7a5416" stroke-width="1"/><rect x="177" y="228" width="6" height="22" rx="2.5" fill="#4a2c17" stroke="#24140a" stroke-width="1"/><circle cx="180" cy="224" r="6" fill="${gold(u)}" stroke="#7a5416" stroke-width="1"/></g>`,
    book:u=>`<g transform="rotate(10 60 300)"><rect x="34" y="282" width="50" height="40" rx="3" fill="#2e6b4a" stroke="#123526" stroke-width="1.5"/><rect x="34" y="282" width="7" height="40" rx="2" fill="#1f4e35"/><rect x="47" y="292" width="28" height="12" rx="2" fill="none" stroke="#e2b653" stroke-width="1.4"/><path d="M50,298 h22" stroke="#e2b653" stroke-width="1.2"/><path d="M36,321 h46" stroke="#f1e7c8" stroke-width="2"/></g>`
  };

  /* ── definición completa por personaje ── */
  const BUILD={
    rey(u,c){ return {
      hair:hair('king',['#f2f0ea','#c3beb2']),
      back:`<path d="M52,180 C22,244 20,330 30,394 L210,394 C220,330 218,244 188,180Z" fill="#8b1f24" stroke="#4a0f12" stroke-width="1.5"/><path d="M52,180 C26,244 24,330 32,394 L60,394 C52,330 54,244 68,190Z" fill="#000" opacity=".2"/>`,
      body:longRobe(u,c,`<path d="M112,180 L112,392 L128,392 L128,180Z" fill="${gold(u)}" opacity=".95"/><path d="M116,180 L116,392 M124,180 L124,392" stroke="#7a5416" stroke-width=".7" opacity=".6"/>
        <path d="M56,246 Q120,260 184,246 L184,260 Q120,274 56,260Z" fill="#3a1d10" stroke="#1d0f08" stroke-width="1"/><rect x="108" y="246" width="24" height="20" rx="4" fill="${gold(u)}" stroke="#7a5416" stroke-width="1.4"/><rect x="114" y="251" width="12" height="10" rx="2" fill="#7a2f9a" stroke="#4b1f6f"/>`),
      front:`<path d="M60,186 Q120,160 180,186 Q188,208 172,226 Q148,214 120,222 Q92,214 68,226 Q52,208 60,186Z" fill="url(#${u}fur)" stroke="#bdb6a6" stroke-width="1.2"/>
        <g fill="#241a14"><path d="M74,204 l3,12 l3,-12z M92,210 l3,12 l3,-12z M108,214 l3,12 l3,-12z M126,214 l3,12 l3,-12z M142,210 l3,12 l3,-12z M160,204 l3,12 l3,-12z"/></g>
        <path d="M98,222 Q120,244 142,222" fill="none" stroke="${gold(u)}" stroke-width="4"/><circle cx="120" cy="240" r="7" fill="${gold(u)}" stroke="#7a5416" stroke-width="1.2"/><circle cx="120" cy="240" r="3.4" fill="#a12522"/>`,
      defs:lin(u+'fur',[[0,'#ffffff'],[1,'#d8d2c4']],1),
      armL:arm(u,c,'L',{cuff:'#f4ecd8',cuffW:19,pose:'open'}),
      armR:arm(u,c,'R',{cuff:'#f4ecd8',cuffW:19,pose:'fist',held:ITEM.sceptre(u)}),
      beard:`<path fill-rule="evenodd" d="M86,112 C84,142 96,168 120,186 C144,168 156,142 154,112 C150,122 142,126 134,124 C128,122 124,121 120,121 C116,121 112,122 106,124 C98,126 90,122 86,112Z M108,131 Q120,127 132,131 Q120,143 108,131Z" fill="#f1efe9" stroke="#b9b4a8" stroke-width="1"/>
        <g fill="none" stroke="#b9b4a8" stroke-width="1" opacity=".8"><path d="M98,140 Q102,160 110,176"/><path d="M110,144 Q113,164 118,180"/><path d="M142,140 Q138,160 130,176"/><path d="M130,144 Q127,164 122,180"/></g>
        <path d="M103,123 C110,117 118,121 120,125 C122,121 130,117 137,123 C132,131 124,128 120,128 C116,128 108,131 103,123Z" fill="#f1efe9" stroke="#b9b4a8" stroke-width="1"/>`,
      hat:`<g><path d="M90,52 Q120,34 150,52 L148,62 L92,62Z" fill="#5a2a8a" stroke="#2e1250" stroke-width="1.2"/>
        <path d="M88,56 L152,56 L151,70 Q120,76 89,70Z" fill="${gold(u)}" stroke="#7a5416" stroke-width="1.4"/>
        <path d="M88,56 L90,30 L104,48 L112,22 L120,44 L128,22 L136,48 L150,30 L152,56Z" fill="${gold(u)}" stroke="#7a5416" stroke-width="1.4" stroke-linejoin="round"/>
        <circle cx="90" cy="29" r="3" fill="#fbe7a1" stroke="#7a5416"/><circle cx="112" cy="21" r="3" fill="#fbe7a1" stroke="#7a5416"/><circle cx="128" cy="21" r="3" fill="#fbe7a1" stroke="#7a5416"/><circle cx="150" cy="29" r="3" fill="#fbe7a1" stroke="#7a5416"/>
        <circle cx="120" cy="63" r="5.4" fill="#7a2f9a" stroke="#4b1f6f"/><circle cx="102" cy="63" r="3.6" fill="#a12522" stroke="#5a1210"/><circle cx="138" cy="63" r="3.6" fill="#2b8a55" stroke="#144a2c"/><path d="M92,59 L148,59" stroke="#fff" stroke-opacity=".45" stroke-width="1.2"/></g>`
    };},
    escriba(u,c){ return {
      hair:hair('bowl',['#7a5232','#4e3220']),
      back:'',
      body:longRobe(u,c,`<path d="M56,246 Q120,260 184,246 L184,256 Q120,270 56,256Z" fill="#d8c08a" stroke="#6b4a25" stroke-width="1"/><path d="M60,256 C56,290 60,310 56,330" fill="none" stroke="#d8c08a" stroke-width="3"/>
        <path d="M84,180 L156,296 L166,286 L98,176Z" fill="#4b3018" opacity=".9"/><g transform="translate(150,290)"><path d="M-2,-8 L28,-8 L30,26 L-4,26Z" fill="#6b4a25" stroke="#2c1a0c" stroke-width="1.4"/><path d="M-2,-2 Q13,6 30,-2" fill="none" stroke="#2c1a0c" stroke-width="1.2"/><circle cx="13" cy="6" r="2.4" fill="${gold(u)}"/></g>`),
      front:`<path d="M100,170 L120,206 L140,170 Q120,178 100,170Z" fill="#f3ead2" stroke="#b9a874" stroke-width="1"/><path d="M104,172 L120,198 L136,172" fill="none" stroke="#c9b98a" stroke-width="1"/>`,
      armL:arm(u,c,'L',{cuff:'#f3ead2',pose:'open',held:ITEM.ledger(u)}),
      armR:arm(u,c,'R',{cuff:'#f3ead2',pose:'fist',held:ITEM.quill(u)}),
      beard:'',mustache:'',
      hat:`<g fill="none" stroke="#5b4a2a" stroke-width="1.6"><circle cx="104" cy="100" r="11.5"/><circle cx="136" cy="100" r="11.5"/><path d="M115.5,99 Q120,96 124.5,99"/><path d="M92.5,98 L86,96 M147.5,98 L154,96"/></g><circle cx="104" cy="100" r="11.5" fill="#fff" opacity=".08"/><circle cx="136" cy="100" r="11.5" fill="#fff" opacity=".08"/>`
    };},
    consejero(u,c){ return {
      hair:hair('slick',['#26221f','#0f0d0c']),
      back:`<path d="M46,176 C36,240 36,330 42,394 L198,394 C204,330 204,240 194,176Z" fill="#12282c" stroke="#0a1719" stroke-width="1.4"/>`,
      body:longRobe(u,c,`<path d="M112,176 L108,392 L132,392 L128,176Z" fill="#12282c" opacity=".55"/><path d="M56,244 Q120,256 184,244 L184,254 Q120,266 56,254Z" fill="#12282c" stroke="#0a1719" stroke-width="1"/><rect x="110" y="244" width="20" height="16" rx="3" fill="#cfd7de" stroke="#6c757e" stroke-width="1.2"/>
        <path d="M60,196 L60,246 M180,196 L180,246" stroke="#cfd7de" stroke-width="1" opacity=".5"/>`),
      front:`<path d="M84,170 L92,150 L104,170 L104,180 Q120,190 136,180 L136,170 L148,150 L156,170 L162,196 Q120,180 78,196Z" fill="#1c3f45" stroke="#0a1719" stroke-width="1.4"/><path d="M84,170 L92,150 L104,170 M136,170 L148,150 L156,170" fill="none" stroke="#cfd7de" stroke-width="1.6"/>
        <path d="M84,196 Q120,262 156,196" fill="none" stroke="#cfd7de" stroke-width="3.2" stroke-dasharray="6 3"/><path d="M120,248 m-9,0 a9,9 0 1,0 18,0 a9,9 0 1,0 -18,0" fill="#cfd7de" stroke="#6c757e" stroke-width="1.4" transform="translate(0,-2)"/><circle cx="120" cy="246" r="4.2" fill="#3b727a"/>`,
      armL:arm(u,c,'L',{cuff:'#cfd7de',pose:'open',held:ITEM.scroll(u)}),
      armR:arm(u,c,'R',{cuff:'#cfd7de',pose:'point'}),
      beard:`<path d="M112,140 C112,152 116,160 120,168 C124,160 128,152 128,140 C124,143 122,144 120,144 C118,144 116,143 112,140Z" fill="#1c1917" stroke="#0f0d0c" stroke-width="1"/><path d="M103,124 C110,120 117,122 120,125 C123,122 130,120 137,124 C132,128 125,127 120,127 C115,127 108,128 103,124Z" fill="#1c1917"/>`,
      hat:''
    };},
    bufon(u,c){ return {
      hair:hair('none',['#000','#000']),
      back:'',
      lower:`<path d="M78,296 L118,296 L112,388 L72,388Z" fill="#e5b62a" stroke="#6a4f0c" stroke-width="1.2"/><path d="M122,296 L162,296 L168,388 L128,388Z" fill="#1e8a8a" stroke="#0d4a4a" stroke-width="1.2"/>
        <g fill="#000" opacity=".16"><path d="M78,318 L118,318 L116,338 L76,338Z M122,340 L164,340 L166,360 L124,360Z"/></g>
        <path d="M72,388 Q54,386 44,398 Q62,398 76,394Z" fill="#c1272d" stroke="#5a1210" stroke-width="1.2"/><path d="M168,388 Q186,386 196,398 Q178,398 164,394Z" fill="#c1272d" stroke="#5a1210" stroke-width="1.2"/><circle cx="44" cy="398" r="3.4" fill="${gold(u)}"/><circle cx="196" cy="398" r="3.4" fill="${gold(u)}"/>`,
      body:`<path d="M120,168 C96,168 74,172 62,184 C54,192 52,214 52,250 L50,312 L64,304 L76,316 L88,304 L100,316 L112,304 L120,316 L128,304 L140,316 L152,304 L164,316 L176,304 L190,312 L188,250 C188,214 186,192 178,184 C166,172 144,168 120,168Z" fill="#d13a35" stroke="#5a1210" stroke-width="1.5"/>
        <path d="M120,168 L120,316 L128,304 L140,316 L152,304 L164,316 L176,304 L190,312 L188,250 C188,214 186,192 178,184 C166,172 144,168 120,168Z" fill="#2f9a6a"/>
        <g opacity=".5" fill="#fff"><path d="M84,230 l10,14 l-10,14 l-10,-14z M156,230 l10,14 l-10,14 l-10,-14z M84,270 l10,14 l-10,14 l-10,-14z M156,270 l10,14 l-10,14 l-10,-14z"/></g>
        <path d="M52,262 Q120,278 188,262 L188,274 Q120,290 52,274Z" fill="#3a2410" stroke="#1d1208" stroke-width="1"/><circle cx="120" cy="272" r="7" fill="${gold(u)}" stroke="#7a5416"/>
        <path d="M150,180 C176,190 186,220 188,250 L190,312 L150,316Z" fill="#000" opacity=".14"/>`,
      front:`<path d="M76,180 Q120,214 164,180 L172,192 L158,200 L166,214 L146,210 L120,224 L94,210 L74,214 L82,200 L68,192Z" fill="#f3ead2" stroke="#8a7a55" stroke-width="1.2"/><g fill="#e5b62a" stroke="#6a4f0c" stroke-width=".8"><path d="M68,192 L58,206 L76,204Z M172,192 L182,206 L164,204Z M74,214 L68,230 L86,220Z M166,214 L172,230 L154,220Z"/></g><circle cx="58" cy="207" r="3.6" fill="${gold(u)}"/><circle cx="182" cy="207" r="3.6" fill="${gold(u)}"/>`,
      armL:arm(u,c,'L',{sleeve:'#d13a35',sleeveD:'#5a1210',cuff:'#f3ead2',cuffW:14,pose:'open'}),
      armR:arm(u,c,'R',{sleeve:'#2f9a6a',sleeveD:'#124a30',cuff:'#f3ead2',cuffW:14,pose:'fist',held:ITEM.marotte(u)}),
      beard:'',
      hat:`<g><path d="M90,72 C84,52 70,44 56,54 C66,58 70,68 74,78Z" fill="#c1272d" stroke="#5a1210" stroke-width="1.3"/><path d="M104,62 C104,42 114,28 120,16 C126,28 136,42 136,62Z" fill="#e5b62a" stroke="#6a4f0c" stroke-width="1.3"/><path d="M150,72 C156,52 170,44 184,54 C174,58 170,68 166,78Z" fill="#1e8a8a" stroke="#0d4a4a" stroke-width="1.3"/>
        <path d="M88,66 Q120,56 152,66 L154,80 Q120,70 86,80Z" fill="#c1272d" stroke="#5a1210" stroke-width="1.3"/><path d="M87,72 Q120,62 153,72" fill="none" stroke="#e5b62a" stroke-width="2.6" stroke-dasharray="5 4"/>
        <circle cx="56" cy="55" r="5.4" fill="${gold(u)}" stroke="#7a5416"/><circle cx="120" cy="15" r="5.4" fill="${gold(u)}" stroke="#7a5416"/><circle cx="184" cy="55" r="5.4" fill="${gold(u)}" stroke="#7a5416"/></g>`
    };},
    caballero(u,c){ return {
      hair:hair('short',['#3a271a','#1e130b']),
      back:`<path d="M58,182 C36,250 36,330 44,394 L196,394 C204,330 204,250 182,182Z" fill="#7a1f1a" stroke="#3d0f0c" stroke-width="1.4"/>`,
      lower:`<path d="M84,336 L116,336 L114,388 L82,388Z" fill="url(#${u}steel)" stroke="#39424c" stroke-width="1.2"/><path d="M124,336 L156,336 L158,388 L126,388Z" fill="url(#${u}steel)" stroke="#39424c" stroke-width="1.2"/><path d="M78,388 L118,388 L120,398 L74,398Z M122,388 L162,388 L166,398 L120,398Z" fill="#3a2a1e" stroke="#1e140c" stroke-width="1.2"/>`,
      body:`<path d="M120,168 C96,168 74,172 62,184 C54,192 54,210 56,232 L62,340 L178,340 L184,232 C186,210 186,192 178,184 C166,172 144,168 120,168Z" fill="url(#${u}steel)" stroke="#39424c" stroke-width="1.6"/>
        <path d="M84,196 Q120,214 156,196 M88,226 Q120,242 152,226" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2"/><path d="M120,200 L120,246" stroke="#4a5461" stroke-width="1.4" opacity=".6"/>
        <path d="M150,180 C176,190 184,220 184,250 L178,340 L150,340Z" fill="#000" opacity=".2"/>
        <path d="M64,238 L176,238 L182,262 L58,262Z" fill="#5a4636" stroke="#2a1c12" stroke-width="1.2"/><rect x="108" y="240" width="24" height="20" rx="3" fill="${gold(u)}" stroke="#7a5416" stroke-width="1.2"/>
        <path d="M84,262 L156,262 L164,346 L76,346Z" fill="#a52a24" stroke="#4a100c" stroke-width="1.4"/><path d="M84,262 L96,346 M156,262 L144,346" stroke="#000" stroke-opacity=".2" stroke-width="2"/>
        <g transform="translate(120,300)"><rect x="-4" y="-22" width="8" height="46" fill="${gold(u)}" stroke="#7a5416" stroke-width="1"/><rect x="-16" y="-10" width="32" height="8" fill="${gold(u)}" stroke="#7a5416" stroke-width="1"/></g>
        <path d="M76,346 L164,346 L160,356 L80,356Z" fill="${gold(u)}" opacity=".85"/>`,
      front:`<path d="M92,166 L104,178 Q120,188 136,178 L148,166 L156,180 Q120,200 84,180Z" fill="url(#${u}steel)" stroke="#39424c" stroke-width="1.4"/>`,
      defs:lin(u+'steel',[[0,'#e6ecf3'],[.45,'#a5b0be'],[1,'#56616f']]),
      armL:arm(u,c,'L',{glove:'#7a8593',cuff:'#5a4636',cuffW:15,pose:'fist',pauldron:`<ellipse cx="64" cy="190" rx="26" ry="17" fill="url(#${u}steel)" stroke="#39424c" stroke-width="1.4"/><path d="M42,192 Q64,204 86,192" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.6"/>`}),
      armR:arm(u,c,'R',{glove:'#7a8593',cuff:'#5a4636',cuffW:15,pose:'fist',held:ITEM.sword(u),pauldron:`<ellipse cx="176" cy="190" rx="26" ry="17" fill="url(#${u}steel)" stroke="#39424c" stroke-width="1.4"/><path d="M154,192 Q176,204 198,192" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.6"/>`}),
      beard:`<path d="M92,116 C94,136 104,146 120,148 C136,146 146,136 148,116 C146,124 142,126 136,126 C130,124 110,124 104,126 C98,126 94,124 92,116Z" fill="#3a271a" opacity=".32"/>`,
      hat:`<path d="M96,80 L104,92" stroke="#b5544a" stroke-width="2" stroke-linecap="round" opacity=".85"/><path d="M97,86 L101,80" stroke="#e8c8b0" stroke-width="1.2" opacity=".7"/>`
    };},
    maestro(u,c){ return {
      hair:hair('elder',['#f3f1ec','#c9c5bb']),
      back:`<path d="M52,178 C30,240 30,330 38,394 L202,394 C210,330 210,240 188,178Z" fill="#243a58" stroke="#16263a" stroke-width="1.4"/>`,
      body:longRobe(u,c,`<path d="M56,246 Q120,258 184,246 L184,254 Q120,266 56,254Z" fill="#d8b458" stroke="#7a5f1e" stroke-width="1"/><path d="M120,254 C118,290 114,320 112,346" fill="none" stroke="#d8b458" stroke-width="3"/><circle cx="112" cy="348" r="4" fill="#d8b458"/>`),
      front:`<path d="M62,186 Q120,160 178,186 L182,214 Q120,196 58,214Z" fill="#efe6cf" stroke="#a8996f" stroke-width="1.2"/><path d="M62,186 Q120,160 178,186" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/>`,
      armL:arm(u,c,'L',{cuff:'#efe6cf',pose:'open',held:ITEM.book(u)}),
      armR:arm(u,c,'R',{cuff:'#efe6cf',pose:'point'}),
      beard:`<path fill-rule="evenodd" d="M85,110 C82,144 98,176 120,200 C142,176 158,144 155,110 C150,122 142,126 134,124 C128,122 124,121 120,121 C116,121 112,122 106,124 C98,126 90,122 85,110Z M108,131 Q120,127 132,131 Q120,143 108,131Z" fill="#f6f4ef" stroke="#c3beb2" stroke-width="1"/>
        <g fill="none" stroke="#c3beb2" stroke-width="1" opacity=".85"><path d="M96,140 Q100,168 110,190"/><path d="M112,146 Q114,172 118,196"/><path d="M144,140 Q140,168 130,190"/><path d="M128,146 Q126,172 122,196"/></g>
        <path d="M102,124 C110,118 118,122 120,126 C122,122 130,118 138,124 C132,132 124,128 120,128 C116,128 108,132 102,124Z" fill="#f6f4ef" stroke="#c3beb2" stroke-width="1"/>`,
      hat:`<g><path d="M90,62 C90,44 104,36 122,36 C142,36 154,46 152,64 Q122,56 90,62Z" fill="#2c4a78" stroke="#16263a" stroke-width="1.3"/><path d="M90,62 Q122,54 152,64 L151,72 Q122,64 91,71Z" fill="#1d3358" stroke="#16263a" stroke-width="1"/><path d="M150,50 Q160,54 158,70" fill="none" stroke="${gold(u)}" stroke-width="2.4"/><circle cx="158" cy="72" r="3.6" fill="${gold(u)}"/></g>`
    };},
    aprendiz(u,c){ return {
      hair:hair('messy',['#6a4630','#3e2718']),
      back:`<path d="M60,176 C46,220 46,300 54,346 L186,346 C194,300 194,220 180,176Z" fill="#3f7a4a" stroke="#1e3f26" stroke-width="1.4"/>`,
      body:longRobe(u,c,`<path d="M56,246 Q120,258 184,246 L184,256 Q120,268 56,256Z" fill="#5c4a30" stroke="#33281a" stroke-width="1"/><rect x="110" y="246" width="20" height="14" rx="3" fill="${gold(u)}" stroke="#7a5416"/>`).replace(hem(u,c),''),
      front:`<path d="M62,182 Q120,158 178,182 L186,222 Q166,238 150,224 Q120,240 90,224 Q74,238 54,222Z" fill="#4c9058" stroke="#1e3f26" stroke-width="1.3"/><path d="M92,178 Q120,196 148,178" fill="none" stroke="#2a5634" stroke-width="2"/><path d="M84,172 L156,300 L164,292 L96,170Z" fill="#6b4a25" opacity=".95"/>`,
      armL:arm(u,c,'L',{sleeve:'#4c9058',sleeveD:'#1e3f26',cuff:'#efe2c2',pose:'open'}),
      armR:arm(u,c,'R',{sleeve:'#4c9058',sleeveD:'#1e3f26',cuff:'#efe2c2',pose:'open'}),
      beard:`<g fill="#b9764c" opacity=".55"><circle cx="98" cy="111" r="1.1"/><circle cx="103" cy="114" r="1"/><circle cx="108" cy="111" r="1"/><circle cx="132" cy="111" r="1"/><circle cx="137" cy="114" r="1.1"/><circle cx="142" cy="111" r="1"/></g>`,
      hat:''
    };}
  };
  const HAIR_C={rey:['#f2f0ea','#c3beb2']};

  /* ── ensamblado ── */
  function build(id,opts){
    opts=opts||{};
    const c=SPEC[id]; if(!c||!BUILD[id]) return '';
    const u='ch'+(++counter)+'_', p=BUILD[id](u,c);
    const vb=opts.portrait?'44 28 152 150':'0 0 240 404';
    const dl=(counter%7)*.6;
    const defs=`<defs>
      ${lin(u+'sk',[[0,c.skin[0]],[.55,c.skin[1]],[1,c.skin[2]]])}
      ${lin(u+'rb',[[0,c.robe[0]],[.45,c.robe[1]],[1,c.robe[2]]])}
      ${lin(u+'gold',[[0,'#fbe7a1'],[.5,'#d9a941'],[1,'#8f6420']],1)}
      ${p.defs||''}
      <radialGradient id="${u}face" cx=".38" cy=".32" r=".85"><stop offset="0" stop-color="${c.skin[0]}"/><stop offset=".6" stop-color="${c.skin[1]}"/><stop offset="1" stop-color="${c.skin[2]}"/></radialGradient>
      ${lin(u+'fx',[[0,'#000',0],[1,'#000',.28]])}
    </defs>`;
    const faceShape=`M120,58 C144,58 156,78 156,100 C156,124 144,146 120,150 C96,146 84,124 84,100 C84,78 96,58 120,58Z`;
    const head=`<g class="head" data-head style="animation-delay:-${dl}s">
      ${p.hair.back}
      <ellipse cx="84" cy="104" rx="6.5" ry="10.5" fill="url(#${u}sk)" stroke="${OL}" stroke-width="1.1"/><ellipse cx="156" cy="104" rx="6.5" ry="10.5" fill="url(#${u}sk)" stroke="${OL}" stroke-width="1.1"/>
      <path d="${faceShape}" fill="url(#${u}face)" stroke="${OL}" stroke-width="1.3"/>
      <path d="${faceShape}" fill="url(#${u}fx)"/>
      ${ageLines(c.age,c.skin)}
      <g class="face-dyn" data-face></g>
      <path d="M120,96 Q116,110 113,116 Q120,121 127,116" fill="none" stroke="${c.skin[2]}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M121.5,98 Q124,108 125,114" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.6" stroke-linecap="round"/>
      ${p.beard||''}${p.hair.front}${p.hat||''}
    </g>`;
    const inner=`
      <ellipse class="shadow" cx="120" cy="396" rx="88" ry="9" fill="#000" opacity=".38"/>
      <g class="rig" style="animation-delay:-${dl}s">
        ${p.back||''}${p.lower||''}
        <g class="torso">${p.body}${neck(u,c)}${p.front||''}</g>
        ${p.armL}${p.armR}
        ${head}
      </g>`;
    return `<svg class="char-svg" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">${defs}${inner}</svg>`;
  }
  function setMood(root,id,mood){
    const c=SPEC[id]; if(!c) return;
    const m=MOODS[mood]?mood:'neutral';
    root.dataset.mood=m;
    root.querySelectorAll('[data-face]').forEach(g=>{ g.innerHTML=face(c,'',m,id); });
  }
  return {build,setMood,SPEC,MOODS};
})();
