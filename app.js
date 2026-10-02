/* ═══════════════════════════════════════════════════════════════════
   REINO DE ALDEMAR — motor de la aplicación
   Módulos: Utils · Store · Settings · Sound · Music · Voice · FX · Cast
            Dialogue · Grade · GameState · Chronicle · Modals · UI · App
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ── Utils ── */
const $=id=>document.getElementById(id);
const $$=(sel,root)=>Array.from((root||document).querySelectorAll(sel));
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const fmt=n=>(Number.isFinite(n)?n:0).toFixed(2);
const rnd=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const CANCEL=Symbol('cancel');            /* centinela para escenas interrumpidas */
function el(tag,cls,text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }

/* ── Store: localStorage tolerante a datos corruptos o no disponibles ── */
const Store=(function(){
  let warned=false;
  function read(key){
    let raw=null;
    try{ raw=localStorage.getItem(key); }catch(e){ return null; }
    if(raw==null) return null;
    try{ return JSON.parse(raw); }catch(e){ return null; }   /* JSON corrupto → valores por defecto */
  }
  function write(key,val){
    try{ localStorage.setItem(key,JSON.stringify(val)); return true; }
    catch(e){ if(!warned){ warned=true; UI.toast('No se pudo guardar en este navegador. Tu progreso durará solo esta sesión.','warn'); } return false; }
  }
  function remove(key){ try{ localStorage.removeItem(key); }catch(e){ /* almacenamiento no disponible */ } }
  return {read,write,remove};
})();

/* ── Settings: validadas, con valores seguros y suscripción ── */
const Settings=(function(){
  const KEY='aldemar_settings_v2', OLD='aldemar_settings_v1';
  const osReduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEF={musicOn:false,musicVol:55,sfxOn:true,sfxVol:70,masterMute:false,voiceOn:false,voiceVol:85,voiceRate:95,
    anim:osReduce?'reduced':'full',visual:'sunset',textSize:'normal',autoMood:true,scenario:'trono'};
  const RULES={musicOn:'b',sfxOn:'b',masterMute:'b',voiceOn:'b',autoMood:'b',
    musicVol:[0,100],sfxVol:[0,100],voiceVol:[0,100],voiceRate:[60,140],
    anim:['full','reduced','off'],visual:['day','sunset','night','torch'],textSize:['normal','large'],
    scenario:['trono','castillo','biblioteca','patio','taberna','entrenamiento','aldea','bosque']};
  function clean(src){
    const out=Object.assign({},DEF);
    if(!src||typeof src!=='object'||Array.isArray(src)) return out;
    Object.keys(RULES).forEach(k=>{
      const v=src[k], r=RULES[k];
      if(r==='b'){ if(typeof v==='boolean') out[k]=v; }
      else if(typeof r[0]==='number'){ if(typeof v==='number'&&Number.isFinite(v)) out[k]=Math.round(clamp(v,r[0],r[1])); }
      else if(r.indexOf(v)>=0) out[k]=v;
    });
    return out;
  }
  let s=clean(Store.read(KEY)||Store.read(OLD));
  const listeners=new Set();
  const SCENE_LABEL={trono:'Salón del Trono',castillo:'Gran Salón del Castillo',biblioteca:'Biblioteca Real',patio:'Patio del Castillo',taberna:'La Taberna del Jabalí',entrenamiento:'Sala de Entrenamiento',aldea:'Aldea Medieval',bosque:'El Bosque Lindero'};
  function apply(){
    const h=document.documentElement;
    h.dataset.anim=s.anim; h.dataset.visual=s.visual; h.dataset.text=s.textSize; h.dataset.scenario=s.scenario;
    const sc=document.getElementById('scene');
    if(sc){ sc.dataset.scene=s.scenario; sc.setAttribute('aria-label',SCENE_LABEL[s.scenario]||'Escenario'); }
  }
  function notify(){ listeners.forEach(fn=>fn(s)); }
  function get(k){ return s[k]; }
  function set(k,v){ if(!(k in RULES)) return; s=clean(Object.assign({},s,{[k]:v})); Store.write(KEY,s); apply(); notify(); }
  function reset(){ s=clean(null); Store.write(KEY,s); apply(); notify(); }
  function subscribe(fn){ listeners.add(fn); }
  apply();
  return {get,set,reset,subscribe,all:()=>s};
})();

/* ═══════════════ Sound: síntesis con Web Audio (sin archivos externos) ═══════════════ */
const Sound=(function(){
  let ctx=null,master=null,musicBus=null,sfxBus=null,verb=null,sfxSend=null,noiseBuf=null,ready=false,failed=false;
  const ksCache=new Map();

  function impulse(sec,decay){
    const sr=ctx.sampleRate,len=Math.floor(sr*sec),b=ctx.createBuffer(2,len,sr);
    for(let c=0;c<2;c++){ const d=b.getChannelData(c); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay); }
    return b;
  }
  function ensure(){
    if(failed) return false;
    if(!ready){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC){ failed=true; return false; }
      try{ ctx=new AC(); }catch(e){ failed=true; return false; }
      master=ctx.createGain(); master.connect(ctx.destination);
      musicBus=ctx.createGain(); musicBus.connect(master);
      sfxBus=ctx.createGain(); sfxBus.connect(master);
      verb=ctx.createConvolver(); verb.buffer=impulse(1.9,2.6);
      const vg=ctx.createGain(); vg.gain.value=.26; verb.connect(vg); vg.connect(master);
      sfxSend=ctx.createGain(); sfxSend.gain.value=.4; sfxSend.connect(verb);
      const n=ctx.sampleRate; noiseBuf=ctx.createBuffer(1,n,n);
      const d=noiseBuf.getChannelData(0); for(let i=0;i<n;i++) d[i]=Math.random()*2-1;
      ready=true; applyVolumes();
    }
    if(ctx.state==='suspended') ctx.resume().catch(()=>{ /* el navegador exige un gesto del usuario: se reintenta en el siguiente */ });
    return true;
  }
  function applyVolumes(){
    if(!ready) return; const t=ctx.currentTime;
    master.gain.setTargetAtTime(Settings.get('masterMute')?0:1,t,.03);
    musicBus.gain.setTargetAtTime(Settings.get('musicVol')/100*.9,t,.05);
    sfxBus.gain.setTargetAtTime(Settings.get('sfxOn')?Settings.get('sfxVol')/100:0,t,.03);
  }
  Settings.subscribe(applyVolumes);
  const mtof=m=>440*Math.pow(2,(m-69)/12);

  /* cuerda pulsada (Karplus-Strong precalculada y en caché): timbre de laúd/arpa */
  function ksBuffer(freq){
    const key=Math.round(freq*2);
    if(ksCache.has(key)) return ksCache.get(key);
    const sr=ctx.sampleRate,n=Math.floor(sr*2.2),N=Math.max(2,Math.round(sr/freq)),ring=new Float32Array(N);
    let last=0; for(let i=0;i<N;i++){ last=last*.55+(Math.random()*2-1)*.45; ring[i]=last; }
    const buf=ctx.createBuffer(1,n,sr),d=buf.getChannelData(0); let idx=0;
    for(let i=0;i<n;i++){ const nx=(idx+1)%N; d[i]=ring[idx]*2.2; ring[idx]=(ring[idx]+ring[nx])*.5*.9968; idx=nx; }
    if(ksCache.size>90) ksCache.delete(ksCache.keys().next().value);
    ksCache.set(key,buf); return buf;
  }
  function pluck(freq,t,dur,vol,out,send){
    if(!ready) return;
    const src=ctx.createBufferSource(); src.buffer=ksBuffer(freq);
    const g=ctx.createGain(); g.gain.setValueAtTime(vol,t); g.gain.setTargetAtTime(0,t+Math.max(.06,dur*.6),Math.max(.06,dur*.2));
    src.connect(g); g.connect(out); if(send) g.connect(send);
    src.start(t); src.stop(t+dur+1.1);
  }
  function flute(freq,t,dur,vol,out,send){
    if(!ready) return;
    const o=ctx.createOscillator(),o2=ctx.createOscillator(),g=ctx.createGain(),g2=ctx.createGain(),lfo=ctx.createOscillator(),lg=ctx.createGain();
    o.type='sine'; o.frequency.value=freq; o2.type='triangle'; o2.frequency.value=freq*2; g2.gain.value=.1;
    lfo.frequency.value=5.1; lg.gain.setValueAtTime(0,t); lg.gain.linearRampToValueAtTime(freq*.006,t+dur*.5); lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.09); g.gain.setValueAtTime(vol*.85,t+dur*.7); g.gain.linearRampToValueAtTime(0,t+dur);
    const nz=ctx.createBufferSource(); nz.buffer=noiseBuf; nz.loop=true;
    const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=freq*2.2; bp.Q.value=4;
    const ng=ctx.createGain(); ng.gain.setValueAtTime(0,t); ng.gain.linearRampToValueAtTime(vol*.16,t+.06); ng.gain.linearRampToValueAtTime(0,t+dur);
    o.connect(g); o2.connect(g2); g2.connect(g); nz.connect(bp); bp.connect(ng); ng.connect(g);
    g.connect(out); if(send) g.connect(send);
    lfo.start(t); o.start(t); o2.start(t); nz.start(t);
    const end=t+dur+.05; lfo.stop(end); o.stop(end); o2.stop(end); nz.stop(end);
  }
  function bell(freq,t,dur,vol,out,send){
    if(!ready) return;
    [1,2.4,3.8].forEach((m,i)=>{
      const o=ctx.createOscillator(),g=ctx.createGain(); o.type='sine'; o.frequency.value=freq*m;
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol/(i+1.3),t+.012); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
      o.connect(g); g.connect(out); if(send) g.connect(send); o.start(t); o.stop(t+dur+.1);
    });
  }
  function drum(t,vol,out,pitch){
    if(!ready) return; pitch=pitch||120;
    const nz=ctx.createBufferSource(); nz.buffer=noiseBuf;
    const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=pitch*2; bp.Q.value=.8;
    const g=ctx.createGain(); g.gain.setValueAtTime(vol*.55,t); g.gain.exponentialRampToValueAtTime(.0001,t+.22);
    nz.connect(bp); bp.connect(g); g.connect(out); nz.start(t,Math.random()*.5,.3);
    const o=ctx.createOscillator(),og=ctx.createGain(); o.type='sine';
    o.frequency.setValueAtTime(pitch*1.5,t); o.frequency.exponentialRampToValueAtTime(pitch*.6,t+.16);
    og.gain.setValueAtTime(vol,t); og.gain.exponentialRampToValueAtTime(.0001,t+.3);
    o.connect(og); og.connect(out); o.start(t); o.stop(t+.34);
  }
  function pad(freq,t,dur,vol,out,send){
    if(!ready) return;
    const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=780;
    const g=ctx.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+dur*.35); g.gain.linearRampToValueAtTime(0,t+dur);
    [-6,6].forEach(c=>{ const o=ctx.createOscillator(); o.type='triangle'; o.frequency.value=freq; o.detune.value=c; o.connect(lp); o.start(t); o.stop(t+dur+.05); });
    lp.connect(g); g.connect(out); if(send) g.connect(send);
  }
  function brass(freq,t,dur,vol,out){
    if(!ready) return;
    const o=ctx.createOscillator(),lp=ctx.createBiquadFilter(),g=ctx.createGain(); o.type='sawtooth'; o.frequency.value=freq;
    lp.type='lowpass'; lp.frequency.setValueAtTime(500,t); lp.frequency.linearRampToValueAtTime(2200,t+.09); lp.frequency.linearRampToValueAtTime(900,t+dur);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.05); g.gain.setValueAtTime(vol*.8,t+dur*.7); g.gain.linearRampToValueAtTime(0,t+dur);
    o.connect(lp); lp.connect(g); g.connect(out); g.connect(sfxSend); o.start(t); o.stop(t+dur+.05);
  }
  function sweep(t,dur,vol,out,f0,f1){
    if(!ready) return;
    const nz=ctx.createBufferSource(); nz.buffer=noiseBuf; nz.loop=true;
    const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=1.1; bp.frequency.setValueAtTime(f0,t); bp.frequency.linearRampToValueAtTime(f1,t+dur);
    const g=ctx.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    nz.connect(bp); bp.connect(g); g.connect(out); nz.start(t); nz.stop(t+dur+.02);
  }

  /* efectos: solo suenan si el usuario los tiene activados; nunca lanzan errores */
  const BLIP={rey:150,bufon:420,caballero:190,escriba:260,consejero:210,maestro:230,aprendiz:330};
  function fx(fn){ return function(){ if(!Settings.get('sfxOn')||!ensure()) return; fn.apply(null,arguments); }; }
  const sfx={
    click:fx(()=>{ const t=ctx.currentTime; drum(t,.16,sfxBus,700); }),
    page:fx(()=>{ sweep(ctx.currentTime,.2,.14,sfxBus,3000,1400); }),
    parchment:fx(()=>{ sweep(ctx.currentTime,.4,.16,sfxBus,2600,600); }),
    bell:fx(()=>{ bell(880,ctx.currentTime,1.2,.2,sfxBus,sfxSend); }),
    seal:fx(()=>{ const t=ctx.currentTime; drum(t,.5,sfxBus,90); bell(320,t+.04,.5,.14,sfxBus,sfxSend); }),
    coin:fx(()=>{ bell(2300+Math.random()*800,ctx.currentTime,.5,.05,sfxBus,sfxSend); }),
    tick:fx(()=>{ pluck(1500,ctx.currentTime,.05,.03,sfxBus); }),
    blip:fx(who=>{ const base=BLIP[who]||220; pluck(base*(1+Math.random()*.25),ctx.currentTime,.05,.05,sfxBus); }),
    drumroll:fx(sec=>{ const t0=ctx.currentTime,n=Math.floor(sec/.09); for(let i=0;i<n;i++) drum(t0+i*.09,.1+i/n*.2,sfxBus,120+i*3); }),
    victory:fx(()=>{ const t0=ctx.currentTime; [[60,0],[64,.14],[67,.28],[72,.42]].forEach(([m,d])=>brass(mtof(m),t0+d,d===.42?.9:.3,.1,sfxBus)); bell(mtof(84),t0+.42,1.4,.12,sfxBus,sfxSend); }),
    defeat:fx(()=>{ const t0=ctx.currentTime; [57,55,52].forEach((m,i)=>pluck(mtof(m),t0+i*.24,.6,.18,sfxBus,sfxSend)); drum(t0+.6,.5,sfxBus,80); }),
    levelup:fx(()=>{ const t0=ctx.currentTime; [72,76,79,84].forEach((m,i)=>bell(mtof(m),t0+i*.11,.9,.13,sfxBus,sfxSend)); })
  };

  return {ensure,get ready(){return ready;},get failed(){return failed;},get ctx(){return ctx;},get musicBus(){return musicBus;},get verb(){return verb;},
    pluck,flute,bell,drum,pad,mtof,sfx,supported:()=>!failed&&!!(window.AudioContext||window.webkitAudioContext)};
})();

