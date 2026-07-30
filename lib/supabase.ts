import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  // Runs the realtime heartbeat in a Web Worker so a backgrounded tab
  // doesn't get throttled into missing heartbeats and dropping the channel.
  realtime: { worker: true },
})
