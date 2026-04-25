/* === REDIRECT BLOCKER === */
if(window.navigation){window.navigation.addEventListener('navigate',function(e){try{if(new URL(e.destination.url,location.href).origin!==location.origin)e.preventDefault();}catch(x){}});}
try{Object.defineProperty(window,'open',{value:function(){return null},writable:false,configurable:false});}catch(e){window.open=function(){return null};}

document.addEventListener('click',function(e){
  const a=e.target.closest&&e.target.closest('a');
  if(!a)return;
  const href=(a.getAttribute('href')||'').trim(),target=(a.getAttribute('target')||'').toLowerCase();

  if(!href||href.startsWith('#')||href.startsWith('javascript:'))return;
  if(target==='_blank'||target==='_top'||target==='_parent'){
    try{
      if(new URL(href,location.href).origin!==location.origin){
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }catch(x){
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }
},true);

/* === SCRAPER === */
const BASE="https://hianime.ad",PROXY="https://api.codetabs.com/v1/proxy/?quest=";
const GENRES=['Action','Adventure','Cars','Comedy','Dementia','Demons','Drama','Ecchi','Fantasy','Game','Harem','Historical','Horror','Isekai','Josei','Kids','Magic','Martial Arts','Mecha','Military','Music','Mystery','Parody','Police','Psychological','Romance','Samurai','School','Sci-Fi','Seinen','Shoujo','Shoujo Ai','Shounen','Shounen Ai','Slice of Life','Space','Sports','Super Power','Supernatural','Thriller','Vampire'];
const cache={};
async function fetchHTML(u){return(await fetch(PROXY+encodeURIComponent(u))).text();}
async function fetchJSON(u){return(await fetch(u)).json();} // Direct fetch to bypass proxy blocking for anisync
function text(e){return e?.textContent?.trim()||null}
function attr(e,a){return e?.getAttribute(a)||null}
function abs(u){if(!u)return null;if(u.startsWith("http"))return u;if(u.startsWith("//"))return"https:"+u;if(u.startsWith("/"))return BASE+u;return BASE+"/"+u;}
function parseDoc(h){return new DOMParser().parseFromString(h,"text/html");}
function num(t){if(!t)return null;const m=t.match(/\d+/);return m?+m[0]:null;}

function parseMeta(card){
  const a=card.querySelector("a.film-poster-ahref") || card.querySelector("a");
  const img=card.querySelector("img.film-poster-img") || card.querySelector("img");
  const tE=card.querySelector(".film-name, .dynamic-name");
  const meta=card.querySelectorAll(".tick-item, .fdi-item");

  let link=attr(a,"href") || "";
  link=link.split('?')[0].split('#')[0];
  
  let id = link.split("/").pop(); 
  if(link.includes('/watch/')) { id = link.split("/")[2] || id; } 
  else if(link.includes('/anime/')) { id = link.split("/").pop(); }

  let sub=null,dub=null,type=null,min=null,eps=null;
  meta.forEach(m=>{
     const t=m.textContent.trim();
     if(m.classList.contains("tick-sub"))sub=num(t);
     else if(m.classList.contains("tick-dub"))dub=num(t);
     else if(m.classList.contains("tick-eps"))eps=num(t);
     else if(t.match(/TV|Movie|ONA|OVA|Special/i))type=t;
     else if(t.match(/^\d+m$/i) || t.includes("min") || (t.match(/^\d+$/) && !m.classList.contains("tick-sub") && !m.classList.contains("tick-dub"))) min=num(t);
  });
  return{id,title:text(tE),cover:abs(attr(img,"data-src")||attr(img,"src")),sub,dub,episodes:eps,type,minutes:min,detail:abs(link)};
}
function parseCards(doc){return[...doc.querySelectorAll(".flw-item")].map(parseMeta);}

function parseRecommended(doc){
  for(const h of[...doc.querySelectorAll(".cat-heading")]){
      if(h.textContent.toLowerCase().includes("recommended")){
          const s=h.closest(".block_area");
          if(s)return parseCards(s);
      }
  }
  return[];
}

async function homeAPI(){
  if(cache.home)return cache.home;
  const doc=parseDoc(await fetchHTML(BASE+"/home"));
  const spotlight=[...doc.querySelectorAll(".deslide-wrap .swiper-slide")].map((s,i)=>{
    const a=s.querySelector(".desi-buttons a.btn-secondary") || s.querySelector("a"); 
    const img=s.querySelector("img.film-poster-img");
    const t=s.querySelector(".desi-head-title, .film-title");
    const d=s.querySelector(".desi-description");
    let link=attr(a,"href")||""; link=link.split('?')[0].split('#')[0];
    
    let id=link.split("/").pop();
    if(link.includes('/anime/')) id = link.split("/").pop();
    else if(link.includes('/watch/')) id = link.split("/")[2] || id;

    const me=s.querySelectorAll(".scd-item, .tick-item");
    let sub=null,dub=null,hd=null,rated=null;
    me.forEach(m=>{
      const x=m.textContent.trim();
      if(m.classList.contains("tick-sub"))sub=num(x);
      else if(m.classList.contains("tick-dub"))dub=num(x);
      else if(x==="HD")hd="HD";
      else if(x.includes("+") || x==="R" || x==="PG-13")rated=x;
    });
    return{spotlightNumber:i+1,id,title:text(t),description:text(d),cover:abs(attr(img,"data-src")||attr(img,"src")),sub,dub,hd,rated};
  }).filter(s => s.title);
  
  const trending=[...doc.querySelectorAll("#trending-home .swiper-slide")].map(s=>{
    const t=s.querySelector(".film-title");
    const img=s.querySelector("img.film-poster-img") || s.querySelector("img");
    const a=s.querySelector("a.film-poster") || s.querySelector("a");
    const n=s.querySelector(".number span");
    let link=attr(a,"href")||""; link=link.split('?')[0].split('#')[0];
    let id=link.split("/").pop();
    if(link.includes('/anime/')) id = link.split("/").pop();
    return{rank:Number(text(n)),id:id,title:text(t),cover:abs(attr(img,"data-src")||attr(img,"src"))};
  }).filter(t => t.title);

  const featured={topAiring:[],mostPopular:[],mostFavorite:[],latestCompleted:[]};
  [...doc.querySelectorAll(".anif-block")].forEach(b=>{
    const h=text(b.querySelector(".anif-block-header"));
    const items=[...b.querySelectorAll("li")].map(li => {
        const a = li.querySelector("a.dynamic-name") || li.querySelector("a");
        const img = li.querySelector("img");
        let link=attr(a,"href")||""; link=link.split('?')[0].split('#')[0];
        let id=link.split("/").pop();
        if(link.includes('/anime/')) id = link.split("/").pop();
        let sub=num(text(li.querySelector(".tick-sub")));
        let dub=num(text(li.querySelector(".tick-dub")));
        let type=text(li.querySelector(".fdi-item"));
        return {id, title:text(a), cover:abs(attr(img,"data-src")||attr(img,"src")), sub, dub, type};
    }).filter(i => i.title);
    
    if(h?.includes("Top Airing"))featured.topAiring=items;
    else if(h?.includes("Most Popular"))featured.mostPopular=items;
    else if(h?.includes("Completed"))featured.latestCompleted=items;
  });

  function byHeading(t){
    for(const h of[...doc.querySelectorAll(".cat-heading")]){
      if(h.textContent.trim()===t){
        const s=h.closest(".block_area");
        if(s)return parseCards(s);
      }
    }
    return[];
  }

  const r={spotlight:spotlight.slice(0,10),trending,featured,latestEpisode:byHeading("Latest Episode"),newOnZanivo:byHeading("New Releases"),topUpcoming:byHeading("Top Upcoming")};
  cache.home=r;return r;
}

async function animeAPI(rawId){
  if(!rawId)return{error:"Missing id"};
  const id = rawId.split('?')[0].split('#')[0]; 
  const doc=parseDoc(await fetchHTML(BASE+"/anime/"+id));
  const cover=attr(doc.querySelector(".film-poster img"),"data-src")||attr(doc.querySelector(".film-poster img"),"src");
  
  const infoWrap = doc.querySelector(".anisc-detail") || doc;
  const title=text(infoWrap.querySelector(".film-name, .dynamic-name"));
  let rated=text(infoWrap.querySelector(".tick-pg, .tick-rate, .fdi-rate"));
  let hd=text(infoWrap.querySelector(".tick-quality"));
  let sub=num(text(infoWrap.querySelector(".tick-sub")));
  let dub=num(text(infoWrap.querySelector(".tick-dub")));
  let duration=null;
  let type=null;

  infoWrap.querySelectorAll(".item, .fdi-item, .tick-item").forEach(m=>{
    const t = m.textContent.trim();
    if(t.match(/^(TV|Movie|ONA|OVA|Special)$/i)) type = t;
    if(!duration && (t.match(/^\d+m$/i) || t.includes("min") || (t.match(/^\d+$/) && !m.classList.contains("tick-sub") && !m.classList.contains("tick-dub")))) duration = t;
  });

  let overview=null;
  const descBox=doc.querySelector(".film-description .text");
  if(descBox) overview=text(descBox);

  const genres=[...doc.querySelectorAll(".item-list a")||[]].map(a=>text(a));
  const studios=[],producers=[];let japanese=null,synonyms=null,aired=null,premiered=null,status=null,malScore=null;
  
  const iw=doc.querySelector(".anisc-info");
  if(iw){
     for(const it of[...iw.querySelectorAll(".item")]){
       const h=it.querySelector(".item-head");
       if(!h)continue;
       const nm=it.querySelector(".name");
       const lk=[...it.querySelectorAll("a")].map(a=>text(a));
       const tc=nm?text(nm):null;
       const hText = h.textContent.trim().toLowerCase();
       if(hText.includes("studios")) studios.push(...lk);
       else if(hText.includes("producers")) producers.push(...lk);
       else if(hText.includes("japanese")) japanese=tc;
       else if(hText.includes("synonyms")) synonyms=tc;
       else if(hText.includes("aired")) aired=tc;
       else if(hText.includes("premiered")) premiered=tc;
       else if(hText.includes("status")) status=tc;
       else if(hText.includes("mal score")) malScore=tc;
     }
  }
  
  const seasons=[...doc.querySelectorAll(".block_area-seasons .os-item")].map(a=>({
      id:attr(a,"href")?.split("/").pop(),
      title:text(a.querySelector(".title")),
      cover:a.querySelector(".season-poster")?.style.backgroundImage?.replace(/^url\(['"]?|['"]?\)$/g,"")||null,
      detail:abs(attr(a,"href"))
  }));
  
  const playBtn = doc.querySelector(".film-buttons .btn-play");
  let firstEpId = null;
  if(playBtn) {
     const href = attr(playBtn, "href"); 
     if(href) firstEpId = href.split('/').pop();
  }

  return{id:id,title,cover:abs(cover),rated,hd,overview,sub,dub,type,duration,genres,studios,producers,japanese,synonyms,aired,premiered,status,malScore,moreSeasons:seasons,firstEpId:firstEpId,recommended:parseRecommended(doc)};
}

async function watchAPI(aid,eid){
  if(!aid||!eid)return{error:"Missing params"};
  const doc=parseDoc(await fetchHTML(`${BASE}/watch/${aid}/${eid}`));
  const cover=attr(doc.querySelector(".film-poster img"),"data-src")||attr(doc.querySelector(".film-poster img"),"src");
  
  const infoWrap = doc.querySelector(".anis-watch-detail") || doc;
  const title=text(infoWrap.querySelector(".film-name, .dynamic-name"));
  let desc=text(infoWrap.querySelector(".film-description .text")||doc.querySelector(".text"));
  if(desc)desc=desc.trim();
  
  let subCount=0, dubCount=0;
  const ticks = infoWrap.querySelectorAll(".tick-item");
  ticks.forEach(m=>{
     const t = m.textContent.trim();
     if(m.classList.contains("tick-sub")) subCount=num(t);
     if(m.classList.contains("tick-dub")) dubCount=num(t);
  });

  // Fetch Ani.zip data for HD-2 server ID and English titles
  let anilistId = null;
  let aniZipData = null;
  try {
      const azRes = await fetchJSON(`https://api.ani.zip/mappings?animeplanet_id=${aid}`);
      if(azRes) {
          aniZipData = azRes;
          anilistId = azRes.mappings?.anilist_id;
      }
  } catch(e) { console.warn("AniZip data failed to load."); }
  
  const eps=[...doc.querySelectorAll(".ss-list a.ep-item")].map(a=>{
     const numVal = num(attr(a,"data-num")) || num(text(a.querySelector(".ep-name")));
     let titleText = text(a.querySelector(".ep-name"));
     
     // Replace with English title if available
     if (aniZipData && aniZipData.episodes && aniZipData.episodes[numVal] && aniZipData.episodes[numVal].title?.en) {
         titleText = `Ep ${numVal}: ${aniZipData.episodes[numVal].title.en}`;
     }

     return {
       episodeId: attr(a,"href")?.split('/').pop(),
       number: numVal,
       title: titleText
     };
  });

  let subSrc="", dubSrc="";
  const subServers = doc.querySelectorAll(".servers-sub .server-video");
  if(subServers.length>0) subSrc = attr(subServers[0], "data-video");
  const dubServers = doc.querySelectorAll(".servers-dub .server-video");
  if(dubServers.length>0) dubSrc = attr(dubServers[0], "data-video");

  return{
      animeId:aid,
      episodeId:eid,
      anilistId: anilistId,
      video:{sub:subSrc,dub:dubSrc},
      listEpisodes:eps,
      cover:abs(cover),
      title,
      description:desc,
      subCount,
      dubCount,
      recommended:parseRecommended(doc)
  };
}

async function gridAPI(path,pg){
  const sep=path.includes('?')?'&':'?';
  const doc=parseDoc(await fetchHTML(`${BASE}/${path}${sep}page=${pg}`));
  let tp=1;
  doc.querySelectorAll(".pagination a.page-link").forEach(a=>{
     const h=attr(a,"href");
     if(h){
         const m=h.match(/page=(\d+)/);
         if(m&&+m[1]>tp)tp=+m[1];
     }
     const t=text(a);
     if(/^\d+$/.test(t)&&+t>tp)tp=+t;
  });
  return{currentPage:+pg,totalPages:tp,results:parseCards(doc)};
}

async function topSearchAPI(){
  const doc=parseDoc(await fetchHTML(BASE+"/"));
  return[...doc.querySelectorAll(".xhashtag .item")].map(a=>{
      const t=text(a),h=attr(a,"href");
      let k=null;
      if(h?.includes("keyword=")){k=new URLSearchParams(h.split("?")[1]).get("keyword");}
      return{keyword:k||t,title:t};
  });
}

async function randomAPI(){
  const doc=parseDoc(await fetchHTML(BASE+"/random"));
  const link=doc.querySelector("link[rel='canonical']");
  const id=link?attr(link,"href")?.split("/").pop():null;
  if(id) return {id};
  return {error:"Failed"};
}

/* === UI HELPERS === */
const $=id=>document.getElementById(id);const main=$('main');let spotlightInterval=null;
function showLoading(){clearInterval(spotlightInterval);main.innerHTML='<div class="loading"><div class="spinner"></div><div class="loading-text">Loading...</div></div>';window.scrollTo({top:0});}
function showError(m){main.innerHTML=`<div class="error-box"><i class="fas fa-exclamation-triangle"></i><p>${m}</p><button onclick="location.reload()" tabindex="0"><i class="fas fa-redo"></i> Retry</button></div>`;}

function cardHTML(i){return`<a href="/p/anime.html?id=${i.id}" class="anime-card" tabindex="0"><div class="card-poster"><img src="${i.cover||''}" alt="${i.title||''}" loading="lazy"><div class="card-play"><i class="fas fa-play-circle"></i></div><div class="card-badges">${i.sub?`<span class="badge badge-sub"><i class="fas fa-closed-captioning"></i> ${i.sub}</span>`:''}${i.dub?`<span class="badge badge-dub"><i class="fas fa-microphone"></i> ${i.dub}</span>`:''}${i.episodes?`<span class="badge badge-eps"><i class="far fa-clock"></i> ${i.episodes}</span>`:''}</div>${i.type?`<div class="card-type">${i.type}</div>`:''}</div><div class="card-title">${i.title||''}</div></a>`;}
function paginationHTML(c,t,b){if(t<=1)return'';let h='<div class="pagination">';h+=c>1?`<a href="${b}page=${c-1}" tabindex="0"><i class="fas fa-chevron-left"></i></a>`:'<span class="disabled"><i class="fas fa-chevron-left"></i></span>';let s=Math.max(1,c-2),e=Math.min(t,c+2);if(s>1){h+=`<a href="${b}page=1" tabindex="0">1</a>`;if(s>2)h+='<span>...</span>';}for(let i=s;i<=e;i++)h+=i===c?`<span class="active">${i}</span>`:`<a href="${b}page=${i}" tabindex="0">${i}</a>`;if(e<t){if(e<t-1)h+='<span>...</span>';h+=`<a href="${b}page=${t}" tabindex="0">${t}</a>`;}h+=c<t?`<a href="${b}page=${c+1}" tabindex="0"><i class="fas fa-chevron-right"></i></a>`:'<span class="disabled"><i class="fas fa-chevron-right"></i></span>';return h+'</div>';}
function gridSectionHTML(t,ic,items,ml){return`<div class="section"><div class="section-header"><div class="section-title"><i class="fas fa-${ic}"></i> ${t}</div>${ml?`<a href="${ml}" class="section-more" tabindex="0">View More <i class="fas fa-chevron-right"></i></a>`:''}</div><div class="anime-grid">${items.map(cardHTML).join('')}</div></div>`;}
function sbListHTML(items){return`<div class="sb-list">${(items||[]).slice(0,5).map((it,i)=>`<div class="sb-item" tabindex="0" onclick="location.href='/p/anime.html?id=${it.id}'" onkeydown="if(event.key==='Enter')location.href='/p/anime.html?id=${it.id}'"><div class="sb-rank">${String(i+1).padStart(2,'0')}</div><div class="sb-img"><img src="${it.cover||''}" loading="lazy"></div><div class="sb-info"><div class="sb-name">${it.title||''}</div><div class="sb-meta">${it.sub?`<span class="badge badge-sub"><i class="fas fa-closed-captioning"></i> ${it.sub}</span>`:''}${it.dub?`<span class="badge badge-dub"><i class="fas fa-microphone"></i> ${it.dub}</span>`:''}${it.type?`<span class="badge" style="background:var(--bg);color:var(--text2)">${it.type}</span>`:''}</div></div></div>`).join('')}</div>`;}
function sbBlockHTML(t,ic,items){return`<div class="sb-block"><div class="sb-block-title"><i class="fas fa-${ic}"></i> ${t}</div>${sbListHTML(items)}</div>`;}

/* === PAGES === */
async function renderHome(){
  showLoading();
  try{
    const d=await homeAPI();const sl=d.spotlight.slice(0,8);let h='';
    if(sl.length){h+='<div class="spotlight" id="spotlight">';sl.forEach((s,i)=>{h+=`<div class="spotlight-slide${i===0?' active':''}" data-index="${i}"><img class="sl-bg" src="${s.cover}" alt=""><div class="sl-overlay"></div><div class="sl-content"><div class="sl-number">#${s.spotlightNumber} Spotlight</div><div class="sl-title">${s.title||''}</div><div class="sl-meta">${s.hd?`<span class="sl-badge hd">${s.hd}</span>`:''}${s.rated?`<span class="sl-badge rated">${s.rated}</span>`:''}${s.sub?`<span class="sl-badge sub"><i class="fas fa-closed-captioning"></i> ${s.sub}</span>`:''}${s.dub?`<span class="sl-badge dub"><i class="fas fa-microphone"></i> ${s.dub}</span>`:''}</div>${s.description?`<div class="sl-desc">${s.description}</div>`:''}<div class="sl-buttons"><a href="/p/anime.html?id=${s.id}" class="sl-btn primary" tabindex="0"><i class="fas fa-play"></i> Watch Now</a><a href="/p/anime.html?id=${s.id}" class="sl-btn secondary" tabindex="0"><i class="fas fa-info-circle"></i> Detail</a></div></div></div>`;});h+=`<button class="spotlight-nav prev" onclick="sSlide(-1)" tabindex="0"><i class="fas fa-chevron-left"></i></button><button class="spotlight-nav next" onclick="sSlide(1)" tabindex="0"><i class="fas fa-chevron-right"></i></button><div class="spotlight-dots">${sl.map((_,i)=>`<button class="dot${i===0?' active':''}" onclick="gSlide(${i})" tabindex="0"></button>`).join('')}</div></div>`;}
    if(d.trending.length){h+=`<div class="container"><div class="section trending"><div class="section-header"><div class="section-title"><i class="fas fa-fire"></i> Trending</div></div><div class="trending-scroll">${d.trending.map(t=>`<a href="/p/anime.html?id=${t.id}" class="trending-card" tabindex="0"><div class="tc-img"><img src="${t.cover||''}" loading="lazy"><div class="tc-rank">${t.rank||''}</div></div><div class="tc-title">${t.title||''}</div></a>`).join('')}</div></div>`;}
    h+='<div class="content-layout"><div class="content-main">';
    if(d.latestEpisode?.length)h+=gridSectionHTML('Latest Episode','bolt',d.latestEpisode);
    if(d.newOnZanivo?.length)h+=gridSectionHTML('New on Zanivo','sparkles',d.newOnZanivo);
    if(d.topUpcoming?.length)h+=gridSectionHTML('Top Upcoming','calendar',d.topUpcoming);
    h+='</div><div class="content-sidebar">';
    const f=d.featured;h+=`<div class="sb-block"><div class="sb-tabs"><div class="sb-tab active" tabindex="0" onclick="swTab(this,0)" onkeydown="if(event.key==='Enter')swTab(this,0)">Top Airing</div><div class="sb-tab" tabindex="0" onclick="swTab(this,1)" onkeydown="if(event.key==='Enter')swTab(this,1)">Popular</div><div class="sb-tab" tabindex="0" onclick="swTab(this,2)" onkeydown="if(event.key==='Enter')swTab(this,2)">Completed</div></div><div class="sb-tab-content" data-tab="0">${sbListHTML(f.topAiring)}</div><div class="sb-tab-content" data-tab="1" style="display:none">${sbListHTML(f.mostPopular)}</div><div class="sb-tab-content" data-tab="2" style="display:none">${sbListHTML(f.latestCompleted)}</div></div>`;
    if(f.latestCompleted?.length)h+=sbBlockHTML('Latest Completed','check-circle',f.latestCompleted);
    h+='</div></div></div>';main.innerHTML=h;startSl(sl.length);
  }catch(e){showError(e.message);}
}

function swTab(el,i){const p=el.closest('.sb-block');p.querySelectorAll('.sb-tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');p.querySelectorAll('.sb-tab-content').forEach(c=>c.style.display='none');p.querySelector(`[data-tab="${i}"]`).style.display='block';}
let cSlide=0;
function startSl(n){clearInterval(spotlightInterval);if(n>1)spotlightInterval=setInterval(()=>sSlide(1),5000);}
function sSlide(dir){const sl=document.querySelectorAll('.spotlight-slide'),dt=document.querySelectorAll('.spotlight-dots .dot');if(!sl.length)return;sl[cSlide]?.classList.remove('active');dt[cSlide]?.classList.remove('active');cSlide=(cSlide+dir+sl.length)%sl.length;sl[cSlide]?.classList.add('active');dt[cSlide]?.classList.add('active');}
function gSlide(i){const sl=document.querySelectorAll('.spotlight-slide'),dt=document.querySelectorAll('.spotlight-dots .dot');if(!sl.length)return;sl[cSlide]?.classList.remove('active');dt[cSlide]?.classList.remove('active');cSlide=i;sl[cSlide]?.classList.add('active');dt[cSlide]?.classList.add('active');clearInterval(spotlightInterval);startSl(sl.length);}

async function renderAnime(id){
  showLoading();
  try{
    const d=await animeAPI(id);if(d.error){showError(d.error);return;}
    document.title = d.title + " - Zanivo";
    let h=`<div class="detail-banner"><div class="detail-inner"><div class="detail-cover"><img src="${d.cover||''}" alt=""></div><div class="detail-info"><div class="detail-title">${d.title||''}</div><div class="detail-meta">${d.rated?`<span class="sl-badge rated">${d.rated}</span>`:''}${d.hd?`<span class="sl-badge hd">${d.hd}</span>`:''}${d.sub?`<span class="sl-badge sub"><i class="fas fa-closed-captioning"></i> ${d.sub}</span>`:''}${d.dub?`<span class="sl-badge dub"><i class="fas fa-microphone"></i> ${d.dub}</span>`:''}${d.type?`<span class="sl-badge hd">${d.type}</span>`:''}${d.duration?`<span class="sl-badge hd"><i class="far fa-clock"></i> ${d.duration}</span>`:''}</div>${d.overview?`<div class="detail-overview" id="dOv">${d.overview}</div><a class="show-more" tabindex="0" onclick="tOv()" onkeydown="if(event.key==='Enter')tOv()">+ More</a>`:''}
    <div class="detail-table">${d.japanese?`<div><span class="dt-label">Japanese:</span> ${d.japanese}</div>`:''}${d.aired?`<div><span class="dt-label">Aired:</span> ${d.aired}</div>`:''}${d.premiered?`<div><span class="dt-label">Premiered:</span> ${d.premiered}</div>`:''}${d.status?`<div><span class="dt-label">Status:</span> ${d.status}</div>`:''}${d.malScore?`<div><span class="dt-label">MAL Score:</span> ${d.malScore}</div>`:''}${d.studios?.length?`<div><span class="dt-label">Studios:</span> ${d.studios.join(', ')}</div>`:''}${d.producers?.length?`<div><span class="dt-label">Producers:</span> ${d.producers.join(', ')}</div>`:''}</div>
    ${d.genres?.length?`<div class="detail-genres">${d.genres.map(g=>`<a href="/p/search.html?genre=${encodeURIComponent(g.toLowerCase())}&amp;page=1" tabindex="0">${g}</a>`).join('')}</div>`:''}
    <div class="detail-actions">${d.firstEpId?`<a href="/p/episode.html?anime=${d.id}&ep=${d.firstEpId}" class="detail-btn primary" tabindex="0"><i class="fas fa-play"></i> Watch Now</a>`:'<span class="detail-btn primary" style="opacity:.5"><i class="fas fa-play"></i> Not Available</span>'}</div></div></div></div><div class="container">`;
    if(d.moreSeasons?.length>1)h+=`<div class="section"><div class="section-header"><div class="section-title"><i class="fas fa-layer-group"></i> Seasons</div></div><div class="seasons-bar">${d.moreSeasons.map(s=>{const sid=s.id||s.detail?.split('/').pop();return`<a href="/p/anime.html?id=${sid}" class="season-item${sid===d.id?' active':''}" tabindex="0">${s.cover?`<img src="${s.cover}" alt="">`:''}${s.title||''}</a>`;}).join('')}</div></div>`;
    if(d.recommended?.length)h+=gridSectionHTML('Recommended','thumbs-up',d.recommended);
    h+='</div>';main.innerHTML=h;
  }catch(e){showError(e.message);}
}
function tOv(){const e=$('dOv');if(!e)return;e.classList.toggle('expanded');e.nextElementSibling.textContent=e.classList.contains('expanded')?'- Less':'+ More';}

async function renderWatch(aid,eid){
  showLoading();
  try{
    const d=await watchAPI(aid,eid);if(d.error){showError(d.error);return;}
    const curEp=(d.listEpisodes||[]).find(e=>e.episodeId===eid);
    const epNum=curEp?.number||1;
    document.title = "Watch " + d.title + " Episode " + epNum + " - Zanivo";
    
    let subServers = [];
    let dubServers =[];

    // Build server list based on availability
    const isDubAvailable = d.dubCount && d.dubCount >= epNum;
    if (d.video.sub) subServers.push({ name: 'HD-1', src: d.video.sub });
    if (d.anilistId) subServers.push({ name: 'HD-2', src: `https://megaplay.buzz/stream/ani/${d.anilistId}/${epNum}/sub` });

    if (d.video.dub) dubServers.push({ name: 'HD-1', src: d.video.dub });
    if (d.anilistId && isDubAvailable) dubServers.push({ name: 'HD-2', src: `https://megaplay.buzz/stream/ani/${d.anilistId}/${epNum}/dub` });

    const defaultSrc = subServers.length ? subServers[0].src : (dubServers.length ? dubServers[0].src : '');

    let h=`<div class="watch-layout"><div class="watch-player-col">
      <div class="watch-player-wrapper">
        <iframe id="vF" src="${defaultSrc}" width="100%" height="100%" frameborder="0" scrolling="no" allowfullscreen sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"></iframe>
      </div>
      <div class="watch-controls">`;

    let firstBtn = true;
    if(subServers.length) {
        h += `<div style="display:flex;align-items:center;gap:8px"><span style="color:var(--text2);font-size:12px;font-weight:700;letter-spacing:1px">SUB:</span>`;
        subServers.forEach(s => {
            const act = firstBtn ? ' active' : '';
            h += `<button class="server-btn${act}" tabindex="0" onclick="swSrv(this)" data-src="${s.src}"><i class="fas fa-closed-captioning"></i> ${s.name}</button>`;
            firstBtn = false;
        });
        h += `</div>`;
    }
    if(dubServers.length) {
        h += `<div style="display:flex;align-items:center;gap:8px"><span style="color:var(--text2);font-size:12px;font-weight:700;letter-spacing:1px">DUB:</span>`;
        dubServers.forEach(s => {
            const act = firstBtn ? ' active' : '';
            h += `<button class="server-btn${act}" tabindex="0" onclick="swSrv(this)" data-src="${s.src}"><i class="fas fa-microphone"></i> ${s.name}</button>`;
            firstBtn = false;
        });
        h += `</div>`;
    }
    if(subServers.length === 0 && dubServers.length === 0){
        h+=`<button class="server-btn disabled" tabindex="0"><i class="fas fa-exclamation-triangle"></i> NO SERVER</button>`;
    }

    h+=`</div></div>
    <div class="watch-ep-panel">
      <div class="watch-ep-header"><span>Episodes</span><input class="watch-ep-search" placeholder="Filter..." oninput="fWEp(this.value)" tabindex="0"></div>
      <div class="watch-ep-list">`;

    (d.listEpisodes||[]).forEach(ep=>{
      const epHasSub = d.subCount >= ep.number;
      const epHasDub = d.dubCount > 0 && d.dubCount >= ep.number;
      h+=`<a href="/p/episode.html?anime=${d.animeId}&ep=${ep.episodeId}" class="watch-ep-item${ep.episodeId===eid?' active':''}" data-num="${ep.number}" tabindex="0">
        <span class="ep-no">${ep.number}</span>
        <span>${ep.title||'Episode '+ep.number}</span>
        <span class="watch-ep-badges">
          ${epHasSub?'<span class="badge badge-sub">SUB</span>':''}
          ${epHasDub?'<span class="badge badge-dub">DUB</span>':''}
        </span>
      </a>`;
    });

    h+=`</div></div></div>
    <div class="container watch-info">
      <div class="watch-anime-info"><img src="${d.cover||''}" alt=""><div class="watch-anime-desc"><h3><a href="/p/anime.html?id=${d.animeId}" tabindex="0">${d.title||''}</a></h3>${d.description?`<p>${d.description}</p>`:''}</div></div>`;
    if(d.recommended?.length)h+=gridSectionHTML('Recommended','thumbs-up',d.recommended);
    h+='</div>';main.innerHTML=h;
    setTimeout(()=>{const a=document.querySelector('.watch-ep-item.active');if(a)a.scrollIntoView({block:'center'});},100);
  }catch(e){showError(e.message);}
}
function swSrv(btn){const f=$('vF');document.querySelectorAll('.server-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');f.src=btn.getAttribute('data-src');}
function fWEp(v){document.querySelectorAll('.watch-ep-item').forEach(e=>{const n=e.getAttribute('data-num')||'',t=e.textContent;e.style.display=(n.includes(v)||t.toLowerCase().includes(v.toLowerCase()))?'':'none';});}

async function renderSearch(kw,pg){showLoading();try{const d=await gridAPI(`filter?keyword=${encodeURIComponent(kw)}`,pg); document.title = `Search results for "${kw}" - Zanivo`; let h=`<div class="container"><div class="page-header"><div class="page-breadcrumb"><a href="/" tabindex="0">Home</a> / Search</div><div class="page-title"><i class="fas fa-search"></i> Results for "${kw}"</div></div>`;h+=d.results.length?`<div class="anime-grid">${d.results.map(cardHTML).join('')}</div>${paginationHTML(d.currentPage,d.totalPages,`/p/search.html?keyword=${encodeURIComponent(kw)}&`)}`:`<div class="error-box"><i class="fas fa-search"></i><p>No results found</p></div>`;h+='</div>';main.innerHTML=h;}catch(e){showError(e.message);}}
async function renderGenre(nm,pg){showLoading();try{const d=await gridAPI(`genres/${encodeURIComponent(nm)}`,pg);const dn=nm.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' '); document.title = dn + " Anime - Zanivo"; let h=`<div class="container"><div class="page-header"><div class="page-breadcrumb"><a href="/" tabindex="0">Home</a> / Genre</div><div class="page-title"><i class="fas fa-tag"></i> ${dn}</div></div>`;h+=d.results.length?`<div class="anime-grid">${d.results.map(cardHTML).join('')}</div>${paginationHTML(d.currentPage,d.totalPages,`/p/search.html?genre=${encodeURIComponent(nm)}&`)}`:`<div class="error-box"><i class="fas fa-folder-open"></i><p>No anime found</p></div>`;h+='</div>';main.innerHTML=h;}catch(e){showError(e.message);}}
async function renderCat(cat,pg){showLoading();const pm={subbed:'subbed-anime',dubbed:'dubbed-anime',popular:'most-popular',movie:'movie',tv:'tv',ova:'ova',ona:'ona',special:'special'};const tm={subbed:'Subbed Anime',dubbed:'Dubbed Anime',popular:'Most Popular',movie:'Movies',tv:'TV Series',ova:'OVA',ona:'ONA',special:'Specials'};const im={subbed:'closed-captioning',dubbed:'microphone',popular:'fire',movie:'film',tv:'tv',ova:'star',ona:'play',special:'gem'};try{const d=await gridAPI(pm[cat]||cat,pg); document.title = (tm[cat]||cat) + " - Zanivo"; let h=`<div class="container"><div class="page-header"><div class="page-breadcrumb"><a href="/" tabindex="0">Home</a> / ${tm[cat]||cat}</div><div class="page-title"><i class="fas fa-${im[cat]||'list'}"></i> ${tm[cat]||cat}</div></div>`;h+=d.results.length?`<div class="anime-grid">${d.results.map(cardHTML).join('')}</div>${paginationHTML(d.currentPage,d.totalPages,`/p/search.html?cat=${cat}&`)}`:`<div class="error-box"><i class="fas fa-folder-open"></i><p>No anime found</p></div>`;h+='</div>';main.innerHTML=h;}catch(e){showError(e.message);}}
async function goRandom(){showLoading();try{const d=await randomAPI();if(d.id)location.href='/p/anime.html?id='+d.id;else showError("Failed");}catch(e){showError(e.message);}}

/* === SEARCH / MOBILE / GENRES / TV NAV === */
function initSearch(){
  const ov=$('searchOverlay'),inp=$('searchInput'),sug=$('searchSuggestions');
  $('searchToggle').onclick=()=>{ov.classList.add('active');inp.focus();loadSug();};
  $('searchClose').onclick=()=>{ov.classList.remove('active');inp.value='';sug.innerHTML='';};
  ov.onclick=e=>{if(e.target===ov){ov.classList.remove('active');inp.value='';sug.innerHTML='';}};
  inp.onkeydown=e=>{if(e.key==='Enter'&&inp.value.trim()){ov.classList.remove('active');location.href=`/p/search.html?keyword=${encodeURIComponent(inp.value.trim())}&page=1`;inp.value='';sug.innerHTML='';}if(e.key==='Escape'){ov.classList.remove('active');inp.value='';sug.innerHTML='';}};
}
async function loadSug(){const s=$('searchSuggestions');try{const d=await topSearchAPI();s.innerHTML=`<div style="padding:5px 15px;color:var(--text2);font-size:12px;margin-bottom:5px">Trending</div>`+d.map(x=>`<a href="/p/search.html?keyword=${encodeURIComponent(x.keyword)}&page=1" tabindex="0" onclick="$('searchOverlay').classList.remove('active')"><i class="fas fa-fire" style="color:var(--accent);margin-right:8px;font-size:12px"></i>${x.title}</a>`).join('');}catch(e){s.innerHTML='';}}
function closeMobile(){$('mobileSidebar').classList.remove('open');$('sidebarOverlay').classList.remove('open');}
function initGenres(){const h=GENRES.map(g=>`<a href="/p/search.html?genre=${encodeURIComponent(g.toLowerCase())}&page=1" tabindex="0" onclick="closeMobile()">${g}</a>`).join('');$('genreDropdown').innerHTML=h;$('mobileGenres').innerHTML=h;}
function initTV(){
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'||(e.key==='Backspace'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))){if($('searchOverlay').classList.contains('active')){$('searchOverlay').classList.remove('active');$('searchInput').value='';$('searchSuggestions').innerHTML='';e.preventDefault();return;}if($('mobileSidebar').classList.contains('open')){closeMobile();e.preventDefault();return;}if(location.pathname!=='/'&&location.pathname!=='/index.html'){history.back();e.preventDefault();return;}}
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
    e.preventDefault();const foc=[...document.querySelectorAll('a[href]:not([disabled]),button:not([disabled]),[tabindex="0"]:not([disabled]),input:not([disabled])')].filter(el=>{const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0'&&el.offsetParent!==null;});if(!foc.length)return;const act=document.activeElement;if(!act||!foc.includes(act)){foc[0]?.focus();return;}const r=act.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let cands=[];foc.forEach(el=>{if(el===act)return;const b=el.getBoundingClientRect(),dx=b.left+b.width/2-cx,dy=b.top+b.height/2-cy;let ok=false;switch(e.key){case'ArrowUp':ok=dy<-10;break;case'ArrowDown':ok=dy>10;break;case'ArrowLeft':ok=dx<-10;break;case'ArrowRight':ok=dx>10;break;}if(ok){const dist=(e.key==='ArrowUp'||e.key==='ArrowDown')?Math.abs(dy)+Math.abs(dx)*2:Math.abs(dx)+Math.abs(dy)*2;cands.push({el,dist});}});cands.sort((a,b)=>a.dist-b.dist);if(cands.length){cands[0].el.focus();cands[0].el.scrollIntoView({block:'nearest',behavior:'smooth'});}
  });
}

/* === ROUTER & INIT === */
// Converted Blogger conditionals into a Vanilla JS router
window.addEventListener('DOMContentLoaded',()=>{
  initGenres();
  initSearch();
  
  $('menuToggle').onclick=()=>{$('mobileSidebar').classList.add('open');$('sidebarOverlay').classList.add('open');};
  window.addEventListener('scroll',()=>{$('backToTop').classList.toggle('show',scrollY>400);});
  initTV();
  
  const path = window.location.pathname;
  const searchPath = path + window.location.search;
  const q = new URLSearchParams(window.location.search);

  // Active link highlighting
  document.querySelectorAll('.nav-link, .ms-link').forEach(a => {
      const h = a.getAttribute('href');
      if(h && h !== '/' && searchPath.includes(h.split('?')[0])) a.classList.add('active');
      else if (h === '/' && (searchPath === '/' || searchPath === '/index.html')) a.classList.add('active');
  });

  // Client-Side Routing
  if (path === '/' || path === '/index.html') {
      renderHome();
  } else if (path.includes('/p/anime.html')) {
      if (q.get('id')) renderAnime(q.get('id'));
      else showError("No Anime ID provided.");
  } else if (path.includes('/p/episode.html')) {
      if (q.get('anime') && q.get('ep')) renderWatch(q.get('anime'), q.get('ep'));
      else showError("Missing Anime or Episode ID.");
  } else if (path.includes('/p/search.html')) {
      if (q.get('keyword')) renderSearch(q.get('keyword'), q.get('page') || 1);
      else if (q.get('genre')) renderGenre(q.get('genre'), q.get('page') || 1);
      else if (q.get('cat')) renderCat(q.get('cat'), q.get('page') || 1);
      else showError("No search parameters provided.");
  }
});
