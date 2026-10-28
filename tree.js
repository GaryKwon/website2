/* A small living weather diorama. Each instance owns and releases its GPU resources. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const RAIN = new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,97,99]);
  const SNOW = new Set([71,73,75,77,85,86]);
  const PALETTES = {
    spring:['#a7be80','#b5ca91','#98b474','#a8c58a','#c3d7a0','#8fae74','#b8cd94','#a1bc83'],
    summer:['#728e65','#809b6d','#68865d','#8aa778','#78966a','#5f7f59','#9aaf80','#759267'],
    autumn:['#cb893d','#e0a447','#bb7134','#e6b258','#d39443','#c17b39','#dda653','#ce9148'],
    winter:['#a88b70','#aa947d','#b19d87','#aa8e75','#b5a28a','#ab927c','#c0ac91','#b29d83']
  };
  const clamp = (v,min=0,max=1) => Math.max(min,Math.min(max,v));
  const seeded = seed => () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15,1 | seed);
    t = t + Math.imul(t ^ t >>> 7,61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  class TreeScene {
    constructor(canvas,options={}) {
      this.canvas=canvas;
      this.parent=canvas.parentElement;
      this.weather={season:'autumn',code:0,wind:6,isDay:true,temp:15,cloudCover:0,nightAmount:0};
      this.modelOptions={url:options.modelUrl||'./assets/realistic-tree.glb',parseDelayMs:options.modelParseDelayMs||0};
      this.assetState={assetStatus:'loading',assetLoaded:false,assetRequestActive:false,assetParseActive:false,assetStage:'fetch',lateLoadIgnored:false,modelMeshes:0,foliageMeshes:0,barkMeshes:0,modelImagePixels:0,modelLeafCards:0};
      this.crowns=[];this.blossoms=[];this.accents=[];
      this.disposed=false;
      this.ready=false;
      this.frames=0;
      this.renderCpuMsLast=0;
      this.renderCpuMsAverage=0;
      this.frameId=null;
      this.lastPaint=0;
      this.hover=0;
      this.hoverTarget=0;
      this.pointer={x:0,y:0};
      this.rotationYaw=-.10;
      this.rotationTarget=-.10;
      this.dragActive=false;
      this.dragPointerId=null;
      this.dragLastX=0;
      this.keyboardFocus=false;
      this.night=0;
      this.resources={geometries:new Set(),materials:new Set(),textures:new Set()};
      this.lights=[];
      this.motion=matchMedia('(prefers-reduced-motion: reduce)');
      this.boundFrame=this.animate.bind(this);
      this.boundVisibility=this.onVisibility.bind(this);
      this.boundResize=this.resize.bind(this);
      this.canvas.dataset.renderer='loading';
      this.syncModelStatus();
      this.parent.dataset.sceneReady='false';
      this.initialization=this.init().catch(error=>{
        if(!this.disposed)this.useFallback(error);
      }).finally(()=>{this.initialization=null;});
    }
    ownGeometry(value) { this.resources.geometries.add(value); return value; }
    ownMaterial(value) { this.resources.materials.add(value); return value; }
    ownTexture(value) { this.resources.textures.add(value); return value; }
    async init() {
      const T=await import('./vendor/three.module.min.js');
      if(this.disposed)return;
      this.T=T;
      const [{WeatherClouds},{GroundWeather}]=await Promise.all([
        import('./weather-clouds.js?v=weather-1'),import('./ground-weather.js?v=weather-1')
      ]);
      if(this.disposed)return;
      this.WeatherClouds=WeatherClouds;this.GroundWeather=GroundWeather;
      this.renderer=new T.WebGLRenderer({canvas:this.canvas,alpha:true,antialias:true,powerPreference:'low-power'});
      this.renderer.setClearColor(0x000000,0);
      this.renderer.outputColorSpace=T.SRGBColorSpace;
      this.renderer.toneMapping=T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure=1;
      this.renderer.shadowMap.enabled=true;
      this.renderer.shadowMap.type=T.PCFSoftShadowMap;
      this.scene=new T.Scene();
      this.camera=new T.OrthographicCamera(-4,4,3.3,-3.3,.1,30);
      this.camera.position.set(5.5,4.05,9);
      this.target=new T.Vector3(0,2.30,0);
      this.camera.lookAt(this.target);
      this.cameraRight=new T.Vector3();
      this.cameraUp=new T.Vector3();
      this.cameraForward=new T.Vector3();
      this.sunPosition=new T.Vector3();
      this.moonPosition=new T.Vector3();
      this.cloudPosition=new T.Vector3();
      this.ndc=new T.Vector2();
      this.raycaster=new T.Raycaster();
      this.colorScratch=new T.Color();
      this.transformScratch=new T.Object3D();
      this.colors={
        skyDay:new T.Color('#deebe0'),skyNight:new T.Color('#a6b8d9'),
        groundDay:new T.Color('#687a6a'),groundNight:new T.Color('#52627b'),
        keyDay:new T.Color('#fff0d6'),keyNight:new T.Color('#9bb8ed'),
        woodDay:new T.Color('#8b684c'),woodNight:new T.Color('#7c8492'),
        diskDay:new T.Color('#b6c8ba'),diskNight:new T.Color('#6d839c'),
        stoneDay:new T.Color('#9ead97'),stoneNight:new T.Color('#61788b'),
        rimDay:new T.Color('#d7e3d5'),rimNight:new T.Color('#b6cce8'),
        foliageNight:new T.Color('#8d9cad')
      };
      this.sculpture=new T.Group();
      this.sculpture.rotation.y=-.10;
      this.scene.add(this.sculpture);
      this.tree=new T.Group();
      this.sculpture.add(this.tree);
      this.makeLights();
      this.makePlatform();
      this.groundWeather=new this.GroundWeather(this);
      this.makeSky();
      this.makePrecipitation();
      this.bindEvents();
      this.resize();
      await this.makeTree();
      if(this.disposed)return;
      this.ready=true;
      this.resize();
      this.applyWeather();
      this.canvas.dataset.renderer='webgl';
      this.start();
    }
    makeLights() {
      const T=this.T;
      this.ambient=new T.HemisphereLight('#deebe0','#687a6a',.95);
      this.key=new T.DirectionalLight('#fff0d6',2.6);
      this.key.position.set(-3,6,5);
      this.key.target.position.set(0,1.6,0);
      this.key.castShadow=true;
      this.key.shadow.mapSize.set(1024,1024);
      Object.assign(this.key.shadow.camera,{left:-3,right:3,top:5,bottom:-2,near:.5,far:18});
      this.key.shadow.normalBias=.024;
      this.key.shadow.bias=-.0002;
      this.key.shadow.radius=3;
      this.fill=new T.DirectionalLight('#d2e4df',.70);
      this.fill.position.set(4,3,-4);
      this.rimLight=new T.DirectionalLight('#f1dbb3',1.0);
      this.rimLight.position.set(-4,2,-4);
      this.lights.push(this.ambient,this.key,this.fill,this.rimLight);
      this.scene.add(...this.lights,this.key.target);
    }
    makeTexture(draw,size=128) {
      const c=document.createElement('canvas');
      c.width=c.height=size;
      draw(c.getContext('2d'),size);
      const map=this.ownTexture(new this.T.CanvasTexture(c));
      map.colorSpace=this.T.SRGBColorSpace;
      return map;
    }
    mesh(geometry,material,parent) {
      const mesh=new this.T.Mesh(geometry,material);
      parent.add(mesh);
      return mesh;
    }
    makePlatform() {
      const T=this.T;
      this.platform=new T.Group();
      this.sculpture.add(this.platform);
      this.glassMaterial=this.ownMaterial(new T.MeshPhysicalMaterial({
        color:'#b6c8ba',transparent:true,opacity:.37,metalness:.12,roughness:.24,
        clearcoat:1,clearcoatRoughness:.2,depthWrite:false,side:T.DoubleSide
      }));
      const points=[[0,-.045],[1.60,-.045],[1.68,-.033],[1.71,0],[1.68,.034],[1.62,.050],[0,.050]].map(p=>new T.Vector2(...p));
      this.mesh(this.ownGeometry(new T.LatheGeometry(points,64)),this.glassMaterial,this.platform);
      this.stoneMaterial=this.ownMaterial(new T.MeshStandardMaterial({color:'#9ead97',metalness:.06,roughness:.50}));
      const top=this.mesh(this.ownGeometry(new T.CylinderGeometry(1.60,1.62,.018,64)),this.stoneMaterial,this.platform);
      top.position.y=.055;
      top.receiveShadow=true;
      this.rimMaterial=this.ownMaterial(new T.MeshStandardMaterial({color:'#d7e3d5',metalness:.5,roughness:.28,emissive:'#809575',emissiveIntensity:.08}));
      const rim=this.mesh(this.ownGeometry(new T.TorusGeometry(1.665,.010,6,64)),this.rimMaterial,this.platform);
      rim.rotation.x=Math.PI/2;
      rim.position.y=.029;
      this.shadowTexture=this.makeTexture((c,n)=>{
        const g=c.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);
        g.addColorStop(0,'rgba(18,34,28,.34)');
        g.addColorStop(.46,'rgba(18,34,28,.15)');
        g.addColorStop(1,'rgba(18,34,28,0)');
        c.fillStyle=g;c.fillRect(0,0,n,n);
      });
      this.contactMaterial=this.ownMaterial(new T.MeshBasicMaterial({map:this.shadowTexture,transparent:true,opacity:.42,depthWrite:false}));
      this.contact=this.mesh(this.ownGeometry(new T.PlaneGeometry(4.7,3.8)),this.contactMaterial,this.scene);
      this.contact.rotation.x=-Math.PI/2;
      this.contact.position.y=-.20;
    }
    taperedGeometry(points,radii,segments=18,sides=7) {
      const T=this.T;
      const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),false,'catmullrom',.38);
      const frames=curve.computeFrenetFrames(segments,false);
      const positions=[],indices=[];
      for(let i=0;i<=segments;i++) {
        const t=i/segments,p=curve.getPointAt(t),q=t*(radii.length-1),j=Math.min(radii.length-2,Math.floor(q)),f=q-j;
        const radius=radii[j]*(1-f)+radii[j+1]*f;
        for(let k=0;k<=sides;k++) {
          const a=k/sides*TAU,ca=Math.cos(a),sa=Math.sin(a),n=frames.normals[i],b=frames.binormals[i];
          positions.push(p.x+(n.x*ca+b.x*sa)*radius,p.y+(n.y*ca+b.y*sa)*radius,p.z+(n.z*ca+b.z*sa)*radius);
          if(i<segments&&k<sides){const v=i*(sides+1)+k;indices.push(v,v+sides+1,v+1,v+1,v+sides+1,v+sides+2);}
        }
      }
      const geometry=this.ownGeometry(new T.BufferGeometry());
      geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    }
    mergeWood(geometries) {
      const T=this.T;
      let vertices=0,indexCount=0;
      for(const g of geometries){vertices+=g.attributes.position.count;indexCount+=g.index.count;}
      const positions=new Float32Array(vertices*3),normals=new Float32Array(vertices*3),indices=new Uint32Array(indexCount);
      let vertexOffset=0,indexOffset=0;
      for(const g of geometries) {
        positions.set(g.attributes.position.array,vertexOffset*3);
        normals.set(g.attributes.normal.array,vertexOffset*3);
        for(let i=0;i<g.index.count;i++)indices[indexOffset+i]=g.index.array[i]+vertexOffset;
        vertexOffset+=g.attributes.position.count;indexOffset+=g.index.count;
        g.dispose();this.resources.geometries.delete(g);
      }
      const geometry=this.ownGeometry(new T.BufferGeometry());
      geometry.setAttribute('position',new T.BufferAttribute(positions,3));
      geometry.setAttribute('normal',new T.BufferAttribute(normals,3));
      geometry.setIndex(new T.BufferAttribute(indices,1));
      geometry.computeBoundingSphere();
      return geometry;
    }
    leafGeometry() {
      // A broad, gently folded leaf; a visible midrib catches the studio light.
      const T=this.T,positions=[],colors=[],indices=[],rows=7;
      for(let i=0;i<rows;i++) {
        const t=i/(rows-1),width=Math.pow(Math.sin(t*Math.PI),.76)*.34;
        for(let side=-1;side<=1;side++) {
          const x=side*width,y=t-.5,z=Math.sin(t*Math.PI)*(.10-Math.abs(side)*.10)+x*x*.12;
          positions.push(x,y,z);
          const shade=side===0?1.0:side===-1?.88:.96;
          colors.push(shade,shade,shade);
          if(i<rows-1&&side<1){const j=i*3+side+1;indices.push(j,j+3,j+1,j+1,j+3,j+4);}
        }
      }
      const geometry=this.ownGeometry(new T.BufferGeometry());
      geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
      return geometry;
    }
    async makeTree() {
      try {
        const {RealisticTreeModel}=await import('./tree-model.js?v=asset-1');
        if(this.disposed)return;
        this.model=new RealisticTreeModel(this.modelOptions.url,{state:this.assetState,parseDelayMs:this.modelOptions.parseDelayMs});
        await this.model.load();
        if(this.disposed)return;
        this.tree.add(this.model.root);
      } catch(error) {
        if(this.disposed)return;
        this.model?.dispose();this.model=null;
        Object.assign(this.assetState,{assetStatus:'error',assetLoaded:false,assetRequestActive:false,assetParseActive:false,assetStage:'error'});
        this.assetError=String(error.message||error);
        console.warn('Realistic tree asset could not be loaded; showing the local tree fallback.',error);
        this.makeProceduralTree();
      }
      this.syncModelStatus();
    }
    syncModelStatus() {
      const state=this.assetState;
      if(!state)return;
      for(const node of [this.canvas,this.parent])if(node) {
        node.dataset.model=this.assetError?'procedural-fallback':'realistic-tree';
        node.dataset.modelStatus=state.assetStatus;
        node.dataset.modelState=state.assetStage;
        if(this.assetError)node.dataset.assetError=this.assetError;
      }
    }
    makeProceduralTree() {
      const T=this.T,r=seeded(204910),parts=[];
      this.wood=this.ownMaterial(new T.MeshPhysicalMaterial({color:'#8b684c',roughness:.76,metalness:0,clearcoat:.045,clearcoatRoughness:.8,emissive:'#936e4f',emissiveIntensity:.055}));
      const branch=(points,radii,segments=16,sides=7)=>parts.push(this.taperedGeometry(points,radii,segments,sides));
      // Branches rise from staggered junctions and taper into the whole canopy,
      // including its rear side, so the silhouette holds together during a full turn.
      branch([[0,.07,0],[-.10,.60,.02],[-.035,1.28,-.035],[.09,1.97,.015],[.04,2.60,-.02],[.16,3.14,-.04],[.10,3.64,0]],[.205,.174,.137,.105,.070,.035,.005],30,10);
      const limbs=[
        {p:[[-.035,1.28,-.035],[-.37,1.67,.025],[-.81,1.99,.09],[-1.18,2.33,.04]],r:[.106,.082,.049,.012]},
        {p:[[.025,1.64,0],[.42,1.91,.07],[.81,2.25,.12],[1.11,2.65,.12]],r:[.091,.068,.040,.010]},
        {p:[[.06,1.87,0],[-.10,2.15,-.35],[-.32,2.49,-.64],[-.36,2.90,-.82]],r:[.080,.060,.034,.008]},
        {p:[[.08,2.02,.015],[.02,2.30,.39],[-.20,2.57,.72],[-.29,2.91,.90]],r:[.074,.053,.030,.007]},
        {p:[[.045,2.52,-.01],[-.27,2.77,.04],[-.58,3.01,.08],[-.75,3.30,.06]],r:[.060,.045,.026,.006]},
        {p:[[.075,2.77,-.02],[.35,2.99,-.11],[.60,3.22,-.20],[.69,3.48,-.19]],r:[.050,.036,.022,.005]}
      ];
      for(const limb of limbs)branch(limb.p,limb.r,20,8);
      const crowns=[
        {p:[-1.20,2.36,.04],s:[.48,.40,.43],b:0},
        {p:[-.99,2.63,.48],s:[.46,.41,.43],b:0},
        {p:[-1.01,2.70,-.44],s:[.48,.42,.43],b:0},
        {p:[1.14,2.68,.13],s:[.48,.44,.46],b:1},
        {p:[1.01,2.93,-.43],s:[.45,.42,.43],b:1},
        {p:[.98,2.92,.59],s:[.45,.42,.44],b:1},
        {p:[-.40,2.95,-.85],s:[.47,.43,.43],b:2},
        {p:[.26,3.18,-.79],s:[.45,.40,.43],b:2},
        {p:[-.72,3.10,-.53],s:[.43,.40,.42],b:2},
        {p:[-.51,2.94,.89],s:[.47,.43,.43],b:3},
        {p:[.18,3.15,.87],s:[.46,.41,.42],b:3},
        {p:[-.77,3.30,.07],s:[.47,.41,.44],b:4},
        {p:[-.49,3.45,-.39],s:[.45,.39,.43],b:4},
        {p:[-.40,3.35,.48],s:[.45,.39,.42],b:4},
        {p:[.69,3.45,-.22],s:[.45,.40,.43],b:5},
        {p:[.61,3.47,.37],s:[.43,.39,.42],b:5},
        {p:[.07,3.58,.04],s:[.46,.40,.44],b:6},
        {p:[.09,3.35,-.43],s:[.45,.40,.43],b:6}
      ];
      // Fine twigs connect the foliage beds, leaving visible negative spaces.
      crowns.forEach((c,i)=>{
        const origin=c.b===6?[.14,3.10,-.03]:limbs[c.b].p[2];
        const tip=c.p,mid=[origin[0]*.40+tip[0]*.60,origin[1]*.42+tip[1]*.58-.05,origin[2]*.40+tip[2]*.60];
        branch([origin,mid,tip],[.024+(i%3)*.003,.016,.003],10,6);
        for(let j=0;j<2;j++) {
          const a=j===0?-.55:.55;
          branch([mid,[tip[0]+a*c.s[0],tip[1]+.10,tip[2]+(j===0?.25:-.25)]],[.010,.002],7,5);
        }
      });
      for(let i=0;i<5;i++) {
        const a=i*TAU/5+.25,x=Math.cos(a),z=Math.sin(a);
        branch([[x*.03,.28,z*.03],[x*.24,.095,z*.24],[x*(.47+i%2*.08),.065,z*(.47+i%2*.08)]],[.090-i*.007,.045,.002],12,7);
      }
      this.woodMesh=this.mesh(this.mergeWood(parts),this.wood,this.tree);
      this.woodMesh.castShadow=true;this.woodMesh.receiveShadow=true;
      this.crownGeometry=this.leafGeometry();
      this.leafMaterial=this.ownMaterial(new T.MeshPhysicalMaterial({color:'#ffffff',vertexColors:true,side:T.DoubleSide,roughness:.75,metalness:0,clearcoat:.07,clearcoatRoughness:.7,emissive:'#7a8798',emissiveIntensity:0}));
      this.leafTintDay=new T.Color('#ffffff');this.leafTintNight=new T.Color('#b8c9e2');
      this.leafEmissiveDay=new T.Color('#c68b42');this.leafEmissiveNight=new T.Color('#7a8798');
      const count=innerWidth<=760?52:72,transform=this.transformScratch;
      this.crowns=crowns.map((shape,i)=>{
        const mesh=new T.InstancedMesh(this.crownGeometry,this.leafMaterial,count);
        mesh.position.set(...shape.p);mesh.castShadow=true;mesh.receiveShadow=true;
        mesh.instanceMatrix.setUsage(T.StaticDrawUsage);
        mesh.userData={rotationX:(r()-.5)*.08,rotationZ:(r()-.5)*.08,leaves:[],capacity:count,autumnFraction:i%5===2?.20:i%4===0?.43:.67};
        mesh.rotation.x=mesh.userData.rotationX;mesh.rotation.z=mesh.userData.rotationZ;
        for(let j=0;j<count;j++) {
          const a=r()*TAU,u=r()*2-1,s=Math.sqrt(1-u*u),radius=.30+Math.pow(r(),.45)*.70;
          const x=Math.cos(a)*s*shape.s[0]*radius,y=u*shape.s[1]*radius,z=Math.sin(a)*s*shape.s[2]*radius;
          transform.position.set(x,y,z);
          transform.rotation.set((r()-.5)*2.7,r()*TAU,(r()-.5)*TAU);
          const length=.19+r()*.095;
          transform.scale.set(length*(.85+r()*.25),length,length);transform.updateMatrix();
          mesh.setMatrixAt(j,transform.matrix);
          mesh.userData.leaves.push({palette:(i+j%3)%8,shade:.78+r()*.34});
          mesh.setColorAt(j,this.colorScratch.set(PALETTES.autumn[(i+j%3)%8]));
        }
        mesh.computeBoundingSphere();this.tree.add(mesh);return mesh;
      });
      this.blossomMaterial=this.ownMaterial(new T.MeshStandardMaterial({color:'#efd6cc',roughness:.86}));
      const blossomGeometry=this.ownGeometry(new T.SphereGeometry(.035,7,5));
      this.blossoms=[];
      for(let i=0;i<12;i++) {
        const c=crowns[(i*5)%crowns.length];
        const m=this.mesh(blossomGeometry,this.blossomMaterial,this.tree);
        m.position.set(c.p[0]+(r()-.5)*.6,c.p[1]+.24+r()*.14,c.p[2]+(r()-.5)*.5);
        m.visible=false;this.blossoms.push(m);
      }
      const leaf=new T.Shape();leaf.moveTo(0,-.11);leaf.bezierCurveTo(-.08,-.03,-.07,.07,0,.12);leaf.bezierCurveTo(.07,.05,.07,-.04,0,-.11);
      const leafGeometry=this.ownGeometry(new T.ShapeGeometry(leaf));
      this.accentMaterial=this.ownMaterial(new T.MeshStandardMaterial({color:'#bb7d42',roughness:.8,side:T.DoubleSide}));
      this.accents=[[-.85,.069,.55],[.58,.069,-.75]].map((p,i)=>{
        const m=this.mesh(leafGeometry,this.accentMaterial,this.platform);m.position.set(...p);m.rotation.set(-Math.PI/2,0,i*.8+.3);return m;
      });
    }
    makeSky() {
      const T=this.T;
      this.sunMaterial=this.ownMaterial(new T.MeshBasicMaterial({color:'#ffdb94',transparent:true,opacity:.9,depthTest:false,depthWrite:false,toneMapped:false}));
      this.sun=this.mesh(this.ownGeometry(new T.SphereGeometry(.28,24,16)),this.sunMaterial,this.scene);
      this.sun.renderOrder=30;
      this.glowTexture=this.makeTexture((c,n)=>{
        const g=c.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);
        g.addColorStop(0,'rgba(255,218,149,.56)');g.addColorStop(.21,'rgba(255,213,137,.30)');g.addColorStop(.5,'rgba(255,216,145,.10)');g.addColorStop(1,'rgba(255,214,150,0)');
        c.fillStyle=g;c.fillRect(0,0,n,n);
      });
      this.glowMaterial=this.ownMaterial(new T.SpriteMaterial({map:this.glowTexture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));
      this.sunGlow=new T.Sprite(this.glowMaterial);this.sunGlow.scale.set(2.45,2.45,1);this.sunGlow.renderOrder=29;this.scene.add(this.sunGlow);
      this.moonTexture=this.makeTexture((c,n)=>{
        c.fillStyle='#e7edf6';c.beginPath();c.arc(n*.49,n*.51,n*.36,0,TAU);c.fill();
        c.globalCompositeOperation='destination-out';c.beginPath();c.arc(n*.63,n*.40,n*.35,0,TAU);c.fill();
      });
      this.moonMaterial=this.ownMaterial(new T.SpriteMaterial({map:this.moonTexture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));
      this.moon=new T.Sprite(this.moonMaterial);this.moon.scale.set(.48,.48,1);this.moon.renderOrder=30;this.scene.add(this.moon);
      this.weatherClouds=new this.WeatherClouds(this);
    }
    makePrecipitation() {
      const T=this.T,r=seeded(9871);
      this.particleData=Array.from({length:110},()=>({x:(r()-.5)*4.8,y:r()*4.8,z:(r()-.5)*2.5,speed:.5+r()}));
      this.rainGeometry=this.ownGeometry(new T.BufferGeometry());
      this.rainGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(110*6),3));
      this.rainMaterial=this.ownMaterial(new T.LineBasicMaterial({color:'#c6dce0',transparent:true,opacity:.43,depthWrite:false}));
      this.rainParticles=new T.LineSegments(this.rainGeometry,this.rainMaterial);this.rainParticles.frustumCulled=false;this.scene.add(this.rainParticles);
      this.flakeTexture=this.makeTexture((c,n)=>{
        const g=c.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);
        g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.98)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,n,n);
      },32);
      this.flakeGeometry=this.ownGeometry(new T.BufferGeometry());
      this.flakeGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(110*3),3));this.flakeGeometry.setDrawRange(0,70);
      this.flakeMaterial=this.ownMaterial(new T.PointsMaterial({color:'#f0f5f4',map:this.flakeTexture,size:3.6,sizeAttenuation:false,transparent:true,opacity:.92,alphaTest:.015,depthWrite:false}));
      this.flakes=new T.Points(this.flakeGeometry,this.flakeMaterial);this.flakes.frustumCulled=false;this.scene.add(this.flakes);
    }
    bindEvents() {
      this.eventsBound=true;
      this.boundMove=this.onPointerMove.bind(this);
      this.boundLeave=this.onPointerLeave.bind(this);
      this.boundDown=this.onPointerDown.bind(this);
      this.boundUp=this.onPointerUp.bind(this);
      this.boundCancel=event=>{if(event.pointerId===this.dragPointerId){this.endDrag();this.setHover(this.keyboardFocus);}};
      this.boundLost=event=>{if(event.pointerId===this.dragPointerId){this.endDrag(false);this.setHover(this.keyboardFocus);}};
      this.boundKey=this.onKeyDown.bind(this);
      this.boundFocus=()=>{this.keyboardFocus=true;this.setHover(true);};
      this.boundBlur=()=>{this.keyboardFocus=false;this.endDrag();this.setHover(false);};
      this.boundMotion=()=>{this.lastPaint=0;this.start();};
      this.boundContextLost=e=>{e.preventDefault();if(!this.disposed&&!this.switching)this.useFallback(new Error('WebGL context lost'));};
      this.canvas.addEventListener('pointermove',this.boundMove,{passive:true});
      this.canvas.addEventListener('pointerleave',this.boundLeave);
      this.canvas.addEventListener('pointerdown',this.boundDown);
      this.canvas.addEventListener('pointerup',this.boundUp);
      this.canvas.addEventListener('pointercancel',this.boundCancel);
      this.canvas.addEventListener('lostpointercapture',this.boundLost);
      this.canvas.addEventListener('keydown',this.boundKey);
      this.canvas.addEventListener('focus',this.boundFocus);
      this.canvas.addEventListener('blur',this.boundBlur);
      this.canvas.addEventListener('webglcontextlost',this.boundContextLost);
      this.canvas.tabIndex=0;this.canvas.dataset.dragging='false';
      window.addEventListener('pointerup',this.boundUp);
      window.addEventListener('pointercancel',this.boundCancel);
      document.addEventListener('visibilitychange',this.boundVisibility);
      window.addEventListener('resize',this.boundResize,{passive:true});
      this.motion.addEventListener?.('change',this.boundMotion);
      this.observer=new ResizeObserver(this.boundResize);this.observer.observe(this.canvas);
      this.eventsBound=true;
    }
    unbindEvents() {
      if(this.canvas&&this.eventsBound) {
        this.canvas.removeEventListener('pointermove',this.boundMove);
        this.canvas.removeEventListener('pointerleave',this.boundLeave);
        this.canvas.removeEventListener('pointerdown',this.boundDown);
        this.canvas.removeEventListener('pointerup',this.boundUp);
        this.canvas.removeEventListener('pointercancel',this.boundCancel);
        this.canvas.removeEventListener('lostpointercapture',this.boundLost);
        this.canvas.removeEventListener('keydown',this.boundKey);
        this.canvas.removeEventListener('focus',this.boundFocus);
        this.canvas.removeEventListener('blur',this.boundBlur);
        this.canvas.removeEventListener('webglcontextlost',this.boundContextLost);
      }
      window.removeEventListener('pointerup',this.boundUp);
      window.removeEventListener('pointercancel',this.boundCancel);
      document.removeEventListener('visibilitychange',this.boundVisibility);
      window.removeEventListener('resize',this.boundResize);
      this.motion?.removeEventListener?.('change',this.boundMotion);
      this.observer?.disconnect();this.observer=null;this.eventsBound=false;
    }
    setWeather(next={}) {
      if(this.disposed)return;
      Object.assign(this.weather,next);
      if(this.fallback){this.fallback.setWeather(next);return;}
      if(this.ready)this.applyWeather();
    }
    nightTarget() {
      if(Number.isFinite(this.weather.nightAmount))return clamp(this.weather.nightAmount);
      return window.SolarClock.getState(this.weather.solar||{isDay:this.weather.isDay},Date.now()).isDay?0:1;
    }
    applyWeather() {
      if(this.model)this.model.setWeather(this.weather);
      const season=PALETTES[this.weather.season]?this.weather.season:'autumn';
      const palette=PALETTES[season];
      const wet=RAIN.has(this.weather.code)?.92:1;
      this.crowns.forEach(mesh=>{
        mesh.visible=season!=='winter';
        mesh.count=season==='winter'?0:Math.round(mesh.userData.capacity*(season==='autumn'?mesh.userData.autumnFraction:1));
        for(let i=0;i<mesh.userData.capacity;i++) {
          const leaf=mesh.userData.leaves[i];
          this.colorScratch.set(palette[leaf.palette]).multiplyScalar(leaf.shade*wet);
          mesh.setColorAt(i,this.colorScratch);
        }
        mesh.instanceColor.needsUpdate=true;
      });
      this.blossoms.forEach(mesh=>mesh.visible=season==='spring');
      this.accents.forEach(mesh=>mesh.visible=season==='autumn');
      this.groundWeather?.updateWeather(this.weather);
      this.rainParticles.visible=RAIN.has(this.weather.code);
      this.flakes.visible=SNOW.has(this.weather.code);
      if(!this.hasWeather){this.night=this.nightTarget();this.hasWeather=true;}
    }
    resize() {
      if(this.disposed||!this.renderer||!this.canvas)return;
      const box=this.canvas.getBoundingClientRect(),w=Math.max(1,box.width),h=Math.max(1,box.height);
      const ratio=Math.min(devicePixelRatio||1,innerWidth<=760?1.25:1.4);
      if(w===this.width&&h===this.height&&ratio===this.pixelRatio)return;
      this.width=w;this.height=h;this.pixelRatio=ratio;
      this.renderer.setPixelRatio(ratio);this.renderer.setSize(w,h,false);
      const aspect=w/h,viewHeight=Math.max(6.35,4.8/aspect);
      this.camera.left=-viewHeight*aspect/2;this.camera.right=viewHeight*aspect/2;
      this.camera.top=viewHeight/2;this.camera.bottom=-viewHeight/2;
      this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
      this.cameraRight.setFromMatrixColumn(this.camera.matrixWorld,0);
      this.cameraUp.setFromMatrixColumn(this.camera.matrixWorld,1);
      this.camera.getWorldDirection(this.cameraForward);
    }
    setHover(active) {
      this.hoverTarget=active?1:0;
      if(this.parent){this.parent.dataset.hover=active?'true':'false';this.parent.classList.toggle('is-tree-hovered',active);}
      if(this.canvas)this.canvas.style.cursor=this.dragActive?'grabbing':active?'grab':'default';
    }
    updatePointer(event) {
      const b=this.canvas.getBoundingClientRect();
      this.pointer.x=(event.clientX-b.left)/Math.max(1,b.width)*2-1;
      this.pointer.y=-(event.clientY-b.top)/Math.max(1,b.height)*2+1;
    }
    hitTree() {
      this.ndc.set(this.pointer.x,this.pointer.y);
      this.scene.updateMatrixWorld();this.raycaster.setFromCamera(this.ndc,this.camera);
      return this.raycaster.intersectObject(this.tree,true).some(hit=>hit.object.visible);
    }
    onPointerMove(event) {
      if(!this.ready||this.disposed)return;
      if(this.dragActive&&event.pointerId!==this.dragPointerId)return;
      this.updatePointer(event);
      if(this.dragActive) {
        const delta=event.clientX-this.dragLastX;
        this.dragLastX=event.clientX;
        this.rotationTarget+=delta/Math.max(180,this.width)*TAU*1.15;
        this.setHover(true);return;
      }
      this.setHover(this.keyboardFocus||this.hitTree());
    }
    onPointerLeave() {
      if(this.dragActive)return;
      this.pointer.x=this.pointer.y=0;this.setHover(this.keyboardFocus);
    }
    onPointerDown(event) {
      if(!this.ready||this.disposed||this.dragActive||event.button>0||event.isPrimary===false)return;
      this.updatePointer(event);
      if(!this.hitTree())return;
      event.preventDefault();
      this.dragActive=true;this.dragPointerId=event.pointerId;this.dragLastX=event.clientX;
      this.canvas.dataset.dragging='true';this.setHover(true);
      try{this.canvas.setPointerCapture(event.pointerId);}catch(_){/* Window handlers still finish an interrupted drag. */}
    }
    endDrag(release=true) {
      const pointerId=this.dragPointerId;
      this.dragActive=false;this.dragPointerId=null;
      if(this.canvas) {
        this.canvas.dataset.dragging='false';
        if(release&&pointerId!==null) {
          try{if(this.canvas.hasPointerCapture(pointerId))this.canvas.releasePointerCapture(pointerId);}catch(_){}
        }
        this.canvas.style.cursor=this.hoverTarget?'grab':'default';
      }
    }
    onPointerUp(event) {
      if(!this.dragActive||event.pointerId!==this.dragPointerId)return;
      this.endDrag();
      if(event.pointerType==='touch')this.setHover(this.keyboardFocus);
      else this.onPointerMove(event);
    }
    onKeyDown(event) {
      if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
      event.preventDefault();
      this.rotationTarget+=(event.key==='ArrowLeft'?-1:1)*Math.PI/12*(event.shiftKey?3:1);
      this.setHover(true);
    }
    skyPosition(state,out) {
      const progress=Number.isFinite(state.progress)?clamp(state.progress):Number.isFinite(state.x)?clamp((650-state.x)/500):.5;
      // Reserve the upper 10–18% of the canvas, clear of the crown.
      const horizontal=(1-progress*2)*Math.min(this.camera.right-.30,3.0);
      const vertical=this.camera.top*(.64+.16*Math.sin(Math.PI*progress));
      return out.copy(this.target).addScaledVector(this.cameraRight,horizontal).addScaledVector(this.cameraUp,vertical).addScaledVector(this.cameraForward,3);
    }
    updateSky(time) {
      const now=Date.now(),solarInput=this.weather.solar||{isDay:this.weather.isDay};
      const sun=window.SolarClock.getState(solarInput,now);
      const moon=typeof window.SolarClock.getMoonState==='function'?window.SolarClock.getMoonState(solarInput,now):{visible:!sun.isDay,progress:.5,opacity:1};
      const cover=clamp((this.weather.cloudCover||0)/100),cloudy=this.weather.code>=2||cover>.23;
      this.sun.visible=this.sunGlow.visible=Boolean(sun.visible);
      this.moon.visible=Boolean(moon.visible);
      if(sun.visible){this.skyPosition(sun,this.sunPosition);this.sun.position.copy(this.sunPosition);this.sunGlow.position.copy(this.sunPosition);this.sunMaterial.opacity=sun.opacity*(.98-cover*.14);this.glowMaterial.opacity=sun.opacity*(.88-cover*.25);}
      if(moon.visible){this.skyPosition(moon,this.moonPosition);this.moon.position.copy(this.moonPosition);this.moonMaterial.opacity=moon.opacity??1;}
      this.weatherClouds?.update(time,sun,moon);
      if(this.parent)this.parent.dataset.daylight=String(Boolean(sun.isDay));
    }
    updateLighting() {
      const n=this.night,c=this.colors;
      this.ambient.color.lerpColors(c.skyDay,c.skyNight,n);
      this.ambient.groundColor.lerpColors(c.groundDay,c.groundNight,n);
      this.ambient.intensity=1.15-.33*n;
      this.key.color.lerpColors(c.keyDay,c.keyNight,n);this.key.intensity=2.6-.85*n;
      this.fill.intensity=.90-.40*n;this.rimLight.intensity=1.0+.08*n;
      this.rimLight.color.lerpColors(c.keyDay,c.keyNight,n);
      this.renderer.toneMappingExposure=1.0-.06*n;
      if(this.wood){this.wood.color.lerpColors(c.woodDay,c.woodNight,n);this.wood.emissiveIntensity=.055-.030*n;}
      this.glassMaterial.color.lerpColors(c.diskDay,c.diskNight,n);
      this.stoneMaterial.color.lerpColors(c.stoneDay,c.stoneNight,n);
      this.rimMaterial.color.lerpColors(c.rimDay,c.rimNight,n);
      this.rimMaterial.emissiveIntensity=.06+this.hover*.30+n*.045;
      this.glassMaterial.opacity=.37+this.hover*.05;
      this.contactMaterial.opacity=.42-this.hover*.025-n*.14;
      if(this.leafMaterial) {
        this.leafMaterial.color.lerpColors(this.leafTintDay,this.leafTintNight,n);
        this.leafMaterial.emissive.lerpColors(this.leafEmissiveDay,this.leafEmissiveNight,n);
        this.leafMaterial.emissiveIntensity=.085+n*.015;
      }
    }
    updateParticles(time,wind) {
      if(this.rainParticles.visible) {
        const a=this.rainGeometry.attributes.position.array;
        for(let i=0;i<this.particleData.length;i++) {
          const p=this.particleData[i],y=4.8-((p.y+time*p.speed*2.1)%4.8),x=p.x+wind*(4.8-y)*.05,j=i*6;
          a[j]=x;a[j+1]=y;a[j+2]=p.z;
          a[j+3]=x+wind*.055+.018;a[j+4]=y-.12-p.speed*.055;a[j+5]=p.z+.01;
        }
        this.rainGeometry.attributes.position.needsUpdate=true;
      }
      if(this.flakes.visible) {
        const a=this.flakeGeometry.attributes.position.array;
        for(let i=0;i<this.particleData.length;i++) {
          const p=this.particleData[i],y=4.8-((p.y+time*p.speed*.23)%4.8),j=i*3;
          a[j]=p.x+Math.sin(time*.5+i)*.10+wind*(4.8-y)*.02;a[j+1]=y;a[j+2]=p.z;
        }
        this.flakeGeometry.attributes.position.needsUpdate=true;
      }
    }
    start() {
      if(this.disposed||!this.ready||document.hidden||this.frameId!==null)return;
      this.frameId=requestAnimationFrame(this.boundFrame);
    }
    pause() {
      if(this.frameId!==null)cancelAnimationFrame(this.frameId);
      this.frameId=null;
    }
    onVisibility() {
      if(document.hidden){this.endDrag();this.setHover(false);this.pause();}
      else{this.lastPaint=0;this.start();}
    }
    animate(now) {
      this.frameId=null;
      if(this.disposed||!this.ready||document.hidden)return;
      const interval=this.motion.matches?250:33;
      if(now-this.lastPaint>=interval) {
        const dt=Math.min(this.motion.matches?.30:.10,(now-(this.lastPaint||now-33))/1000);
        this.lastPaint=now;
        const reduced=this.motion.matches,time=reduced?0:now/1000;
        this.hover+=(this.hoverTarget-this.hover)*Math.min(1,dt*7);
        this.night+=(this.nightTarget()-this.night)*Math.min(1,dt*1.8);
        const wind=clamp((this.weather.wind||0)/28,.08,1.3),move=reduced?0:1;
        this.rotationYaw+=(this.rotationTarget-this.rotationYaw)*Math.min(1,dt*(reduced?30:14));
        this.sculpture.rotation.y=this.rotationYaw+(this.dragActive?0:this.pointer.x*this.hover*.045*move);
        this.sculpture.rotation.x=-(this.dragActive?0:this.pointer.y)*this.hover*.020*move;
        this.sculpture.position.y=this.hover*.055*move;
        this.sculpture.scale.setScalar(1+this.hover*.018*move);
        this.tree.rotation.z=Math.sin(time*.7)*.0035*wind*move;
        this.crowns.forEach((mesh,i)=>{
          mesh.rotation.x=mesh.userData.rotationX+Math.sin(time*.65+i)*.004*wind*move;
          mesh.rotation.z=mesh.userData.rotationZ+Math.cos(time*.75+i)*.007*(wind+this.hover*.4)*move;
        });
        this.updateLighting();this.updateSky(time);this.updateParticles(time,wind);
        this.model?.update(time,wind,this.night,reduced);
        this.groundWeather?.update(time,dt);
        this.canvas.dataset.cloudAsset=this.weatherClouds?.loaded?'loaded':'loading';
        this.canvas.dataset.groundAssets=this.groundWeather?.assetsLoaded?'loaded':'loading';
        const renderStart=performance.now();
        this.renderer.render(this.scene,this.camera);
        this.renderCpuMsLast=performance.now()-renderStart;
        this.renderCpuMsAverage=this.frames?this.renderCpuMsAverage*.94+this.renderCpuMsLast*.06:this.renderCpuMsLast;
        this.frames++;
        this.canvas.dataset.rotation=this.rotationYaw.toFixed(3);
        this.syncModelStatus();
        if(this.parent.dataset.sceneReady!=='true')this.parent.dataset.sceneReady='true';
      }
      this.start();
    }
    getDiagnostics() {
      this.syncModelStatus();
      if(this.disposed)return {disposed:true,geometries:0,textures:0,programs:0,calls:0,triangles:0,frames:this.frames,rafActive:false,estimatedBufferBytes:0,dragActive:false,dragPointerId:null,rotationYaw:this.rotationYaw,rotationTarget:this.rotationTarget,renderCpuMsLast:this.renderCpuMsLast,renderCpuMsAverage:this.renderCpuMsAverage,...this.assetState};
      const info=this.renderer?.info;
      let bytes=0;
      for(const geometry of this.resources.geometries){for(const attr of Object.values(geometry.attributes))bytes+=attr.array?.byteLength||0;bytes+=geometry.index?.array?.byteLength||0;}
      for(const texture of this.resources.textures)bytes+=(texture.image?.width||0)*(texture.image?.height||0)*4;
      for(const mesh of this.crowns||[]){bytes+=mesh.instanceMatrix?.array.byteLength||0;bytes+=mesh.instanceColor?.array.byteLength||0;}
      bytes+=this.model?.getDiagnostics().estimatedBufferBytes||0;
      return {
        disposed:false,geometries:info?.memory.geometries||0,textures:info?.memory.textures||0,
        programs:info?.programs?.length||0,calls:info?.render.calls||0,triangles:info?.render.triangles||0,
        frames:this.frames,rafActive:this.frameId!==null&&!document.hidden,estimatedBufferBytes:bytes,
        dragActive:this.dragActive,dragPointerId:this.dragPointerId,rotationYaw:this.rotationYaw,rotationTarget:this.rotationTarget,
        renderCpuMsLast:this.renderCpuMsLast,renderCpuMsAverage:this.renderCpuMsAverage,
        ...this.assetState,
        cloudAssetLoaded:this.weatherClouds?.loaded===true,
        cloudAsset:this.weatherClouds?.getDiagnostics(),
        groundWeather:this.groundWeather?.getDiagnostics(),
        limits:{desktopDpr:1.4,mobileDpr:1.25,shadow:1024,maxFps:30,reducedMotionFps:4},
        renderer:this.fallback?'fallback':this.ready?'webgl':'loading'
      };
    }
    releaseGraphics() {
      this.pause();
      this.endDrag();
      this.unbindEvents();
      if(this.assetState.assetStatus==='loading')Object.assign(this.assetState,{assetStatus:'aborted',assetStage:'aborted',assetLoaded:false});
      this.model?.dispose();this.model=null;this.syncModelStatus();
      this.weatherClouds?.dispose();this.weatherClouds=null;
      this.groundWeather?.dispose();this.groundWeather=null;
      this.WeatherClouds=this.GroundWeather=null;
      clearTimeout(this.touchTimer);this.touchTimer=null;
      if(this.scene)this.scene.traverse(object=>{if(object.isInstancedMesh)object.dispose?.();});
      for(const light of this.lights)light.shadow?.dispose?.();
      for(const geometry of this.resources.geometries)geometry.dispose();
      for(const material of this.resources.materials)material.dispose();
      for(const texture of this.resources.textures){
        texture.dispose();
        const image=texture.image;
        if(image&&typeof image.getContext==='function'){image.width=1;image.height=1;}
        texture.image=null;
      }
      this.resources.geometries.clear();this.resources.materials.clear();this.resources.textures.clear();
      this.scene?.clear();
      if(this.renderer){this.renderer.renderLists?.dispose();this.renderer.dispose();this.renderer.forceContextLoss();}
      this.renderer=null;this.scene=null;this.camera=null;this.ready=false;
      this.lights=[];this.crowns=[];this.blossoms=[];this.accents=[];this.clouds=[];this.particleData=[];
      for(const key of ['sculpture','tree','woodMesh','platform','sun','sunGlow','moon','ambient','key','fill','rimLight','contact','rainParticles','flakes','snowCap','colors','wood','glassMaterial','stoneMaterial','rimMaterial','contactMaterial','sunMaterial','glowMaterial','moonMaterial','cloudMaterial','leafMaterial','leafTintDay','leafTintNight','leafEmissiveDay','leafEmissiveNight','blossomMaterial','accentMaterial','snowMaterial','rainMaterial','flakeMaterial','crownGeometry','rainGeometry','flakeGeometry','shadowTexture','glowTexture','moonTexture','flakeTexture','target','cameraRight','cameraUp','cameraForward','sunPosition','moonPosition','cloudPosition','raycaster','ndc','colorScratch','transformScratch'])this[key]=null;
      this.T=null;
    }
    useFallback(error) {
      if(this.disposed||this.switching)return;
      this.switching=true;
      this.releaseGraphics();
      const old=this.canvas,canvas=old.cloneNode(true);
      canvas.removeAttribute('tabindex');old.replaceWith(canvas);this.canvas=canvas;
      canvas.dataset.renderer='fallback';
      if(window.FlatTreeScene){this.fallback=new window.FlatTreeScene(canvas);this.fallback.setWeather(this.weather);this.parent.dataset.sceneReady='true';}
      else{this.parent.dataset.sceneReady='false';console.warn('Tree renderer unavailable',error);}
      this.switching=false;
    }
    destroy() {
      if(this.disposed)return;
      this.disposed=true;
      this.fallback?.destroy();this.fallback=null;
      this.releaseGraphics();
      if(this.parent){this.parent.dataset.hover='false';this.parent.dataset.sceneReady='false';this.parent.classList.remove('is-tree-hovered');}
      if(this.canvas){this.canvas.dataset.renderer='disposed';this.canvas.width=this.canvas.height=1;}
      this.canvas=null;this.parent=null;this.motion=null;this.weather={};
      this.boundFrame=this.boundVisibility=this.boundResize=this.boundMove=this.boundLeave=this.boundDown=this.boundUp=this.boundCancel=this.boundLost=this.boundKey=this.boundFocus=this.boundBlur=this.boundMotion=this.boundContextLost=null;
    }
  }
  window.TreeScene=TreeScene;
})();