/* ═══════════════ Music: pistas ambientales generadas, con parada limpia ═══════════════ */
const Music=(function(){
  const STEP=.3, LOOP=32;
  const MEL_A=[[0,0,2],[2,2,1],[3,4,1],[4,5,2],[6,7,2],[8,9,1],[9,7,1],[10,5,2],[12,4,2],[14,2,1],[15,0,1],[16,0,2],[18,4,2],[20,5,1],[21,7,1],[22,9,2],[24,11,2],[26,9,1],[27,7,1],[28,5,2],[30,2,2]];
  const MEL_B=[[0,7,3],[3,5,1],[4,4,2],[6,2,2],[8,0,3],[11,2,1],[12,4,2],[14,5,2],[16,7,2],[18,9,1],[19,7,1],[20,5,2],[22,4,2],[24,2,3],[27,4,1],[28,2,2],[30,0,2]];
  const BASS=[[0,-12],[8,-5],[16,-12],[24,-7]];
  const INNER=[[2,-5],[6,-5],[10,-5],[14,-5],[18,-8],[22,-8],[26,-5],[30,-5]];
  const MINOR={4:3,9:8,11:10};
  const tone=(semi,minor)=>{ if(!minor) return semi; const pc=((semi%12)+12)%12; return MINOR[pc]!==undefined?Math.floor(semi/12)*12+MINOR[pc]:semi; };
  const TRACKS=[
    {id:'castillo',name:'Castillo Real',cat:'castillo',root:60,tempo:1.00,minor:false,mel:MEL_A,lute:true,flute:true,bell:true,drum:false,pad:true,vol:.9},
    {id:'taberna',name:'Taberna del Reino',cat:'taberna',root:62,tempo:.62,minor:false,mel:MEL_B,lute:true,flute:false,bell:false,drum:true,pad:false,vol:1},
    {id:'batalla',name:'Redobles de Batalla',cat:'batalla',root:57,tempo:.5,minor:true,mel:MEL_A,lute:true,flute:false,bell:false,drum:true,pad:false,vol:1},
    {id:'epica',name:'Gesta Épica',cat:'batalla',root:60,tempo:.72,minor:false,mel:MEL_A,lute:true,flute:true,bell:true,drum:true,pad:true,vol:1},
    {id:'misterio',name:'Corredores del Misterio',cat:'misterio',root:55,tempo:1.7,minor:true,mel:MEL_A,lute:true,flute:false,bell:false,drum:false,pad:true,vol:.7},
    {id:'tension',name:'El Rey Delibera',cat:'misterio',root:52,tempo:2.1,minor:true,mel:MEL_B,lute:false,flute:false,bell:false,drum:true,pad:true,vol:.55},
    {id:'viaje',name:'Camino del Peregrino',cat:'viaje',root:59,tempo:.85,minor:false,mel:MEL_A,lute:true,flute:true,bell:false,drum:false,pad:true,vol:.85},
    {id:'estudio',name:'Sala de Estudio',cat:'relajacion',root:57,tempo:1.35,minor:false,mel:MEL_B,lute:false,flute:true,bell:false,drum:false,pad:true,vol:.75},
    {id:'ceremonia',name:'Ceremonia de Coronación',cat:'ceremonia',root:60,tempo:.9,minor:false,mel:MEL_A,lute:false,flute:true,bell:true,drum:false,pad:true,vol:.85},
    {id:'victoria',name:'Fanfarria de Victoria',cat:'ceremonia',root:64,tempo:.55,minor:false,mel:MEL_B,lute:false,flute:true,bell:true,drum:true,pad:false,vol:1},
    {id:'celebracion',name:'Celebración Real',cat:'ceremonia',root:60,tempo:.6,minor:false,mel:MEL_B,lute:true,flute:true,bell:true,drum:true,pad:true,vol:1},
    {id:'bosque',name:'Sendero del Bosque Antiguo',cat:'bosque',root:64,tempo:1.15,minor:true,mel:MEL_B,lute:false,flute:true,bell:true,drum:false,pad:true,vol:.75}
  ];
  const CATS=[
    {id:'castillo',name:'Castillo',ico:'i-castle'},
    {id:'taberna',name:'Taberna',ico:'i-mug'},
    {id:'batalla',name:'Batalla',ico:'i-sword'},
    {id:'misterio',name:'Misterio',ico:'i-mask'},
    {id:'viaje',name:'Viaje',ico:'i-compass'},
    {id:'relajacion',name:'Relajación',ico:'i-moon'},
    {id:'ceremonia',name:'Ceremonia Real',ico:'i-crown'},
    {id:'bosque',name:'Bosque Medieval',ico:'i-tree'}
  ];
  let idx=0,playing=false,bus=null,timer=0,loopStart=0,loopDur=1,raf=0,panelOpen=false,autoArmed=false,listOpen=true;

  function scheduleLoop(){
    if(!playing||!bus||!Sound.ready) return;
    const S=Sound,cfg=TRACKS[idx],step=STEP*cfg.tempo,t0=S.ctx.currentTime+.06,v=cfg.vol*.55;
    loopStart=t0; loopDur=step*LOOP;
    const out=bus.out,send=bus.send;
    if(cfg.lute) cfg.mel.forEach(([p,s,l])=>S.pluck(S.mtof(cfg.root+tone(s,cfg.minor)+12),t0+p*step,Math.max(.25,l*step*.9),v*.5,out,send));
    if(cfg.flute) cfg.mel.forEach(([p,s,l],i)=>{ if(i%2===0) S.flute(S.mtof(cfg.root+tone(s,cfg.minor)+(cfg.id==='estudio'?0:12)),t0+p*step,l*step*1.5,v*.32,out,send); });
    BASS.forEach(([p,s])=>S.pluck(S.mtof(cfg.root+tone(s,cfg.minor)),t0+p*step,step*3.4,v*.65,out,send));
    if(cfg.pad) BASS.forEach(([p,s])=>{ S.pad(S.mtof(cfg.root+tone(s,cfg.minor)+12),t0+p*step,step*8,v*.16,out,send); });
    if(cfg.bell) INNER.forEach(([p,s])=>S.bell(S.mtof(cfg.root+tone(s,cfg.minor)+24),t0+p*step,step*2,v*.2,out,send));
    if(cfg.drum) [0,8,16,24].forEach(p=>S.drum(t0+p*step,v*.5,out,cfg.minor?95:120));
    timer=setTimeout(scheduleLoop,Math.max(200,loopDur*1000-60));
  }
  function openBus(){
    const S=Sound,t=S.ctx.currentTime;
    const out=S.ctx.createGain(),send=S.ctx.createGain();
    out.gain.setValueAtTime(0,t); out.gain.linearRampToValueAtTime(1,t+.5); send.gain.value=.5;
    out.connect(S.musicBus); send.connect(S.verb); bus={out,send};
  }
  function closeBus(){
    clearTimeout(timer); timer=0;
    if(!bus||!Sound.ready){ bus=null; return; }
    const b=bus,t=Sound.ctx.currentTime; bus=null;
    b.out.gain.cancelScheduledValues(t); b.out.gain.setTargetAtTime(0,t,.12); b.send.gain.setTargetAtTime(0,t,.12);
    setTimeout(()=>{ b.out.disconnect(); b.send.disconnect(); },1200);   /* silencia también las notas ya programadas */
  }
  function restartIfPlaying(){ if(playing){ closeBus(); openBus(); scheduleLoop(); } }

  function status(){
    if(!Sound.supported()) return 'Audio no disponible en este navegador';
    if(playing) return Sound.ready&&Sound.ctx.state!=='running'?'Toca la pantalla para activar el sonido':'Reproduciendo';
    if(Settings.get('musicOn')&&autoArmed) return 'Se reanudará al tocar la pantalla';
    return 'En pausa';
  }
  function updateUI(){
    const cfg=TRACKS[idx];
    $('mpTrack').textContent=cfg.name; $('mpStatus').textContent=status();
    const btn=$('mpPlay'); btn.setAttribute('aria-label',playing?'Pausar':'Reproducir');
    btn.querySelector('use').setAttribute('href',playing?'#i-pause':'#i-play');
    const on=playing&&!(Sound.ready&&Sound.ctx.state!=='running');
    document.body.classList.toggle('music-on',on);
    $('musicBtn').setAttribute('aria-label',on?'Reproductor de música (sonando)':'Reproductor de música');
    const unsupported=!Sound.supported();
    ['mpPlay','mpPrev','mpNext'].forEach(id=>{ $(id).disabled=unsupported; });
    markCurrent();
  }
  function tick(){
    raf=0; if(!playing||!panelOpen||!Sound.ready) return;
    const p=clamp((Sound.ctx.currentTime-loopStart)/loopDur,0,1);
    $('mpFill').style.width=(p*100).toFixed(1)+'%';
    raf=requestAnimationFrame(tick);
  }
  function kick(){ if(!raf&&playing&&panelOpen) raf=requestAnimationFrame(tick); }

  function play(){
    if(playing) return true;
    if(!Sound.ensure()){ Settings.set('musicOn',false); updateUI(); UI.toast('Este navegador no permite reproducir música.','warn'); return false; }
    playing=true; autoArmed=false; Settings.set('musicOn',true);
    openBus(); scheduleLoop(); updateUI(); kick();
    return true;
  }
  function pause(){ playing=false; autoArmed=false; Settings.set('musicOn',false); closeBus(); $('mpFill').style.width='0%'; updateUI(); }
  function toggle(){ playing?pause():play(); }
  function go(delta){ idx=(idx+delta+TRACKS.length)%TRACKS.length; restartIfPlaying(); updateUI(); }
  function select(i){ if(i<0||i>=TRACKS.length||i===idx) return; idx=i; restartIfPlaying(); updateUI(); if(!playing) play(); }
  function buildList(){
    const box=$('mpTracks'); if(!box) return; box.innerHTML='';
    CATS.forEach(cat=>{
      const items=TRACKS.map((t,i)=>({t,i})).filter(x=>x.t.cat===cat.id);
      if(!items.length) return;
      const h=el('div','mp-cat');
      h.innerHTML='<svg class="ico" aria-hidden="true"><use href="#'+cat.ico+'"/></svg><span>'+cat.name+'</span>';
      box.appendChild(h);
      items.forEach(({t,i})=>{
        const b=document.createElement('button');
        b.type='button'; b.className='mp-track-btn'; b.setAttribute('role','listitem'); b.dataset.idx=i;
        b.innerHTML='<i class="dot" aria-hidden="true"></i><span>'+t.name+'</span>';
        b.addEventListener('click',()=>select(i));
        box.appendChild(b);
      });
    });
    markCurrent();
  }
  function markCurrent(){ $$('#mpTracks .mp-track-btn').forEach(b=>b.setAttribute('aria-current',String(Number(b.dataset.idx)===idx))); }
  function toggleList(){
    listOpen=!listOpen; $('mpTracks').hidden=!listOpen;
    $('mpListToggle').setAttribute('aria-expanded',String(listOpen));
  }
  function setMood(id){
    if(!Settings.get('autoMood')) return;
    const i=TRACKS.findIndex(t=>t.id===id); if(i<0||i===idx) return;
    idx=i; restartIfPlaying(); updateUI();
  }
  function setPanelOpen(v){ panelOpen=v; kick(); }
  /* si la música estaba activada, arranca en el primer gesto (los navegadores bloquean el autoplay) */
  function armAutostart(){
    if(!Settings.get('musicOn')||playing||!Sound.supported()) return;
    autoArmed=true;
    const start=()=>{ removeEventListener('pointerdown',start,true); removeEventListener('keydown',start,true); if(autoArmed&&Settings.get('musicOn')) play(); };
    addEventListener('pointerdown',start,true); addEventListener('keydown',start,true);
  }
  return {play,pause,toggle,next:()=>go(1),prev:()=>go(-1),select,buildList,toggleList,setMood,updateUI,setPanelOpen,armAutostart,get playing(){return playing;}};
})();

