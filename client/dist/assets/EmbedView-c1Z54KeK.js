import{u as T,c as D,r as t,j as e}from"./index-xMwKD10N.js";import{r as M}from"./index-DUWixUNR.js";import{E as G}from"./ElevationProfile-DP2kmXtP.js";import{R as W,W as z,M as B,P as L,G as H}from"./WeatherForecast-DREyolUz.js";function V(){const{t:l,i18n:x}=T(),[h]=D(),i=h.get("route"),n=h.get("lang"),[s,P]=t.useState(null),[y,f]=t.useState(!0),[p,r]=t.useState(null),[C,c]=t.useState(null),[d,m]=t.useState(!1),[S,g]=t.useState(!1),[b,N]=t.useState("gold"),[k,j]=t.useState(),[E,v]=t.useState(null),w=t.useRef(null);t.useEffect(()=>{n&&(n==="de"||n==="en")&&x.changeLanguage(n)},[n,x]),t.useEffect(()=>{if(!i){r("No route ID provided. Use ?route=ID"),f(!1);return}(async()=>{try{const a=await M.getById(Number(i));a.success?P(a.route):r("Route not found")}catch(a){r("Failed to load route"),console.error(a)}finally{f(!1)}})()},[i]);const R=t.useCallback(o=>{j(o?o.distance:void 0)},[]),F=t.useCallback(o=>{v(o?{lng:o.lng,lat:o.lat}:null)},[]),I=t.useCallback(o=>{c(o),w.current&&w.current(o)},[]);return y?e.jsxs("div",{className:"wrapper",children:[e.jsxs("div",{className:"h-full flex flex-col items-center justify-center text-[#a0a0a0]",children:[e.jsx("i",{className:"fas fa-mountain text-4xl text-[#088d95] mb-4 animate-bounce"}),e.jsx("div",{className:"text-sm",children:l("routeLoading")})]}),e.jsx("style",{children:u})]}):p||!s?e.jsxs("div",{className:"wrapper",children:[e.jsxs("div",{className:"h-full flex flex-col items-center justify-center text-[#a0a0a0]",children:[e.jsx("i",{className:"fas fa-exclamation-triangle text-4xl text-red-500 mb-4"}),e.jsx("div",{children:p||l("routeNotFound")})]}),e.jsx("style",{children:u})]}):e.jsxs("div",{className:"wrapper",children:[e.jsx(W,{route:s,tourType:b,onTourTypeChange:N,showWeather:!0,showTourSelector:!0,showDownloadButton:!0,onDownloadClick:()=>g(!0)}),e.jsxs("div",{className:"content",style:{position:"relative"},children:[e.jsx("div",{style:{position:"absolute",top:"16px",left:"60px",right:"60px",zIndex:40,maxWidth:"calc(100% - 60px)"},children:e.jsx(z,{lat:(s.startPoint[1]+s.endPoint[1])/2,lng:(s.startPoint[0]+s.endPoint[0])/2,locationName:s.name||"Route"})}),e.jsx("div",{id:"map",children:e.jsx(B,{route:s,tourType:b,onPositionChange:R,onPoiClick:c,highlightPosition:E,isFullscreen:d})}),e.jsx("button",{onClick:()=>{document.fullscreenElement?(document.exitFullscreen(),m(!1)):(document.documentElement.requestFullscreen(),m(!0))},className:"absolute top-3 left-3 z-50 w-10 h-10 flex items-center justify-center bg-[#080e11] border border-[#1e2a33] rounded-lg text-gray-400 hover:text-white hover:bg-[#088d95] hover:border-[#088d95] transition-all",title:l(d?"exitFullscreen":"fullscreen"),children:e.jsx("i",{className:`fas fa-${d?"compress":"expand"}`})})]}),e.jsx("div",{id:"profilesContainer",children:e.jsx(G,{route:s,pois:s.pois,onPositionChange:F,highlightDistance:k,onPoiClick:I})}),e.jsx(L,{poi:C,routeStartPoint:s.startPoint,onClose:()=>c(null)}),S&&e.jsx(H,{onClose:()=>g(!1),routeId:s.id}),e.jsx("style",{children:u})]})}const u=`
  .wrapper {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
    background: #0b1215;
    border-radius: 12px;
    border: 2px solid #088d95;
    box-shadow: 0 0 15px rgba(8, 141, 149, 0.7);
  }

  .content {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    overflow: hidden;
    background: transparent;
  }

  #map {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #0b1215;
  }

  #profilesContainer {
    width: 100%;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    background: #0b1215;
    z-index: 10;
  }
`;export{V as default};
