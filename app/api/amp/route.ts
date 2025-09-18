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
    const { messages }: ChatRequest = await req.json();

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the latest user message for context retrieval
    const userQuery = messages[messages.length - 1]?.content || '';
    console.log('User query:', userQuery);

    // Retrieve relevant context from dashboard data
    const context = await getRelevantContext(userQuery, 3000);
    console.log('Context length:', context.length);

    const ampApiKey = process.env.AMP_API_KEY;
    const ampApiUrl = process.env.AMP_API_URL || 'https://api.ampcode.com';

    console.log('AMP API Key configured:', !!ampApiKey);
    console.log('AMP API URL:', ampApiUrl);

    if (!ampApiKey) {
      // Return a mock response for development/demo purposes
      const mockResponse = `I'd love to help you analyze your AgentVibes dashboard data! 

Based on the context provided, I can see you have:
- ${context.split('\n').length - 2} entries from various sources
- Data from RSS feeds, GitHub PRs, and build systems
- Recent activity across AI coding assistant tools

To get real AI-powered insights, please add your AMP_API_KEY to the .env.local file.

**Your query was:** "${userQuery}"

**Available data context:**
${context.substring(0, 500)}...`;

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

    console.log('Calling Amp API at:', `${ampApiUrl}/v1/chat/completions`);

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

    console.log('Amp API response status:', ampResponse.status, ampResponse.statusText);

    if (!ampResponse.ok) {
      const errorText = await ampResponse.text();
      console.error('Amp API error response:', errorText);
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

  } catch (error) {
    console.error('Amp API error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to process query',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
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