/* ═══════════════ Voice: síntesis de voz opcional ═══════════════ */
const Voice=(function(){
  const supported='speechSynthesis' in window&&'SpeechSynthesisUtterance' in window;
  const PROFILES={rey:{pitch:.6,rate:.9},bufon:{pitch:1.5,rate:1.2},caballero:{pitch:.8,rate:.98},escriba:{pitch:1.05,rate:.92},consejero:{pitch:.75,rate:.88},maestro:{pitch:.85,rate:.95},narrador:{pitch:1,rate:1}};
  let voices=[],current=null;
  function load(){ voices=supported?(speechSynthesis.getVoices()||[]):[]; }
  if(supported){ load(); if(speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged',load); }
  function pickVoice(){
    return voices.find(v=>/^es[-_]/i.test(v.lang)&&/es[-_](es|mx|ar|us)/i.test(v.lang))||voices.find(v=>/^es/i.test(v.lang))||null;
  }
  function stop(){ if(supported) speechSynthesis.cancel(); current=null; }
  function speak(text,who,force){
    if(!supported||!text) return;
    if(!force&&(!Settings.get('voiceOn')||Settings.get('masterMute'))) return;
    stop();
    const p=PROFILES[who]||PROFILES.narrador,u=new SpeechSynthesisUtterance(text),v=pickVoice();
    if(v){ u.voice=v; u.lang=v.lang; } else u.lang='es-ES';
    u.pitch=p.pitch; u.rate=clamp(Settings.get('voiceRate')/100*p.rate,.5,2); u.volume=Settings.get('voiceVol')/100;
    u.onend=u.onerror=()=>{ if(current===u) current=null; };
    current=u; speechSynthesis.speak(u);
  }
  Settings.subscribe(()=>{ if(Settings.get('masterMute')||!Settings.get('voiceOn')) stop(); });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) stop(); });
  return {speak,stop,supported,busy:()=>!!current};
})();

/* ═══════════════ FX: partículas en canvas (con delta-time real y sin NaN) ═══════════════ */
const FX=(function(){
  const cv=$('fx'),g=cv.getContext('2d');
  let W=1,H=1,parts=[],raf=0,last=0;
  function fit(){
    const r=cv.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
    W=Math.max(1,r.width); H=Math.max(1,r.height);
    cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); g.setTransform(dpr,0,0,dpr,0,0);
  }
  if('ResizeObserver' in window) new ResizeObserver(fit).observe(cv); else addEventListener('resize',fit);
  fit();
  const level=()=>Settings.get('anim');
  function add(p){
    parts.push(Object.assign({x:0,y:0,vx:0,vy:0,g:0,drag:.01,rot:0,vr:0,life:1,max:1,size:3,delay:0,shape:'rect',ratio:1,color:'#fff'},p));
    if(!raf){ last=performance.now(); raf=requestAnimationFrame(frame); }
  }
  function frame(now){
    const dt=Math.min(.05,(now-last)/1000); last=now; g.clearRect(0,0,W,H);
    for(const p of parts){
      if(p.delay>0){ p.delay-=dt; continue; }
      const k=Math.pow(1-p.drag,dt*60);
      p.vy+=p.g*dt; p.vx*=k; p.vy*=k; p.x+=p.vx*dt; p.y+=p.vy*dt; p.rot+=p.vr*dt; p.life-=dt;
      if(p.life<=0) continue;
      g.save(); g.translate(p.x,p.y); g.rotate(p.rot); g.globalAlpha=clamp(p.life/p.max*1.6,0,1); g.fillStyle=p.color;
      if(p.shape==='circle'){ g.beginPath(); g.arc(0,0,p.size,0,Math.PI*2); g.fill(); }
      else g.fillRect(-p.size/2,-p.size/2,p.size,p.size*p.ratio);
      g.restore();
    }
    parts=parts.filter(p=>p.life>0);
    if(parts.length) raf=requestAnimationFrame(frame); else{ raf=0; g.clearRect(0,0,W,H); }
  }
  const GOLD=['#fbe7a1','#e2b653','#c99a3c','#fff6d6'];
  const FEAST=['#fbe7a1','#e2b653','#a12522','#2f6b3a','#f4e8c9','#8a53c9'];
  const amount=n=>level()==='reduced'?Math.ceil(n*.35):n;
  const on=()=>level()!=='off';
  function confetti(x,y,n,pal){ if(!on()) return; for(let i=0;i<amount(n);i++){ const a=rnd(0,Math.PI*2),sp=rnd(160,420);
    add({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-280,g:560,drag:.012,rot:rnd(0,7),vr:rnd(-7,7),life:rnd(1.2,2.1),max:2.1,size:rnd(5,9),ratio:rnd(.4,1),color:pick(pal)}); } }
  function spark(x,y,n,pal){ if(!on()) return; for(let i=0;i<amount(n);i++){ const a=rnd(0,Math.PI*2),sp=rnd(90,320);
    add({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,g:160,drag:.03,life:rnd(.7,1.3),max:1.3,size:rnd(2,4),shape:'circle',color:pick(pal)}); } }
  function coinRain(n){ if(!on()) return; for(let i=0;i<amount(n);i++)
    add({x:rnd(0,W),y:-10,vx:rnd(-20,20),vy:rnd(80,160),g:280,drag:0,life:rnd(1.8,2.6),max:2.6,size:rnd(4,6),shape:'circle',color:pick(GOLD),delay:rnd(0,.6)}); }
  function ash(n){ if(!on()) return; for(let i=0;i<amount(n);i++)
    add({x:rnd(0,W),y:-10,vx:rnd(-12,12),vy:rnd(30,70),g:10,drag:.004,life:rnd(2.2,3.6),max:3.6,size:rnd(1.5,3),shape:'circle',color:'#7d7263',delay:rnd(0,.8)}); }
  function clear(){ parts=[]; if(raf){ cancelAnimationFrame(raf); raf=0; } g.clearRect(0,0,W,H); }
  return {confetti,spark,coinRain,ash,clear,GOLD,FEAST,size:()=>({W,H})};
})();

