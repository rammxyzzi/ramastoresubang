import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://awbklgvwnsofkaiwjcso.supabase.co/rest/v1/';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YmtsZ3Z3bnNvZmthaXdqY3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NTE1MTEsImV4cCI6MjEwMzIyNzUxMX0.Cli1QGWqU7TrNEgUnPxmcUTdt8P5uR60ppqzIdTrt8Q';

export const supabase = createClient(supabaseUrl, supabaseKey);
