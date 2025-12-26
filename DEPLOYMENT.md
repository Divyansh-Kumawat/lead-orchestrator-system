# 🚀 Quick Deployment Guide

## Option 1: Deploy to Railway (Recommended - Full Stack with Database)

### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
```

### Step 2: Login to Railway
```bash
railway login
```

### Step 3: Initialize Project
```bash
railway init
```

### Step 4: Add PostgreSQL Database
```bash
railway add
# Select PostgreSQL from the list
```

### Step 5: Set Environment Variables
```bash
railway variables set OPENAI_API_KEY=your-openai-key
railway variables set TWILIO_ACCOUNT_SID=your-twilio-sid
railway variables set TWILIO_AUTH_TOKEN=your-twilio-token
railway variables set TWILIO_WHATSAPP_NUMBER=your-whatsapp-number
railway variables set SMTP_HOST=smtp.gmail.com
railway variables set SMTP_PORT=587
railway variables set SMTP_USER=your-email@gmail.com
railway variables set SMTP_PASS=your-app-password
railway variables set NODE_ENV=production
```

### Step 6: Deploy
```bash
railway up
```

### Step 7: Get Your URL
```bash
railway domain
```

Your app will be live at: `https://your-app.up.railway.app`

---

## Option 2: Deploy to Render (Free Tier Available)

### Step 1: Go to Render Dashboard
Visit: https://dashboard.render.com/

### Step 2: Create New Web Service
- Click "New +" → "Web Service"
- Connect your GitHub repository: `Divyansh-Kumawat/lead-orchestrator-system`
- Select branch: `main`

### Step 3: Configure Service
```
Name: lead-orchestrator-system
Environment: Node
Build Command: npm install && npx prisma generate && npm run build
Start Command: npx prisma migrate deploy && npm start
```

### Step 4: Add PostgreSQL Database
- Click "New +" → "PostgreSQL"
- Name it and create
- Copy the Internal Database URL

### Step 5: Add Environment Variables
In your web service settings, add:
```
DATABASE_URL=<your-postgres-internal-url>
OPENAI_API_KEY=your-openai-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_WHATSAPP_NUMBER=your-whatsapp-number
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
NODE_ENV=production
```

### Step 6: Deploy
Click "Create Web Service" and wait for deployment.

Your app will be live at: `https://lead-orchestrator-system.onrender.com`

---

## Option 3: Deploy Backend to Vercel + Database to Supabase

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```

### Step 3: Deploy
```bash
vercel --prod
```

### Step 4: Setup Supabase Database
1. Go to https://supabase.com/
2. Create new project
3. Copy the connection string
4. Add to Vercel environment variables

### Step 5: Add Environment Variables in Vercel Dashboard
Go to your project settings and add all required environment variables.

Your app will be live at: `https://your-project.vercel.app`

---

## Option 4: Deploy with Docker to Any Cloud Provider

### For DigitalOcean, AWS, GCP, Azure:

```bash
# Build Docker image
docker build -t lead-orchestrator .

# Tag for your registry
docker tag lead-orchestrator your-registry/lead-orchestrator

# Push to registry
docker push your-registry/lead-orchestrator

# Deploy using your cloud provider's container service
```

---

## Quick Demo Deployment (No Database - For Testing Only)

If you just want to show the demo form and API structure without full functionality:

### Deploy to Vercel (Frontend Only)
```bash
cd demo
vercel --prod
```

This will deploy just the demo form at: `https://your-demo.vercel.app`

---

## Environment Variables Required

```env
# Required for AI Classification
OPENAI_API_KEY=sk-...

# Required for WhatsApp
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Required for Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Database (auto-provided by Railway/Render)
DATABASE_URL=postgresql://...

# Application
NODE_ENV=production
PORT=3000
```

---

## Fastest Way to Get a Live Demo Link (5 Minutes)

### Use Railway:
```bash
# 1. Install CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Initialize and deploy
railway init
railway add  # Select PostgreSQL
railway up

# 4. Get URL
railway domain
```

**Done!** Share the URL: `https://your-app.up.railway.app`

---

## Testing Your Deployed App

Once deployed, test with:

```bash
# Test health endpoint
curl https://your-app-url.com/health

# Test webhook endpoint
curl -X POST https://your-app-url.com/api/webhook/lead \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "+919876543210",
    "inquiry": "Test inquiry",
    "materialType": "flooring"
  }'
```

---

## Troubleshooting

**Issue: Database connection failed**
- Check DATABASE_URL is set correctly
- Ensure database is in the same region as your app

**Issue: AI classification not working**
- Verify OPENAI_API_KEY is valid
- Check API quota on OpenAI dashboard

**Issue: WhatsApp not sending**
- Verify Twilio credentials
- Check Twilio console for errors
- Ensure WhatsApp Business API is approved

---

## Need Help?

Contact: divyanshmcp@gmail.com

---

**Recommended for Assignment Submission: Railway or Render**
Both offer free tiers and are production-ready!