/* ═══════════════ Reparto: personajes en escena y retratos ═══════════════ */
const ROSTER={
  rey:{name:'Rey Aldemar',role:'Soberano del Reino',bio:'Gobierna con severidad teatral pero justicia real. Decide el veredicto final ante cada pergamino.'},
  bufon:{name:'Milo el Bufón',role:'Bufón de la corte',bio:'Comenta cada resultado con humor afilado. Nadie sabe si sus bromas ocultan sabiduría.'},
  caballero:{name:'Sir Halric',role:'Caballero del Reino',bio:'Firme y de pocas palabras. Cree que el esfuerzo importa tanto como el resultado.'},
  escriba:{name:'Tobías el Escriba',role:'Escriba real',bio:'Recibe y registra cada pergamino con precisión meticulosa antes de que llegue al rey.'},
  consejero:{name:'Consejero Draven',role:'Consejero real',bio:'Analiza las cifras con ojo crítico y aconseja al rey antes de cada veredicto.'},
  maestro:{name:'Maestro Elian',role:'Maestro del reino',bio:'Antiguo tutor real. Cree en cada aprendiz, incluso cuando el Consejo es severo.'},
  aprendiz:{name:'Tú, el Aprendiz',role:'Estudiante del reino',bio:'Quien se presenta ante el Consejo Académico a defender sus puntuaciones.'}
};
const Cast=(function(){
  const SCENE_IDS=['escriba','consejero','rey','bufon','caballero'];
  const slots={}, portraits={};
  /* zonas de cada personaje dentro de su casilla (el SVG mide 240×404): cabeza con sombrero o corona, y cuerpo.
     Sirven para que ningún globo tape una cara ni un cuerpo. */
  const HEAD={x0:.24,x1:.76,y0:.03,y1:.39}, BODY={x0:.10,x1:.90,y0:.39,y1:1};
  let layer=null, scene=null;
  function mount(){
    const court=$('court'); layer=$('bubbles'); scene=$('scene');
    SCENE_IDS.forEach(id=>{
      const s=el('div','slot'); s.dataset.slot=id;
      const ch=el('div','char'); ch.dataset.char=id; ch.innerHTML=CharArt.build(id); s.appendChild(ch); court.appendChild(s);
      CharArt.setMood(ch,id,'neutral'); slots[id]={el:s,ch,say:null,sayTimer:0};
    });
    /* si cambia el tamaño de la escena (giro de pantalla, ventana), los globos abiertos se recolocan */
    if('ResizeObserver' in window) new ResizeObserver(relayout).observe(scene); else addEventListener('resize',relayout);
  }
  function setMood(id,mood){ const s=slots[id]; if(s) CharArt.setMood(s.ch,id,mood); }
  function show(id,mood){ const s=slots[id]; if(!s) return; if(mood) setMood(id,mood); s.el.classList.add('on'); }
  /* quita el globo de un personaje (o de todos): al instante, o con fundido si fade=true */
  function clearSay(id,fade){
    (id?[id]:SCENE_IDS).forEach(k=>{
      const s=slots[k]; if(!s) return; clearTimeout(s.sayTimer);
      const b=s.say; s.say=null; if(!b) return;
      if(fade){ b.classList.add('out'); setTimeout(()=>b.remove(),260); } else b.remove();
    });
  }
  function hide(id){ const s=slots[id]; if(!s) return; s.el.classList.remove('on','speaker'); s.ch.classList.remove('speaking'); clearSay(id); }
  /* al vaciar el salón, cada personaje vuelve a su ánimo neutro: nadie reaparece con la cara de la escena anterior */
  function hideAll(){ SCENE_IDS.forEach(k=>{ hide(k); setMood(k,'neutral'); }); }
  function speaking(id,on){
    const s=slots[id]; if(s){ s.ch.classList.toggle('speaking',!!on); s.el.classList.toggle('speaker',!!on); }
    const p=portraits[id]; if(p) p.classList.toggle('speaking',!!on);
  }
  function clearSpeaking(){ SCENE_IDS.concat(Object.keys(portraits)).forEach(id=>speaking(id,false)); }

  /* ── globos ── */
  const rectOf=e=>({l:e.offsetLeft,t:e.offsetTop,r:e.offsetLeft+e.offsetWidth,b:e.offsetTop+e.offsetHeight});
  const overlap=(a,b)=>Math.max(0,Math.min(a.r,b.r)-Math.max(a.l,b.l))*Math.max(0,Math.min(a.b,b.b)-Math.max(a.t,b.t));
  /* cabeza y cuerpo de un personaje en píxeles de la escena; se lee del layout, así que no depende de la transición de entrada */
  function zones(id){
    const s=slots[id].el, w=s.offsetWidth, h=s.offsetHeight, x=s.offsetLeft-w/2, y=s.offsetTop;
    const z=f=>({l:x+f.x0*w,r:x+f.x1*w,t:y+f.y0*h,b:y+f.y1*h});
    return {head:z(HEAD),body:z(BODY)};
  }
  /* Genera candidatos (encima de la cabeza, o a su lado, con varios anchos) y elige el de menor penalización:
     salirse de la escena, cubrir una cara o un cuerpo (propio o ajeno) o pisar otro globo. */
  function place(b,id){
    const W=scene.clientWidth, H=scene.clientHeight; if(!W||!H) return;
    const P=8, GAP=12, z=zones(id), fcx=(z.head.l+z.head.r)/2, fcy=z.head.t+(z.head.b-z.head.t)*.55;
    const bmax=Math.min(240,Math.max(150,W*(W<520?.5:.3)));
    const obs=[];
    SCENE_IDS.forEach(k=>{
      const s=slots[k]; if(!s.el.classList.contains('on')) return;
      const me=k===id, zz=me?z:zones(k);
      obs.push({r:zz.head,w:me?9:6},{r:zz.body,w:me?3:1.5});
      if(!me&&s.say&&s.say!==b) obs.push({r:rectOf(s.say),w:12});
    });
    const measure=mw=>{ b.style.maxWidth=Math.round(mw)+'px'; return {w:b.offsetWidth,h:b.offsetHeight}; };
    const cands=[];
    [1,.75,.55].forEach((k,i)=>{
      const mw=Math.min(bmax*k,W-2*P), s=measure(mw);
      ['c','l','r'].forEach((a,j)=>{
        const x=clamp(a==='c'?fcx-s.w/2:a==='l'?fcx-s.w+36:fcx-36,P,W-s.w-P);
        cands.push({side:'top',x,y:z.head.t-GAP-s.h,w:s.w,h:s.h,mw,pen:i*3+(j?5:0)});
      });
    });
    const availR=W-P-(z.head.r+GAP), availL=z.head.l-GAP-P;
    [1,.7].forEach((k,i)=>{
      if(availR>=90){ const mw=Math.min(bmax*k,availR), s=measure(mw); cands.push({side:'right',x:z.head.r+GAP,y:clamp(fcy-s.h/2,P,H-s.h-P),w:s.w,h:s.h,mw,pen:14+i*3}); }
      if(availL>=90){ const mw=Math.min(bmax*k,availL), s=measure(mw); cands.push({side:'left',x:z.head.l-GAP-s.w,y:clamp(fcy-s.h/2,P,H-s.h-P),w:s.w,h:s.h,mw,pen:14+i*3}); }
    });
    const bounds={l:4,t:4,r:W-4,b:H-4};
    let best=null;
    cands.forEach(c=>{
      const r={l:c.x,t:c.y,r:c.x+c.w,b:c.y+c.h};
      let sc=c.pen+(c.w*c.h-overlap(r,bounds))*40;          /* fuera de la escena */
      obs.forEach(o=>{ sc+=overlap(r,o.r)*o.w; });            /* encima de caras, cuerpos u otros globos */
      c.sc=sc; if(!best||sc<best.sc) best=c;
    });
    if(!best) return;
    b.style.maxWidth=Math.round(best.mw)+'px';
    b.style.left=Math.round(best.x)+'px'; b.style.top=Math.round(best.y)+'px';
    b.dataset.side=best.side;
    /* la cola apunta a la cara del hablante aunque el globo se haya desplazado para no salirse */
    const tail=best.side==='top'?clamp(fcx-best.x,18,best.w-18):clamp(fcy-best.y,16,best.h-16);
    b.style.setProperty('--tail',Math.round(tail)+'px');
  }
  function relayout(){ SCENE_IDS.forEach(k=>{ const s=slots[k]; if(s&&s.say&&!s.say.classList.contains('out')) place(s.say,k); }); }
  /* globo sobre un personaje. Un solo hablante a la vez: al empezar, cualquier otro globo o boca activa se corta. */
  function say(id,text,ms){
    const s=slots[id]; if(!s||!layer) return;
    SCENE_IDS.forEach(k=>{ if(k!==id){ clearSay(k); speaking(k,false); } });
    clearSay(id);
    s.el.classList.add('on');
    const b=el('div','say',text); layer.appendChild(b); s.say=b;
    place(b,id); b.classList.add('in'); speaking(id,true);
    s.sayTimer=setTimeout(()=>hush(id),ms||3200);   /* red de seguridad; la charla lo cierra antes con hush() */
  }
  /* el personaje termina de hablar: se calla la boca y el globo se desvanece */
  function hush(id){ speaking(id,false); clearSay(id,true); }
  function portrait(id,mood,fresh){
    let p=fresh?null:portraits[id];
    if(!p){ p=el('div','char portrait'); p.dataset.char=id; p.innerHTML=CharArt.build(id,{portrait:true}); if(!fresh) portraits[id]=p; }
    CharArt.setMood(p,id,mood||'neutral'); return p;
  }
  return {mount,show,hide,hideAll,setMood,speaking,clearSpeaking,say,hush,clearSay,portrait};
})();

/* ═══════════════ Dialogue: diálogo con retrato, escritura y cancelación limpia ═══════════════ */
const Dialogue=(function(){
  const E={name:$('dlgName'),role:$('dlgRole'),text:$('dlgText'),next:$('dlgNext'),skip:$('dlgSkipAll'),count:$('dlgCount'),portrait:$('dlgPortrait'),foot:$('dlgFoot'),choices:$('dlgChoices')};
  let cur=null,curChoice=null,lastLine=null;   /* lastLine: la última réplica mostrada; es a la que responde el aprendiz */
  function play(steps){
    return new Promise((resolve,reject)=>{
      if(cur||curChoice) abort();
      cur={steps,i:-1,resolve,reject,typing:false,timer:0};
      App.showPanel('dialogue'); advance();
    });
  }
  /* pinta la placa del hablante (nombre, retrato, ánimo, contador) y lo deja visible en escena; no toca el texto */
  function paint(d,st){
    const info=ROSTER[st.who]||{name:'',role:''};
    E.name.textContent=info.name; E.role.textContent=info.role;
    E.count.textContent=d.steps.length>1?(d.i+1)+' / '+d.steps.length:'';
    E.portrait.textContent=''; E.portrait.appendChild(Cast.portrait(st.who,st.mood||'neutral'));
    Cast.show(st.who,st.mood||'neutral');
    lastLine={who:st.who,text:st.text};
  }
  function advance(){
    const d=cur; if(!d) return;
    stopSpeaking(); d.i++;
    if(d.i>=d.steps.length){ finish(); return; }
    const st=d.steps[d.i], info=ROSTER[st.who]||{name:'',role:''};
    d.who=st.who; d.text=st.text;
    paint(d,st);
    E.text.textContent=''; E.text.classList.add('typing'); E.next.textContent='Mostrar todo';
    d.typing=true; Cast.speaking(st.who,true);
    UI.announce(info.name+': '+st.text);
    Voice.speak(st.text,st.who);
    E.next.focus({preventScroll:true});
    if(Settings.get('anim')==='off'){ finishTyping(); return; }
    const chars=Array.from(st.text); let n=0;
    const step=()=>{
      if(cur!==d||!d.typing) return;
      n++; E.text.textContent=chars.slice(0,n).join('');
      if(n%3===0) Sound.sfx.blip(st.who);
      if(n>=chars.length){ finishTyping(); return; }
      const c=chars[n-1]; d.timer=setTimeout(step,/[.!?…]/.test(c)?230:/[,;:]/.test(c)?120:26);
    };
    step();
  }
  function finishTyping(){
    const d=cur; if(!d||!d.typing) return;
    clearTimeout(d.timer); d.typing=false;
    E.text.textContent=d.text; E.text.classList.remove('typing'); E.next.textContent=d.i>=d.steps.length-1?'Continuar':'Siguiente';
    Cast.speaking(d.who,false);
  }
  /* corta voz, boca y cualquier globo de la charla: mientras habla el diálogo principal no habla nadie más */
  function stopSpeaking(){ if(cur){ clearTimeout(cur.timer); cur.typing=false; } E.text.classList.remove('typing'); Voice.stop(); Cast.clearSpeaking(); Cast.clearSay(); }
  function finish(){ const d=cur; cur=null; stopSpeaking(); d.resolve(); }
  /* «Omitir»: salta a la última réplica y la deja completa en pantalla, porque las opciones siguientes la responden */
  function skipAll(){
    const d=cur; if(!d) return;
    stopSpeaking();
    d.steps.forEach(s=>Cast.show(s.who,s.mood||'neutral'));   /* cada hablante queda con el ánimo de su último turno */
    d.i=d.steps.length-1; const st=d.steps[d.i]; d.who=st.who; d.text=st.text;
    paint(d,st); E.text.textContent=st.text;
    finish();
  }
  function closeChoice(){ E.choices.hidden=true; E.choices.textContent=''; E.foot.hidden=false; }
  /* opciones de respuesta: el aprendiz elige entre 2-3 réplicas y cada una lleva a una reacción distinta.
     La réplica anterior (con su nombre y su retrato) sigue visible: se responde a ella, no a otro personaje. */
  function choose(options,who){
    who=who||'aprendiz';
    return new Promise((resolve,reject)=>{
      if(curChoice){ const old=curChoice; curChoice=null; old.reject(CANCEL); }
      const entry={resolve,reject}; curChoice=entry;
      if(!lastLine){
        const info=ROSTER[who]||{name:'',role:''};
        E.name.textContent=info.name; E.role.textContent=info.role;
        E.portrait.textContent=''; E.portrait.appendChild(Cast.portrait(who,'neutral'));
        E.text.textContent='Elige tu respuesta.';
      }
      E.count.textContent=''; E.foot.hidden=true;
      const box=E.choices; box.textContent=''; box.hidden=false;
      box.appendChild(el('p','dlg-reply-cap','Tu respuesta:'));
      options.forEach(opt=>{
        const b=el('button','dlg-choice',opt.label); b.type='button';
        b.addEventListener('click',()=>{
          if(curChoice!==entry) return;
          curChoice=null; closeChoice(); Sound.sfx.click(); resolve(opt);
        });
        box.appendChild(b);
      });
      UI.announce('Elige tu respuesta: '+options.map(o=>o.label).join(' — '));
      requestAnimationFrame(()=>{ const f=box.querySelector('.dlg-choice'); if(f) f.focus({preventScroll:true}); });
    });
  }
  function abort(){
    lastLine=null;
    if(curChoice){ const cc=curChoice; curChoice=null; closeChoice(); cc.reject(CANCEL); }
    const d=cur; if(!d) return; cur=null; stopSpeaking(); d.reject(CANCEL);
  }
  function next(){ if(!cur) return; if(cur.typing) finishTyping(); else advance(); }
  E.next.addEventListener('click',next);
  E.skip.addEventListener('click',skipAll);
  return {play,next,abort,choose,get active(){return !!cur;}};
})();

