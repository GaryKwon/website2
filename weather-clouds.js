// One shared cloud sprite keeps the sky soft without volumetric ray-marching.
export class WeatherClouds {
  constructor(host) {
    this.host=host;this.disposed=false;this.loaded=false;this.error=null;
    this.controller=new AbortController();this.bitmap=null;
    const T=host.T;
    this.texture=host.ownTexture(new T.Texture());
    this.texture.colorSpace=T.SRGBColorSpace;
    this.texture.minFilter=T.LinearFilter;this.texture.magFilter=T.LinearFilter;
    this.texture.generateMipmaps=false;
    this.day=new T.Color('#fffaf1');this.rain=new T.Color('#b7c7d1');this.night=new T.Color('#8c9cb5');
    this.color=new T.Color();this.materials=[];this.sprites=[];
    for(let i=0;i<4;i++) {
      const material=host.ownMaterial(new T.SpriteMaterial({map:this.texture,transparent:true,opacity:0,depthTest:false,depthWrite:false,toneMapped:false,rotation:[-.025,.035,-.01,.02][i]}));
      const sprite=new T.Sprite(material);sprite.visible=false;sprite.renderOrder=31+i*.1;
      host.scene.add(sprite);this.materials.push(material);this.sprites.push(sprite);
    }
    this.initialization=this.load().catch(error=>{
      if(this.disposed||error.name==='AbortError')return;
      this.error=String(error.message||error);console.warn('Cloud image unavailable',error);
    }).finally(()=>{this.initialization=null;});
  }
  async load() {
    const response=await fetch(new URL('./assets/weather-cloud.png',import.meta.url),{signal:this.controller.signal});
    if(!response.ok)throw new Error(`Cloud image: HTTP ${response.status}`);
    const blob=await response.blob();
    if(this.disposed)return;
    const bitmap=await createImageBitmap(blob,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
    if(this.disposed){bitmap.close();return;}
    this.bitmap=bitmap;this.texture.image=bitmap;this.texture.needsUpdate=true;this.loaded=true;
  }
  update(time,sun,moon) {
    if(this.disposed)return;
    const h=this.host,cover=Math.max(0,Math.min(1,(h.weather.cloudCover||0)/100));
    const weatherCloud=h.weather.code>=2,cloudy=weatherCloud||cover>.23;
    const storm=[95,96,97,99].includes(h.weather.code),wet=h.rainParticles.visible||h.flakes.visible;
    this.color.copy(this.day).lerp(this.rain,wet?.30:storm?.50:cover*.10).lerp(this.night,h.night*.78);
    for(let i=0;i<this.sprites.length;i++) {
      const sprite=this.sprites[i],material=this.materials[i];
      sprite.visible=cloudy&&this.loaded;
      if(!sprite.visible)continue;
      material.color.copy(this.color);
      let width,opacity;
      if(i===2) {
        const orb=sun.visible?h.sunPosition:moon.visible?h.moonPosition:null;
        sprite.visible=Boolean(orb);if(!orb)continue;
        // A thin veil crosses only the lower edge, leaving the glowing disc legible.
        sprite.position.copy(orb).addScaledVector(h.cameraRight,.43+Math.sin(time*.08)*.05).addScaledVector(h.cameraUp,-.22).addScaledVector(h.cameraForward,-.15);
        width=1.65;opacity=.24+cover*.22;
      } else {
        const side=i===0?-.54:i===1?.54:-.03;
        const x=side*Math.min(h.camera.right,3.7)+Math.sin(time*(.020+i*.004)+i*2)*.09;
        const height=i===0?.55:i===1?.65:.83;
        sprite.position.copy(h.target).addScaledVector(h.cameraRight,x).addScaledVector(h.cameraUp,h.camera.top*height).addScaledVector(h.cameraForward,2.9);
        width=i===0?2.20:i===1?1.85:1.40;
        opacity=i===3?(cover>.65?.23:0):(.42+cover*.42)*(i===0?1:.82);
      }
      const edgeWidth=Math.min(width,(h.camera.right-h.camera.left)*.46);
      sprite.scale.set(edgeWidth,edgeWidth*.50,1);
      material.opacity=opacity*(1-h.night*.17);
    }
  }
  getDiagnostics(){return {loaded:this.loaded,error:this.error,sprites:this.sprites.length,pixels:this.bitmap?this.bitmap.width*this.bitmap.height:0};}
  dispose() {
    if(this.disposed)return;
    this.disposed=true;this.controller.abort();
    for(const sprite of this.sprites)sprite.removeFromParent();
    this.bitmap?.close();this.bitmap=null;this.texture.image=null;
    this.sprites=[];this.materials=[];this.host=null;
  }
}
