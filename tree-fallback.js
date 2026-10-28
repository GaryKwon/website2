/* Weather Tree — an animated, resolution-independent botanical scene. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const palettes = {
    spring: ['#759862','#8ba973','#9bbd80','#a9c68b','#658757','#b6ce92','#86a66c'],
    summer: ['#4e7455','#60815d','#749568','#86a471','#587b54','#9bb47a','#6b8a5d'],
    autumn: ['#b76e3d','#c98146','#d89a52','#ac633b','#d4a35a','#bb7a48','#e0b470','#996244'],
    winter: ['#a58c6d','#b6a18a','#c1b3a1']
  };
  const rainCodes = new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,97,99]);
  function weatherTone(weather) {
    return `${rainCodes.has(weather.code)?'rain':weather.code<=1?'clear':'overcast'}-${weather.temp<5?'cold':'mild'}`;
  }
  function tintPalette(colors, weather) {
    const rainy=rainCodes.has(weather.code),cold=weather.temp<5,clear=weather.code<=1;
    return colors.map(hex=> {
      const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
      const grey=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
      const saturation=cold?.82:rainy?1.04:1,brightness=rainy?.91:cold?.98:1;
      return '#'+rgb.map((channel,i)=> {
        const warmth=clear&&!cold?[1.018,1,.975][i]:1;
        return Math.round(Math.max(0,Math.min(255,(grey+(channel-grey)*saturation)*brightness*warmth))).toString(16).padStart(2,'0');
      }).join('');
    });
  }
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const skeleton = [
    [[401,548,27],[391,516,25],[397,480,23],[399,441,20],[398,405,18],[391,370,15],[401,335,12],[402,293,9],[414,251,6],[405,217,3],[414,181,1]],
    [[398,444,15],[361,416,13],[330,378,10],[289,356,7],[252,325,4],[209,313,.8]],
    [[330,378,8],[286,387,6],[251,370,3],[214,372,.8]],
    [[289,356,7],[286,318,5],[263,285,3],[231,273,.7]],
    [[394,390,13],[363,352,11],[347,313,8],[311,289,5],[290,253,3],[259,235,.7]],
    [[348,313,7],[346,273,5],[327,235,3],[294,211,.8]],
    [[398,334,10],[376,297,8],[373,259,5],[351,225,3],[355,190,.8]],
    [[373,259,5],[390,222,3],[387,181,.7]],
    [[398,409,15],[444,388,12],[478,362,9],[517,348,6],[553,321,3],[596,311,.8]],
    [[478,362,8],[484,325,6],[510,292,3],[530,254,.7]],
    [[517,348,6],[549,372,3],[573,353,.7]],
    [[398,371,13],[435,338,11],[457,302,8],[481,269,5],[492,229,2],[516,211,.7]],
    [[456,302,7],[441,262,5],[446,224,3],[434,184,.8]],
    [[482,269,5],[521,260,3],[549,276,.7]],
    [[401,294,8],[421,265,6],[427,229,4],[457,200,.8]],
    [[363,352,8],[328,341,5],[300,316,2],[272,320,.7]],
    [[444,388,8],[460,357,5],[439,322,2],[430,299,.7]]
  ];
  const crowns = [
    [202,320,42],[226,278,46],[255,240,48],[294,210,43],[341,184,43],
    [390,167,46],[437,181,44],[483,201,45],[529,228,44],[565,270,46],
    [594,309,44],[571,352,44],[528,377,45],[483,348,49],[437,316,47],
    [382,302,48],[328,315,47],[282,350,44],[238,368,40],[354,247,45],
    [414,226,48],[463,264,47],[520,305,45],[310,272,46],[398,375,38]
  ];
  function smoothPoints(points) {
    const out=[];
    for(let i=0;i<points.length-1;i++) {
      const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];
      for(let j=0;j<9;j++) {
        const t=j/9,t2=t*t,t3=t2*t;
        out.push([.5*((2*b[0])+(-a[0]+c[0])*t+(2*a[0]-5*b[0]+4*c[0]-d[0])*t2+(-a[0]+3*b[0]-3*c[0]+d[0])*t3),.5*((2*b[1])+(-a[1]+c[1])*t+(2*a[1]-5*b[1]+4*c[1]-d[1])*t2+(-a[1]+3*b[1]-3*c[1]+d[1])*t3),b[2]+(c[2]-b[2])*t]);
      }
    }
    out.push(points[points.length-1]);return out;
  }
  function leaf(ctx,x,y,length,width,angle,color,alpha=1,vein=false) {
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=alpha;
    ctx.beginPath();ctx.moveTo(-length*.52,0);ctx.bezierCurveTo(-length*.16,-width*.68,length*.38,-width*.6,length*.56,0);ctx.bezierCurveTo(length*.20,width*.54,-length*.2,width*.63,-length*.52,0);ctx.fillStyle=color;ctx.fill();
    if(vein){ctx.beginPath();ctx.moveTo(-length*.4,0);ctx.lineTo(length*.43,0);ctx.strokeStyle='rgba(255,244,202,.2)';ctx.lineWidth=.45;ctx.stroke();}
    ctx.restore();
  }
  class TreeScene {
    constructor(canvas) {
      this.canvas=canvas;this.ctx=canvas.getContext('2d');this.weather={season:'autumn',code:1,wind:8,isDay:true,temp:16,cloudCover:0,solar:null};
      this.motion=window.matchMedia('(prefers-reduced-motion: reduce)');this.time=0;this.last=0;this.alive=true;
      this.sprites=[];this.makeTree();this.resize= this.resize.bind(this);this.tick=this.tick.bind(this);
      this.observer=new ResizeObserver(this.resize);this.observer.observe(canvas);this.resize();
      this.frame=requestAnimationFrame(this.tick);
    }
    resize() {
      const box=this.canvas.getBoundingClientRect();this.width=box.width||800;this.height=box.height||650;
      this.dpr=Math.min(window.devicePixelRatio||1,2);this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);
      this.draw();
    }
    setWeather(next={}) {
      const previous=this.weather.season,previousTone=weatherTone(this.weather);Object.assign(this.weather,next);
      if(!palettes[this.weather.season])this.weather.season='autumn';
      if(previous!==this.weather.season||previousTone!==weatherTone(this.weather))this.makeTree();
      this.draw();
    }
    makeTree() {
      const season=this.weather.season,colors=tintPalette(palettes[season],this.weather),random=rng(439201);this.palette=colors;this.sprites=[];this.specks=[];
      // A bare winter crown uses real branch tips, so every remaining leaf is attached.
      const foliagePositions=season==='winter'?skeleton.map(path=>{const tip=path[path.length-1];return [tip[0],tip[1],0];}):crowns;
      foliagePositions.forEach(([x,y,r],index)=> {
        const sprite=document.createElement('canvas');sprite.width=240;sprite.height=240;const ctx=sprite.getContext('2d');ctx.scale(2,2);ctx.translate(60,60);
        const count=season==='winter'?1:season==='autumn'?71:season==='spring'?118:143;
        // Individual tapered leaves leave little windows through the crown.
        for(let j=0;j<count;j++) {
          const a=random()*TAU;const dist=Math.sqrt(random())*r*(.69+.30*Math.sin(a*3+index));
          const lx=Math.cos(a)*dist,ly=Math.sin(a)*dist*.85;
          const len=4+random()*6.3;const tone=colors[Math.floor(random()*colors.length)];
          if(season==='winter'&&random()>.28)continue;
          leaf(ctx,lx,ly,len,len*(.40+random()*.28),a*.5+random()*2.2,tone,.69+random()*.31,j%6===0);
          if(season==='spring'&&j%19===0) {
            ctx.fillStyle=['#efe2ce','#e8d4c3','#f5eee0'][j%3];
            for(let k=0;k<5;k++){const pa=k*TAU/5;ctx.beginPath();ctx.ellipse(lx+Math.cos(pa)*2,ly+Math.sin(pa)*2,1.8,1.4,pa,0,TAU);ctx.fill();}
            ctx.fillStyle='#c6ad76';ctx.fillRect(lx-.6,ly-.6,1.2,1.2);
          }
        }
        this.sprites.push({image:sprite,x,y,r,phase:random()*TAU,rate:.7+random()*.6});
      });
      for(let i=0;i<80;i++) {
        const crown=crowns[Math.floor(random()*crowns.length)];
        this.specks.push({x:crown[0]+(random()-.5)*crown[2]*1.7,y:crown[1]+(random()-.5)*crown[2]*1.4,size:4+random()*4,phase:random()*TAU,color:colors[Math.floor(random()*colors.length)]});
      }
      this.ground=[];
      for(let i=0;i<(season==='autumn'?74:season==='winter'?5:10);i++)this.ground.push({x:260+random()*285,y:546+random()*38,length:3+random()*5,angle:random()*TAU,color:colors[Math.floor(random()*colors.length)]});
    }
    tick(now) {
      if(!this.alive)return;
      // Cap painting at 30fps, while letting the browser pause hidden tabs.
      if(now-this.last>32){this.time=this.motion.matches?0:now/1000;this.last=now;this.draw();}
      this.frame=requestAnimationFrame(this.tick);
    }
    atmosphere(ctx,t) {
      const {code,isDay,wind,cloudCover}=this.weather;
      const rain=rainCodes.has(code),snow=[71,73,75,77,85,86].includes(code);
      const coverage=Number.isFinite(cloudCover)?Math.max(0,Math.min(100,cloudCover))/100:code>=3?.9:code===2?.5:code===1?.15:0;
      const cloudy=code>=2||coverage>=.25;
      // Solar motion follows real time, independently of decorative/reduced motion.
      const solar=window.SolarClock.getState(this.weather.solar||{isDay},Date.now());
      if(solar.visible) {
        const {x,y}=solar;
        const dim=Math.max(.34,1-coverage*.44-(rain||snow?.12:0));
        ctx.save();ctx.globalAlpha=solar.opacity;
        const g=ctx.createRadialGradient(x,y,8,x,y,66);g.addColorStop(0,`rgba(225,186,108,${.16*dim})`);g.addColorStop(1,'rgba(238,211,152,0)');ctx.fillStyle=g;ctx.fillRect(x-70,y-70,140,140);
        ctx.beginPath();ctx.arc(x,y,23,0,TAU);ctx.fillStyle=`rgba(228,193,127,${.64*dim})`;ctx.fill();
        ctx.restore();
      } else if(!solar.isDay&&!cloudy) {
        // The quiet crescent remains in the night sky after the sun has set.
        const x=578,y=130;const g=ctx.createRadialGradient(x,y,8,x,y,66);g.addColorStop(0,'rgba(197,210,211,.12)');g.addColorStop(1,'rgba(238,211,152,0)');ctx.fillStyle=g;ctx.fillRect(x-70,y-70,140,140);
        ctx.beginPath();ctx.arc(x,y,18,0,TAU);ctx.fillStyle='rgba(218,226,220,.7)';ctx.fill();
        ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(x+8,y-6,16,0,TAU);ctx.fill();ctx.globalCompositeOperation='source-over';
      }
      if(cloudy) {
        this.cloud(ctx,219+Math.sin(t*.06)*13,142,1,rain||snow?.58:.42);
        this.cloud(ctx,555+Math.sin(t*.045+2)*18,176,.77,rain||snow?.5:.30);
        if(code>=3)this.cloud(ctx,416+Math.sin(t*.05)*12,111,.66,.3);
      }
      if(solar.visible&&cloudy) {
        // Offset the cloud below/right so a part of the warm disk always peeks out.
        const drift=Math.sin(t*.045)*8;
        this.cloud(ctx,solar.x+25+drift,solar.y+20,.50,(.34+coverage*.16)*solar.opacity);
      }
      if(rain||snow) {
        const rnd=rng(1182);const amount=snow?62:(code===65||code===82||code>=95?145:85);
        const reduced=this.motion.matches;
        for(let i=0;i<amount;i++) {
          const speed=snow?19+rnd()*20:210+rnd()*145,seedX=145+rnd()*515,seedY=rnd()*550;
          const y=90+((seedY+(reduced?0:t*speed))%480);const drift=wind*.26;
          const x=seedX+(snow?Math.sin(t*.8+i)*9:0)+((y-90)/480)*drift;
          if(snow){ctx.beginPath();ctx.arc(x,y,1.3+rnd()*1.7,0,TAU);ctx.fillStyle='rgba(255,255,255,.84)';ctx.fill();}
          else {ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+2+wind*.05,y-9-rnd()*8);ctx.strokeStyle='rgba(116,149,153,.30)';ctx.lineWidth=.8;ctx.stroke();}
        }
      }
      if(wind>16) {
        const rnd=rng(53);ctx.lineWidth=.8;ctx.strokeStyle='rgba(130,148,134,.23)';
        for(let i=0;i<5;i++){const y=240+rnd()*260;const x=125+((rnd()*520+(this.motion.matches?0:t*wind*1.3))%530);ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+12,y-2,x+26,y+3,x+39,y-1);ctx.stroke();}
      }
    }
    cloud(ctx,x,y,scale,opacity) {
      ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.globalAlpha=opacity;
      ctx.beginPath();ctx.moveTo(-61,15);ctx.bezierCurveTo(-82,13,-81,-11,-58,-16);ctx.bezierCurveTo(-57,-40,-20,-46,-6,-26);ctx.bezierCurveTo(14,-51,48,-31,46,-10);ctx.bezierCurveTo(79,-14,87,17,58,19);ctx.closePath();
      const g=ctx.createLinearGradient(0,-40,0,20);g.addColorStop(0,'#ffffff');g.addColorStop(1,'#ccd6d0');ctx.fillStyle=g;ctx.fill();ctx.restore();
    }
    branch(ctx,points) {
      const pts=smoothPoints(points),left=[],right=[];
      for(let i=0;i<pts.length;i++) {
        const p=pts[i],prev=pts[Math.max(0,i-1)],next=pts[Math.min(pts.length-1,i+1)];const a=Math.atan2(next[1]-prev[1],next[0]-prev[0])+Math.PI/2;
        left.push([p[0]+Math.cos(a)*p[2]/2,p[1]+Math.sin(a)*p[2]/2]);right.push([p[0]-Math.cos(a)*p[2]/2,p[1]-Math.sin(a)*p[2]/2]);
      }
      ctx.beginPath();ctx.moveTo(...left[0]);for(let i=1;i<left.length;i++)ctx.lineTo(...left[i]);for(let i=right.length-1;i>=0;i--)ctx.lineTo(...right[i]);ctx.closePath();
      const grad=ctx.createLinearGradient(360,0,425,0);grad.addColorStop(0,'#76604c');grad.addColorStop(.45,'#685447');grad.addColorStop(.7,'#7f6955');grad.addColorStop(1,'#604d42');ctx.fillStyle=grad;ctx.fill();
      if(points[0][2]>9){ctx.beginPath();const offset=points[0][2]*.13;pts.forEach((p,i)=>i?ctx.lineTo(p[0]-offset,p[1]):ctx.moveTo(p[0]-offset,p[1]));ctx.strokeStyle='rgba(205,177,136,.13)';ctx.lineWidth=.8;ctx.stroke();}
    }
    draw() {
      if(!this.ctx||!this.width)return;const ctx=this.ctx,t=this.time,{season,wind,code}=this.weather;
      ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,this.width,this.height);
      const scale=Math.min(this.width/600,this.height/570);
      const offsetY=window.innerWidth<=680?this.height-590*scale:(this.height-650*scale)/2;
      ctx.translate((this.width-800*scale)/2,offsetY);ctx.scale(scale,scale);
      this.atmosphere(ctx,t);
      // Grounding shadow, with an organic wash instead of a solid pedestal.
      const shadow=ctx.createRadialGradient(400,553,5,400,553,168);shadow.addColorStop(0,'rgba(78,90,64,.12)');shadow.addColorStop(.65,'rgba(111,118,86,.045)');shadow.addColorStop(1,'rgba(111,118,86,0)');
      ctx.save();ctx.translate(400,553);ctx.scale(1,.17);ctx.translate(-400,-553);ctx.fillStyle=shadow;ctx.fillRect(220,373,360,360);ctx.restore();
      const grass=rng(511);ctx.lineWidth=.8;
      for(let i=0;i<44;i++){const x=290+grass()*218,y=550+grass()*14;ctx.strokeStyle=season==='winter'?'rgba(153,149,133,.24)':'rgba(115,134,87,.35)';ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x-2+grass()*4,y-4,x-4+grass()*8,y-5-grass()*6);ctx.stroke();}
      this.ground.forEach(g=>leaf(ctx,g.x,g.y,g.length,g.length*.48,g.angle,g.color,.70));
      if([71,73,75,77,85,86].includes(code)) {ctx.beginPath();ctx.ellipse(401,557,101,9,0,0,TAU);ctx.fillStyle='rgba(255,255,255,.72)';ctx.fill();}
      // Tapered roots meet the ground naturally.
      this.branch(ctx,[[398,524,17],[387,542,13],[368,550,5],[345,552,.3]]);
      this.branch(ctx,[[400,530,16],[412,547,10],[433,551,3],[454,551,.3]]);
      this.branch(ctx,[[399,534,13],[396,551,8],[388,559,.5]]);
      ctx.save();ctx.translate(400,548);
      const strength=Math.min(1.7,Math.max(.15,Number(wind||0)/22));const sway=Math.sin(t*.75)*.004*strength+Math.sin(t*1.53)*.0012*strength;ctx.rotate(sway);ctx.translate(-400,-548);
      // A few distant leaves under the branches create depth.
      if(season!=='winter')for(let i=0;i<9;i++){const p=this.sprites[i];ctx.save();ctx.globalAlpha=.64;ctx.drawImage(p.image,p.x-60,p.y-60,120,120);ctx.restore();}
      skeleton.forEach(p=>this.branch(ctx,p));
      // Fine twig fans are visible through gaps, especially during winter.
      const twigRandom=rng(145);ctx.strokeStyle='rgba(102,82,67,.75)';ctx.lineCap='round';
      if(season==='winter') {
        skeleton.forEach(path=>{
          const tip=path[path.length-1],previous=path[path.length-2];
          const direction=Math.atan2(tip[1]-previous[1],tip[0]-previous[0]);
          for(let j=0;j<2;j++) {
            const angle=direction+(j===0?-.45:.45),len=7+twigRandom()*10;
            ctx.beginPath();ctx.moveTo(tip[0],tip[1]);
            ctx.quadraticCurveTo(tip[0]+Math.cos(direction)*len*.45,tip[1]+Math.sin(direction)*len*.45,tip[0]+Math.cos(angle)*len,tip[1]+Math.sin(angle)*len);ctx.lineWidth=.6;ctx.stroke();
          }
        });
      } else {
        crowns.forEach((c,i)=>{
          for(let j=0;j<3;j++){const angle=twigRandom()*TAU;const len=12+twigRandom()*22;ctx.beginPath();ctx.moveTo(c[0],c[1]+15);ctx.quadraticCurveTo(c[0]+Math.cos(angle)*len*.4,c[1]+Math.sin(angle)*len*.5,c[0]+Math.cos(angle)*len,c[1]+Math.sin(angle)*len);ctx.lineWidth=.7;ctx.stroke();}
        });
      }
      this.sprites.forEach((p,i)=> {
        const motion=Math.sin(t*p.rate+p.phase)*.013*strength;ctx.save();ctx.translate(p.x+Math.sin(t*.9+p.phase)*1.2*strength,p.y);ctx.rotate(motion);ctx.drawImage(p.image,-60,-60,120,120);ctx.restore();
      });
      if(season!=='winter')this.specks.forEach(p=>leaf(ctx,p.x+Math.sin(t*1.6+p.phase)*1.4*strength,p.y+Math.cos(t+p.phase)*.65*strength,p.size,p.size*.52,p.phase+Math.sin(t*1.7+p.phase)*.12*strength,p.color,.84));
      if([71,73,75,77,85,86].includes(code)&&season==='winter') {
        ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=3;ctx.lineCap='round';
        [[[286,386],[313,383]],[[446,386],[469,369]],[[306,287],[326,297]],[[519,348],[540,362]]].forEach(p=>{ctx.beginPath();ctx.moveTo(...p[0]);ctx.lineTo(...p[1]);ctx.stroke();});
      }
      ctx.restore();
      // A handful of drifting autumn leaves responds to the real wind.
      if(season==='autumn'&&wind>5)for(let i=0;i<6;i++){const duration=9+i*.8;const progress=this.motion.matches?(i*.13):((t/duration+i*.171)%1);const x=290+i*43+Math.sin(progress*7+i)*18+progress*Math.min(75,wind*1.2);const y=304+progress*252;leaf(ctx,x,y,6.5,3.4,progress*8+i,this.palette[i],Math.sin(progress*Math.PI)*.7);}
    }
    destroy() {this.alive=false;cancelAnimationFrame(this.frame);this.observer.disconnect();this.sprites=[];this.specks=[];}
  }
  window.FlatTreeScene=TreeScene;
})();
