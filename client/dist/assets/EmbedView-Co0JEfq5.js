import{u as M,c as z,r as t,j as e}from"./index-CldepO61.js";import{r as B}from"./index-C1hE1Gfb.js";import{E as L}from"./ElevationProfile-DQXevQii.js";import{R as W,T as H,W as O,M as q,P as A,a as G}from"./WeatherForecast-PDUQIQA5.js";function J(){const{t:l,i18n:h}=M(),[f]=z(),i=f.get("route"),n=f.get("lang"),[s,w]=t.useState(null),[y,m]=t.useState(!0),[p,r]=t.useState(null),[C,c]=t.useState(null),[u,g]=t.useState(!1),[N,b]=t.useState(!1),[d,k]=t.useState("gold"),[j,E]=t.useState(null),[R,P]=t.useState(),[T,v]=t.useState(null),S=t.useRef(null);t.useEffect(()=>{n&&(n==="de"||n==="en")&&h.changeLanguage(n)},[n,h]),t.useEffect(()=>{if(!i){r("No route ID provided. Use ?route=ID"),m(!1);return}(async()=>{try{const a=await B.getById(Number(i));a.success?w(a.route):r("Route not found")}catch(a){r("Failed to load route"),console.error(a)}finally{m(!1)}})()},[i]);const F=t.useCallback(o=>{P(o?o.distance:void 0)},[]),I=t.useCallback(o=>{v(o?{lng:o.lng,lat:o.lat}:null)},[]),D=t.useCallback(o=>{c(o),S.current&&S.current(o)},[]);return y?e.jsxs("div",{className:"wrapper",children:[e.jsxs("div",{className:"h-full flex flex-col items-center justify-center text-[#a0a0a0]",children:[e.jsx("i",{className:"fas fa-mountain text-4xl text-[#088d95] mb-4 animate-bounce"}),e.jsx("div",{className:"text-sm",children:l("routeLoading")})]}),e.jsx("style",{children:x})]}):p||!s?e.jsxs("div",{className:"wrapper",children:[e.jsxs("div",{className:"h-full flex flex-col items-center justify-center text-[#a0a0a0]",children:[e.jsx("i",{className:"fas fa-exclamation-triangle text-4xl text-red-500 mb-4"}),e.jsx("div",{children:p||l("routeNotFound")})]}),e.jsx("style",{children:x})]}):e.jsxs("div",{className:"wrapper",children:[e.jsx(W,{route:s,showWeather:!0,showDownloadButton:!0,onDownloadClick:()=>b(!0)}),e.jsxs("div",{className:"content",style:{position:"relative"},children:[e.jsx("div",{style:{position:"absolute",top:"12px",left:"60px",zIndex:40},children:e.jsx(H,{tourType:d,onTourTypeChange:k,selectedStage:j,onStageSelect:E})}),e.jsx("div",{style:{position:"absolute",top:"12px",right:"60px",zIndex:40},children:e.jsx(O,{lat:(s.startPoint[1]+s.endPoint[1])/2,lng:(s.startPoint[0]+s.endPoint[0])/2,locationName:s.name||"Route"})}),e.jsx("div",{id:"map",children:e.jsx(q,{route:s,tourType:d,selectedStage:j,onPositionChange:F,onPoiClick:c,highlightPosition:T,isFullscreen:u})}),e.jsx("button",{onClick:()=>{document.fullscreenElement?(document.exitFullscreen(),g(!1)):(document.documentElement.requestFullscreen(),g(!0))},className:"absolute top-3 left-3 z-50 w-10 h-10 flex items-center justify-center bg-[#080e11] border border-[#1e2a33] rounded-lg text-gray-400 hover:text-white hover:bg-[#088d95] hover:border-[#088d95] transition-all",title:l(u?"exitFullscreen":"fullscreen"),children:e.jsx("i",{className:`fas fa-${u?"compress":"expand"}`})})]}),e.jsx("div",{id:"profilesContainer",children:e.jsx(L,{route:s,pois:s.pois,tourType:d,onPositionChange:I,highlightDistance:R,onPoiClick:D})}),e.jsx(A,{poi:C,routeStartPoint:s.startPoint,onClose:()=>c(null)}),e.jsx(G,{isOpen:N,onClose:()=>b(!1),featureName:"GPX Download"}),e.jsx("style",{children:x})]})}const x=`
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
`;export{J as default};
