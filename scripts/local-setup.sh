#!/bin/bash

echo "🚀 Setting up AgentVibes for local development..."

# Copy example env if .env.local doesn't exist
if [ ! -f .env.local ]; then
  echo "📋 Creating .env.local from example..."
  cp .env.local.example .env.local
  echo "✅ Please edit .env.local with your API keys"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🗄️ Setting up database..."
npx prisma generate
npx prisma db push

# Show next steps
echo ""
echo "✅ Setup complete! Next steps:"
echo "1. Edit .env.local with your API keys (optional for basic testing)"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Visit http://localhost:3000/dashboard"
echo ""
echo "🧪 Test commands:"
echo "• npm run test-ingestion  # Test data ingestion"
echo "• npm run test-sources    # Test individual sources"
echo "• npm run check          # Run type checking"
