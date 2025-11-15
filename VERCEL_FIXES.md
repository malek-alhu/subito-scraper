# ⚠️ VERCEL DEPLOYMENT ISSUES - COMPLETE FIX

Your Vercel deployment has issues. Here's how to fix them:

---

## 🚨 **Issue 1: 404 on Production**

The production URL `https://subito-scraper.vercel.app` returns 404.

### **Root Cause**
Vercel likely isn't configured to use the correct root directory.

### **Fix Steps**

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your `subito-scraper` project

2. **Configure Root Directory**
   - Go to **Settings** → **General**
   - Find **Root Directory** setting
   - Set it to: `subito-scrapper-app`
   - Click **Save**

3. **Configure Framework Preset**
   - In the same Settings → General section
   - Find **Framework Preset**
   - Ensure it says: **Nuxt.js**
   - If not, select it from dropdown

4. **Add Environment Variable**
   - Go to **Settings** → **Environment Variables**
   - Click **Add New**
   - Add:
     ```
     Name: DATABASE_URL
     Value: postgresql://neondb_owner:npg_IjW6fn5wcpyX@ep-dark-pine-ahtzr6ya-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
     ```
   - Select: **All Environments** (Production, Preview, Development)
   - Click **Save**

5. **Redeploy**
   - Go to **Deployments** tab
   - Click the **"..."** menu on the latest deployment
   - Click **Redeploy**
   - Wait for build to complete (2-3 minutes)

---

## 🚨 **Issue 2: Deployment Protection on Previews**

Preview URLs like `https://subito-scraper-o00zserle-...` require authentication.

### **Fix: Disable Deployment Protection**

1. **Go to Settings**
   - In Vercel dashboard, go to your project
   - Navigate to **Settings** → **Deployment Protection**

2. **Choose Protection Level**

   **Option A: Disable Protection (Recommended for testing)**
   - Select: **Standard Protection** or **None**
   - Click **Save**

   **Option B: Keep Protection Enabled**
   - Keep current settings
   - Use production URL instead: `https://subito-scraper.vercel.app`

---

## 🎯 **Complete Checklist**

Go through each step:

### **A. Vercel Project Settings**

- [ ] **Root Directory** set to `subito-scrapper-app`
- [ ] **Framework Preset** set to `Nuxt.js`
- [ ] **Build Command**: `npm run build` (should be auto-detected)
- [ ] **Output Directory**: `.vercel/output` (auto-detected)
- [ ] **Install Command**: `npm install` (auto-detected)

### **B. Environment Variables**

- [ ] `DATABASE_URL` added
- [ ] Value is the correct Neon PostgreSQL connection string
- [ ] Applied to **Production**
- [ ] Applied to **Preview**
- [ ] Applied to **Development**

### **C. Deployment**

- [ ] Redeployed after adding environment variables
- [ ] Build completed successfully (no errors in build logs)
- [ ] Deployment status shows "Ready"

### **D. Testing**

- [ ] Production URL loads: `https://subito-scraper.vercel.app`
- [ ] API works: `https://subito-scraper.vercel.app/api/scraper/metrics`
- [ ] Dashboard loads: `https://subito-scraper.vercel.app/`
- [ ] Deals page loads: `https://subito-scraper.vercel.app/deals`

---

## 🔍 **How to Verify Configuration**

### **Check Root Directory**

In Vercel dashboard:
1. Settings → General
2. Look for "Root Directory"
3. Should show: `subito-scrapper-app`

### **Check Environment Variables**

In Vercel dashboard:
1. Settings → Environment Variables
2. Should see: `DATABASE_URL` with your Neon connection string
3. Should show checkmarks for Production, Preview, Development

### **Check Build Logs**

1. Go to Deployments tab
2. Click on latest deployment
3. Click "Building" or "View Function Logs"
4. Look for errors

**Common errors:**
- `MODULE_NOT_FOUND` → Root directory is wrong
- `DATABASE_URL is not defined` → Environment variable not set
- Build fails → Check build logs for specific error

