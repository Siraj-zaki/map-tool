import{u as G,f as H,r as t,j as e,c as O}from"./index-DWwqmRE3.js";import{E as V}from"./ElevationProfileVisx-M0_gh13K.js";import{R as q,T as A,L as U,W as J,M as K,P as Q,a as X}from"./WeatherForecast-CsYYjz2U.js";function ee(){const{t:a,i18n:p}=G(),[g]=H(),d=g.get("route"),l=g.get("lang"),[s,C]=t.useState(null),[k,m]=t.useState(!0),[b,u]=t.useState(null),[N,x]=t.useState(null),[f,j]=t.useState(!1),[I,y]=t.useState(!1),[r,R]=t.useState("gold"),[S,F]=t.useState(null),[T,E]=t.useState(null),[W,w]=t.useState(),[z,P]=t.useState(null),v=t.useRef(null),[n,D]=t.useState(!0),[i,L]=t.useState(!0);t.useEffect(()=>{l&&(l==="de"||l==="en")&&p.changeLanguage(l)},[l,p]),t.useEffect(()=>{if(!d){u("No route ID provided. Use ?route=ID"),m(!1);return}(async()=>{try{const c=await O.getById(Number(d));c.success?C(c.route):u("Route not found")}catch(c){u("Failed to load route"),console.error(c)}finally{m(!1)}})()},[d]);const M=t.useCallback(o=>{w(o?o.distance:void 0)},[]),B=t.useCallback(o=>{P(o?{lng:o.lng,lat:o.lat}:null)},[]),$=t.useCallback(o=>{x(o),v.current&&v.current(o)},[]);return k?e.jsxs("div",{className:"wrapper",children:[e.jsxs("div",{className:"h-full flex flex-col items-center justify-center text-[#a0a0a0]",children:[e.jsx("i",{className:"fas fa-mountain text-4xl text-[#088d95] mb-4 animate-bounce"}),e.jsx("div",{className:"text-sm",children:a("routeLoading")})]}),e.jsx("style",{children:h})]}):b||!s?e.jsxs("div",{className:"wrapper",children:[e.jsxs("div",{className:"h-full flex flex-col items-center justify-center text-[#a0a0a0]",children:[e.jsx("i",{className:"fas fa-exclamation-triangle text-4xl text-red-500 mb-4"}),e.jsx("div",{children:b||a("routeNotFound")})]}),e.jsx("style",{children:h})]}):e.jsxs("div",{className:"wrapper",children:[e.jsx(q,{route:s,showWeather:!0,showDownloadButton:!0,onDownloadClick:()=>y(!0),onLocationSelect:o=>E({lng:o.lng,lat:o.lat})}),e.jsxs("div",{className:"content",style:{position:"relative"},children:[e.jsxs("div",{style:{position:"absolute",top:"12px",left:"60px",zIndex:40,display:"flex",gap:"8px",flexDirection:"column",alignItems:"flex-start"},children:[e.jsxs("button",{onClick:()=>D(!n),style:{background:"rgba(8, 14, 17, 0.9)",backdropFilter:"blur(20px)",border:"1px solid #1e2a33",borderRadius:"8px",padding:"6px 10px",color:n?"#088d95":"rgba(255,255,255,0.6)",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px",fontSize:"11px",fontWeight:"600",transition:"all 0.2s ease"},title:a(n?"hideRouteInfo":"showRouteInfo"),children:[e.jsx("i",{className:"fas fa-route"}),e.jsx("i",{className:`fas fa-chevron-${n?"up":"down"}`,style:{fontSize:"9px"}})]}),n&&e.jsxs(e.Fragment,{children:[e.jsx(A,{route:s,tourType:r,onTourTypeChange:R,selectedStage:S,onStageSelect:F}),e.jsx(U,{routeId:s.id,tourType:r})]})]}),e.jsxs("div",{style:{position:"absolute",top:"12px",right:"12px",zIndex:40,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"8px"},children:[e.jsxs("button",{onClick:()=>L(!i),style:{background:"rgba(8, 14, 17, 0.9)",backdropFilter:"blur(20px)",border:"1px solid #1e2a33",borderRadius:"8px",padding:"6px 10px",color:i?"#088d95":"rgba(255,255,255,0.6)",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px",fontSize:"11px",fontWeight:"600",transition:"all 0.2s ease"},title:a(i?"hideWeather":"showWeather"),children:[e.jsx("i",{className:"fas fa-cloud-sun"}),e.jsx("i",{className:`fas fa-chevron-${i?"up":"down"}`,style:{fontSize:"9px"}})]}),i&&e.jsx(J,{lat:(s.startPoint[1]+s.endPoint[1])/2,lng:(s.startPoint[0]+s.endPoint[0])/2,locationName:s.name||"Route"})]}),e.jsx("div",{id:"map",children:e.jsx(K,{route:s,tourType:r,selectedStage:S,onPositionChange:M,onPoiClick:x,highlightPosition:z,isFullscreen:f,flyToLocation:T})}),e.jsx("button",{onClick:()=>{document.fullscreenElement?(document.exitFullscreen(),j(!1)):(document.documentElement.requestFullscreen(),j(!0))},className:"absolute top-3 left-3 z-50 w-10 h-10 flex items-center justify-center bg-[#080e11] border border-[#1e2a33] rounded-lg text-gray-400 hover:text-white hover:bg-[#088d95] hover:border-[#088d95] transition-all",title:a(f?"exitFullscreen":"fullscreen"),children:e.jsx("i",{className:`fas fa-${f?"compress":"expand"}`})})]}),e.jsx("div",{id:"profilesContainer",children:e.jsx(V,{route:s,pois:s.pois,tourType:r,onPositionChange:B,highlightDistance:W,onPoiClick:$})}),e.jsx(Q,{poi:N,routeStartPoint:s.startPoint,routeGeometry:s.routeGeometry,onClose:()=>x(null)}),e.jsx(X,{isOpen:I,onClose:()=>y(!1)}),e.jsx("style",{children:h})]})}const h=`
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
`;export{ee as default};
