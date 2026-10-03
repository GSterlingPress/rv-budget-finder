# RV Budget Finder V1

Small validation product for one question: **What is the cheapest RV trip I can take for my total budget?**

## V1
- Location, dates, travelers, budget and radius
- Normalized estimated trip total
- Cheapest-first ranking
- Affiliate-ready click-outs
- Zero database, accounts, payments or framework overhead

## Current data mode
The UI intentionally uses clearly labeled demo inventory until partner credentials are approved. It does not pretend demo prices are live.

## Production data
Outdoorsy Partner API is source #1. Keep the Partner ID server-side/proxied if partner terms require it. Replace the demo adapter in `app.js` with live search + quote normalization. RVshare is source #2 after affiliate/API approval.

## Total-cost model
Rental + service fee + required protection/add-ons + taxes + estimated fuel. Future versions may add campground, delivery, mileage and generator overages when supplied by inventory/quote data.

## Deploy
Static site: deploy the repository root to Netlify or any static host. No build command required.
