const dayMs=86400000;
const iso=d=>d.toISOString().slice(0,10);
const add=(s,n)=>{const d=new Date(s+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return iso(d)};
const diff=(a,b)=>Math.round((new Date(b+"T12:00:00Z")-new Date(a+"T12:00:00Z"))/dayMs);
function combos(start,end,minN,maxN){
  const out=[];
  for(let d=start;diff(d,end)>=minN;d=add(d,1)){
    for(let n=minN;n<=maxN&&diff(d,end)>=n;n++) out.push({from:d,to:add(d,n),nights:n});
  }
  return out;
}
function priceOf(a){
  const v=[a.active_options?.price_per_day,a.active_options?.day_price,a.active_options?.price?.day,a.current_price?.day,a.currentPrice?.day,a.price?.day,a.daily_rate,a.calculated_day_price,a.price_per_day].map(Number).find(x=>Number.isFinite(x)&&x>0)||0;
  return v>=1000?v/100:v;
}
async function searchOne({address,from,to,guests,radius,budget}){
  const qs=new URLSearchParams({"address":address,"date[from]":from,"date[to]":to,"sleeps":String(guests),"radius":String(radius),"page[limit]":"40","sort":"price"});
  const r=await fetch("https://search.staging.outdoorsy.com/rentals?"+qs,{headers:{"Accept":"application/vnd.api+json, application/json"}});
  if(!r.ok) return [];
  const body=await r.json(),raw=Array.isArray(body?.data)?body.data:Array.isArray(body)?body:[];
  const nights=Math.max(1,diff(from,to));
  return raw.map((row,i)=>{
    const a=row?.attributes||row||{},rate=priceOf(a); if(!rate)return null;
    const rental=Math.round(rate*nights),service=Math.round(rental*.10),protection=18*nights,taxes=Math.round((rental+service)*.075),fuel=Math.round(90*3.35/12),total=rental+service+protection+taxes+fuel;
    const slug=a.slug||row?.id||"rv-search";
    return{id:String(row?.id||i),title:a.name||a.vehicle_make||a.title||"RV rental",rate:Math.round(rate),rental,service,protection,taxes,fuel,total,from,to,nights,source:"Outdoorsy staging",url:"https://www.outdoorsy.com/rv-rental/"+String(slug).replace(/^\//,"")}
  }).filter(Boolean).filter(x=>x.total<=budget);
}
export default async(req)=>{
  if(req.method!=="GET")return new Response("Method not allowed",{status:405});
  const p=new URL(req.url).searchParams,address=p.get("address")||"",mode=p.get("mode")||"exact",guests=Math.max(1,+p.get("guests")||2),radius=Math.max(1,Math.min(300,+p.get("radius")||100)),budget=Math.max(100,+p.get("budget")||1500);
  let windows=[];
  if(mode==="flex"){
    const earliest=p.get("earliest")||"",latest=p.get("latest")||"",minN=Math.max(1,+p.get("minNights")||3),maxN=Math.max(minN,+p.get("maxNights")||5);
    if(!earliest||!latest||diff(earliest,latest)<minN)return Response.json({error:"Invalid flexible window"},{status:400});
    windows=combos(earliest,latest,minN,maxN);
  }else{
    const from=p.get("from")||"",to=p.get("to")||"";
    if(!from||!to||diff(from,to)<1)return Response.json({error:"Invalid exact dates"},{status:400});
    windows=[{from,to,nights:diff(from,to)}];
  }
  // Guard staging/runtime load while still exhaustively searching ordinary vacation windows.
  if(windows.length>240)return Response.json({error:"Flexible window creates too many date combinations","combinations":windows.length},{status:422});
  const all=[];
  try{
    for(let i=0;i<windows.length;i+=6){
      const batch=windows.slice(i,i+6);
      const rows=await Promise.all(batch.map(w=>searchOne({address,...w,guests,radius,budget})));
      rows.forEach(x=>all.push(...x));
    }
    const groups=new Map();
    for(const x of all.sort((a,b)=>a.total-b.total)){
      if(!groups.has(x.id)) groups.set(x.id,{...x,alternateDates:[]});
      else{
        const g=groups.get(x.id);
        if(g.alternateDates.length<4&&!g.alternateDates.some(d=>d.from===x.from&&d.to===x.to)) g.alternateDates.push({from:x.from,to:x.to,nights:x.nights,total:x.total});
      }
    }
    const items=[...groups.values()].sort((a,b)=>a.total-b.total).slice(0,10);
    return Response.json({items,meta:{combinationsSearched:windows.length,candidatesFound:all.length,mode}});
  }catch(e){return Response.json({error:"Partner search failed"},{status:502})}
};
export const config={path:"/api/search"};