/* ═══════════════ GradeCalculator: validación estricta y cálculo ═══════════════ */
const Grade=(function(){
  const MIN=60;
  const LIMITS={tareas:80,parcial1:30,parcial2:30,examen:30};
  const LABELS={tareas:'Trabajos y tareas',parcial1:'Primer parcial',parcial2:'Segundo parcial',examen:'Examen final'};
  const KEYS=['tareas','parcial1','parcial2','examen'];
  /* Textos exactos por categoría, tal como los proclama el Consejo */
  const CATEGORY_TEXT={
    0:'El Consejo ha determinado que el aprendiz deberá continuar su entrenamiento.',
    2:'El Consejo considera que el aprendiz ha superado la prueba.',
    3:'El Consejo reconoce un desempeño notable.',
    4:'El Rey reconoce un desempeño sobresaliente.',
    5:'El Consejo Real proclama un desempeño excepcional.'
  };
  const CAP={0:'Reprobado',2:'Nota 2 de 5',3:'Nota 3 de 5',4:'Nota 4 de 5',5:'Nota 5 de 5'};
  const THRESH={2:60,3:71,4:81,5:91};
  function tierOf(n){ if(n>=91) return 5; if(n>=81) return 4; if(n>=71) return 3; if(n>=MIN) return 2; return 0; }
  /* interpreta el texto del campo: acepta coma o punto decimal, rechaza signos, letras y notación científica */
  function checkField(key,raw){
    const s=String(raw==null?'':raw).trim().replace(',','.');
    if(s==='') return {empty:true,msg:'Escribe tus puntos.'};
    if(s.charAt(0)==='-') return {msg:'No puede ser negativo.'};
    if(!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return {msg:'Usa solo números; el decimal va con punto o coma.'};
    const v=parseFloat(s);
    if(!Number.isFinite(v)) return {msg:'Usa solo números; el decimal va con punto o coma.'};
    if(v>LIMITS[key]) return {msg:'El máximo es '+LIMITS[key]+' puntos.'};
    return {value:v};
  }
  function compute(v){
    const pT=v.tareas/80*100, pP=(v.parcial1+v.parcial2)/60*100, notaParcial=pT*.4+pP*.6;
    const pE=v.examen/30*100;
    const nf=clamp(Math.round((notaParcial*.6+pE*.4)*100)/100,0,100);
    return {nf,tier:tierOf(nf)};
  }
  function nextGoal(nf,tier){ if(tier===5) return null; const t=tier===0?2:tier+1; return {tier:t,need:Math.max(0,THRESH[t]-nf)}; }
  return {LIMITS,LABELS,KEYS,CATEGORY_TEXT,CAP,tierOf,checkField,compute,nextGoal,MIN};
})();

/* ═══════════════ GameState: experiencia, nivel y título ═══════════════ */
const GameState=(function(){
  const KEY='aldemar_progress_v2',OLD='aldemar_progress_v1',PER=120;
  const TITLES=[{min:1,name:'Aprendiz del Reino'},{min:3,name:'Escriba Novato'},{min:6,name:'Estudiante Real'},{min:10,name:'Caballero del Conocimiento'},{min:15,name:'Maestro Académico'},{min:21,name:'Sabio del Reino'}];
  let xp=0;
  function load(){ const s=Store.read(KEY)||Store.read(OLD); const v=s&&Number(s.xp); xp=Number.isFinite(v)&&v>0?Math.floor(Math.min(v,1e7)):0; }
  const level=()=>Math.floor(xp/PER)+1;
  function title(){ const lv=level(); let t=TITLES[0].name; TITLES.forEach(x=>{ if(lv>=x.min) t=x.name; }); return t; }
  const xpForGrade=(nf,tier)=>Math.max(0,Math.round(nf*.9)+tier*12+8);
  function addXP(n){ const before=level(); xp+=Math.max(0,Math.floor(n)); Store.write(KEY,{xp}); render(); return {gained:n,levelUp:level()>before}; }
  function reset(){ xp=0; Store.write(KEY,{xp}); render(); }
  function render(){
    const lv=level(),inLv=xp%PER,pct=Math.round(inLv/PER*100);
    $('lvlNum').textContent=lv; $('rankTitle').textContent=title();
    $('xpFill').style.width=pct+'%'; $('xpBar').setAttribute('aria-valuenow',pct);
    $('titleRank').textContent='Nivel '+lv+' · '+title()+' — '+inLv+'/'+PER+' EXP';
  }
  load();
  return {addXP,xpForGrade,level,title,render,reset,reload:()=>{ load(); render(); }};
})();

/* ═══════════════ Chronicle: historial validado y sin duplicados ═══════════════ */
const Chronicle=(function(){
  const KEY='aldemar_chronicle_v2',OLD='aldemar_chronicle_v1',MAX=60;
  let list=[];
  function clean(e){
    if(!e||typeof e!=='object') return null;
    const nf=Number(e.nf); if(!Number.isFinite(nf)||nf<0||nf>100) return null;
    const tier=[0,2,3,4,5].indexOf(e.tier)>=0?e.tier:Grade.tierOf(nf);
    const xp=Number.isFinite(Number(e.xp))?Math.max(0,Math.floor(Number(e.xp))):0;
    const ts=Number.isFinite(Number(e.ts))&&Number(e.ts)>0?Number(e.ts):0;
    const label=typeof e.label==='string'?e.label.slice(0,60):(typeof e.fecha==='string'?(e.fecha+(e.hora?', '+e.hora:'')).slice(0,60):'');
    const id=typeof e.id==='string'&&e.id?e.id.slice(0,40):'old-'+ts+'-'+nf+'-'+xp+'-'+label;
    return {id,ts,nf:Math.round(nf*100)/100,tier,xp,label};
  }
  function load(){
    const raw=Store.read(KEY)||Store.read(OLD), seen=new Set(); list=[];
    if(Array.isArray(raw)) raw.forEach(e=>{ const c=clean(e); if(c&&!seen.has(c.id)){ seen.add(c.id); list.push(c); } });
    list=list.slice(0,MAX);
  }
  function add(nf,tier,xp){
    const e=clean({id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),ts:Date.now(),nf,tier,xp});
    if(!e||list.some(x=>x.id===e.id)) return null;
    list.unshift(e); list=list.slice(0,MAX); Store.write(KEY,list); renderSummary(); return e;
  }
  function clear(){ list=[]; Store.write(KEY,list); render(); renderSummary(); }
  function when(e){
    if(!e.ts) return e.label||'Fecha desconocida';
    const d=new Date(e.ts);
    return d.toLocaleDateString('es',{day:'numeric',month:'long',year:'numeric'})+' · '+d.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'});
  }
  function render(){
    const ol=$('chronList'); ol.textContent='';
    $('chronEmpty').hidden=list.length>0; $('clearChronBtn').disabled=list.length===0;
    list.forEach(e=>{
      const li=el('li','chron-item'), seal=el('div','chron-seal'); seal.dataset.tier=e.tier;
      if(e.tier===0){ seal.innerHTML='<svg class="ico" aria-hidden="true"><use href="#i-cracked"/></svg>'; } else seal.textContent=e.tier;
      const body=el('div'), top=el('div','chron-top');
      top.append(el('span',null,fmt(e.nf)+' / 100'),el('span',null,Grade.CAP[e.tier]));
      body.append(top,el('div','chron-meta',when(e)+' · +'+e.xp+' EXP'),el('div','chron-com',Grade.CATEGORY_TEXT[e.tier]));
      li.append(seal,body); ol.appendChild(li);
    });
    const n=list.length;
    if(!n) $('chronSummary').textContent='Registro de tus evaluaciones ante el Consejo Real.';
    else{ const best=Math.max.apply(null,list.map(e=>e.nf)),avg=list.reduce((s,e)=>s+e.nf,0)/n;
      $('chronSummary').textContent=n+(n===1?' evaluación':' evaluaciones')+' · Mejor: '+fmt(best)+' · Promedio: '+fmt(avg); }
  }
  function renderSummary(){ const n=list.length; $('menuChronSub').textContent=n?n+(n===1?' evaluación registrada':' evaluaciones registradas'):'Aún sin evaluaciones'; }
  load();
  return {add,clear,render,renderSummary,reload:()=>{ load(); renderSummary(); },count:()=>list.length};
})();

/* ═══════════════ Modals: ventanas con foco atrapado, Esc y confirmación ═══════════════ */
const Modals=(function(){
  const layer=$('modalLayer'),stack=[];
  let opener=null,confirmDone=null;
  function bg(on){ ['topbar','stage'].forEach(id=>{ const e=$(id); if(on){ e.setAttribute('inert',''); e.setAttribute('aria-hidden','true'); } else{ e.removeAttribute('inert'); e.removeAttribute('aria-hidden'); } }); }
  function focusables(m){ return $$('button:not([disabled]),input:not([disabled]),[href],[tabindex]:not([tabindex="-1"])',m).filter(x=>x.offsetParent!==null); }
  function open(name){
    const m=$('modal-'+name); if(!m||stack.indexOf(m)>=0) return;
    if(name!=='confirm') stack.filter(x=>x.id!=='modal-confirm').forEach(x=>{ x.hidden=true; stack.splice(stack.indexOf(x),1); });
    if(!stack.length){ opener=document.activeElement; bg(true); layer.hidden=false; UI.closeMusic(); }
    stack.forEach(x=>x.setAttribute('inert',''));
    if(name==='cronica') Chronicle.render();
    if(name==='personajes') UI.renderRoster();
    m.hidden=false; m.removeAttribute('inert'); stack.push(m); m.focus();
    if(name!=='confirm'){ const body=$$('.modal-body',m)[0]; if(body) body.scrollTop=0; }
    App.syncNav();
  }
  function closeTop(){
    const m=stack.pop(); if(!m) return;
    m.hidden=true;
    if(m.id==='modal-confirm'&&confirmDone){ const d=confirmDone; confirmDone=null; d(false); }
    if(stack.length){ const t=stack[stack.length-1]; t.removeAttribute('inert'); t.focus(); }
    else{
      layer.hidden=true; bg(false);
      const back=(opener&&document.contains(opener)&&opener.offsetParent!==null)?opener:$('dock');
      back.focus({preventScroll:true}); opener=null;
    }
    App.syncNav();
  }
  function closeAll(){ while(stack.length) closeTop(); }
  function current(){ for(let i=stack.length-1;i>=0;i--){ if(stack[i].id!=='modal-confirm') return stack[i].id.replace('modal-',''); } return null; }
  function confirm(o){
    return new Promise(res=>{
      $('confTitle').textContent=o.title; $('confText').textContent=o.text; $('confYes').textContent=o.yes||'Confirmar';
      confirmDone=res; open('confirm'); $('confNo').focus();
    });
  }
  $('confYes').addEventListener('click',()=>{ const d=confirmDone; confirmDone=null; closeTop(); if(d) d(true); });
  $('confNo').addEventListener('click',closeTop);
  layer.addEventListener('click',e=>{ if(e.target===layer||e.target.closest('[data-close]')) closeTop(); });
  layer.addEventListener('keydown',e=>{
    if(e.key!=='Tab'||!stack.length) return;
    const top=stack[stack.length-1],f=focusables(top); if(!f.length){ e.preventDefault(); return; }
    const first=f[0],last=f[f.length-1],a=document.activeElement;
    if(e.shiftKey&&(a===first||a===top)){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey&&a===last){ e.preventDefault(); first.focus(); }
  });
  return {open,closeTop,closeAll,current,confirm,get isOpen(){return stack.length>0;}};
})();

