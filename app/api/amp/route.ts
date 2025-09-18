import { getRelevantContext } from '@/lib/context';

// Remove edge runtime as it might be causing issues
// export const runtime = 'edge'

const SYSTEM_PROMPT = `You are Amp, an AI assistant integrated into the AgentVibes dashboard. You help users analyze and understand data about AI coding assistants, market trends, and development insights.

Your role:
- Analyze aggregated data from RSS feeds, GitHub PRs, and build systems
- Provide synthesized reports and insights about AI coding tools
- Answer questions about trends, sentiment, and market developments
- Suggest relevant data points and correlations

Guidelines:
- Be concise and data-driven in your responses
- Reference specific entries when relevant
- Highlight trends and patterns in the data
- Suggest follow-up queries when appropriate
- If no relevant data is found, explain what data sources are available

The context provided contains recent entries from the dashboard's data aggregation system.`;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ChatRequest {
  messages: ChatMessage[]
  query?: string
}

export async function POST(req: Request) {
  try {
    console.log('[AMP API] Request received');
    
    const { messages }: ChatRequest = await req.json();
    console.log('[AMP API] Messages parsed:', messages);

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the latest user message for context retrieval
    const userQuery = messages[messages.length - 1]?.content || '';
    console.log('[AMP API] User query:', userQuery);

    // Retrieve relevant context from dashboard data
    console.log('[AMP API] Retrieving context...');
    const context = await getRelevantContext(userQuery, 3000);
    console.log('[AMP API] Context retrieved, length:', context.length);

    const ampApiKey = process.env.AMP_API_KEY;
    const ampApiUrl = process.env.AMP_API_URL || 'https://api.ampcode.com';

    console.log('[AMP API] API Key configured:', !!ampApiKey);
    console.log('[AMP API] API URL:', ampApiUrl);

    // Always return mock response if no API key is configured
    if (!ampApiKey) {
      console.log('[AMP API] No API key found, returning mock response');
      
      // Return a helpful mock response with actual data analysis
      const lines = context.split('\n').filter(line => line.trim());
      const entryCount = lines.length - 2; // Subtract header and footer
      
      const mockResponse = `# Dashboard Analysis

**Your query:** "${userQuery}"

Based on your AgentVibes dashboard data, I found **${entryCount} relevant items** to analyze:

## Key Insights:
- **Active discussions** about AI coding tools across social platforms
- **Mixed sentiment** with users sharing both excitement and concerns
- **AmpCode mentions** appear frequently in the data
- **Recent activity** shows ongoing development and user engagement

## Data Summary:
${context.substring(0, 800)}...

---
*Note: This is a demo response. For full AI-powered analysis, configure your AMP_API_KEY in .env.local*`;

      return new Response(mockResponse, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Build enhanced prompt with context
    const enhancedPrompt = `${SYSTEM_PROMPT}

Current AgentVibes Dashboard Data:
${context}

User Query: ${userQuery}

Please analyze the provided dashboard data and respond to the user's query with specific insights and references to the data.`;

    console.log('[AMP API] Calling Amp API at:', `${ampApiUrl}/v1/chat/completions`);

    try {
      // Call Amp API - try without json_object first since that might be causing issues
      const ampResponse = await fetch(`${ampApiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ampApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: enhancedPrompt },
          ],
          stream: true,
          model: 'gpt-4o', // Ensure we specify a model
        }),
      });

      console.log('[AMP API] Response status:', ampResponse.status, ampResponse.statusText);

      if (!ampResponse.ok) {
        const errorText = await ampResponse.text();
        console.error('[AMP API] Error response:', errorText);
        throw new Error(`Amp API error: ${ampResponse.status} ${ampResponse.statusText} - ${errorText}`);
      }

      // Stream the response back
      return new Response(ampResponse.body, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } catch (fetchError) {
      console.error('[AMP API] Fetch failed, falling back to mock response:', fetchError);
      
      // If the API call fails, return a helpful fallback response
      const fallbackResponse = `# Dashboard Analysis (Offline Mode)

**Your query:** "${userQuery}"

I'm currently running in offline mode but can still analyze your dashboard data:

## Available Data Context:
${context.substring(0, 1000)}...

---
*Note: Full AI analysis requires AMP_API_KEY configuration. Currently showing data context only.*`;

      return new Response(fallbackResponse, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }

  } catch (error) {
    console.error('[AMP API] Error:', error);
    
    // Create a more informative error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[AMP API] Error details:', { errorMessage, errorStack });

    return new Response(
      JSON.stringify({
        error: 'Failed to process query',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

// Health check endpoint
export async function GET() {
  try {
    const context = await getRelevantContext('test', 100);
    const dataAvailable = context.length > 50;

    return Response.json({
      status: 'healthy',
      dataAvailable,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({
      status: 'error',
      error: (error as Error).message,
    }, { status: 500 });
  }
}
