import { Resend } from "npm:resend";
import { createClient } from "npm:@supabase/supabase-js";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Cabeceras CORS obligatorias para llamadas desde el navegador
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // 1. Manejo de la pre-solicitud (OPTIONS) CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Obtener los parámetros enviados desde React
    const { operationId, emailTo } = await req.json();

    if (!operationId || !emailTo) {
      throw new Error("Faltan parámetros: operationId o emailTo");
    }

    // 3. Inicializar el cliente de Supabase usando el Service Role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 4. Buscar la información de la operación en la BD v2.0
    const { data: opData, error: opError } = await supabaseClient
      .from('operations')
      .select(`
        number,
        total_amount,
        created_at,
        organizations ( name ),
        operation_lines ( quantity, unit_price, catalog_items ( name ) )
      `)
      .eq('id', operationId)
      .single();

    if (opError || !opData) throw new Error("No se pudo obtener el detalle de la operación.");

    const orgName = opData.organizations.name;
    const ticketNumber = opData.number;
    const date = new Date(opData.created_at).toLocaleDateString('es-AR', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // 5. Armar el detalle de las líneas
    const itemsHtml = opData.operation_lines.map((line: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${line.quantity}x ${line.catalog_items?.name || 'Servicio'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${Number(line.unit_price).toLocaleString()}</td>
      </tr>
    `).join('');

    // 6. Diseño del correo (HTML)
    const htmlBody = `
      <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #333;">
        <div style="text-align: center; padding: 20px; background-color: #f8fafc; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: #0f172a;">${orgName}</h1>
          <p style="margin: 5px 0 0 0; color: #64748b;">Comprobante de Pago</p>
        </div>
        
        <div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <div style="margin-bottom: 20px; font-size: 14px; color: #64748b;">
            <p><strong>Ticket Nº:</strong> ${ticketNumber}</p>
            <p><strong>Fecha:</strong> ${date}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f8fafc;">
                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #cbd5e1;">Concepto</th>
                <th style="padding: 8px; text-align: right; border-bottom: 2px solid #cbd5e1;">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td style="padding: 12px 8px; font-weight: bold; text-align: right;">TOTAL ABONADO</td>
                <td style="padding: 12px 8px; font-weight: bold; text-align: right; font-size: 18px; color: #10b981;">
                  $${Number(opData.total_amount).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>

          <p style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 40px;">
            Gracias por elegirnos. Este documento es un comprobante de pago electrónico.
          </p>
        </div>
      </div>
    `;

    // 7. Disparar el correo con Resend
    const resendResponse = await resend.emails.send({
      from: `${orgName} <comprobantes@tudominio.com>`, // IMPORTANTE: Cambiá "tudominio.com"
      to: emailTo,
      subject: `Comprobante de Pago - ${orgName}`,
      html: htmlBody,
    });

    return new Response(JSON.stringify(resendResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});