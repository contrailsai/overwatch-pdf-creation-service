const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase;
const supabaseEnabled = Boolean(supabaseUrl && supabaseKey);

if (supabaseEnabled) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('Missing SUPABASE_URL or SUPABASE_KEY environment variables. Report status updates will be skipped.');
  supabase = {
    from: () => ({
      update: () => ({
        eq: async () => ({ error: { message: 'Supabase client not initialized', code: 'SUPABASE_DISABLED' } })
      })
    })
  };
}

module.exports = { supabase, supabaseEnabled };
