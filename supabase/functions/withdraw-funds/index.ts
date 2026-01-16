import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. Setup Client (Hardcoded as requested)
    const supabase = createClient(
      'https://losdziwmoxmdjaboggea.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxvc2R6aXdtb3htZGphYm9nZ2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NTc5NzIsImV4cCI6MjA4MzAzMzk3Mn0.2ijy4sofyqtTfuAIG3-0ZxrMQ6KNsQQeCjSAHy4gIRI'
    )

    const { userId, amount, phone } = await req.json()
    const withdrawAmount = parseFloat(amount)

    console.log(`Processing Withdrawal: KES ${withdrawAmount} for ${userId}`)

    // 2. GET CONFIG (Check Fee)
    const { data: config } = await supabase.from('sacco_configs').select('transaction_fee').single()
    const fee = config?.transaction_fee || 10
    const totalDeduction = withdrawAmount + fee

    // 3. CHECK BALANCE (Crucial Security Step)
    const { data: profile } = await supabase.from('profiles').select('savings_balance').eq('id', userId).single()
    
    if (!profile || profile.savings_balance < totalDeduction) {
        return new Response(JSON.stringify({ error: `Insufficient Funds. You need KES ${totalDeduction} (incl. fee)` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 4. DEDUCT BALANCE FIRST (Prevent double withdraw)
    const { error: deductError } = await supabase
        .from('profiles')
        .update({ savings_balance: profile.savings_balance - totalDeduction })
        .eq('id', userId)

    if (deductError) throw new Error("Balance update failed")

    // ---------------------------------------------------------
    // 5. SEND MONEY VIA B2C (Placeholder for Logic)
    // ---------------------------------------------------------
    // In a real live app, you put the Safaricom B2C API call here.
    // For now, we simulate success so the app works.
    const mpesaRef = 'WITHDRAW-' + Math.floor(Math.random() * 1000000)

    // 6. RECORD TRANSACTION
    await supabase.from('transactions').insert({
        user_id: userId,
        amount: -withdrawAmount, // Negative because money left account
        transaction_type: 'withdrawal',
        description: 'Withdrawal to M-Pesa',
        mpesa_reference: mpesaRef,
        status: 'completed'
    })

    // 7. RECORD FEE TRANSACTION
    await supabase.from('transactions').insert({
        user_id: userId,
        amount: -fee,
        transaction_type: 'fee',
        description: 'Withdrawal Fee',
        mpesa_reference: 'FEE-' + Math.floor(Math.random() * 1000000),
        status: 'completed'
    })

    return new Response(JSON.stringify({ success: true, message: "Withdrawal Successful", newBalance: profile.savings_balance - totalDeduction }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})