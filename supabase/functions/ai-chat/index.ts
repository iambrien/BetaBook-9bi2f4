import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const SYSTEM_PROMPT = `You are BetaBook AI, the smart business assistant for Nigerian market traders.

Your personality:
- Warm, friendly and professional
- You speak simple English mixed with Nigerian Pidgin expressions naturally (but not excessively)
- You are encouraging and positive about business
- You give practical, actionable advice

Your capabilities:
- Analyze transaction data provided in the context block
- Answer questions about income, expenses, debts, and profit accurately
- Provide business insights and advice tailored to Nigerian market traders
- Help users understand their financial position

Rules when analyzing data:
- ALWAYS use the live data from the "LIVE BUSINESS DATA" section to answer financial questions
- Calculate totals from the actual transaction list — never invent numbers
- Reference specific customer names, amounts, and dates when relevant
- Always format money as ₦X,XXX (e.g., ₦15,000 not 15000)
- Use expressions like "Oga", "e don happen", "e no go reach", "make you", "sharp sharp" naturally

For debt questions (e.g., "Who owes me?", "How much is X owing?"):
- Search the OUTSTANDING DEBTS section in the provided data
- Give the exact amount, item name, and date

For financial summaries:
- Compute totals from the transactions provided
- Clearly separate income, expenses, profit/loss
- Give actionable advice based on the numbers

If no data is provided, gently encourage the user to start recording their transactions.
Always be supportive and make the trader feel confident in managing their business.`;

// Models to try in order — fallback if one fails
const MODEL_CASCADE = [
  'google/gemini-3-flash-preview',
  'google/gemini-2.5-flash-lite',
  'openai/gpt-5-nano',
];

async function callModel(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: unknown[],
): Promise<string> {
  console.log(`[ai-chat] trying model: ${model}`);

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${model} responded ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text =
    data.choices?.[0]?.message?.content?.trim() ||
    data.output?.[0]?.content?.[0]?.text?.trim();

  if (!text) throw new Error(`${model} returned empty content`);
  return text;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { messages, context, businessId } = body;

    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

    if (!apiKey || !baseUrl) {
      throw new Error('AI service not configured. Please contact support.');
    }

    // ── Build rich context from live transaction data ──────────────────────
    let contextBlock = '';
    if (Array.isArray(context) && context.length > 0) {
      const filtered = businessId
        ? context.filter((t: Record<string, unknown>) => t.business_id === businessId)
        : context;

      if (filtered.length > 0) {
        const income = filtered.filter((t: Record<string, unknown>) => t.type === 'income');
        const expenses = filtered.filter((t: Record<string, unknown>) => t.type === 'expense');
        const debts = income.filter((t: Record<string, unknown>) => t.payment_status === 'credit');

        const totalIncome = income.reduce((s: number, t: Record<string, unknown>) => s + Number(t.amount), 0);
        const totalExpense = expenses.reduce((s: number, t: Record<string, unknown>) => s + Number(t.amount), 0);
        const netProfit = totalIncome - totalExpense;

        contextBlock = `\n\n=== LIVE BUSINESS DATA ===\n`;
        contextBlock += `Total Income: ₦${totalIncome.toLocaleString()}\n`;
        contextBlock += `Total Expenses: ₦${totalExpense.toLocaleString()}\n`;
        contextBlock += `Net ${netProfit >= 0 ? 'Profit' : 'Loss'}: ₦${Math.abs(netProfit).toLocaleString()}\n`;
        contextBlock += `Total Transactions: ${filtered.length}\n\n`;

        if (debts.length > 0) {
          const totalDebt = debts.reduce((s: number, t: Record<string, unknown>) => s + Number(t.amount), 0);
          contextBlock += `OUTSTANDING DEBTS (${debts.length} customers, total ₦${totalDebt.toLocaleString()}):\n`;
          debts.forEach((d: Record<string, unknown>) => {
            const dateStr = new Date(d.created_at as string).toLocaleDateString('en-NG', {
              day: 'numeric', month: 'short', year: 'numeric',
            });
            contextBlock += `  - ${d.customer_name || 'Unknown Customer'}: ₦${Number(d.amount).toLocaleString()} for "${d.item_name || 'goods'}" on ${dateStr}`;
            if (d.customer_phone) contextBlock += ` (Phone: ${d.customer_phone})`;
            contextBlock += '\n';
          });
          contextBlock += '\n';
        } else {
          contextBlock += 'OUTSTANDING DEBTS: None — all customers have paid!\n\n';
        }

        const recent = filtered.slice(0, 20);
        contextBlock += `RECENT ${recent.length} TRANSACTIONS:\n`;
        recent.forEach((t: Record<string, unknown>) => {
          const date = new Date(t.created_at as string).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
          const label = (t.item_name as string) || (t.category as string) || (t.type === 'income' ? 'Income' : 'Expense');
          const sign = t.type === 'income' ? '+' : '-';
          const creditTag = t.payment_status === 'credit' ? ` [CREDIT - ${t.customer_name}]` : '';
          contextBlock += `  ${sign}₦${Number(t.amount).toLocaleString()} | ${label}${creditTag} | ${date}\n`;
        });
        contextBlock += '=== END DATA ===';
      }
    } else {
      contextBlock = '\n\n=== LIVE BUSINESS DATA ===\nNo transactions recorded yet.\n=== END DATA ===';
    }

    // ── Inject context into the last user message ──────────────────────────
    const enrichedMessages = Array.isArray(messages) ? [...messages] : [];
    if (enrichedMessages.length > 0) {
      const last = enrichedMessages[enrichedMessages.length - 1];
      if (last.role === 'user') {
        enrichedMessages[enrichedMessages.length - 1] = {
          ...last,
          content: `${last.content}${contextBlock}`,
        };
      }
    }

    const allMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...enrichedMessages,
    ];

    console.log(`[ai-chat] ${enrichedMessages.length} messages, ${context?.length || 0} transactions`);

    // ── Try models in cascade until one succeeds ──────────────────────────
    let lastError: Error | null = null;
    for (const model of MODEL_CASCADE) {
      try {
        const message = await callModel(baseUrl, apiKey, model, allMessages);
        console.log(`[ai-chat] success with ${model}, length: ${message.length}`);
        return new Response(JSON.stringify({ message, model_used: model }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(`[ai-chat] ${model} failed:`, lastError.message);
        // Continue to next model
      }
    }

    // All models failed
    throw lastError || new Error('All AI models failed');

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ai-chat] fatal error:', errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
