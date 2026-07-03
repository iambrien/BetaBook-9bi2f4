import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Models to try in order — automatic fallback if one fails
const MODEL_CASCADE = [
  'google/gemini-2.5-flash-lite',
  'google/gemini-3-flash-preview',
  'openai/gpt-5-nano',
];

function buildSystemPrompt(userName?: string): string {
  const nameGreet = userName ? `The user's name is ${userName}. Address them by name naturally in conversation.` : '';
  return `You are **Beta**, the BetaBook AI — a warm, brilliant financial expert, business advisor, and mathematics whiz built specifically for Nigerian market traders.

${nameGreet}

## Your Personality
- Friendly, encouraging, and professional
- You speak clear English mixed with natural Nigerian Pidgin expressions (e.g. "Oga", "e don set", "make you", "sharp sharp", "no wahala", "e go better") — use them naturally, not excessively
- You are enthusiastic about helping traders grow their businesses
- You celebrate wins ("Oga, you dey do well!") and give honest, actionable advice for challenges

## Your Expertise
1. **Financial Expert**: Calculate totals, percentages, profit margins, growth rates accurately. Show your working when doing complex maths.
2. **Business Advisor**: Give practical, Nigeria-market-specific advice on inventory, pricing, debt management, cash flow, and growth strategies.
3. **Math Whiz**: Solve any arithmetic, percentage, interest calculation, or quantity problem instantly and accurately.
4. **Data Analyst**: Analyze the live transaction data provided to give precise, accurate answers about income, expenses, and debts.

## Rules for Data Analysis
- ALWAYS use numbers from the "LIVE BUSINESS DATA" section — never invent figures
- Format money as ₦X,XXX (e.g. ₦15,000)
- When answering financial questions, start with the key number then give context
- Reference specific customer names, items, and dates when relevant
- Clearly distinguish between income, expenses, and outstanding debts

## Rules for Math Questions
- Solve step by step when needed
- Always double-check your arithmetic
- Format results clearly (e.g. "₦5,000 × 3 bags = ₦15,000")
- Offer to help with related calculations

## Debt Questions
- Check the OUTSTANDING DEBTS section carefully
- Give exact amounts, customer names, and dates
- Suggest WhatsApp follow-up messages in a friendly tone

## Response Style
- Keep replies concise but complete (2–5 short paragraphs max)
- Use bullet points for lists
- Bold key numbers and names using **asterisks**
- End with a helpful follow-up offer or encouragement
- If no data exists, gently encourage the user to start recording transactions`;
}

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
      max_tokens: 900,
      temperature: 0.72,
    }),
  });

  const responseText = await res.text();

  if (!res.ok) {
    throw new Error(`${model} → HTTP ${res.status}: ${responseText.slice(0, 400)}`);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`${model} → invalid JSON: ${responseText.slice(0, 200)}`);
  }

  const text =
    (data.choices as Array<{ message?: { content?: string } }>)?.[0]?.message?.content?.trim() ||
    (data.output as Array<{ content?: Array<{ text?: string }> }>)?.[0]?.content?.[0]?.text?.trim();

  if (!text) throw new Error(`${model} → empty content in response`);
  return text;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { messages, context, businessId, userName } = body;

    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

    if (!apiKey || !baseUrl) {
      console.error('[ai-chat] Missing ONSPACE_AI_API_KEY or ONSPACE_AI_BASE_URL');
      throw new Error('AI service not configured. Please contact support.');
    }

    console.log(`[ai-chat] baseUrl=${baseUrl}, apiKey starts with: ${apiKey?.slice(0, 8)}...`);

    // ── Build rich context block from live transaction data ─────────────────
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
            contextBlock += `  - ${d.customer_name || 'Unknown'}: ₦${Number(d.amount).toLocaleString()} for "${d.item_name || 'goods'}" on ${dateStr}`;
            if (d.customer_phone) contextBlock += ` (Phone: ${d.customer_phone})`;
            contextBlock += '\n';
          });
          contextBlock += '\n';
        } else {
          contextBlock += 'OUTSTANDING DEBTS: None — all payments are cleared!\n\n';
        }

        const recent = filtered.slice(0, 25);
        contextBlock += `RECENT ${recent.length} TRANSACTIONS:\n`;
        recent.forEach((t: Record<string, unknown>) => {
          const date = new Date(t.created_at as string).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
          const label = (t.item_name as string) || (t.category as string) || (t.type === 'income' ? 'Income' : 'Expense');
          const sign = t.type === 'income' ? '+' : '-';
          const creditTag = t.payment_status === 'credit' ? ` [CREDIT - ${t.customer_name}]` : '';
          contextBlock += `  ${sign}₦${Number(t.amount).toLocaleString()} | ${label}${creditTag} | ${date}\n`;
        });
        contextBlock += '=== END DATA ===';
      } else {
        contextBlock = '\n\n=== LIVE BUSINESS DATA ===\nNo transactions for this business yet.\n=== END DATA ===';
      }
    } else {
      contextBlock = '\n\n=== LIVE BUSINESS DATA ===\nNo transactions recorded yet.\n=== END DATA ===';
    }

    // ── Inject context into last user message ──────────────────────────────
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
      { role: 'system', content: buildSystemPrompt(userName) },
      ...enrichedMessages,
    ];

    console.log(`[ai-chat] sending ${enrichedMessages.length} messages, ${context?.length || 0} tx context`);

    // ── Try each model in cascade until one works ─────────────────────────
    const errors: string[] = [];

    for (const model of MODEL_CASCADE) {
      try {
        const message = await callModel(baseUrl, apiKey, model, allMessages);
        console.log(`[ai-chat] ✅ success with ${model}`);
        return new Response(
          JSON.stringify({ message, model_used: model }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[ai-chat] ❌ ${model} failed: ${errMsg}`);
        errors.push(`${model}: ${errMsg}`);
      }
    }

    // All models failed — return detailed error
    const combinedError = `All AI models failed.\n${errors.join('\n')}`;
    console.error('[ai-chat] All models exhausted:', combinedError);
    throw new Error('AI is temporarily unavailable. Please try again in a moment.');

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ai-chat] fatal:', errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
