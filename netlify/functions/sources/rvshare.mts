export type NormalizedRv={id:string;source:string;title:string;image?:string|null;rate?:number;total?:number;from?:string;to?:string;nights?:number;url:string;[key:string]:unknown};
export type SearchInput={address:string;from:string;to:string;guests:number;radius:number;budget:number};

/**
 * RVshare source adapter.
 * RVshare documents affiliate access to a search API/product feed, but credentials
 * and endpoint details are supplied after affiliate approval. We intentionally do
 * not scrape RVshare or invent undocumented endpoints.
 */
export async function searchRvshare(_input:SearchInput):Promise<NormalizedRv[]>{
  const endpoint=Netlify.env.get("RVSHARE_API_URL");
  const token=Netlify.env.get("RVSHARE_API_TOKEN");
  if(!endpoint||!token)return [];
  const q=new URLSearchParams({
    location:_input.address,
    start_date:_input.from,
    end_date:_input.to,
    guests:String(_input.guests),
    radius:String(_input.radius)
  });
  const r=await fetch(endpoint+"?"+q,{headers:{Authorization:"Bearer "+token,Accept:"application/json"}});
  if(!r.ok)throw new Error("RVshare search failed: "+r.status);
  // Exact response mapping will be locked to RVshare's approved API schema.
  // Until then, return no results rather than misrepresenting partner data.
  return [];
}
