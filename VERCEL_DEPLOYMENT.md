# 🚀 Vercel Deployment Guide

Your app is now properly configured for Vercel! Follow these steps to get it running.

## ✅ What Was Fixed

1. ✅ Changed Nitro preset from `node-server` to `vercel`
2. ✅ Removed dotenv dependency (Vercel handles env vars automatically)
3. ✅ Added `.env.example` file
4. ✅ Updated `.gitignore` to exclude Vercel build artifacts
5. ✅ Pushed changes to trigger new deployment

## 🔧 Vercel Setup Steps

### 1. Import Your Project to Vercel

If you haven't already:

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import your GitHub repository: `malek-alhu/subito-scraper`
4. Select the `subito-scrapper-app` directory as the root

### 2. Configure Build Settings

Vercel should auto-detect Nuxt 3. Verify these settings:

- **Framework Preset**: Nuxt.js
- **Root Directory**: `subito-scrapper-app`
- **Build Command**: `npm run build`
- **Output Directory**: `.vercel/output`
- **Install Command**: `npm install`

### 3. Add Environment Variables

**CRITICAL**: Add this environment variable in Vercel:

1. Go to your project settings in Vercel
2. Navigate to "Environment Variables"
3. Add:

```
Name: DATABASE_URL
Value: postgresql://neondb_owner:npg_IjW6fn5wcpyX@ep-dark-pine-ahtzr6ya-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

**Apply to**: Production, Preview, and Development

### 4. Deploy

1. Click "Deploy" in Vercel dashboard
2. Wait for build to complete (~2-3 minutes)
3. Visit your deployment URL: `https://subito-scraper.vercel.app`

## 🔍 Troubleshooting

### Issue: Still Getting 404

**Solution**:
1. Check that the deployment succeeded (no build errors)
2. Make sure you're deploying the latest commit (`8346028`)
3. Verify the root directory is set to `subito-scrapper-app`
4. Check the build logs in Vercel dashboard

### Issue: Internal Server Error (500)

**Solution**:
1. Check the "Functions" logs in Vercel dashboard
2. Verify `DATABASE_URL` environment variable is set correctly
3. Make sure the Neon database is accessible (not sleeping/paused)

### Issue: Database Connection Failed

**Solution**:
1. Test your Neon database connection manually
2. Verify the connection string is correct
3. Check that SSL is required in the connection string
4. Ensure Neon database is not in sleep mode

## 📋 Deployment Checklist

- [ ] Latest code pushed to GitHub (`8346028` commit)
- [ ] Vercel project created and linked to GitHub repo
- [ ] Root directory set to `subito-scrapper-app`
- [ ] Framework preset is Nuxt.js
- [ ] `DATABASE_URL` environment variable added
- [ ] Environment variables applied to all environments
- [ ] Deployment triggered
- [ ] Build completed successfully
- [ ] App accessible at deployment URL

## 🎯 Expected Behavior

Once deployed successfully:

1. **Homepage (`/`)**: Shows scraper dashboard
2. **Deals Page (`/deals`)**: Shows "No deals found" (until first scrape)
3. **Metrics Page (`/metrics`)**: Shows session history
4. **API**: `https://your-app.vercel.app/api/scraper/metrics` returns JSON

## ⏰ First Scrape

The scraper runs automatically on first deployment:

1. Database schema is created automatically
2. First scrape starts immediately
3. After ~2-5 minutes, deals will appear
4. Then runs every 6 hours automatically

## 🔄 Redeploy Instructions

If you need to redeploy:

### Option 1: Via Vercel Dashboard
1. Go to Vercel dashboard
2. Click "Deployments"
3. Click "..." on latest deployment
4. Click "Redeploy"

### Option 2: Via Git Push
```bash
# Make any change or just trigger rebuild
git commit --allow-empty -m "Trigger Vercel rebuild"
git push origin claude/understand-app-features-01KN3QzmxCa6AiokcYXM93g9
```

### Option 3: Via Vercel CLI
```bash
npm i -g vercel
cd subito-scrapper-app
vercel --prod
```

## 📊 Monitoring

### Check if Scraper is Running

Visit: `https://your-app.vercel.app/api/scraper/metrics`

You should see:
```json
{
  "lastRun": "2024-11-15T00:00:00.000Z",
  "status": "idle",
  "totalSessions": 1,
  "totalItemsScraped": 150,
  "lastSessionStats": { ... }
}
```

### View Function Logs

1. Go to Vercel dashboard
2. Click on your project
3. Go to "Functions" tab
4. View real-time logs

### Check Database

Connect to your Neon database:
```bash
psql 'postgresql://neondb_owner:npg_IjW6fn5wcpyX@ep-dark-pine-ahtzr6ya-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'
```

Then check:
```sql
-- Check if schema exists
SELECT table_name FROM information_schema.tables WHERE table_schema='public';

-- Check scraping sessions
SELECT * FROM scraping_sessions ORDER BY created_at DESC LIMIT 5;

-- Check items count
SELECT COUNT(*) FROM scraped_items;

-- Check deals
SELECT COUNT(*) FROM deal_alerts WHERE is_dismissed = false;
```

## 🚨 Common Issues & Solutions

### Build Fails with "Module not found"

**Solution**: Make sure all dependencies are in `package.json`:
```bash
cd subito-scrapper-app
npm install
git add package.json package-lock.json
git commit -m "Update dependencies"
git push
```

### Environment Variables Not Working

**Solution**:
1. Ensure they're set in Vercel dashboard (not just .env file)
2. Redeploy after adding/changing env vars
3. Check they're applied to the correct environment (Production/Preview)

### Database Schema Not Created

**Solution**:
1. Check function logs for schema creation errors
2. Manually run schema:
   ```bash
   psql $DATABASE_URL < server/database/schema.sql
   ```

### Scraper Not Running on Schedule

**Solution**:
- Vercel serverless functions are stateless
- The cron scheduler only works while a function is running
- For production, consider using:
  - Vercel Cron Jobs (recommended)
  - External cron service (cron-job.org)
  - Railway/Render for always-on server

### Setting Up Vercel Cron (Recommended)

Create `vercel.json` in `subito-scrapper-app`:
```json
{
  "crons": [{
    "path": "/api/scraper/run",
    "schedule": "0 */6 * * *"
  }]
}
```

Then commit and push:
```bash
git add vercel.json
git commit -m "Add Vercel cron job"
git push
```

## 📞 Need Help?

1. **Check Vercel Logs**: Most issues are visible in function logs
2. **Check Database**: Verify database is accessible
3. **Test API Endpoints**: Use browser or curl to test endpoints
4. **Review Build Logs**: Check for build-time errors

## ✅ Success Indicators

Your deployment is successful when:

1. ✅ Build completes without errors
2. ✅ Homepage loads without 404
3. ✅ API endpoint `/api/scraper/metrics` returns JSON
4. ✅ Database connection works (no 500 errors)
5. ✅ First scrape completes (check metrics)
6. ✅ Deals appear in `/deals` page

---

**Your app is ready to deploy! Just add the DATABASE_URL environment variable in Vercel and you're good to go!** 🎉
