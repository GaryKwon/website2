(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const scene = new window.TreeScene($('treeCanvas'));
  const SEASONS = {spring:'봄',summer:'여름',autumn:'가을',winter:'겨울'};
  const city = (id,name,en,country,lat,lon,aliases=[]) => ({id,name,en,country,latitude:lat,longitude:lon,aliases:[name,en,...aliases]});
  const CITIES = [
    city('seoul','서울','Seoul','대한민국',37.5665,126.978,['서울시','서울특별시']),
    city('jeju','제주','Jeju','대한민국',33.4996,126.5312,['제주시','제주도']),
    city('busan','부산','Busan','대한민국',35.1796,129.0756,['부산시','부산광역시']),
    city('incheon','인천','Incheon','대한민국',37.4563,126.7052),
    city('daegu','대구','Daegu','대한민국',35.8714,128.6014),
    city('daejeon','대전','Daejeon','대한민국',36.3504,127.3845),
    city('gwangju','광주','Gwangju','대한민국',35.1595,126.8526),
    city('ulsan','울산','Ulsan','대한민국',35.5384,129.3114),
    city('suwon','수원','Suwon','대한민국',37.2636,127.0286),
    city('sejong','세종','Sejong','대한민국',36.4801,127.289),
    city('seongnam','성남','Seongnam','대한민국',37.420,127.1265,['분당','판교']),
    city('goyang','고양','Goyang','대한민국',37.6584,126.832,['일산']),
    city('yongin','용인','Yongin','대한민국',37.2411,127.1776),
    city('hwaseong','화성','Hwaseong','대한민국',37.1995,126.8313,['동탄']),
    city('chuncheon','춘천','Chuncheon','대한민국',37.8813,127.73),
    city('gangneung','강릉','Gangneung','대한민국',37.7519,128.8761),
    city('sokcho','속초','Sokcho','대한민국',38.207,128.5918),
    city('wonju','원주','Wonju','대한민국',37.3422,127.9202),
    city('cheongju','청주','Cheongju','대한민국',36.6424,127.489),
    city('cheonan','천안','Cheonan','대한민국',36.8151,127.1139),
    city('jeonju','전주','Jeonju','대한민국',35.8242,127.148),
    city('yeosu','여수','Yeosu','대한민국',34.7604,127.6622),
    city('suncheon','순천','Suncheon','대한민국',34.9506,127.4872),
    city('mokpo','목포','Mokpo','대한민국',34.8118,126.3922),
    city('pohang','포항','Pohang','대한민국',36.019,129.3435),
    city('gyeongju','경주','Gyeongju','대한민국',35.8562,129.2247),
    city('changwon','창원','Changwon','대한민국',35.228,128.6811),
    city('seogwipo','서귀포','Seogwipo','대한민국',33.2541,126.56),
    city('tokyo','도쿄','Tokyo','일본',35.6762,139.6503,['동경']),
    city('osaka','오사카','Osaka','일본',34.6937,135.5023),
    city('sapporo','삿포로','Sapporo','일본',43.0618,141.3545),
    city('fukuoka','후쿠오카','Fukuoka','일본',33.5902,130.4017),
    city('london','런던','London','영국',51.5074,-.1278),
    city('paris','파리','Paris','프랑스',48.8566,2.3522),
    city('newyork','뉴욕','New York City','미국',40.7128,-74.006,['new york','nyc']),
    city('la','로스앤젤레스','Los Angeles','미국',34.0522,-118.2437,['엘에이','la']),
    city('sf','샌프란시스코','San Francisco','미국',37.7749,-122.4194,['sf']),
    city('seattle','시애틀','Seattle','미국',47.6062,-122.3321),
    city('sydney','시드니','Sydney','호주',-33.8688,151.2093),
    city('melbourne','멜버른','Melbourne','호주',-37.8136,144.9631),
    city('singapore','싱가포르','Singapore','싱가포르',1.3521,103.8198),
    city('bangkok','방콕','Bangkok','태국',13.7563,100.5018),
    city('taipei','타이베이','Taipei','대만',25.033,121.5654,['타이페이']),
    city('hongkong','홍콩','Hong Kong','홍콩',22.3193,114.1694),
    city('beijing','베이징','Beijing','중국',39.9042,116.4074,['북경']),
    city('shanghai','상하이','Shanghai','중국',31.2304,121.4737),
    city('berlin','베를린','Berlin','독일',52.52,13.405),
    city('rome','로마','Rome','이탈리아',41.9028,12.4964),
    city('vancouver','밴쿠버','Vancouver','캐나다',49.2827,-123.1207),
    city('auckland','오클랜드','Auckland','뉴질랜드',-36.8485,174.7633),
    city('montreal','몬트리올','Montreal','캐나다',45.5019,-73.5674,['몬트리얼','montréal']),
    city('toronto','토론토','Toronto','캐나다',43.6532,-79.3832),
    city('barcelona','바르셀로나','Barcelona','스페인',41.3874,2.1686),
    city('madrid','마드리드','Madrid','스페인',40.4168,-3.7038),
    city('lisbon','리스본','Lisbon','포르투갈',38.7223,-9.1393),
    city('prague','프라하','Prague','체코',50.0755,14.4378),
    city('vienna','빈','Vienna','오스트리아',48.2082,16.3738,['비엔나']),
    city('zurich','취리히','Zurich','스위스',47.3769,8.5417),
    city('dubai','두바이','Dubai','아랍에미리트',25.2048,55.2708),
    city('hanoi','하노이','Hanoi','베트남',21.0278,105.8342),
    city('danang','다낭','Da Nang','베트남',16.0544,108.2022),
    city('hochiminh','호찌민','Ho Chi Minh City','베트남',10.8231,106.6297,['호치민']),
    city('buenosaires','부에노스아이레스','Buenos Aires','아르헨티나',-34.6037,-58.3816)
  ];
  let state = {city:CITIES[0], data:null, season:'autumn', preview:null};
  let weatherController, searchController, searchTimer, results=[], selectedResult=-1, searchSequence=0, lastFetch=0;
  const normal = s => s.toLowerCase().trim().replace(/\s+/g,' ');
  const safeStorage = {get(key){try{return JSON.parse(localStorage.getItem(key))}catch{return null}},set(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}};
  const degree = v => Number.isFinite(v) ? `${Math.round(v)}°` : '—°';
  const number = (v,digits=0) => Number.isFinite(v) ? v.toFixed(digits) : '—';
  const weatherInfo = code => {
    if (code===0) return {label:'맑음',icon:'sun',type:'clear'};
    if (code===1) return {label:'대체로 맑음',icon:'sun',type:'clear'};
    if (code===2) return {label:'구름 조금',icon:'cloud',type:'cloud'};
    if (code===3) return {label:'흐림',icon:'cloud',type:'cloud'};
    if ([45,48].includes(code)) return {label:'안개',icon:'cloud',type:'fog'};
    if ([51,53,55,56,57].includes(code)) return {label:'이슬비',icon:'rain',type:'rain'};
    if ([61,63,65,66,67,80,81,82].includes(code)) return {label:'비',icon:'rain',type:'rain'};
    if ([71,73,75,77,85,86].includes(code)) return {label:'눈',icon:'snow',type:'snow'};
    if ([95,96,97,99].includes(code)) return {label:'뇌우',icon:'rain',type:'storm'};
    return {label:'날씨 정보 없음',icon:'cloud',type:'cloud'};
  };
  function icon(name) {const s=document.createElementNS('http://www.w3.org/2000/svg','svg');const u=document.createElementNS(s.namespaceURI,'use');u.setAttribute('href',`#i-${name}`);s.append(u);s.setAttribute('aria-hidden','true');return s;}
  function localDateKey(value,timezone){
    return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  }
  function getSeason(data,lat,now=Date.now()){
    let m=Number(new Intl.DateTimeFormat('en-US',{timeZone:data.timezone,month:'numeric'}).format(new Date(now)));
    if(lat<0)m=(m+5)%12+1;
    return m>=3&&m<=5?'spring':m>=6&&m<=8?'summer':m>=9&&m<=11?'autumn':'winter';
  }
  function solarInput(data,now=Date.now()){
    const fallback={sunriseAt:null,sunsetAt:null,previousSunsetAt:null,nextSunriseAt:null,daylightDuration:null,isDay:data?!!data.current.is_day:true};
    if(!data)return fallback;
    const day=localDateKey(now,data.timezone);
    const i=data.daily.time.findIndex(t=>localDateKey(t*1000,data.timezone)===day);
    if(i<0)return fallback;
    const rise=data.daily.sunrise[i],set=data.daily.sunset[i],duration=data.daily.daylight_duration[i];
    const previousSet=data.daily.sunset[i-1],nextRise=data.daily.sunrise[i+1];
    return {sunriseAt:Number.isFinite(rise)?rise*1000:null,sunsetAt:Number.isFinite(set)?set*1000:null,previousSunsetAt:Number.isFinite(previousSet)?previousSet*1000:null,nextSunriseAt:Number.isFinite(nextRise)?nextRise*1000:null,daylightDuration:Number.isFinite(duration)?duration:null,isDay:!!data.current.is_day};
  }
  function validForecast(data){
    return Number.isFinite(data?.current?.time)&&typeof data.timezone==='string'&&Array.isArray(data?.daily?.time)&&Array.isArray(data.daily.sunrise)&&Array.isArray(data.daily.sunset)&&Array.isArray(data.daily.daylight_duration);
  }
  function updateLocalClock(){
    if(!state.data)return;
    const now=Date.now(),zone=state.data.timezone;
    const time=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(now))+' 현지';
    const date=new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long',timeZone:zone}).format(new Date(now));
    if($('cityTime').textContent!==time)$('cityTime').textContent=time;
    if($('fullDate').textContent!==date)$('fullDate').textContent=date;
    const w=weatherInfo(state.data.current.weather_code);
    const daylight=window.SolarClock.getState(solarInput(state.data,now),now).isDay;
    $('mainWeatherIcon').firstElementChild.setAttribute('href',`#i-${w.icon==='sun'&&!daylight?'moon':w.icon}`);
    state.season=getSeason(state.data,state.city.latitude,now);
  }
  function showNotice(message,retry=false) {$('notice').replaceChildren(document.createTextNode(message));$('notice').hidden=false;if(retry){const b=document.createElement('button');b.textContent='다시 시도';b.onclick=()=>loadWeather(state.city,true);$('notice').append(b)}}
  function hideNotice(){$('notice').hidden=true;}
  function clearForecast(){
    $('cityTime').textContent='—';
    $('mainWeatherIcon').firstElementChild.setAttribute('href','#i-cloud');
    $('temperature').replaceChildren(document.createTextNode('—'),Object.assign(document.createElement('span'),{textContent:'°'}));
    $('weatherLabel').textContent='날씨를 불러오는 중';
    $('fullDate').textContent='—';
    ['tempMax','tempMin','feelsLike'].forEach(id=>$(id).textContent='—°');
    ['humidity','wind','rainChance'].forEach(id=>$(id).textContent='—');
  }
  async function fetchJSON(url,signal) {
    const response=await fetch(url,{signal});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  async function loadWeather(place,force=false) {
    if(weatherController)weatherController.abort();
    weatherController=new AbortController();
    const controller=weatherController;
    const timeout=setTimeout(()=>controller.abort('timeout'),18000);
    const changed=state.city.id!==place.id;
    const memoryCache=!changed&&state.data?{data:state.data,at:lastFetch}:null;
    state.city=place;
    state.preview=null;
    $('previewBadge').hidden=true;
    if(changed)state.data=null;
    $('weatherPanel').setAttribute('aria-busy','true');
    $('cityName').textContent=place.name;
    $('cityDetail').textContent=place.country||'';
    $('refreshButton').classList.add('spinning');
    hideNotice();
    if(changed)clearForecast();
    const key=`weather-tree:mood-v1:${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`;
    const cached=safeStorage.get(key)||memoryCache;
    if(!force&&cached&&validForecast(cached.data)&&Date.now()-cached.at<10*60*1000&&localDateKey(cached.data.current.time*1000,cached.data.timezone)===localDateKey(Date.now(),cached.data.timezone)){
      clearTimeout(timeout);
      state.data=cached.data;
      lastFetch=cached.at;
      render();
      return;
    }
    const params=new URLSearchParams({latitude:place.latitude,longitude:place.longitude,current:'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m',daily:'temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,daylight_duration',timezone:'auto',timeformat:'unixtime',wind_speed_unit:'ms',forecast_days:'2',past_days:'1'});
    try{
      const data=await fetchJSON(`https://api.open-meteo.com/v1/forecast?${params}`,controller.signal);
      if(controller!==weatherController)return;
      if(!validForecast(data))throw new Error('Incomplete forecast');
      state.data=data;
      lastFetch=Date.now();
      safeStorage.set(key,{data,at:lastFetch});
      safeStorage.set('weather-tree:last-city',place);
      render();
    }catch(error){
      if(controller!==weatherController)return;
      if(cached&&validForecast(cached.data)&&Date.now()-cached.at<24*60*60*1000){
        state.data=cached.data;
        lastFetch=cached.at;
        render();
        showNotice('최신 날씨에 연결하지 못해 마지막으로 받아온 예보를 보여드려요.',true);
      }else{
        state.data=null;
        clearForecast();
        $('weatherLabel').textContent='날씨 연결 필요';
        showNotice('날씨를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',true);
        updateScene();
      }
    }finally{
      clearTimeout(timeout);
      if(controller===weatherController){
        $('refreshButton').classList.remove('spinning');
        $('weatherPanel').setAttribute('aria-busy','false');
      }
    }
  }
  function render(){
    const {current:c,daily:d}=state.data;
    state.season=getSeason(state.data,state.city.latitude);
    const w=weatherInfo(c.weather_code);
    $('cityName').textContent=state.city.name;
    $('cityDetail').textContent=state.city.country||'';
    updateLocalClock();
    $('temperature').replaceChildren(document.createTextNode(number(c.temperature_2m)),Object.assign(document.createElement('span'),{textContent:'°'}));
    $('weatherLabel').textContent=w.label;

    const day=Math.max(0,d.time.findIndex(t=>localDateKey(t*1000,state.data.timezone)===localDateKey(Date.now(),state.data.timezone)));
    $('tempMax').textContent=degree(d.temperature_2m_max[day]);
    $('tempMin').textContent=degree(d.temperature_2m_min[day]);
    $('feelsLike').textContent=degree(c.apparent_temperature);
    setMetric('humidity',c.relative_humidity_2m,'%');
    setMetric('wind',c.wind_speed_10m,'m/s',1);
    setMetric('rainChance',d.precipitation_probability_max[day],'%');
    $('weatherPanel').setAttribute('aria-busy','false');
    $('refreshButton').classList.remove('spinning');
    updateScene();
  }
  function setMetric(id,value,unit,digits=0){
    $(id).replaceChildren(document.createTextNode(number(value,digits)),Object.assign(document.createElement('small'),{textContent:unit}));
  }
  function updateScene(){
    const c=state.data?.current;
    let code=c?.weather_code??0,wind=(c?.wind_speed_10m??2)*3.6;
    if(state.preview){
      code=({clear:0,rain:63,snow:73,wind:2})[state.preview];
      wind=state.preview==='wind'?32:state.preview==='rain'?14:state.preview==='snow'?7:5;
    }
    const solar=solarInput(state.data);
    const cloudCover=state.preview?({clear:5,rain:95,snow:95,wind:55})[state.preview]:(c?.cloud_cover??0);
    const conditions={code,wind,temp:c?.temperature_2m??15,cloudCover};
    const theme=window.WeatherAtmosphere.getTheme(conditions,solar);
    const body=document.body;
    for(const key of ['top','mid','bottom','glow'])body.style.setProperty('--sky-'+key,theme[key]);
    body.style.setProperty('--night-amount',theme.nightAmount.toFixed(4));
    const sun=window.SolarClock.getState(solar),moon=window.SolarClock.getMoonState(solar);
    const light=sun.visible?sun:moon;
    body.style.setProperty('--sky-light-x',`${Math.round((light.x-150)/500*80+10)}%`);
    body.dataset.period=theme.period;body.dataset.weather=theme.weatherKind;
    scene.setWeather({locationKey:`${state.city.latitude},${state.city.longitude}`,season:state.season,...conditions,isDay:solar.isDay,solar,nightAmount:theme.nightAmount});
    $('landscape').dataset.season=state.season;
    $('previewBadge').hidden=!state.preview;
    $('previewBadge').setAttribute('aria-label','실제 날씨로 돌아가기');
    document.querySelectorAll('[data-weather]').forEach(b=>{
      const active=b.dataset.weather===state.preview;
      b.classList.toggle('active',active);
      b.setAttribute('aria-pressed',String(active));
    });
    const w=weatherInfo(code);
    $('treeCanvas').setAttribute('aria-label',`${state.city.name}, ${SEASONS[state.season]}의 ${w.label} 풍경. ${state.preview?'미리보기.':''} 바람에 흔들리는 나무. 좌우로 드래그하거나 방향키로 360도 회전할 수 있습니다.`);
  }
  function renderResults(items,message){
    results=items;selectedResult=-1;const holder=$('searchResults');holder.replaceChildren();
    if(!items.length){const p=document.createElement('div');p.className='search-message';p.textContent=message||'도시를 찾지 못했어요. 영어 이름으로도 검색해 보세요. 예: Paris';holder.append(p);}
    items.forEach((place,i)=>{
      const button=document.createElement('button');button.type='button';button.className='search-result';button.id=`city-option-${i}`;button.setAttribute('role','option');button.setAttribute('aria-selected','false');button.append(icon('pin'));
      const text=document.createElement('span'),name=document.createElement('strong'),detail=document.createElement('small');name.textContent=place.name;detail.textContent=[place.country,place.admin,place.en!==place.name?place.en:null].filter(Boolean).join(' · ');text.append(name,detail);button.append(text);button.onclick=()=>selectCity(place);holder.append(button);
    });
    holder.hidden=false;$('citySearch').setAttribute('aria-expanded','true');
  }
  function closeSearch(){searchSequence++;clearTimeout(searchTimer);searchController?.abort();$('searchResults').hidden=true;$('citySearch').setAttribute('aria-expanded','false');$('citySearch').removeAttribute('aria-activedescendant');selectedResult=-1;}
  async function searchCities(query){
    const q=normal(query),sequence=++searchSequence;if(!q){closeSearch();return;}
    searchController?.abort();searchController=new AbortController();
    const local=CITIES.filter(c=>c.aliases.some(a=>normal(a).includes(q))).slice(0,6);
    if(local.length){renderResults(local);return;}
    if(q.length<2){renderResults([],'도시 이름을 두 글자 이상 입력해 주세요.');return;}
    renderResults([],'도시를 찾아보고 있어요…');
    try{
      const data=await fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({name:q,count:8,language:'ko',format:'json'})}`,searchController.signal);
      if(sequence!==searchSequence)return;
      const items=(data.results||[]).sort((a,b)=>(b.population||0)-(a.population||0)).map(p=>({id:`geo-${p.id}`,name:p.name,en:'',country:p.country||'',admin:p.admin1&&p.admin1!==p.name?p.admin1:'',latitude:p.latitude,longitude:p.longitude}));renderResults(items);
    }catch(error){if(error.name!=='AbortError'&&sequence===searchSequence)renderResults([],'지역 검색에 연결하지 못했어요. 잠시 후 다시 검색해 주세요.');}
  }
  function selectCity(place){closeSearch();$('citySearch').value='';$('citySearch').blur();$('previewMenu').hidden=true;$('previewButton').setAttribute('aria-expanded','false');loadWeather(place);}
  $('citySearch').addEventListener('input',()=>{closeSearch();results=[];const q=$('citySearch').value.trim();if(!q)return;searchTimer=setTimeout(()=>searchCities(q),300);});
  $('citySearch').addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeSearch();return;}
    if((e.key==='ArrowDown'||e.key==='ArrowUp')&&results.length&&!$('searchResults').hidden){e.preventDefault();selectedResult=selectedResult<0?(e.key==='ArrowDown'?0:results.length-1):(selectedResult+(e.key==='ArrowDown'?1:-1)+results.length)%results.length;[...$('searchResults').children].forEach((b,i)=>{b.classList.toggle('selected',i===selectedResult);b.setAttribute('aria-selected',String(i===selectedResult));});$('citySearch').setAttribute('aria-activedescendant',`city-option-${selectedResult}`);$('searchResults').children[selectedResult].scrollIntoView({block:'nearest'});}
  });
  $('searchForm').addEventListener('submit',e=>{e.preventDefault();if(selectedResult>=0&&!$('searchResults').hidden){selectCity(results[selectedResult]);return;}const query=$('citySearch').value.trim();if(query)searchCities(query);else{$('citySearch').focus();renderResults(CITIES.slice(0,6),'도시를 선택해 주세요.');}});
  $('previewButton').onclick=()=>{const open=$('previewMenu').hidden;$('previewMenu').hidden=!open;$('previewButton').setAttribute('aria-expanded',String(open));};
  document.querySelectorAll('[data-weather]').forEach(b=>b.onclick=()=>{state.preview=b.dataset.weather;updateScene();$('previewMenu').hidden=true;$('previewButton').setAttribute('aria-expanded','false');});
  function resetPreview(){state.preview=null;if(state.data)state.season=getSeason(state.data,state.city.latitude);updateScene();$('previewMenu').hidden=true;$('previewButton').setAttribute('aria-expanded','false');}
  $('returnLive').onclick=resetPreview;$('previewBadge').onclick=resetPreview;
  document.addEventListener('click',e=>{if(!e.target.closest('.search-form'))closeSearch();if(!e.target.closest('.preview-menu')&&!e.target.closest('.preview-trigger')){$('previewMenu').hidden=true;$('previewButton').setAttribute('aria-expanded','false');}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('previewMenu').hidden=true;$('previewButton').setAttribute('aria-expanded','false');}});
  $('refreshButton').onclick=()=>{if($('weatherPanel').getAttribute('aria-busy')!=='true')loadWeather(state.city,true)};
  $('locateButton').onclick=()=>{
    if(!navigator.geolocation){showNotice('이 브라우저에서는 위치를 확인할 수 없어요. 도시 이름으로 검색해 주세요.');return;}
    $('locateButton').disabled=true;$('locateButton').querySelector('svg').classList.add('spinning');
    navigator.geolocation.getCurrentPosition(pos=>{
      $('locateButton').disabled=false;$('locateButton').querySelector('svg').classList.remove('spinning');
      const {latitude,longitude}=pos.coords;
      const nearest=CITIES.map(c=>({city:c,d:Math.hypot((c.latitude-latitude)*111,(c.longitude-longitude)*111*Math.cos(latitude*Math.PI/180))})).sort((a,b)=>a.d-b.d)[0];
      const place={id:'my-location',name:nearest.d<30?`${nearest.city.name} 근처`:'내 위치',en:`${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`,country:nearest.d<30?nearest.city.country:'현재 위치',latitude,longitude};selectCity(place);
    },error=>{$('locateButton').disabled=false;$('locateButton').querySelector('svg').classList.remove('spinning');showNotice(error.code===1?'위치 사용이 허용되지 않았어요. 브라우저 설정에서 허용하거나 도시 이름으로 검색해 주세요.':'현재 위치를 확인하지 못했어요. 도시 이름으로 검색해 주세요.');},{enableHighAccuracy:false,timeout:12000,maximumAge:300000});
  };
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden||!state.data)return;
    updateLocalClock();updateScene();
    if(Date.now()-lastFetch>20*60*1000)loadWeather(state.city,true);
  });
  const clockInterval=setInterval(()=>{
    if(document.hidden||!state.data)return;
    updateLocalClock();
    updateScene();
    const newDay=localDateKey(state.data.current.time*1000,state.data.timezone)!==localDateKey(Date.now(),state.data.timezone);
    if((newDay||Date.now()-lastFetch>=15*60*1000)&&$('weatherPanel').getAttribute('aria-busy')!=='true')loadWeather(state.city,true);
  },60000);
  window.addEventListener('pagehide',event=>{
    if(event.persisted)return;
    clearInterval(clockInterval);clearTimeout(searchTimer);
    weatherController?.abort();searchController?.abort();
    scene.destroy();
  },{once:false});
  window.addEventListener('pageshow',event=>{
    if(event.persisted&&state.data){updateLocalClock();updateScene();}
  });
  const saved=safeStorage.get('weather-tree:last-city');
  if(saved&&typeof saved.name==='string'&&Number.isFinite(saved.latitude)&&Number.isFinite(saved.longitude)&&Math.abs(saved.latitude)<=90&&Math.abs(saved.longitude)<=180)state.city=saved;
  loadWeather(state.city);
})();
