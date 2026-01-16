import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const body = await req.json()
    const result = body.Body.stkCallback
    
    if (result.ResultCode === 0) {
        const amount = result.CallbackMetadata.Item.find((i: any) => i.Name === 'Amount').Value
        const receipt = result.CallbackMetadata.Item.find((i: any) => i.Name === 'MpesaReceiptNumber').Value
        const mpesaPhone = result.CallbackMetadata.Item.find((i: any) => i.Name === 'PhoneNumber').Value.toString()
        const checkoutId = result.CheckoutRequestID

        // --- BEAST MODE: FIND THE USER ---
        // 1. Try finding by Memory (Payment Request)
        let userId = null;
        let intent = "savings_deposit";

        const { data: request } = await supabase
            .from('payment_requests')
            .select('user_id, intent')
            .eq('checkout_request_id', checkoutId)
            .single();

        if (request) {
            userId = request.user_id;
            intent = request.intent;
        } else {
            // 2. Fallback: Try finding by Phone (Try ALL formats)
            const format1 = mpesaPhone; // 2547...
            const format2 = mpesaPhone.replace(/^254/, '0'); // 07...
            const format3 = '+' + mpesaPhone; // +254...

            const { data: user } = await supabase
                .from('profiles')
                .select('id, membership_status')
                .or(`phone_number.eq.${format1},phone_number.eq.${format2},phone_number.eq.${format3}`)
                .single();
            
            if (user) {
                userId = user.id;
                // If they are new, assume Membership Fee
                if (user.membership_status === 'pending_payment') intent = "membership_fee";
            }
        }

        // --- EXECUTE TRANSACTION ---
        if (userId) {
            // A. Update Balances
            if (intent === 'savings_deposit') {
                await supabase.rpc('increment_savings', { p_phone: mpesaPhone.replace(/^254/, '0'), p_amount: amount })
            } else if (intent === 'share_capital') {
                await supabase.rpc('increment_shares', { p_phone: mpesaPhone.replace(/^254/, '0'), p_amount: amount })
            } else if (intent === 'membership_fee') {
                await supabase.from('profiles').update({ membership_status: 'pending_approval' }).eq('id', userId);
            }

            // 👇 ADD THIS BLOCK TO SAVE THE LEDGER RECEIPT WITH DEBUGGING 👇
            const meta = result.CallbackMetadata.Item;
            const receiptNumber = meta.find((m: any) => m.Name === 'MpesaReceiptNumber')?.Value;
            const amountPaid = meta.find((m: any) => m.Name === 'Amount')?.Value;

            // Debug: Log all variables before insert
            console.log('DEBUG LEDGER INSERT:', {
                userId,
                amountPaid,
                receiptNumber,
                meta,
                intent,
                mpesaPhone,
                checkoutId
            });

            const { data: ledgerData, error: ledgerError } = await supabase.from('transactions').insert({
                user_id: userId, // Make sure you have the userId here
                amount: amountPaid,
                transaction_type: 'deposit',
                description: 'M-Pesa Deposit',
                mpesa_reference: receiptNumber,
                status: 'completed'
            });
            // Debug: Log result of insert
            console.log('LEDGER INSERT RESULT:', { ledgerData, ledgerError });
            if (ledgerError) console.error("Ledger Error:", ledgerError);
            // 👆 END OF NEW BLOCK 👆
        } else {
            // Log Orphaned Transaction (For Admin to fix later)
            await supabase.from('webhook_logs').insert({ 
                payload: result, 
                error_message: `ORPHANED TRANSACTION: Could not find user for phone ${mpesaPhone}` 
            });
        }
    } else {
        await supabase.from('webhook_logs').insert({ payload: result, error_message: "User Cancelled" });
    }

  } catch (err) {
    console.error(err);
    await supabase.from('webhook_logs').insert({ payload: {}, error_message: `CRASH: ${err.message}` });
  }

  return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }), { headers: { "Content-Type": "application/json" } })
})