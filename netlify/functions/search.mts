export default async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed",{status:405});
  const input=new URL(req.url).searchParams;
  const address=input.get("address")||"",from=input.get("from")||"",to=input.get("to")||"";
  const guests=Math.max(1,Number(input.get("guests")||2)),radius=Math.max(1,Math.min(300,Number(input.get("radius")||100))),budget=Math.max(100,Number(input.get("budget")||1500));
  const debug=input.get("debug")==="1";
  if(!address||!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)) return Response.json({error:"Invalid search"},{status:400});
  const qs=new URLSearchParams({"address":address,"date[from]":from,"date[to]":to,"sleeps":String(guests),"radius":String(radius),"page[limit]":"40"});
  try{
    const upstream="https://search.staging.outdoorsy.com/rentals?"+qs;
    const r=await fetch(upstream,{headers:{"Accept":"application/vnd.api+json, application/json"}});
    const text=await r.text();
    let body; try{body=JSON.parse(text)}catch{body=null}
    if(!r.ok) return Response.json({error:"Partner search unavailable",upstreamStatus:r.status,preview:debug?text.slice(0,500):undefined},{status:502});
    const raw=Array.isArray(body)?body:(Array.isArray(body?.data)?body.data:Array.isArray(body?.results)?body.results:[]);
    const nights=Math.max(1,Math.round((new Date(to+"T12:00:00")-new Date(from+"T12:00:00"))/86400000));
    const items=raw.map((row,i)=>{
      const a=row?.attributes||row||{};
      const candidates=[a.current_price?.day,a.currentPrice?.day,a.price?.day,a.active_options?.price?.day,a.daily_rate,a.calculated_day_price,a.price_per_day,a.nightly_rate].map(Number).filter(Number.isFinite);
      const cents=candidates.find(x=>x>0)||0,rate=cents>=1000?cents/100:cents;
      if(!rate)return null;
      const rental=Math.round(rate*nights),service=Math.round(rental*.10),protection=18*nights,taxes=Math.round((rental+service)*.075),fuel=Math.round(90*3.35/12),total=rental+service+protection+taxes+fuel;
      const slug=a.slug||row?.id||"rv-search";
      return{id:row?.id||i,title:a.name||a.vehicle_make||a.title||"RV rental",rate:Math.round(rate),rental,service,protection,taxes,fuel,total,from,to,nights,source:"Outdoorsy staging",url:"https://www.outdoorsy.com/rv-rental/"+String(slug).replace(/^\//,"")}
    }).filter(Boolean).filter(x=>x.total<=budget).sort((a,b)=>a.total-b.total).slice(0,10);
    const diagnostics=debug?{upstreamStatus:r.status,bodyType:Array.isArray(body)?"array":typeof body,topKeys:body&&typeof body==="object"&&!Array.isArray(body)?Object.keys(body).slice(0,20):[],rawCount:raw.length,firstRowKeys:raw[0]?Object.keys(raw[0]).slice(0,20):[],firstAttributeKeys:raw[0]?.attributes?Object.keys(raw[0].attributes).slice(0,80):[],firstPriceLike:raw[0]?.attributes?Object.fromEntries(Object.entries(raw[0].attributes).filter(([k])=>/price|rate|cost|day/i.test(k)).slice(0,30)):null,textPreview:raw.length?undefined:text.slice(0,500)}:undefined;
    return Response.json({items,diagnostics});
  }catch(e){return Response.json({error:"Partner search failed",detail:debug?String(e):undefined},{status:502})}
}
export const config={path:"/api/search"};