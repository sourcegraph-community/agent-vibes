# Amp Integration Setup

## Environment Configuration

Add these variables to your `.env.local` file:

```bash
# Required: Your Amp API key
AMP_API_KEY=your_amp_api_key_here

# Optional: Amp API URL (defaults to https://api.ampcode.com)
AMP_API_URL=https://api.ampcode.com
```

## How to Get Your Amp API Key

1. Go to [Amp Settings](https://ampcode.com/settings)
2. Navigate to the API Keys section
3. Create a new API key for your AgentVibes dashboard
4. Copy the key and add it to your `.env.local` file

## Usage

Once configured, the Amp query interface will be available in two places:

1. **Header Query Bar**: Available on all dashboard pages for quick queries
2. **Query Interface Section**: Click "Query Interface" in the sidebar for the full experience

## Testing

Try these example queries:
- "What are the latest trends in AI coding assistants?"
- "Summarize sentiment across all sources"
- "What happened in the last 24 hours?"
- "Show me the most important insights this week"

The system will automatically include relevant data from your RSS feeds, GitHub PRs, and build logs in the context sent to Amp.
