import * as T from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

const abortError=()=>new DOMException('Tree model load was cancelled','AbortError');
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));

// The authorized Sketchfab model keeps its original geometry and texture detail.
// This small adapter owns everything the loader allocates, including late results.
export class RealisticTreeModel {
  constructor(url,{state={},parseDelayMs=0}={}) {
    this.url=new URL(url,document.baseURI).href;
    this.state=state;
    Object.assign(state,{assetStatus:'loading',assetLoaded:false,assetRequestActive:false,assetParseActive:false,assetStage:'fetch',lateLoadIgnored:false,modelMeshes:0,foliageMeshes:0,barkMeshes:0,modelImagePixels:0,modelLeafCards:0});
    this.parseDelayMs=clamp(Number(parseDelayMs)||0,0,2000);
    this.controller=new AbortController();
    this.disposed=false;
    this.root=new T.Group();
    this.root.name='Realistic Tree — Daniel';
    this.foliage=[];this.bark=[];this.leafMaterials=[];
    this.geometries=new Set();this.materials=new Set();this.textures=new Set();this.skeletons=new Set();
    this.disposedGeometries=new WeakSet();this.disposedMaterials=new WeakSet();this.disposedTextures=new WeakSet();this.closedImages=new WeakSet();
    this.uniforms={uWeatherTime:{value:0},uWeatherWind:{value:0},uWeatherLeafKeep:{value:1},uWeatherTintStrength:{value:0},uWeatherTintA:{value:new T.Color('#d28b36')},uWeatherTintB:{value:new T.Color('#c15d27')}};
    this.tintDay=new T.Color('#ffffff');this.tintNight=new T.Color('#bfcede');
    this.emissiveDay=new T.Color('#56713a');this.emissiveNight=new T.Color('#7089a5');
  }
  ownGeometry(geometry) {
    if(!geometry)return;
    if(this.disposed){if(!this.disposedGeometries.has(geometry)){geometry.dispose();this.disposedGeometries.add(geometry);}}
    else this.geometries.add(geometry);
  }
  closeImage(image) {
    if(!image||typeof image!=='object'||this.closedImages.has(image))return;
    this.closedImages.add(image);
    if(Array.isArray(image)){for(const part of image)this.closeImage(part);return;}
    if(typeof image.close==='function')image.close();
  }
  ownTexture(texture) {
    if(!texture?.isTexture)return;
    if(this.disposed) {
      if(!this.disposedTextures.has(texture)){texture.dispose();this.closeImage(texture.image);texture.image=null;this.disposedTextures.add(texture);}
    } else this.textures.add(texture);
  }
  ownMaterial(material) {
    if(!material)return;
    if(Array.isArray(material)){material.forEach(m=>this.ownMaterial(m));return;}
    for(const value of Object.values(material))if(value?.isTexture)this.ownTexture(value);
    if(this.disposed){if(!this.disposedMaterials.has(material)){material.dispose();this.disposedMaterials.add(material);}}
    else this.materials.add(material);
  }
  ownObject(root) {
    root?.traverse(object=>{
      this.ownGeometry(object.geometry);this.ownMaterial(object.material);
      if(object.skeleton){if(this.disposed)object.skeleton.dispose();else this.skeletons.add(object.skeleton);}
      if(this.disposed&&object.isInstancedMesh)object.dispose?.();
    });
  }
  async load() {
    try {
      this.state.assetRequestActive=true;
      const response=await fetch(this.url,{signal:this.controller.signal});
      if(!response.ok)throw new Error(`Tree model returned HTTP ${response.status}`);
      const bytes=await response.arrayBuffer();
      this.state.assetRequestActive=false;
      if(this.disposed)throw abortError();
      if(this.parseDelayMs) {
        this.state.assetStage='parse-delay';
        await new Promise((resolve,reject)=>{
          const finish=()=>{clearTimeout(this.parseTimer);this.parseTimer=null;this.controller.signal.removeEventListener('abort',cancel);};
          const cancel=()=>{finish();reject(abortError());};
          this.parseTimer=setTimeout(()=>{finish();resolve();},this.parseDelayMs);
          this.controller.signal.addEventListener('abort',cancel,{once:true});
        });
      }
      if(this.disposed)throw abortError();
      this.state.assetStage='parse';this.state.assetParseActive=true;
      const loader=new GLTFLoader();
      // Track allocations as they resolve, so a cancelled or failed parse cannot
      // orphan a texture/material that was created before its scene was returned.
      loader.register(parser=>({
        name:'WEATHER_RESOURCE_LIFETIME',
        loadTexture:index=>parser.loadTexture(index).then(texture=>{this.ownTexture(texture);return texture;}),
        loadMaterial:index=>parser.loadMaterial(index).then(material=>{this.ownMaterial(material);return material;}),
        loadMesh:index=>parser.loadMesh(index).then(mesh=>{this.ownObject(mesh);return mesh;})
      }));
      const gltf=await loader.parseAsync(bytes,new URL('.',this.url).href);
      for(const scene of gltf.scenes||[gltf.scene])this.ownObject(scene);
      this.state.assetParseActive=false;
      if(this.disposed){this.state.lateLoadIgnored=true;throw abortError();}
      this.root.add(gltf.scene);
      this.configure();
      Object.assign(this.state,{assetStatus:'loaded',assetLoaded:true,assetStage:'ready'});
      return this;
    } catch(error) {
      Object.assign(this.state,{assetStatus:this.disposed||error.name==='AbortError'?'aborted':'error',assetLoaded:false,assetRequestActive:false,assetParseActive:false,assetStage:this.disposed||error.name==='AbortError'?'aborted':'error'});
      throw error;
    }
  }
  configure() {
    const bounds=new T.Box3().setFromObject(this.root),size=new T.Vector3(),center=new T.Vector3();
    bounds.getSize(size);bounds.getCenter(center);
    const point=new T.Vector3();let radiusSquared=0;
    this.root.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const positions=mesh.geometry.attributes.position;
      for(let i=0;i<positions.count;i++) {
        point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
        const x=point.x-center.x,z=point.z-center.z;
        radiusSquared=Math.max(radiusSquared,x*x+z*z);
      }
    });
    const radius=Math.sqrt(radiusSquared);
    const scale=Math.min(4.0/Math.max(.01,size.y),1.85/Math.max(.01,radius));
    const source=this.root.children[0];
    source.scale.multiplyScalar(scale);
    source.position.set(-center.x*scale,.072-bounds.min.y*scale,-center.z*scale);
    this.root.updateMatrixWorld(true);
    this.root.traverse(mesh=>{
      if(!mesh.isMesh)return;
      this.state.modelMeshes++;
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      const leaf=/leav|crown|foliage/i.test(mesh.name+' '+materials.map(m=>m.name).join(' '));
      mesh.castShadow=true;mesh.receiveShadow=true;
      if(leaf) {
        this.foliage.push(mesh);this.state.foliageMeshes++;
        this.prepareLeafCards(mesh.geometry);
        for(const material of materials) {
          if(!this.leafMaterials.includes(material))this.leafMaterials.push(material);
          material.transparent=false;material.opacity=1;material.alphaTest=.42;
          material.depthWrite=true;material.side=T.DoubleSide;material.roughness=.85;material.metalness=0;
          material.forceSinglePass=true;
          this.patchFoliage(material,false);
        }
        const base=materials[0];
        const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map:base.map,alphaMap:base.alphaMap,alphaTest:.42,side:T.DoubleSide});
        this.patchFoliage(depth,true);this.ownMaterial(depth);mesh.customDepthMaterial=depth;
      } else {
        this.bark.push(mesh);this.state.barkMeshes++;
        for(const material of materials){material.transparent=false;material.side=T.FrontSide;material.roughness=.90;material.metalness=0;}
      }
    });
    if(!this.foliage.length||!this.bark.length)throw new Error('Tree model is missing identifiable leaves or bark');
    const images=new Set();
    for(const texture of this.textures) {
      texture.anisotropy=Math.min(4,texture.anisotropy||1);
      const image=texture.image;if(image&&!images.has(image)){images.add(image);this.state.modelImagePixels+=(image.width||0)*(image.height||0);}
    }
  }
  prepareLeafCards(geometry) {
    const p=geometry.attributes.position,n=p.count,index=geometry.index?.array;
    const parents=new Uint32Array(n);for(let i=0;i<n;i++)parents[i]=i;
    const find=x=>{while(parents[x]!==x){parents[x]=parents[parents[x]];x=parents[x];}return x;};
    const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parents[b]=a;};
    if(index)for(let i=0;i<index.length;i+=3){join(index[i],index[i+1]);join(index[i],index[i+2]);}
    else for(let i=0;i<n;i+=3){join(i,i+1);join(i,i+2);}
    const centers=new Map();
    for(let i=0;i<n;i++){const id=find(i);let c=centers.get(id);if(!c){c=[0,0,0,0];centers.set(id,c);}c[0]+=p.getX(i);c[1]+=p.getY(i);c[2]+=p.getZ(i);c[3]++;}
    const seeds=new Float32Array(n),pivots=new Float32Array(n*3);
    for(let i=0;i<n;i++) {
      const id=find(i),c=centers.get(id);
      seeds[i]=((Math.imul(id+19,1597334677)>>>0)%1048576)/1048576;
      pivots[i*3]=c[0]/c[3];pivots[i*3+1]=c[1]/c[3];pivots[i*3+2]=c[2]/c[3];
    }
    geometry.setAttribute('aWeatherLeafSeed',new T.BufferAttribute(seeds,1));
    geometry.setAttribute('aWeatherLeafCenter',new T.BufferAttribute(pivots,3));
    this.state.modelLeafCards+=centers.size;
  }
  patchFoliage(material,depth) {
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,this.uniforms);
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float aWeatherLeafSeed;\nattribute vec3 aWeatherLeafCenter;\nvarying float vWeatherLeafSeed;\nuniform float uWeatherTime;\nuniform float uWeatherWind;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWeatherLeafSeed=aWeatherLeafSeed;\nvec3 weatherLocal=transformed-aWeatherLeafCenter;\nfloat weatherFlutter=sin(uWeatherTime*(1.4+aWeatherLeafSeed)+aWeatherLeafSeed*61.0)*uWeatherWind*.16;\ntransformed.x+=weatherLocal.y*weatherFlutter;\ntransformed.z+=weatherLocal.x*weatherFlutter*.7;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vWeatherLeafSeed;\nuniform float uWeatherLeafKeep;\nuniform float uWeatherTintStrength;\nuniform vec3 uWeatherTintA;\nuniform vec3 uWeatherTintB;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\nif(vWeatherLeafSeed>uWeatherLeafKeep)discard;');
      if(!depth)shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat weatherLuma=dot(diffuseColor.rgb,vec3(.299,.587,.114));\nvec3 weatherTint=mix(uWeatherTintA,uWeatherTintB,fract(vWeatherLeafSeed*7.31));\ndiffuseColor.rgb=mix(diffuseColor.rgb,weatherTint*clamp(.62+weatherLuma*1.25,.62,1.35),uWeatherTintStrength);');
    };
    material.customProgramCacheKey=()=>depth?'weather-tree-leaf-depth-v1':'weather-tree-leaf-v1';
    material.needsUpdate=true;
  }
  setWeather(weather) {
    if(this.disposed)return;
    const season=weather.season||'summer',autumn=season==='autumn';
    for(const mesh of this.foliage)mesh.visible=season!=='winter';
    this.uniforms.uWeatherLeafKeep.value=autumn?.58:1;
    this.uniforms.uWeatherTintStrength.value=autumn?.94:season==='spring'?.16:0;
    this.uniforms.uWeatherTintA.value.set(autumn?'#e5a344':'#9dbb6c');
    this.uniforms.uWeatherTintB.value.set(autumn?'#c7692c':'#b6ca88');
  }
  update(time,wind,night,reduced) {
    if(this.disposed)return;
    this.uniforms.uWeatherTime.value=reduced?0:time;
    this.uniforms.uWeatherWind.value=reduced?0:wind;
    for(const material of this.leafMaterials) {
      material.color.lerpColors(this.tintDay,this.tintNight,night);
      material.emissive.lerpColors(this.emissiveDay,this.emissiveNight,night);
      material.emissiveIntensity=.018+night*.018;
    }
  }
  getDiagnostics() {
    let bytes=0;
    for(const geometry of this.geometries){for(const attribute of Object.values(geometry.attributes))bytes+=attribute.array?.byteLength||0;bytes+=geometry.index?.array?.byteLength||0;}
    for(const texture of this.textures)bytes+=(texture.image?.width||0)*(texture.image?.height||0)*4;
    return {estimatedBufferBytes:bytes};
  }
  dispose() {
    if(this.disposed)return;
    this.disposed=true;this.controller.abort();clearTimeout(this.parseTimer);this.parseTimer=null;
    if(this.state.assetStatus==='loading')Object.assign(this.state,{assetStatus:'aborted',assetStage:'aborted'});
    this.state.assetLoaded=false;
    for(const skeleton of this.skeletons)skeleton.dispose();
    for(const geometry of this.geometries){geometry.dispose();this.disposedGeometries.add(geometry);}
    for(const material of this.materials){material.onBeforeCompile=()=>{};material.dispose();this.disposedMaterials.add(material);}
    for(const texture of this.textures){texture.dispose();this.closeImage(texture.image);texture.image=null;this.disposedTextures.add(texture);}
    this.root?.traverse(object=>{if(object.isInstancedMesh)object.dispose?.();});
    this.root?.removeFromParent();this.root?.clear();this.root=null;
    this.geometries.clear();this.materials.clear();this.textures.clear();this.skeletons.clear();
    this.foliage=[];this.bark=[];this.leafMaterials=[];this.uniforms=null;
  }
}
