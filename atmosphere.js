/* Quiet weather palettes, blended against the location's real solar clock. */
(() => {
  'use strict';
  const TWILIGHT = 30 * 60000;
  const DAY = 86400000;
  const clamp = value => Math.max(0, Math.min(1, value));
  const smoothstep = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
  const palettes = {
    clear: ['#496b75', '#607e76', '#9aa786', '#e8cda5'],
    cold: ['#4c617d', '#607a8e', '#91a4ad', '#c7d7e1'],
    hot: ['#6e7370', '#8e7c68', '#b39877', '#f2ce98'],
    cloudy: ['#506675', '#637c86', '#93a19f', '#c8d3d0'],
    rain: ['#394f69', '#506a7e', '#7a8d99', '#b6cbd1'],
    snow: ['#56627f', '#71839a', '#a3b4bd', '#d5dce3'],
    fog: ['#4c6360', '#677b75', '#95a699', '#c8d4c9'],
    storm: ['#253c58', '#3c536e', '#65778b', '#9db6cc']
  };
  const nightPalettes = {
    clear: ['#111b35', '#25324d', '#4b465d', '#b7c3e2'],
    cloudy: ['#152439', '#2b3b52', '#4b5569', '#9aaecb'],
    rain: ['#10292f', '#1d3d46', '#355360', '#8da6b4'],
    snow: ['#19243e', '#34435d', '#6a6b85', '#b5c6de'],
    fog: ['#1c2f35', '#33484d', '#57676a', '#a5b8ba'],
    storm: ['#0b172a', '#1a2c43', '#35405a', '#7e9aba']
  };
  const dawn = ['#5b6c88', '#997b88', '#c8a38c', '#ffe0b8'];
  const dusk = ['#615775', '#a1767c', '#c59a80', '#ffcf9d'];
  const rainCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
  const snowCodes = new Set([71, 73, 75, 77, 85, 86]);
  const stormCodes = new Set([95, 96, 97, 99]);

  function blendColor(a, b, amount) {
    const weight = clamp(amount);
    let result = '#';
    for (let channel = 1; channel < 7; channel += 2) {
      const from = parseInt(a.slice(channel, channel + 2), 16);
      const to = parseInt(b.slice(channel, channel + 2), 16);
      result += Math.round(from + (to - from) * weight).toString(16).padStart(2, '0');
    }
    return result;
  }
  const blendPalette = (from, to, weight) => from.map((color, index) => blendColor(color, to[index], weight));

  function weatherKind(weather) {
    const code = Number.isFinite(weather.code) ? weather.code : 0;
    if (stormCodes.has(code)) return 'storm';
    if (snowCodes.has(code)) return 'snow';
    if (rainCodes.has(code)) return 'rain';
    if (code === 45 || code === 48) return 'fog';
    if (code === 2 || code === 3 || weather.cloudCover >= 65) return 'cloudy';
    return 'clear';
  }

  function getTheme(weather = {}, solarInput = {}, now = Date.now()) {
    const conditions = weather && typeof weather === 'object' ? weather : {};
    const solar = solarInput && typeof solarInput === 'object' ? solarInput : {};
    const kind = weatherKind(conditions);
    const temperature = Number.isFinite(conditions.temp) ? conditions.temp : 16;
    let dayPalette = palettes[kind];
    if (kind === 'clear') {
      dayPalette = blendPalette(dayPalette, palettes.cold, clamp((10 - temperature) / 12));
      dayPalette = blendPalette(dayPalette, palettes.hot, clamp((temperature - 24) / 12));
      const haze = Number.isFinite(conditions.cloudCover) ? clamp((conditions.cloudCover - 10) / 100) * .24 : 0;
      dayPalette = blendPalette(dayPalette, palettes.cloudy, haze);
    } else if (temperature < 2 && kind !== 'snow') {
      dayPalette = blendPalette(dayPalette, palettes.cold, .15 * clamp((2 - temperature) / 10));
    }

    const clock = window.SolarClock?.getState(solar, now);
    let nightAmount = (clock ? clock.isDay : !!solar.isDay) ? 0 : 1;
    let warmAmount = 0;
    let twilightPalette = dusk;
    const duration = Number.isFinite(solar.daylightDuration) ? solar.daylightDuration : null;
    const rise = solar.sunriseAt;
    const set = solar.sunsetAt;
    const validTimes = Number.isFinite(now) && Number.isFinite(rise) && Number.isFinite(set) && set > rise && set - rise <= DAY;
    if (duration === 0) {
      nightAmount = 1;
    } else if (duration !== null && duration >= 86399) {
      nightAmount = 0;
    } else if (validTimes) {
      const dawnLight = smoothstep((now - rise + TWILIGHT) / (TWILIGHT * 2));
      const duskLight = 1 - smoothstep((now - set + TWILIGHT) / (TWILIGHT * 2));
      nightAmount = 1 - dawnLight * duskLight;
      const nearRise = Math.abs(now - rise);
      const nearSet = Math.abs(now - set);
      warmAmount = 1 - smoothstep(Math.min(nearRise, nearSet) / TWILIGHT);
      twilightPalette = nearRise < nearSet ? dawn : dusk;
    }
    const base = blendPalette(dayPalette, nightPalettes[kind], nightAmount);
    const weatherWarmth = kind === 'storm' ? .35 : kind === 'rain' ? .48 : kind === 'fog' ? .55 : .74;
    const colors = blendPalette(base, twilightPalette, warmAmount * weatherWarmth);
    const period = nightAmount >= .98 ? 'night' : nightAmount <= .02 ? 'day' : 'twilight';
    return {top: colors[0], mid: colors[1], bottom: colors[2], glow: colors[3], nightAmount, period, weatherKind: kind};
  }

  window.WeatherAtmosphere = Object.freeze({getTheme});
})();
