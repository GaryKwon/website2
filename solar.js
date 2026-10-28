/* Wall-clock solar positioning. All dates are absolute epoch milliseconds. */
(() => {
  'use strict';
  const DAY = 86400000;
  const TAU = Math.PI * 2;
  const clamp = value => Math.max(0, Math.min(1, value));
  const smoothstep = value => { const p = clamp(value); return p * p * (3 - 2 * p); };

  function getState(solar, now = Date.now()) {
    const input = solar && typeof solar === 'object' ? solar : {};
    const isFallbackDay = Boolean(input.isDay);
    const rise = Number.isFinite(input.sunriseAt) ? input.sunriseAt : null;
    const set = Number.isFinite(input.sunsetAt) ? input.sunsetAt : null;
    const daylight = Number.isFinite(input.daylightDuration) ? input.daylightDuration : null;
    const validNow = Number.isFinite(now);

    if (daylight === 0) {
      return {isDay:false,visible:false,progress:null,x:400,y:535,opacity:0,mode:'polar-night'};
    }
    if (daylight !== null && daylight >= 86399 && validNow) {
      // A continuous, always-above-horizon loop for the midnight sun.
      const anchor = rise === null ? Math.floor(now / DAY) * DAY : rise;
      const progress = ((now - anchor) % DAY + DAY) % DAY / DAY;
      const angle = progress * TAU;
      return {isDay:true,visible:true,progress,x:400 + 250 * Math.cos(angle),y:230 - 120 * Math.sin(angle),opacity:1,mode:'polar-day'};
    }
    if (validNow && rise !== null && set !== null && set > rise && set - rise <= DAY) {
      const duration = set - rise;
      const phase = clamp((now - rise) / duration);
      const isDay = now >= rise && now < set;
      const fade = Math.min(5 * 60000, duration / 5);
      const opacity = isDay ? smoothstep(Math.min((now - rise) / fade, (set - now) / fade)) : 0;
      return {
        isDay,visible:isDay,progress:isDay ? phase : null,
        x:650 - 500 * phase,y:535 - 440 * Math.sin(Math.PI * phase),opacity,mode:'normal'
      };
    }
    const isDay = daylight !== null && daylight >= 86399 ? true : isFallbackDay;
    return {isDay,visible:isDay,progress:null,x:578,y:130,opacity:isDay ? 1 : 0,mode:'fallback'};
  }

  function getMoonState(solar, now = Date.now()) {
    const input = solar && typeof solar === 'object' ? solar : {};
    const sun = getState(input, now);
    if(sun.isDay)return {isNight:false,visible:false,progress:null,x:400,y:95,opacity:0};
    if(input.daylightDuration===0){
      const phase=((now-(Number.isFinite(input.sunriseAt)?input.sunriseAt:0))%DAY+DAY)%DAY/DAY;
      return {isNight:true,visible:true,progress:phase,x:400+250*Math.cos(phase*TAU),y:230-120*Math.sin(phase*TAU),opacity:.9};
    }
    let start,end;
    if(Number.isFinite(input.sunsetAt)&&now>=input.sunsetAt){start=input.sunsetAt;end=input.nextSunriseAt;}
    else{start=input.previousSunsetAt;end=input.sunriseAt;}
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start){
      return {isNight:true,visible:true,progress:.5,x:400,y:95,opacity:.9};
    }
    const phase=clamp((now-start)/(end-start));
    const fade=Math.min(10*60000,(end-start)/5);
    const opacity=smoothstep(Math.min((now-start)/fade,(end-now)/fade));
    return {isNight:true,visible:now>=start&&now<end,progress:phase,x:650-500*phase,y:535-440*Math.sin(Math.PI*phase),opacity};
  }
  window.SolarClock = Object.freeze({getState,getMoonState});
})();
