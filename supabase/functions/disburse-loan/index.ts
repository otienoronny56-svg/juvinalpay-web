import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 👇 PASTE THE "SERVICE ROLE" KEY FROM YOUR DASHBOARD HERE
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxvc2R6aXdtb3htZGphYm9nZ2VhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzQ1Nzk3MiwiZXhwIjoyMDgzMDMzOTcyfQ.OvGR33mRa1yfvZiYdTZoGOWQSspc2oqwXqWoe2gyw68"; 

const MY_PROJECT_URL = "https://losdziwmoxmdjaboggea.supabase.co";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { loanId } = await req.json()
    if (!loanId) throw new Error("Missing loanId")

    console.log(`Processing Request -> Loan: ${loanId}`)

    // 1. CREATE SUPER ADMIN CLIENT
    // This uses the key you pasted to bypass all database restrictions.
    const supabaseAdmin = createClient(MY_PROJECT_URL, SERVICE_ROLE_KEY)

    // 2. FETCH LOAN (Now this will work because we are Admin)
    const { data: loan, error: loanError } = await supabaseAdmin
        .from('sacco_loans')
        .select('*, profiles(phone_number, full_name)')
        .eq('id', loanId)
        .single()

    if (loanError || !loan) {
        console.error("DB Error:", loanError)
        return new Response(JSON.stringify({ error: "Loan not found (Check Permissions)" }), { 
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
    }

    if (loan.status === 'active') {
        return new Response(JSON.stringify({ message: "Loan is already active" }), { 
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
    }

    // 3. APPROVE LOAN
    const now = new Date()
    const dueDate = new Date()
    dueDate.setMonth(now.getMonth() + 1)

    const { error: updateError } = await supabaseAdmin
        .from('sacco_loans')
        .update({
            status: 'active',
            disbursed_at: now.toISOString(),
            due_date: dueDate.toISOString()
        })
        .eq('id', loanId)

    if (updateError) throw updateError

    // 4. DEPOSIT MONEY
    const { error: moneyError } = await supabaseAdmin.rpc('process_deposit', {
        p_user_id: loan.user_id,
        p_amount: loan.amount,
        p_method: 'Loan Disbursement',
        p_reference: 'LOAN-' + loan.id.substring(0, 8)
    })

    if (moneyError) console.error("Money Transfer Failed:", moneyError)

    return new Response(JSON.stringify({ success: true, message: "Loan Approved" }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
    })
  }
})