import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // 1. USE SERVICE ROLE KEY (Bypasses RLS)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' 
  )

  try {
    const body = await req.json()
    const result = body.Body.stkCallback
    
    // 2. LOG THE RAW DATA IMMEDIATELY
    await supabase.from('webhook_logs').insert({ 
        payload: result,
        error_message: "Incoming Signal Received" 
    })

    if (result.ResultCode === 0) {
        // Extract Data
        const amount = result.CallbackMetadata.Item.find((i: any) => i.Name === 'Amount').Value
        const receipt = result.CallbackMetadata.Item.find((i: any) => i.Name === 'MpesaReceiptNumber').Value
        const phone = result.CallbackMetadata.Item.find((i: any) => i.Name === 'PhoneNumber').Value.toString()

        // 3. NORMALIZE PHONE (Critical Step)
        const dbPhone = phone.replace(/^254/, '0')
        console.log(`Processing Payment: ${amount} for ${dbPhone}`)

        // 4. CALL THE DATABASE FUNCTION
        const { error: rpcError } = await supabase.rpc('process_loan_repayment', { 
            p_phone: dbPhone, 
            p_amount: amount 
        })

        if (rpcError) throw new Error(`RPC Failed: ${rpcError.message}`)

        // 5. LOG SUCCESS TO LEDGER
        const { data: user } = await supabase.from('profiles').select('id').eq('phone_number', dbPhone).single()
        
        await supabase.from('transactions').insert({
            user_id: user?.id, 
            amount: amount, 
            mpesa_reference: receipt,
            transaction_type: 'loan_repayment',
            description: "M-Pesa Auto-Repayment"
        })

    } else {
        await supabase.from('webhook_logs').insert({ 
            payload: result,
            error_message: `User Cancelled or Failed: ${result.ResultDesc}` 
        })
    }

  } catch (err) {
    console.error(err)
    await supabase.from('webhook_logs').insert({ 
        payload: {},
        error_message: `CRASH: ${err.message}` 
    })
  }

  return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }), {
    headers: { "Content-Type": "application/json" }
  })
})