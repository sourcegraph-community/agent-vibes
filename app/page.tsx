'use client';

import { useState } from 'react';

export default function Home() {
  const [notificationStatus, setNotificationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

  const handleNotificationRequest = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notifications');
      return;
    }

    if (Notification.permission === 'granted') {
      setNotificationStatus('granted');
      new Notification('AgentVibes', {
        body: "You're all set! We'll notify you when we launch.",
        icon: '/favicon.ico'
      });
      return;
    }

    setNotificationStatus('requesting');
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      setNotificationStatus('granted');
      // Show immediate browser notification
      new Notification('AgentVibes', {
        body: "You're all set! We'll notify you when we launch.",
        icon: '/favicon.ico'
      });
    } else {
      setNotificationStatus('denied');
    }
  };

  const getButtonText = () => {
    switch (notificationStatus) {
      case 'requesting':
        return '⏳ Requesting...';
      case 'granted':
        return '✅ Notifications Enabled';
      case 'denied':
        return '❌ Notifications Blocked';
      default:
        return '🔔 Enable Notifications';
    }
  };
  return (
    <div className="font-sans min-h-screen text-[#f8f9fa]" style={{backgroundColor: '#000000'}}>
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-screen text-center">
        <div className="mb-8">
          <h1 className="text-6xl md:text-8xl font-bold mb-4 leading-tight" style={{color: '#f8f9fa'}}>
            AgentVibes
          </h1>
          <p className="text-xl md:text-2xl mb-8" style={{color: '#f8f9fa'}}>
            Your pulse on the coding agent landscape
          </p>
        </div>

        <div className="max-w-3xl mb-12">
          <p className="text-lg md:text-xl leading-relaxed mb-8" style={{color: '#f8f9fa'}}>
            A centralized intelligence platform designed to track market sentiment, 
            competitive landscape, and technological developments in the AI coding agent space.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="rounded-lg p-6 border" style={{backgroundColor: '#373737', borderColor: '#5b5b5b'}}>
              <div className="text-3xl mb-3">📈</div>
              <h3 className="text-lg font-semibold mb-2" style={{color: '#f8f9fa'}}>Market Sentiment</h3>
              <p className="text-sm" style={{color: '#f8f9fa'}}>Track real-time sentiment and trends</p>
            </div>
            <div className="rounded-lg p-6 border" style={{backgroundColor: '#373737', borderColor: '#5b5b5b'}}>
              <div className="text-3xl mb-3">🔍</div>
              <h3 className="text-lg font-semibold mb-2" style={{color: '#f8f9fa'}}>Competitive Intelligence</h3>
              <p className="text-sm" style={{color: '#f8f9fa'}}>Monitor the competitive landscape</p>
            </div>
            <div className="rounded-lg p-6 border" style={{backgroundColor: '#373737', borderColor: '#5b5b5b'}}>
              <div className="text-3xl mb-3">⏲️</div>
              <h3 className="text-lg font-semibold mb-2" style={{color: '#f8f9fa'}}>Coming soon</h3>
              <p className="text-sm" style={{color: '#f8f9fa'}}>Stay tuned</p>
            </div>
          </div>
        </div>

        

        <div className="text-sm" style={{color: '#5b5b5b'}}>
          Built with ❤️ for the coding agent community
        </div>
      </div>
    </div>
  );
}
