# Knock Integration Setup

This project now includes Knock for web push notifications. Here's what was implemented and what needs to be configured:

## What Was Implemented

### 1. API Routes
- **`/api/notifications/subscribe`** - Handles user subscription to push notifications
- **`/api/notifications/send`** - Endpoint to send notifications (for testing/admin use)

### 2. Service Worker (`/public/sw.js`)
- Handles incoming push notifications from Knock
- Manages notification display and click actions
- Automatically opens the app when notifications are clicked

### 3. Frontend Integration
- **`useKnockNotifications` hook** - Handles service worker registration and push subscription
- **Updated notification button** - Now integrates with Knock for persistent notifications
- **Immediate feedback** - Shows browser notification for instant confirmation

### 4. Environment Configuration
- Created `.env.local` with placeholder values for Knock API keys and VAPID keys

## Manual Setup Required

### 1. Knock Dashboard Setup

1. **Create Account**: Sign up at [https://dashboard.knock.app/signup](https://dashboard.knock.app/signup)

2. **Get API Keys**: 
   - Navigate to **Platform** > **API Keys**
   - Copy your Public API Key and Secret API Key
   - Update `.env.local` with actual values

3. **Create Workflow**:
   - Go to **Workflows** section
   - Create a new workflow named `agentvibes-launch`
   - Add a **Web Push** channel step
   - Design your notification message template
   - **Commit** the workflow to activate it

4. **Configure Web Push Channel**:
   - Go to **Settings** > **Integrations** > **Channels**
   - Set up a Web Push channel
   - Configure with your VAPID keys (see step 2 below)

### 2. VAPID Keys Setup

1. **Generate VAPID Keys**: Visit [https://vapidkeys.com/](https://vapidkeys.com/)
2. **Update Environment Variables** in `.env.local`:
   ```bash
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_actual_public_key
   VAPID_PRIVATE_KEY=your_actual_private_key
   ```

### 3. Production Considerations

- **Environment Variables**: Ensure all environment variables are set in your production deployment (Vercel, etc.)
- **Domain Configuration**: Update `NEXT_PUBLIC_APP_URL` for production
- **Workflow Promotion**: Promote your workflow from development to production in Knock dashboard

## Testing the Integration

### Local Testing
1. Start the development server: `npm run dev`
2. Open the app and click "Get Launch Alerts"
3. Allow notifications when prompted
4. You should see both:
   - Immediate browser notification confirming subscription
   - User registered in your Knock dashboard

### Send Test Notification
Use the `/api/notifications/send` endpoint to send test notifications:

```bash
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "title": "AgentVibes is Live!",
    "body": "The wait is over. Check out the new features."
  }'
```

## How It Works

1. **User clicks notification button** → Browser requests permission
2. **Service worker registers** → Subscribes to push notifications with VAPID key
3. **Subscription sent to backend** → User registered in Knock with push token
4. **Future notifications** → Knock sends push notifications that trigger service worker
5. **Service worker displays** → Notification with app branding and click handling

## Next Steps

- Set up actual Knock account and configure environment variables
- Create and test the `agentvibes-launch` workflow
- Consider adding user preferences for notification types
- Implement unsubscribe functionality if needed
