import {createClient} from 'npm:@supabase/supabase-js@2.49.8';
import {corsHeaders} from '../_shared/cors.ts';
import {createInvestmentHandler} from '../_shared/investment-endpoint.mjs';
import {parseRss} from '../_shared/multisource-sources-v294.ts';
import {pinnedHttpsPage} from '../_shared/pinned-https.mjs';
Deno.serve(createInvestmentHandler({createClient,getEnv:(name:string)=>String(Deno.env.get(name)||'').trim(),parseRss,getPage:pinnedHttpsPage,headers:corsHeaders}));