/* ═══════════════ UI: avisos, controles, reproductor, personajes ═══════════════ */
const UI=(function(){
  let panelOpen=false,rosterDone=false;
  function toast(msg,kind){
    const box=$('toasts'); while(box.children.length>=3) box.firstChild.remove();
    const t=el('div','toast'+(kind==='warn'?' warn':''),msg); box.appendChild(t);
    setTimeout(()=>{ t.classList.add('out'); setTimeout(()=>t.remove(),320); },kind==='warn'?5200:3600);
  }
  function announce(msg){ const s=$('srLive'); s.textContent=''; setTimeout(()=>{ s.textContent=msg; },40); }
  const OUT={musicVol:v=>v+'%',sfxVol:v=>v+'%',voiceVol:v=>v+'%',voiceRate:v=>(v/100).toFixed(2)+'×'};
  function renderControls(){
    $$('[data-set]').forEach(b=>b.setAttribute('aria-checked',String(!!Settings.get(b.dataset.set))));
    $$('[data-range]').forEach(r=>{ if(document.activeElement!==r) r.value=Settings.get(r.dataset.range); });
    $$('[data-out]').forEach(o=>{ o.textContent=OUT[o.dataset.out](Settings.get(o.dataset.out)); });
    $$('[data-seg]').forEach(g=>{ const v=Settings.get(g.dataset.seg); $$('button',g).forEach(b=>b.setAttribute('aria-checked',String(b.dataset.val===v))); });
    const m=Settings.get('masterMute'),mb=$('mpMute');
    mb.setAttribute('aria-pressed',String(m)); mb.setAttribute('aria-label',m?'Activar el sonido':'Silenciar todo el sonido');
    mb.querySelector('use').setAttribute('href',m?'#i-mute':'#i-vol');
  }
  function bindSettings(){
    $$('[data-set]').forEach(b=>b.addEventListener('click',()=>{
      const k=b.dataset.set,v=!Settings.get(k);
      if(k==='musicOn'){ v?Music.play():Music.pause(); return; }
      Settings.set(k,v);
      if(k==='sfxOn'&&v) Sound.sfx.click();
    }));
    $$('[data-range]').forEach(r=>{
      r.addEventListener('input',()=>Settings.set(r.dataset.range,Number(r.value)));
      r.addEventListener('change',()=>{ if(r.dataset.range==='sfxVol') Sound.sfx.coin(); });
    });
    $$('[data-seg]').forEach(g=>$$('button',g).forEach(b=>b.addEventListener('click',()=>Settings.set(g.dataset.seg,b.dataset.val))));
    $('voiceTest').addEventListener('click',()=>Voice.speak('Que el reino te reciba con honor, joven aprendiz.','rey',true));
    $('resetSettings').addEventListener('click',()=>{ Settings.reset(); Voice.stop(); Music.updateUI(); toast('Ajustes restablecidos.'); });
    $('resetProgress').addEventListener('click',async()=>{
      const ok=await Modals.confirm({title:'¿Borrar todo el progreso?',text:'Se eliminarán tu experiencia, tu nivel y toda la crónica. Esta acción no se puede deshacer.',yes:'Borrar todo'});
      if(ok){ GameState.reset(); Chronicle.clear(); toast('Progreso y crónica borrados.'); }
    });
    if(!Voice.supported){
      $('voiceNote').hidden=false;
      $$('[data-set="voiceOn"],[data-range="voiceVol"],[data-range="voiceRate"],#voiceTest').forEach(x=>{ x.disabled=true; });
    }
    Settings.subscribe(renderControls); renderControls();
  }
  function renderRoster(){
    if(rosterDone) return; rosterDone=true;
    const box=$('roster');
    ['rey','escriba','consejero','bufon','caballero','maestro','aprendiz'].forEach(id=>{
      const r=ROSTER[id],card=el('article','roster-card'),frame=el('div','portrait-frame');
      frame.appendChild(Cast.portrait(id,id==='caballero'?'neutral':'pleased',true));
      card.append(frame,el('h3',null,r.name),el('p','role',r.role),el('p',null,r.bio)); box.appendChild(card);
    });
  }
  function openMusic(){ panelOpen=true; $('musicPanel').hidden=false; $('musicBtn').setAttribute('aria-expanded','true'); Music.setPanelOpen(true); Music.updateUI(); }
  function closeMusic(){ if(!panelOpen) return; panelOpen=false; $('musicPanel').hidden=true; $('musicBtn').setAttribute('aria-expanded','false'); Music.setPanelOpen(false); }
  function initMusicPanel(){
    $('musicBtn').addEventListener('click',()=>{ if(panelOpen) closeMusic(); else{ openMusic(); $('mpPlay').focus(); } });
    $('mpPlay').addEventListener('click',()=>Music.toggle());
    $('mpNext').addEventListener('click',()=>Music.next());
    $('mpPrev').addEventListener('click',()=>Music.prev());
    $('mpMute').addEventListener('click',()=>{ Settings.set('masterMute',!Settings.get('masterMute')); });
    $('mpListToggle').addEventListener('click',()=>Music.toggleList());
    document.addEventListener('pointerdown',e=>{ if(panelOpen&&!e.target.closest('#musicPanel,#musicBtn')) closeMusic(); });
    Music.buildList();
  }
  function initDust(){
    const box=$('dust');
    for(let i=0;i<14;i++){ const m=el('i','mote'); m.style.left=rnd(4,96).toFixed(1)+'%'; m.style.animationDuration=rnd(9,17).toFixed(1)+'s'; m.style.animationDelay='-'+rnd(0,14).toFixed(1)+'s'; m.style.setProperty('--dx',rnd(-40,40).toFixed(0)+'px'); box.appendChild(m); }
  }
  return {toast,announce,bindSettings,renderRoster,initMusicPanel,initDust,openMusic,closeMusic,get musicOpen(){return panelOpen;}};
})();

/* ═══════════════ App: máquina de estados y flujo de la audiencia ═══════════════
   Estados: menu → intro → input → review → deliver → deliberate → verdict
   Cada escena usa un "flowId": al cancelar, todo lo pendiente se corta de raíz. */
