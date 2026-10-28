/* Scanned snow / mud surfaces and bounded, accumulating ground weather. */
const RAIN=new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,97,99]);
const SNOW=new Set([71,73,75,77,85,86]);
const TAU=Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{const n=clamp(v);return n*n*(3-2*n);};

export class GroundWeather {
  constructor(host) {
    this.host=host;this.T=host.T;this.disposed=false;
    this.controller=new AbortController();this.images=new Set();this.textures=[];
    this.assetsReady=0;this.assetsFailed=0;this.requestsActive=0;this.assetsExpected=6;
    this.snowLevel=0;this.wetLevel=0;this.snowTarget=0;this.wetTarget=0;this.locationKey=null;
    this.group=new this.T.Group();this.group.name='Accumulating snow and rain';host.platform.add(this.group);
    const snowColor=this.loadTexture('ground-snow-color.jpg',true,1.8);
    const snowNormal=this.loadTexture('ground-snow-normal.jpg',false,1.8);
    const snowRough=this.loadTexture('ground-snow-roughness.jpg',false,1.8);
    const mudColor=this.loadTexture('ground-mud-color.jpg',true,1.4);
    const mudNormal=this.loadTexture('ground-mud-normal.jpg',false,1.4);
    this.waterNormal=this.loadTexture('ground-water-normal.jpg',false,1.5);
    this.snowDay=new this.T.Color('#f6f8f5');this.snowNight=new this.T.Color('#becbe1');
    this.waterDay=new this.T.Color('#718a8c');this.waterNight=new this.T.Color('#405974');
    this.snowMaterial=host.ownMaterial(new this.T.MeshPhysicalMaterial({map:snowColor,normalMap:snowNormal,normalScale:new this.T.Vector2(.34,.34),roughnessMap:snowRough,roughness:.97,color:this.snowDay,metalness:0,clearcoat:.07,clearcoatRoughness:.84,transparent:true,opacity:0,depthWrite:true}));
    this.snow=new this.T.Mesh(this.snowGeometry(),this.snowMaterial);this.snow.position.y=.066;this.snow.receiveShadow=true;this.snow.visible=false;this.group.add(this.snow);
    this.wetMaterial=host.ownMaterial(new this.T.MeshStandardMaterial({map:mudColor,normalMap:mudNormal,normalScale:new this.T.Vector2(.22,.22),color:'#a6ad9e',roughness:.42,metalness:.03,transparent:true,opacity:0,depthWrite:false}));
    this.wetGround=new this.T.Mesh(host.ownGeometry(new this.T.CircleGeometry(1.584,64)),this.wetMaterial);this.wetGround.rotation.x=-Math.PI/2;this.wetGround.position.y=.0665;this.wetGround.receiveShadow=true;this.wetGround.visible=false;this.group.add(this.wetGround);
    this.environment=this.makeReflection();
    this.waterMaterial=host.ownMaterial(new this.T.MeshPhysicalMaterial({color:this.waterDay,normalMap:this.waterNormal,normalScale:new this.T.Vector2(.085,.085),roughness:.16,metalness:.025,clearcoat:.65,clearcoatRoughness:.12,ior:1.333,envMap:this.environment,envMapIntensity:.72,transparent:true,opacity:0,depthWrite:false}));
    this.puddles=[];
    const shapes=[[-.79,.62,.65,.41,.18],[.73,.61,.66,.46,-.4],[1.02,-.43,.42,.60,.32],[-.74,-.66,.63,.36,-.23],[.16,-1.14,.48,.23,.06]];
    shapes.forEach(([x,z,sx,sz,angle],i)=>{
      const mesh=new this.T.Mesh(this.puddleGeometry(i+2),this.waterMaterial);mesh.position.set(x,.074+i*.0002,z);mesh.rotation.y=angle;mesh.userData.sx=sx;mesh.userData.sz=sz;mesh.visible=false;mesh.receiveShadow=true;this.group.add(mesh);this.puddles.push(mesh);
    });
    this.rippleGeometry=host.ownGeometry(new this.T.RingGeometry(.94,1,40));
    this.ripples=[];
    const drops=[[-.74,.63],[.75,.63],[1.04,-.45],[-.73,-.65],[.16,-1.15],[.98,.68]];
    drops.forEach(([x,z],i)=>{
      const material=host.ownMaterial(new this.T.MeshBasicMaterial({color:'#d9e9ee',transparent:true,opacity:0,depthWrite:false,side:this.T.DoubleSide,toneMapped:false}));
      const mesh=new this.T.Mesh(this.rippleGeometry,material);mesh.position.set(x,.079+i*.0001,z);mesh.rotation.x=-Math.PI/2;mesh.userData.phase=i*.173;mesh.visible=false;this.group.add(mesh);this.ripples.push(mesh);
    });
    this.applyLevels(0);
  }
  loadTexture(file,color,repeat) {
    const T=this.T,c=document.createElement('canvas');c.width=c.height=1;
    const ctx=c.getContext('2d');ctx.fillStyle=color?'#d4d8ce':file.includes('normal')?'#8080ff':'#ffffff';ctx.fillRect(0,0,1,1);
    const texture=this.host.ownTexture(new T.CanvasTexture(c));texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(repeat,repeat);texture.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;texture.anisotropy=Math.min(4,this.host.renderer.capabilities.getMaxAnisotropy());
    this.textures.push(texture);this.requestsActive++;
    this.textureBlob(file).then(blob=>createImageBitmap(blob,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'})).then(bitmap=>{
      if(this.disposed){bitmap.close();return;}
      this.images.add(bitmap);texture.image=bitmap;texture.flipY=false;texture.needsUpdate=true;this.assetsReady++;
    }).catch(error=>{if(!this.disposed&&error.name!=='AbortError'){this.assetsFailed++;console.warn('Ground texture unavailable; retaining material fallback.',file,error);}}).finally(()=>{this.requestsActive=Math.max(0,this.requestsActive-1);});
    return texture;
  }
  async textureBlob(file) {
    const signal=this.controller.signal,url=new URL('./assets/'+file,import.meta.url);
    for(let attempt=0;attempt<2;attempt++) {
      try {
        const response=await fetch(url,{signal});
        if(!response.ok) {
          const error=new Error(`${file}: HTTP ${response.status}`);
          error.retryable=response.status>=500;throw error;
        }
        return await response.blob();
      } catch(error) {
        if(signal.aborted||error.name==='AbortError'||error.retryable===false||attempt===1)throw error;
        await new Promise((resolve,reject)=>{
          const cancel=()=>{clearTimeout(timer);reject(new DOMException('Ground load cancelled','AbortError'));};
          const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},250);
          signal.addEventListener('abort',cancel,{once:true});
        });
      }
    }
  }
  snowGeometry() {
    const T=this.T,segments=72,rings=18,positions=[],uv=[],indices=[];
    // A thick, slightly windblown blanket: the underside remains below the top
    // surface at its perimeter, avoiding an infinitely thin white disk.
    for(let ring=0;ring<=rings;ring++) {
      const t=ring/rings;
      for(let j=0;j<=segments;j++) {
        const a=j/segments*TAU;
        const edge=1.545+Math.sin(a*5+.7)*.018+Math.sin(a*9-1.2)*.012;
        const r=t*edge,x=Math.cos(a)*r,z=Math.sin(a)*r;
        const drift=.050+.045*Math.sin(x*2.7+z*.8)+.028*Math.cos(z*4.1-x*1.5)+.019*Math.sin(x*7.1+z*4.8);
        const mound=.10*Math.exp(-((x+.78)**2+(z-.40)**2)*3.8)+.07*Math.exp(-((x-.8)**2+(z+.6)**2)*6);
        const trunkDip=.044*Math.exp(-(x*x+z*z)*12);
        const edgeBlend=smooth((1-t)/.10);
        const h=Math.max(.015,drift+mound-trunkDip)*edgeBlend+.008;
        positions.push(x,h,z);uv.push(x/3.1+.5,z/3.1+.5);
        if(ring<rings&&j<segments){const k=ring*(segments+1)+j;indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
      }
    }
    const geometry=this.host.ownGeometry(new T.BufferGeometry());geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
  }
  puddleGeometry(seed) {
    const T=this.T,segments=64,rings=4,positions=[],uv=[],indices=[];
    for(let ring=0;ring<=rings;ring++)for(let j=0;j<=segments;j++) {
      const t=ring/rings,a=j/segments*TAU;
      const edge=.87+.105*Math.sin(a*3+seed)+.055*Math.cos(a*5-seed*.6)+.035*Math.sin(a*7+seed*2);
      const x=Math.cos(a)*edge*t,z=Math.sin(a)*edge*t;
      positions.push(x,0,z);uv.push(x*.5+.5,z*.5+.5);
      if(ring<rings&&j<segments){const k=ring*(segments+1)+j;indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
    }
    const geometry=this.host.ownGeometry(new T.BufferGeometry());geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
  }
  makeReflection() {
    // A tiny soft studio sky for water Fresnel/reflections. The actual water
    // detail comes from the bundled Three.js normal asset. No reflection pass.
    const T=this.T,c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d');
    const g=ctx.createLinearGradient(0,0,0,128);g.addColorStop(0,'#b4cad6');g.addColorStop(.38,'#d9e6e5');g.addColorStop(.49,'#a0b9ac');g.addColorStop(.52,'#506456');g.addColorStop(1,'#2c3c36');ctx.fillStyle=g;ctx.fillRect(0,0,256,128);
    for(const [x,y,w,h] of [[24,36,44,10],[103,24,62,15],[193,44,48,8]]){const glow=ctx.createRadialGradient(x,y,0,x,y,w);glow.addColorStop(0,'rgba(255,255,247,.86)');glow.addColorStop(1,'rgba(255,255,247,0)');ctx.save();ctx.translate(x,y);ctx.scale(1,h/w);ctx.translate(-x,-y);ctx.fillStyle=glow;ctx.fillRect(x-w,y-w,w*2,w*2);ctx.restore();}
    const texture=this.host.ownTexture(new T.CanvasTexture(c));texture.colorSpace=T.SRGBColorSpace;texture.mapping=T.EquirectangularReflectionMapping;return texture;
  }
  updateWeather(weather={}) {
    if(this.disposed)return;
    const location=weather.locationKey??weather.locationId;
    if(location!==undefined&&this.locationKey!==null&&location!==this.locationKey){this.snowLevel=0;this.wetLevel=0;}
    if(location!==undefined)this.locationKey=location;
    this.snowTarget=SNOW.has(Number(weather.code))?1:0;
    this.wetTarget=RAIN.has(Number(weather.code))?1:0;
    if(this.snowTarget&&this.snowLevel<.12)this.snowLevel=.12;
    if(this.wetTarget&&this.wetLevel<.10)this.wetLevel=.10;
    this.applyLevels(this.host.night||0);
  }
  applyLevels(night) {
    const snow=this.snowLevel,wet=this.wetLevel,visibleWet=wet*(1-smooth(snow));
    this.snow.visible=snow>.005;this.snowMaterial.opacity=smooth(snow*3);this.snowMaterial.color.lerpColors(this.snowDay,this.snowNight,night);
    this.snow.scale.set(.77+snow*.23,.14+snow*.86,.77+snow*.23);
    this.wetGround.visible=visibleWet>.005;this.wetMaterial.opacity=visibleWet*.82;this.wetMaterial.roughness=.54-visibleWet*.21;
    this.waterMaterial.opacity=smooth(visibleWet*2.8)*.58;this.waterMaterial.color.lerpColors(this.waterDay,this.waterNight,night);this.waterMaterial.envMapIntensity=.55-night*.26;
    for(const mesh of this.puddles){mesh.visible=visibleWet>.012;const scale=.15+.85*smooth(visibleWet);mesh.scale.set(mesh.userData.sx*scale,1,mesh.userData.sz*scale);}
    this.visibleWet=visibleWet;
  }
  update(time,deltaSeconds) {
    if(this.disposed)return;
    const dt=clamp(Number(deltaSeconds)||0,0,.35);
    this.snowLevel+=(this.snowTarget-this.snowLevel)*(1-Math.exp(-dt*(this.snowTarget?.20:this.wetTarget?.26:.14)));
    this.wetLevel+=(this.wetTarget-this.wetLevel)*(1-Math.exp(-dt*(this.wetTarget?.22:this.snowTarget?.32:.17)));
    this.snowLevel=clamp(this.snowLevel);this.wetLevel=clamp(this.wetLevel);this.applyLevels(this.host.night||0);
    const reduced=this.host.motion.matches;
    if(!reduced){this.waterNormal.offset.set((time*.008)%1,(time*.005)%1);}
    for(let i=0;i<this.ripples.length;i++) {
      const mesh=this.ripples[i],phase=((reduced?.3:time*.52)+mesh.userData.phase)%1;
      const radius=(.018+phase*.115)*(.25+.75*this.visibleWet);
      mesh.visible=this.wetTarget>0&&this.visibleWet>.18&&!reduced;
      mesh.scale.set(radius,radius,1);mesh.material.opacity=(1-phase)*.30*this.visibleWet;
    }
  }
  get assetsLoaded() { return this.assetsReady===this.assetsExpected; }
  getDiagnostics() {
    return {disposed:this.disposed,assetsLoaded:this.assetsLoaded,assetsReady:this.assetsReady,assetsExpected:this.assetsExpected,assetsFailed:this.assetsFailed,requestsActive:this.requestsActive,snowLevel:this.snowLevel,wetLevel:this.wetLevel,snowTarget:this.snowTarget,wetTarget:this.wetTarget,openBitmaps:this.images.size};
  }
  dispose() {
    if(this.disposed)return;
    this.disposed=true;this.controller.abort();this.group.removeFromParent();this.group.clear();
    for(const image of this.images)image.close();this.images.clear();
    // Host owns GPU disposal. Drop decoded image references before its resource
    // sweep; a fetch/decode finishing after this point closes its own bitmap.
    for(const texture of this.textures)texture.image=null;
    this.textures=[];this.puddles=[];this.ripples=[];this.host=null;this.T=null;
  }
}
