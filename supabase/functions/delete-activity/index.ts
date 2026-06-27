import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    console.error('no auth header')
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  const body = await req.json()
  const { activity_id } = body
  console.log('activity_id:', activity_id)
  if (!activity_id) {
    return new Response('Missing activity_id', { status: 400, headers: corsHeaders })
  }

  const url  = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const svc  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Verify caller identity using anon key + their JWT (recommended Edge Function pattern)
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  console.log('user id:', user?.id, 'authError:', authError?.message)
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  // Service role client for all writes
  const admin = createClient(url, svc)

  const { data: activity, error: fetchError } = await admin
    .from('activities')
    .select('id, host_id, image_url')
    .eq('id', activity_id)
    .single()

  console.log('activity:', JSON.stringify(activity), 'fetchError:', fetchError?.message)

  if (fetchError || !activity) {
    return new Response(
      JSON.stringify({ error: 'not found', detail: fetchError?.message }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  if (activity.host_id !== user.id) {
    console.error('host mismatch', activity.host_id, user.id)
    return new Response('Forbidden', { status: 403, headers: corsHeaders })
  }

  const { error: deleteError } = await admin
    .from('activities')
    .delete()
    .eq('id', activity_id)

  console.log('deleteError:', deleteError?.message)
  if (deleteError) {
    return new Response(
      JSON.stringify({ error: deleteError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (activity.image_url) {
    const path = activity.image_url.split('/activity-images/')[1]
    console.log('deleting storage path:', path)
    if (path) {
      const { data: removed, error: storageError } = await admin.storage
        .from('activity-images')
        .remove([path])
      console.log('storage removed:', JSON.stringify(removed), 'storageError:', storageError?.message)
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
