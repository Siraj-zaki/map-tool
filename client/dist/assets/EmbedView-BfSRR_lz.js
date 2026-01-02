import{u as z,h as B,r as t,j as e,c as W}from"./index-gJIHh3xe.js";import{E as H}from"./ElevationProfile-B6rqfWoi.js";import{R as O,T as q,L as A,W as U,M as V,P as $,a as G}from"./WeatherForecast-DVvh1alL.js";function X(){const{t:n,i18n:f}=z(),[h]=B(),r=h.get("route"),l=h.get("lang"),[s,v]=t.useState(null),[w,m]=t.useState(!0),[p,c]=t.useState(null),[C,u]=t.useState(null),[d,g]=t.useState(!1),[N,j]=t.useState(!1),[a,k]=t.useState("gold"),[b,E]=t.useState(null),[T,F]=t.useState(null),[I,P]=t.useState(),[R,y]=t.useState(null),S=t.useRef(null);t.useEffect(()=>{l&&(l==="de"||l==="en")&&f.changeLanguage(l)},[l,f]),t.useEffect(()=>{if(!r){c("No route ID provided. Use ?route=ID"),m(!1);return}(async()=>{try{const i=await W.getById(Number(r));i.success?v(i.route):c("Route not found")}catch(i){c("Failed to load route"),console.error(i)}finally{m(!1)}})()},[r]);const L=t.useCallback(o=>{P(o?o.distance:void 0)},[]),D=t.useCallback(o=>{y(o?{lng:o.lng,lat:o.lat}:null)},[]),M=t.useCallback(o=>{u(o),S.current&&S.current(o)},[]);return w?e.jsxs("div",{className:"wrapper",children:[e.jsxs("div",{className:"h-full flex flex-col items-center justify-center text-[#a0a0a0]",children:[e.jsx("i",{className:"fas fa-mountain text-4xl text-[#088d95] mb-4 animate-bounce"}),e.jsx("div",{className:"text-sm",children:n("routeLoading")})]}),e.jsx("style",{children:x})]}):p||!s?e.jsxs("div",{className:"wrapper",children:[e.jsxs("div",{className:"h-full flex flex-col items-center justify-center text-[#a0a0a0]",children:[e.jsx("i",{className:"fas fa-exclamation-triangle text-4xl text-red-500 mb-4"}),e.jsx("div",{children:p||n("routeNotFound")})]}),e.jsx("style",{children:x})]}):e.jsxs("div",{className:"wrapper",children:[e.jsx(O,{route:s,showWeather:!0,showDownloadButton:!0,onDownloadClick:()=>j(!0),onLocationSelect:o=>F({lng:o.lng,lat:o.lat})}),e.jsxs("div",{className:"content",style:{position:"relative"},children:[e.jsxs("div",{style:{position:"absolute",top:"12px",left:"60px",zIndex:40,display:"flex",gap:"12px",flexDirection:"column",alignItems:"flex-start"},children:[e.jsx(q,{route:s,tourType:a,onTourTypeChange:k,selectedStage:b,onStageSelect:E}),e.jsx(A,{routeId:s.id,tourType:a})]}),e.jsx("div",{style:{position:"absolute",top:"15px",right:"12px",zIndex:40},children:e.jsx(U,{lat:(s.startPoint[1]+s.endPoint[1])/2,lng:(s.startPoint[0]+s.endPoint[0])/2,locationName:s.name||"Route"})}),e.jsx("div",{id:"map",children:e.jsx(V,{route:s,tourType:a,selectedStage:b,onPositionChange:L,onPoiClick:u,highlightPosition:R,isFullscreen:d,flyToLocation:T})}),e.jsx("button",{onClick:()=>{document.fullscreenElement?(document.exitFullscreen(),g(!1)):(document.documentElement.requestFullscreen(),g(!0))},className:"absolute top-3 left-3 z-50 w-10 h-10 flex items-center justify-center bg-[#080e11] border border-[#1e2a33] rounded-lg text-gray-400 hover:text-white hover:bg-[#088d95] hover:border-[#088d95] transition-all",title:n(d?"exitFullscreen":"fullscreen"),children:e.jsx("i",{className:`fas fa-${d?"compress":"expand"}`})})]}),e.jsx("div",{id:"profilesContainer",children:e.jsx(H,{route:s,pois:s.pois,tourType:a,onPositionChange:D,highlightDistance:I,onPoiClick:M})}),e.jsx($,{poi:C,routeStartPoint:s.startPoint,onClose:()=>u(null)}),e.jsx(G,{isOpen:N,onClose:()=>j(!1)}),e.jsx("style",{children:x})]})}const x=`
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
`;export{X as default};