const App=(function(){
  let state='menu',flowId=0,pending=null,result=null,seenIntro=false;
  const waiters=new Set(),panels=$$('.panel'),card=$('verdictCard'),form=$('gradeForm');
  const KING_MOOD={0:'stern',2:'wary',3:'pleased',4:'happy',5:'radiant'};
  /* el rey habla siempre en primera persona (solemne, pero nunca de sí mismo como un tercero) */
  const KING_LINE={
    0:'Había pensado en tu ejecución… pero incluso un rey concede una segunda oportunidad.',
    2:'Te has salvado por poco, aprendiz. No tientes a la suerte.',
    3:'Me parece aceptable. Puedes retirarte con la frente en alto.',
    4:'Te felicito, aprendiz. Tu esfuerzo ha sido notable.',
    5:'Te nombro mi consejero real. ¡Que se entere todo el reino!'
  };
  /* ánimo con el que el bufón y el caballero reciben cada veredicto; sus palabras están en CONSEJO_REACT */
  const BUFON_MOOD={0:'sad',2:'surprised',3:'pleased',4:'happy',5:'radiant'};
  const CABALLERO_MOOD={0:'stern',2:'neutral',3:'pleased',4:'happy',5:'radiant'};
  const NEXT_MSG={0:'Repasa tus parciales y vuelve a presentarte cuando estés listo.',2:'Aprobaste por poco: cada punto extra en el examen final suma.',3:'Un resultado sólido. Sigue así.',4:'Un resultado sobresaliente. ¡Casi la cima!',5:'Es la nota máxima. ¡Leyenda de Aldemar!'};

  /* ── memoria de la audiencia: lo que el aprendiz eligió y cómo le fue antes. Las charlas posteriores la usan. ── */
  const ctx={intro:null,escriba:null,ready:null,prev:null};

  /* ── opciones de diálogo: cada réplica del aprendiz cambia cómo reacciona la corte ── */
  const INTRO_CHOICES=[
    {id:'humilde',label:'Me presento con humildad, majestad.'},
    {id:'seguro',label:'Vengo con la confianza puesta en mi trabajo.'},
    {id:'directo',label:'¿Podemos empezar cuanto antes?'}
  ];
  /* cada respuesta del rey termina mandando al aprendiz al Gran Libro: así la escena siguiente tiene sentido */
  const INTRO_REPLY={
    humilde:{who:'rey',mood:'pleased',text:'La humildad honra esta corte. Acércate a la mesa y anota tus puntos en el Gran Libro.'},
    seguro:{who:'rey',mood:'happy',text:'Ese temple me agrada. Veamos si tus notas lo respaldan: anota tus puntos en el Gran Libro.'},
    directo:{who:'rey',mood:'wary',text:'Sin rodeos, ¿eh? Que así sea. A la mesa, y anota tus puntos en el Gran Libro.'}
  };
  function introSteps(){
    if(!seenIntro) return [
      {who:'rey',mood:'pleased',text:'Bienvenido al Salón del Trono, joven aprendiz. Soy Aldemar, rey de este reino.'},
      {who:'rey',mood:'neutral',text:'El Consejo Académico aguarda tus resultados. Anota tus puntos en el Gran Libro y preséntalos ante mi corte.'},
      {who:'rey',mood:'happy',text:'Antes de empezar, dime, aprendiz: ¿con qué ánimo te presentas hoy?'}];
    const p=ctx.prev; let mem='';
    if(p) mem=p.tier===0?' La última vez el Consejo no te fue favorable, pero veo que no te rindes.'
      :p.tier>=4?' Tu última nota fue de '+fmt(p.nf)+'; veamos si la igualas.'
      :' La última vez alcanzaste '+fmt(p.nf)+' puntos.';
    return [{who:'rey',mood:'pleased',text:'De nuevo ante el trono, aprendiz.'+mem+' ¿Con qué ánimo vuelves hoy?'}];
  }

  const ESCRIBA_CHOICES=[
    {id:'gracias',label:'Gracias por tu diligencia, escriba.'},
    {id:'nervioso',label:'Espero no haber olvidado nada…'},
    {id:'apuro',label:'¿Cuánto tardará el Consejo?'}
  ];
  /* el escriba siempre pasa el pergamino al consejero: es lo que hace entrar a Draven en escena */
  const ESCRIBA_REPLY={
    gracias:{who:'escriba',mood:'pleased',text:'Es un honor servir a la corona. Entrego ahora tu pergamino al Consejero Draven.'},
    nervioso:{who:'escriba',mood:'neutral',text:'Tranquilo: cada pergamino se revisa dos veces antes de sellarse. Ahora lo entrego al Consejero Draven.'},
    apuro:{who:'escriba',mood:'smirk',text:'La paciencia es la primera virtud de esta corte. El Consejero Draven ya tiene tu pergamino; no tardará.'}
  };
  /* el consejero analiza las cifras reales del aprendiz (es su papel: ojo crítico, sin sentimentalismos) */
  const PART={tareas:'tus trabajos y tareas',parcial1:'tu primer parcial',parcial2:'tu segundo parcial',examen:'tu examen final'};
  function consejeroLine(v){
    const r={}; Grade.KEYS.forEach(k=>{ r[k]=v[k]/Grade.LIMITS[k]; });
    const ks=Grade.KEYS, hi=ks.reduce((a,k)=>r[k]>r[a]?k:a,ks[0]), lo=ks.reduce((a,k)=>r[k]<r[a]?k:a,ks[0]);
    const base='Majestad, las cuatro cifras coinciden con el registro y respetan sus límites. ';
    if(r[hi]===0) return base+'Aunque todas constan en cero, el pronóstico es sombrío.';
    if(r[lo]===1) return base+'Y todas alcanzan su máximo: un registro impecable.';
    if(r[hi]-r[lo]<.06) return base+'Lo notable es lo parejas que son.';
    return base+'Lo más sólido es '+PART[hi]+'; lo más débil, '+PART[lo]+'.';
  }
  const READY_CHOICES=[
    {id:'listo',label:'Estoy listo, majestad.'},
    {id:'nervioso2',label:'Un poco nervioso, para ser sincero.'},
    {id:'audaz',label:'¡Que empiece el juicio!'}
  ];
  /* responde quien preguntó (el rey); el consejero solo añade algo cuando el aprendiz confiesa nervios */
  const READY_REPLY={
    listo:[{who:'rey',mood:'happy',text:'Así me gusta. Que el Consejo delibere.'}],
    nervioso2:[{who:'rey',mood:'pleased',text:'El temor es señal de que te importa, aprendiz. Que el Consejo delibere.'},
               {who:'consejero',mood:'neutral',text:'Las cifras constan en orden, aprendiz. Es todo lo que puedo adelantarte.'}],
    audaz:[{who:'rey',mood:'smirk',text:'¡Ese ánimo! Que el Consejo decida, entonces.'}]
  };

  /* ── charlas entre el bufón (burlón, se ríe de sí mismo) y el caballero (parco, honorable). Se tutean siempre.
        Cada guion es una conversación cerrada en la que cada frase responde a la anterior.
        «when» los activa según lo que el aprendiz eligió antes; {nf} y {gap} se rellenan con la nota real. ── */
  const DELIBERATE_CHAT=[
    {lines:[{who:'bufon',mood:'surprised',text:'¡Qué tensión! Se me caen los cascabeles.'},
            {who:'caballero',mood:'stern',text:'Silencio en la corte.'},
            {who:'bufon',mood:'wary',text:'Solo digo lo que todos pensamos…'},
            {who:'caballero',mood:'stern',text:'Pues piénsalo en silencio.'}]},
    {lines:[{who:'bufon',mood:'thinking',text:'¿Aprobará? ¿No aprobará? Apuesto un cascabel a que sí.'},
            {who:'caballero',mood:'neutral',text:'No se apuesta sobre el esfuerzo ajeno.'},
            {who:'bufon',mood:'surprised',text:'¡Ay, qué serio! Era solo un cascabel.'},
            {who:'caballero',mood:'stern',text:'Alguien debe guardar la compostura en esta sala.'}]},
    {lines:[{who:'bufon',mood:'wary',text:'Mis cascabeles tiemblan… ¿o soy yo?'},
            {who:'caballero',mood:'neutral',text:'Ambos, seguramente.'},
            {who:'bufon',mood:'surprised',text:'¡Vaya, el caballero bromea!'},
            {who:'caballero',mood:'stern',text:'Fue un comentario. No una broma.'}]},
    {when:()=>ctx.ready==='nervioso2'||ctx.escriba==='nervioso',
     lines:[{who:'bufon',mood:'wary',text:'El aprendiz está más pálido que el pergamino del escriba.'},
            {who:'caballero',mood:'neutral',text:'El nerviosismo no es deshonra. Yo también lo sentí ante mi primer combate.'},
            {who:'bufon',mood:'surprised',text:'¿Tú, nervioso? ¿Con esa armadura?'},
            {who:'caballero',mood:'stern',text:'Bajo la armadura también late un corazón, bufón.'}]},
    {when:()=>ctx.ready==='audaz'||ctx.intro==='seguro',
     lines:[{who:'bufon',mood:'smirk',text:'Qué aplomo el del aprendiz. O mucha confianza, o ninguna sensatez.'},
            {who:'caballero',mood:'neutral',text:'La confianza se demuestra con hechos, no con palabras.'},
            {who:'bufon',mood:'happy',text:'Entonces pronto sabremos de qué está hecho.'},
            {who:'caballero',mood:'pleased',text:'Eso es lo único que importa.'}]},
    {when:()=>ctx.intro==='directo'||ctx.escriba==='apuro',
     lines:[{who:'bufon',mood:'surprised',text:'¡Con qué prisa vino el aprendiz! Ni un juglar canta tan rápido.'},
            {who:'caballero',mood:'neutral',text:'La prisa es mala consejera.'},
            {who:'bufon',mood:'wary',text:'Y peor bufona que yo, que ya es decir.'},
            {who:'caballero',mood:'stern',text:'Ahora al aprendiz le toca esperar, como a todos.'}]}
  ];
  const CONSEJO_REACT={
    0:[{lines:[{who:'bufon',mood:'sad',text:'Ay, {nf}… A mí también me duele, y eso que no soy yo el examinado.'},
               {who:'caballero',mood:'stern',text:'El fracaso enseña a quien quiere aprender. Levántate, aprendiz.'},
               {who:'bufon',mood:'sad',text:'Fácil decirlo tú, que nunca fallas una estocada.'},
               {who:'caballero',mood:'neutral',text:'También fallé alguna vez. Solo que nadie lo vio.'}]},
       {lines:[{who:'caballero',mood:'stern',text:'Faltaron {gap} puntos. Es una distancia que se recorre con estudio.'},
               {who:'bufon',mood:'sad',text:'¡Ánimo, aprendiz! Yo llevo años fallando y aún tengo trabajo.'},
               {who:'caballero',mood:'neutral',text:'Eso no es motivo de orgullo, bufón.'},
               {who:'bufon',mood:'wary',text:'Perdón… era mi forma de ayudar.'}]}],
    2:[{lines:[{who:'bufon',mood:'surprised',text:'¡Con {nf}! Por los pelos, aprendiz.'},
               {who:'caballero',mood:'neutral',text:'Se aprueba o no se aprueba. Y se aprobó.'},
               {who:'bufon',mood:'smirk',text:'Hasta yo aplaudo… un poquito.'},
               {who:'caballero',mood:'pleased',text:'Un aplauso ganado vale más que diez regalados.'}]},
       {lines:[{who:'caballero',mood:'neutral',text:'Aprobado, aunque con poco margen. No te acostumbres a lo justo.'},
               {who:'bufon',mood:'surprised',text:'¡Por poco, pero dentro es dentro!'},
               {who:'caballero',mood:'neutral',text:'Dentro es dentro. Faltaron {gap} puntos para el siguiente escalón.'},
               {who:'bufon',mood:'smirk',text:'Yo me acostumbré a lo justo. Y mira dónde vivo: en un castillo.'}]}],
    3:[{lines:[{who:'bufon',mood:'pleased',text:'{nf}… Bien, bien. Ni un cascabel ha sonado.'},
               {who:'caballero',mood:'pleased',text:'Trabajo constante. Se nota.'},
               {who:'bufon',mood:'happy',text:'¡Constante dice! Yo diría que hasta brilla un poco.'},
               {who:'caballero',mood:'pleased',text:'No exageres, bufón. Aunque… no te falta razón.'}]},
       {lines:[{who:'caballero',mood:'pleased',text:'Un resultado firme, de los que se construyen sin prisa.'},
               {who:'bufon',mood:'pleased',text:'Firme y sin sobresaltos. Casi me aburres.'},
               {who:'caballero',mood:'pleased',text:'Prefiero aburrirte a alarmarte.'},
               {who:'bufon',mood:'happy',text:'Tiene lógica, para variar.'}]}],
    4:[{lines:[{who:'bufon',mood:'happy',text:'¡{nf}! Esto merece una pirueta.'},
               {who:'caballero',mood:'happy',text:'Honor a tu esfuerzo, aprendiz.'},
               {who:'bufon',mood:'radiant',text:'¡Vamos, Halric, si hasta sonríes!'},
               {who:'caballero',mood:'happy',text:'Solo un poco. No te acostumbres.'}]},
       {lines:[{who:'caballero',mood:'happy',text:'Un resultado que honra a esta corte.'},
               {who:'bufon',mood:'happy',text:'¡Y a mis piruetas de celebración!'},
               {who:'caballero',mood:'pleased',text:'Guárdalas para el salón, bufón.'},
               {who:'bufon',mood:'radiant',text:'¡Entonces al salón! ¡Que alguien traiga música!'}]}],
    5:[{lines:[{who:'bufon',mood:'radiant',text:'¡{nf}! Consejero real… me quedaré sin trabajo.'},
               {who:'caballero',mood:'radiant',text:'Mi espada al servicio del nuevo consejero.'},
               {who:'bufon',mood:'radiant',text:'¡Y yo seré su bufón oficial, faltaría más!'},
               {who:'caballero',mood:'radiant',text:'Aldemar entero recordará este día.'}]},
       {lines:[{who:'caballero',mood:'radiant',text:'Nota máxima. Pocas veces se ve algo así en esta corte.'},
               {who:'bufon',mood:'radiant',text:'¡Tocaré todos mis cascabeles en su honor!'},
               {who:'caballero',mood:'radiant',text:'Suenan poco, pero alegran la sala. Eso ya es mucho.'},
               {who:'bufon',mood:'radiant',text:'¡El bufón más honrado de Aldemar!'}]}]
  };
  /* comentarios según la evolución respecto a la última audiencia (solo si el tono encaja con el veredicto) */
  const TREND=[
    {when:()=>result&&ctx.prev&&result.tier>=2&&result.nf>ctx.prev.nf,
     lines:[{who:'bufon',mood:'happy',text:'¡Subiste desde la última vez, aprendiz! Se nota el estudio.'},
            {who:'caballero',mood:'pleased',text:'Cada intento deja algo aprendido. Ese es el camino.'},
            {who:'bufon',mood:'pleased',text:'Lo dice quien lleva años puliendo su espada.'},
            {who:'caballero',mood:'neutral',text:'Y quien nunca deja de pulirla.'}]},
    {when:()=>result&&ctx.prev&&(result.tier===2||result.tier===3)&&result.nf<ctx.prev.nf,
     lines:[{who:'bufon',mood:'wary',text:'Vaya… un poco menos que la última vez.'},
            {who:'caballero',mood:'stern',text:'Un tropiezo no borra lo aprendido.'},
            {who:'bufon',mood:'sad',text:'Eso dicen siempre los que no tropiezan.'},
            {who:'caballero',mood:'neutral',text:'Te equivocas. Tropecé más de lo que crees.'}]}
  ];
  /* elige un guion: prefiere los que encajan con lo ocurrido y nunca repite el último usado con la misma clave */
  const lastChat={};
  function chatFor(list,key){
    const cond=list.filter(x=>x.when&&x.when()), gen=list.filter(x=>!x.when);
    const pool=(cond.length&&(!gen.length||Math.random()<.7))?cond:gen;
    const fresh=pool.filter(x=>x!==lastChat[key]);
    const c=pick(fresh.length?fresh:pool); lastChat[key]=c; return c.lines;
  }
  /* sustituye {nf} y {gap} por los números reales del veredicto (los mismos que muestra la tarjeta) */
  function fill(t){
    const r=result; if(!r) return t;
    const g=Grade.nextGoal(r.nf,r.tier), gap=r.tier===0?Math.max(0,Grade.MIN-r.nf):(g?g.need:0);
    return t.replace(/\{nf\}/g,fmt(r.nf)).replace(/\{gap\}/g,fmt(gap));
  }

  /* ── control de escenas asíncronas ── */
  function wait(ms){ return new Promise((res,rej)=>{ const w={rej}; w.t=setTimeout(()=>{ waiters.delete(w); res(); },ms); waiters.add(w); }); }
  /* tiempo de lectura de un globo: proporcional al texto e igual en todos los modos de animación
     (antes, con animaciones desactivadas, cada globo duraba menos de un segundo) */
  const readTime=t=>clamp(t.length*58+900,1800,5200);
  /* si la voz está activada, espera a que termine de hablar antes de dar el turno al siguiente */
  async function waitVoice(id,max){
    const t0=performance.now();
    while(Voice.busy()&&performance.now()-t0<(max||5000)){ await wait(120); if(!alive(id)) return; }
  }
  /* charla dinámica entre personajes con turnos estrictos: habla uno, se calla, y solo entonces habla el siguiente.
     Cast.say() ya garantiza que nunca haya dos globos ni dos bocas activas. */
  function converse(id,lines){
    return (async()=>{
      const mode=Settings.get('anim'); let prev=null;
      for(const raw of lines){
        if(!alive(id)) return;
        const ln=Object.assign({},raw,{text:fill(raw.text)});
        if(prev) await wait(mode==='off'?90:mode==='reduced'?320:(prev.who!==ln.who?480:320));
        if(!alive(id)) return;
        Cast.show(ln.who,ln.mood);
        Cast.say(ln.who,ln.text,60000);
        Sound.sfx.blip(ln.who); UI.announce(((ROSTER[ln.who]||{}).name||'')+': '+ln.text); Voice.speak(ln.text,ln.who);
        await wait(readTime(ln.text)); await waitVoice(id,4500);
        Cast.hush(ln.who); prev=ln;
      }
    })();
  }
  function cancelFlow(){
    flowId++;
    waiters.forEach(w=>{ clearTimeout(w.t); w.rej(CANCEL); }); waiters.clear();
    Dialogue.abort(); Voice.stop(); Cast.clearSay(); Cast.clearSpeaking(); FX.clear();
  }
  async function run(fn){
    cancelFlow(); const id=flowId;
    try{ await fn(id); }
    catch(e){ if(e!==CANCEL){ console.error(e); UI.toast('Algo salió mal en la escena. Vuelve al menú e inténtalo de nuevo.','warn'); } }
  }
  const alive=id=>id===flowId;

  /* ── estados y paneles ── */
  function showPanel(name){ panels.forEach(p=>{ p.hidden=p.dataset.panel!==name; }); document.body.classList.toggle('dlg-open',name==='dialogue'); }
  function setState(s){ state=s; document.body.dataset.state=s; $('titleScreen').hidden=s!=='menu'; syncNav(); }
  function syncNav(){
    const active=Modals.current()||(state==='menu'?null:'hall');
    $$('.nav-btn').forEach(b=>{ if(b.dataset.nav===active) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  }
  function ensureVisible(){
    if(innerWidth>900) return;
    $('dock').scrollIntoView({block:'start',behavior:Settings.get('anim')==='off'?'auto':'smooth'});
  }

  /* ── formulario ── */
  function fieldEl(k){ return document.querySelector('.field[data-key="'+k+'"]'); }
  function setFieldError(k,msg){
    const f=fieldEl(k),inp=$(k),err=$(k+'-err');
    f.classList.toggle('invalid',!!msg); err.textContent=msg||''; inp.setAttribute('aria-invalid',msg?'true':'false');
  }
  function validateField(k,strict){
    const r=Grade.checkField(k,$(k).value);
    if(r.empty){ setFieldError(k,strict?r.msg:''); return false; }
    setFieldError(k,r.msg||''); return r.value!==undefined;
  }
  function resetForm(){ form.reset(); Grade.KEYS.forEach(k=>setFieldError(k,'')); $('formError').textContent=''; }
  function onSubmit(e){
    e.preventDefault();
    if(state!=='input') return;
    const vals={}; let firstBad=null;
    Grade.KEYS.forEach(k=>{ const r=Grade.checkField(k,$(k).value); setFieldError(k,r.msg||''); if(r.value===undefined){ if(!firstBad) firstBad=k; } else vals[k]=r.value; });
    if(firstBad){ $('formError').textContent='Revisa las casillas marcadas: cada una necesita un número dentro de su límite.'; $(firstBad).focus(); Sound.sfx.defeat(); return; }
    $('formError').textContent=''; pending=vals; Sound.sfx.page();
    const ul=$('recap'); ul.textContent='';
    Grade.KEYS.forEach(k=>{ const li=el('li'); li.append(el('span',null,Grade.LABELS[k]),el('b',null,vals[k]+' / '+Grade.LIMITS[k])); ul.appendChild(li); });
    setState('review'); showPanel('review'); ensureVisible(); $('deliverBtn').focus({preventScroll:true});
  }

  /* ── flujo: entrada ── */
  function startEval(){
    Sound.ensure(); Sound.sfx.click();
    /* la audiencia anterior queda en la memoria del rey; las elecciones de esa audiencia se olvidan */
    if(result&&result.committed) ctx.prev={nf:result.nf,tier:result.tier};
    ctx.intro=ctx.escriba=ctx.ready=null;
    resetForm(); pending=null; result=null; card.classList.remove('pending','revealing');
    run(async id=>{
      Cast.hideAll(); Cast.show('rey','pleased'); setState('intro'); Music.setMood('castillo');
      await Dialogue.play(introSteps()); if(!alive(id)) return;
      const choice=await Dialogue.choose(INTRO_CHOICES); if(!alive(id)) return;
      ctx.intro=choice.id;
      await Dialogue.play([INTRO_REPLY[choice.id]]); if(!alive(id)) return;
      seenIntro=true; setState('input'); showPanel('form'); ensureVisible();
      const first=Grade.KEYS.map($).find(i=>!i.value)||$('tareas'); first.focus({preventScroll:true});
    });
  }

  /* ── flujo: entrega, deliberación y veredicto ── */
  function deliver(){
    if(state!=='review'||!pending) return;
    const v=pending; result=Grade.compute(v); result.committed=false; ctx.escriba=ctx.ready=null;
    run(async id=>{
      Sound.ensure(); Sound.sfx.parchment(); setState('deliver'); Music.setMood('estudio');
      Cast.show('escriba','neutral');
      await Dialogue.play([{who:'escriba',mood:'neutral',text:'Recibo tu pergamino. Anoto: tareas '+v.tareas+', parciales '+v.parcial1+' y '+v.parcial2+', examen final '+v.examen+'. Todo queda asentado en el registro real.'}]); if(!alive(id)) return;
      const c1=await Dialogue.choose(ESCRIBA_CHOICES); if(!alive(id)) return;
      ctx.escriba=c1.id;
      await Dialogue.play([ESCRIBA_REPLY[c1.id]]); if(!alive(id)) return;
      /* el escriba acaba de pasar el pergamino: solo ahora entra el consejero, y habla de las cifras reales */
      Cast.show('consejero','thinking');
      await Dialogue.play([
        {who:'consejero',mood:'thinking',text:consejeroLine(v)},
        {who:'rey',mood:'pleased',text:'Excelente, Draven. Veamos qué trae este aprendiz ante mi trono… ¿Estás listo para conocer tu puntaje?'}]); if(!alive(id)) return;
      const c2=await Dialogue.choose(READY_CHOICES); if(!alive(id)) return;
      ctx.ready=c2.id;
      await Dialogue.play(READY_REPLY[c2.id]); if(!alive(id)) return;
      /* deliberación: escriba y consejero se retiran; el bufón y el caballero comentan, uno a la vez */
      setState('deliberate'); card.dataset.tier=''; card.classList.add('pending'); card.classList.remove('revealing');
      $('vStatus').textContent='El Consejo delibera'; $('vScore').textContent='0.00'; $('vSeal').className='v-seal'; $('vSeal').textContent='';
      showPanel('verdict'); ensureVisible(); Music.setMood('tension');
      Cast.setMood('rey','thinking'); Cast.hide('escriba'); Cast.hide('consejero');
      Cast.show('bufon','surprised'); Cast.show('caballero','stern');
      await converse(id,chatFor(DELIBERATE_CHAT,'delib')); if(!alive(id)) return;
      const long=Settings.get('anim')!=='off'; Sound.sfx.drumroll(long?1.7:.3); await wait(long?1400:300);
      await reveal(id);
    });
  }
  function countUp(target,id){
    return new Promise(res=>{
      const out=$('vScore');
      if(Settings.get('anim')==='off'){ out.textContent=fmt(target); res(); return; }
      const t0=performance.now(),dur=1300; let lastTick=0;
      const step=now=>{
        if(!alive(id)){ res(); return; }
        const p=clamp((now-t0)/dur,0,1),e=1-Math.pow(1-p,3);
        out.textContent=fmt(target*e);
        if(now-lastTick>85&&p<1){ lastTick=now; Sound.sfx.tick(); }
        if(p<1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }
  async function reveal(id){
    const r=result,tier=r.tier;
    card.dataset.tier=tier; card.classList.remove('pending'); card.classList.add('revealing');
    $('vStatus').textContent='Veredicto del Consejo';
    await countUp(r.nf,id); if(!alive(id)) return;
    $('vScore').textContent=fmt(r.nf);
    /* sello, luz y partículas */
    const seal=$('vSeal'); seal.className='v-seal';
    if(tier===0) seal.innerHTML='<svg class="ico" aria-hidden="true"><use href="#i-cracked"/></svg>'; else seal.textContent=tier;
    void seal.offsetWidth; seal.classList.add('stamp'); Sound.sfx.seal();
    const fl=$('flash'); fl.classList.remove('hit'); void fl.offsetWidth; fl.classList.add('hit');
    const sz=FX.size();
    if(tier===0){ FX.ash(34); const sc=$('scene'); sc.classList.remove('shake'); void sc.offsetWidth; sc.classList.add('shake'); Sound.sfx.defeat(); }
    else{
      Sound.sfx.victory();
      if(tier>=4){ FX.confetti(sz.W*.5,sz.H*.42,tier===5?110:70,FX.FEAST); }
      FX.spark(sz.W*.5,sz.H*.4,tier>=4?36:22,FX.GOLD);
      if(tier===5) FX.coinRain(36);
    }
    /* reacciones: cada uno recibe el veredicto con su ánimo; hablarán después de que el rey pronuncie su sentencia */
    Cast.show('rey',KING_MOOD[tier]); Cast.show('bufon',BUFON_MOOD[tier]); Cast.show('caballero',CABALLERO_MOOD[tier]);
    Music.setMood(tier===0?'misterio':tier>=4?'celebracion':'castillo');
    /* textos del veredicto */
    $('vGrade').textContent=Grade.CAP[tier];
    $('vKingText').textContent=KING_LINE[tier];
    $('vCouncil').textContent=Grade.CATEGORY_TEXT[tier];
    const goal=Grade.nextGoal(r.nf,tier);
    $('vMeaning').textContent=tier===0?'Reprobado: te faltaron '+fmt(Grade.MIN-r.nf)+' puntos para aprobar.':'Aprobado con '+fmt(r.nf)+' de 100.'+(goal?' Te faltan '+fmt(goal.need)+' puntos para la nota '+goal.tier+'.':'');
    $('vNext').textContent=NEXT_MSG[tier];
    /* experiencia y crónica: se guardan una sola vez por evaluación */
    if(!r.committed){
      r.committed=true;
      const xp=GameState.xpForGrade(r.nf,tier), res=GameState.addXP(xp);
      Chronicle.add(r.nf,tier,xp);
      $('vXpText').textContent='+'+xp+' EXP'+(res.levelUp?' · ¡Subes al nivel '+GameState.level()+'!':'');
      Sound.sfx.coin(); if(res.levelUp){ setTimeout(()=>Sound.sfx.levelup(),700); UI.toast('¡Has subido al nivel '+GameState.level()+' — '+GameState.title()+'!'); }
    }
    UI.announce('Resultado: '+fmt(r.nf)+' de 100. '+Grade.CAP[tier]+'. '+KING_LINE[tier]);
    /* el rey pronuncia el veredicto: con globo, boca y voz sincronizados como en el resto de la corte */
    Cast.say('rey',KING_LINE[tier],60000); Voice.speak(KING_LINE[tier],'rey');
    await wait(Math.min(4200,KING_LINE[tier].length*55)); await waitVoice(id,6500); Cast.hush('rey');
    await wait(500);
    card.classList.remove('revealing'); setState('verdict');
    $('vGrade').focus({preventScroll:true});
    if(innerWidth<=900) card.scrollIntoView({block:'nearest',behavior:Settings.get('anim')==='off'?'auto':'smooth'});
    /* turno de la corte: el bufón y el caballero hablan solo cuando el rey ya terminó; se cancela con la escena */
    converse(id,chatFor(CONSEJO_REACT[tier].concat(TREND),'react'+tier)).catch(e=>{ if(e!==CANCEL) console.error(e); });
  }

  /* ── navegación ── */
  async function toMenu(){
    if(state==='deliver'||state==='deliberate'){
      const ok=await Modals.confirm({title:'¿Volver al menú?',text:'La audiencia está en curso. Si sales ahora, tendrás que presentar el pergamino de nuevo.',yes:'Volver al menú'});
      if(!ok) return;
    }
    cancelFlow(); Modals.closeAll(); UI.closeMusic(); closeNav();
    Cast.hideAll(); card.classList.remove('pending','revealing'); pending=null; ctx.intro=ctx.escriba=ctx.ready=null;
    setState('menu'); showPanel('idle'); Music.setMood('castillo');
    $('startBtn').focus({preventScroll:true}); scrollTo(0,0);
  }
  function goHall(){ if(state==='menu') startEval(); else{ Modals.closeAll(); closeNav(); $('dock').focus({preventScroll:true}); } }
  function navigate(key){
    closeNav(); Sound.sfx.click();
    if(key==='hall') goHall(); else Modals.open(key);
  }
  function closeNav(){ $('mainNav').classList.remove('open'); $('menuBtn').setAttribute('aria-expanded','false'); }

  function init(){
    Cast.mount(); UI.initDust(); UI.bindSettings(); UI.initMusicPanel();
    GameState.render(); Chronicle.renderSummary(); Music.updateUI(); Music.armAutostart();
    showPanel('idle'); setState('menu');
    form.addEventListener('submit',onSubmit);
    Grade.KEYS.forEach(k=>{ const inp=$(k); inp.addEventListener('input',()=>{ if(fieldEl(k).classList.contains('invalid')||inp.value.trim()!=='') validateField(k,false); $('formError').textContent=''; }); inp.addEventListener('blur',()=>{ if(inp.value.trim()!=='') validateField(k,false); }); });
    $('clearBtn').addEventListener('click',()=>{ resetForm(); $('tareas').focus(); });
    $('reviseBtn').addEventListener('click',()=>{ if(state!=='review') return; setState('input'); showPanel('form'); $('tareas').focus(); });
    $('deliverBtn').addEventListener('click',deliver);
    $('btnNueva').addEventListener('click',()=>{ if(state==='verdict') startEval(); });
    $('btnCronica').addEventListener('click',()=>Modals.open('cronica'));
    $('btnMenu').addEventListener('click',toMenu);
    $('brandBtn').addEventListener('click',toMenu);
    $$('[data-nav]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.nav)));
    $('menuBtn').addEventListener('click',()=>{ const o=$('mainNav').classList.toggle('open'); $('menuBtn').setAttribute('aria-expanded',String(o)); });
    $('clearChronBtn').addEventListener('click',async()=>{
      if(!Chronicle.count()) return;
      const ok=await Modals.confirm({title:'¿Limpiar el historial?',text:'Se borrarán todas las evaluaciones de la crónica. Tu experiencia y nivel se conservan.',yes:'Limpiar historial'});
      if(ok){ Chronicle.clear(); UI.toast('Historial limpiado.'); }
    });
    $('titleMenu').addEventListener('keydown',e=>{
      if(e.key!=='ArrowDown'&&e.key!=='ArrowUp') return;
      const items=$$('.menu-item'),i=items.indexOf(document.activeElement); if(i<0) return;
      e.preventDefault(); items[(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();
    });
    document.addEventListener('keydown',e=>{
      const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if(e.key==='Escape'){
        if(Modals.isOpen) Modals.closeTop(); else if(UI.musicOpen){ UI.closeMusic(); $('musicBtn').focus(); } else closeNav();
        return;
      }
      if((e.key==='m'||e.key==='M')&&!typing&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!Modals.isOpen){ Music.toggle(); return; }
      if((e.key==='Enter'||e.key===' ')&&Dialogue.active&&!Modals.isOpen&&!e.target.closest('button,a,input,select,textarea,[role="switch"],[role="radio"]')){ e.preventDefault(); Dialogue.next(); }
    });
    addEventListener('storage',e=>{ if(e.key&&e.key.indexOf('aldemar_')===0){ GameState.reload(); Chronicle.reload(); } });
    $('startBtn').focus({preventScroll:true});
  }
  return {init,showPanel,syncNav};
})();

App.init();
})();
