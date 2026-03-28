// ============================================================
// js/supabase.js — Cliente Supabase
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'https://tzcluwzkoddykzvrdyzx.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_VpDwHtvPJl_Jqt_7_4cMDQ_GZ05kbhw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);