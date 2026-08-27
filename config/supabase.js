import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://lpkohqusmhbeeclyuxxv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxwa29ocXVzbWhiZWVjbHl1eHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MTgyNjgsImV4cCI6MjEwMzM5NDI2OH0.MTU_Xq2clcJie5ATveoR-wg9iFjM6pYyu_aBagIOgw8';

export const supabase = createClient(supabaseUrl, supabaseKey);
