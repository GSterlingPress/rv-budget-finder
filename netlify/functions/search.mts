export default async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed",{status:405});
  const input=new URL(req.url).searchParams;
  const address=input.get("address")||"";
  const from=input.get("from")||"";
  const to=input.get("to")||"";
  const guests=Math.max(1,Number(input.get("guests")||2));
  const radius=Math.max(1,Math.min(300,Number(input.get("radius")||100)));
  const budget=Math.max(100,Number(input.get("budget")||1500));
  if(!address||!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)) return Response.json({error:"Invalid search"},{status:400});
  const qs=new URLSearchParams({"address":address,"date[from]":from,"date[to]":to,"sleeps":String(guests),"radius":String(radius),"page[limit]":"40","sort":"price","raw_json":"true"});
  try{
    const r=await fetch("https://search.staging.outdoorsy.com/rentals?"+qs);
    if(!r.ok) return Response.json({error:"Partner search unavailable",status:r.status},{status:502});
    const body=await r.json();
    const raw=Array.isArray(body)?body:(body.data||body.results||[]);
    const nights=Math.max(1,Math.round((new Date(to+"T12:00:00")-new Date(from+"T12:00:00"))/86400000));
    const items=raw.map((row,i)=>{
      const a=row.attributes||row;
      const cents=Number(a.price?.day||a.daily_rate||a.price||a.calculated_day_price||0);
      const rate=cents>1000?cents/100:cents;
      if(!rate)return null;
      const rental=Math.round(rate*nights),service=Math.round(rental*.10),protection=18*nights,taxes=Math.round((rental+service)*.075),fuel=Math.round(90*3.35/12),total=rental+service+protection+taxes+fuel;
      const slug=a.slug||"rv-search";
      return{id:row.id||i,title:a.name||a.vehicle_make||"RV rental",rate:Math.round(rate),rental,service,protection,taxes,fuel,total,from,to,nights,source:"Outdoorsy staging",url:"https://www.outdoorsy.com/"+String(slug).replace(/^\//,"")}
    }).filter(Boolean).filter(x=>x.total<=budget).sort((a,b)=>a.total-b.total).slice(0,10);
    return Response.json({items});
  }catch(e){return Response.json({error:"Partner search failed"},{status:502})}
}
export const config={path:"/api/search"};