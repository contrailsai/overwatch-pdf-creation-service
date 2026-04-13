const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('Missing SUPABASE_URL or SUPABASE_KEY environment variables.');
  // Mock client to prevent crashes if environment variables are missing
  supabase = {
    from: () => ({
      update: () => ({
        eq: async () => ({ error: { message: 'Supabase client not initialized' } })
      })
    })
  };
}

module.exports = { supabase };
