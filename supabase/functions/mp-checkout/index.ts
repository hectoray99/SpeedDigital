import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json();
    const { title, unit_price, appointment_id, return_url } = body;

    // TU TOKEN DE MERCADO PAGO
    const MP_ACCESS_TOKEN = "APP_USR-6573920676834041-041313-699305350dd75438dad51863a1a787be-3333970800";

    let safeUrl = return_url;
    if (!safeUrl || !safeUrl.startsWith('http')) {
        safeUrl = "https://speeddigitalapp.com"; 
    }

    // 🔥 BLINDAJE MATEMÁTICO: MP no acepta decimales largos
    const finalPrice = Math.round(Number(unit_price) || 50);

    const preferenceData: any = {
      items: [
        {
          title: title || "Reserva de Turno", 
          description: "Seña / Pago de servicio",
          quantity: 1,
          currency_id: "ARS", 
          unit_price: finalPrice
        }
      ],
      external_reference: appointment_id, 
      back_urls: {
        success: `${safeUrl}?mp_status=approved&app_id=${appointment_id}`, 
        failure: `${safeUrl}?mp_status=failure`,
        pending: `${safeUrl}?mp_status=pending`
      }
    };

    // Apagamos auto_return en localhost para que MP no explote
    const isLocalhost = safeUrl.includes('localhost') || safeUrl.includes('127.0.0.1');
    if (!isLocalhost) {
        preferenceData.auto_return = "approved";
    }

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(preferenceData)
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
        console.error("Error MP:", JSON.stringify(mpData));
        return new Response(JSON.stringify({ error: "MERCADO_PAGO_REJECTED", details: mpData }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ url: mpData.init_point, sandbox_init_point: mpData.sandbox_init_point }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR", message: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})