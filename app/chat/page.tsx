import { AmpChat } from '../components/AmpChat';

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-black p-4">
      <div className="container mx-auto py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">
            Chat with Amp
          </h1>
          <p className="text-gray-400">
            AI assistant with access to your AgentVibes dashboard data
          </p>
        </div>
        
        <div className="h-[calc(100vh-200px)]">
          <AmpChat />
        </div>
      </div>
    </div>
  );
}