---

## 📱 **Test After Fixing**

Once you've completed the steps above, test these URLs:

### **1. Homepage**
```
https://subito-scraper.vercel.app/
```
**Expected**: Scraper dashboard page (not 404!)

### **2. Metrics API**
```
https://subito-scraper.vercel.app/api/scraper/metrics
```
**Expected**: JSON response like:
```json
{
  "lastRun": "2024-11-15T...",
  "status": "idle",
  "totalSessions": 0,
  "totalItemsScraped": 0
}
```

### **3. Deals Page**
```
https://subito-scraper.vercel.app/deals
```
**Expected**: Deals dashboard (may show "No deals found" initially)

### **4. Metrics Page**
```
https://subito-scraper.vercel.app/metrics
```
**Expected**: Detailed metrics page

---

## 🚀 **Alternative: Deploy from Scratch**

If issues persist, try deploying fresh:

### **Step 1: Delete Current Project**
1. Go to Vercel dashboard
2. Select `subito-scraper` project
3. Settings → General → Delete Project

### **Step 2: Import Again**
1. Click "Add New..." → "Project"
2. Import from GitHub: `malek-alhu/subito-scraper`
3. **IMPORTANT**: Set Root Directory to `subito-scrapper-app` BEFORE deploying
4. Add environment variable `DATABASE_URL` BEFORE deploying
5. Click "Deploy"

### **Step 3: Verify Settings**
- Framework Preset: Nuxt.js ✓
- Root Directory: `subito-scrapper-app` ✓
- Build Command: `npm run build` ✓
- Environment Variable: `DATABASE_URL` set ✓

---

## 🔧 **Troubleshooting Specific Errors**

### **Error: "The page could not be found"**

**Cause**: Root directory is not set correctly.

**Fix**:
1. Settings → General → Root Directory
2. Set to: `subito-scrapper-app`
3. Save and redeploy

### **Error: "Internal Server Error (500)"**

**Cause**: Database connection failing or environment variable not set.

**Fix**:
1. Settings → Environment Variables
2. Verify `DATABASE_URL` is set correctly
3. Redeploy

### **Error: "Authentication Required"**

**Cause**: Deployment Protection is enabled.

**Fix**:
1. Settings → Deployment Protection
2. Change to "Standard Protection" or disable
3. OR use production URL instead of preview URL

### **Build Fails**

**Cause**: Missing dependencies or build configuration issue.

**Fix**:
1. Check build logs in Deployments tab
2. Look for specific error message
3. Ensure all dependencies are in `package.json`

---

## 📞 **Still Having Issues?**

### **Share Build Logs**

1. Go to Deployments in Vercel
2. Click latest deployment
3. Copy the build logs
4. Share the error message

### **Verify Database Connection**

Test your Neon database directly:
```bash
psql 'postgresql://neondb_owner:npg_IjW6fn5wcpyX@ep-dark-pine-ahtzr6ya-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'
```

Should connect successfully. If not, your Neon database might be sleeping or have connectivity issues.

---

## ✅ **Success Indicators**

You'll know it's working when:

1. ✅ `https://subito-scraper.vercel.app` loads (no 404)
2. ✅ `/api/scraper/metrics` returns JSON
3. ✅ Dashboard shows scraper status
4. ✅ No authentication required (or only on preview URLs)
5. ✅ Build logs show no errors
6. ✅ Database schema auto-creates
7. ✅ First scrape runs automatically

---

## 🎯 **Quick Summary**

**The main issue is likely the Root Directory is not set to `subito-scrapper-app`.**

**Quick Fix:**
1. Vercel Dashboard → Settings → General
2. Root Directory → `subito-scrapper-app`
3. Settings → Environment Variables
4. Add `DATABASE_URL` with Neon connection string
5. Redeploy

**That should fix the 404 error!**

---

Once you've completed these steps, let me know and I can test the deployment for you!
