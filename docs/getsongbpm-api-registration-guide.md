# GetSongBPM API Registration Guide

This guide explains what URLs to use when registering for the GetSongBPM API.

## Required Information

When registering at [https://getsongbpm.com/api](https://getsongbpm.com/api), you'll need to provide:

1. **Website URL or App ID/Package Name**
2. **Backlink URL** (where you've added the backlink to GetSongBPM.com)
3. **Email Address**

## Website URL Options

### Option 1: GitHub Repository (Recommended for Development)

If your project is on GitHub:

- **Website URL:** `https://github.com/yourusername/vinyl-dash`
  - Replace `yourusername` with your actual GitHub username
  - Replace `vinyl-dash` with your actual repository name

**Example:**
```
https://github.com/victor/vinyl-dash
```

### Option 2: Deployed Application

If you've deployed your application (e.g., Vercel, Netlify, Railway):

- **Website URL:** Your deployed URL
  - Example: `https://vinyl-dash.vercel.app`
  - Example: `https://vinyl-dash.netlify.app`
  - Example: `https://yourdomain.com`

### Option 3: Local Development (Not Recommended)

If you're only developing locally:

- **Website URL:** You can use a placeholder like:
  - `http://localhost:5173` (your Vite dev server)
  - Or create a GitHub repository first (recommended)

**Note:** GetSongBPM may verify the backlink, so using a publicly accessible URL (GitHub repo or deployed site) is preferred.

## Backlink URL

The **backlink URL** is the specific page where you've added a link to GetSongBPM.com. This link must be **active and publicly accessible**.

### Where to Add the Backlink

The backlink has been added to your application in the footer. Here are the options:

#### Option 1: Application Footer (Already Implemented)

- **Backlink URL:** Your deployed application URL + `/` (root)
  - Example: `https://vinyl-dash.vercel.app/`
  - Example: `https://yourdomain.com/`

The footer includes: "BPM data provided by [GetSongBPM](https://getsongbpm.com)"

#### Option 2: GitHub README

If you're using a GitHub repository:

- **Backlink URL:** `https://github.com/yourusername/vinyl-dash#readme`
  - Add a section in your README.md with a link to GetSongBPM

**Example README addition:**
```markdown
## Credits

BPM data provided by [GetSongBPM](https://getsongbpm.com)
```

#### Option 3: Both (Recommended)

For best results, add the backlink in both places:
1. In your deployed application footer (already done)
2. In your GitHub README.md

Then use the deployed application URL as your backlink URL.

## Complete Registration Example

Here's an example of what to fill in:

**Website URL or App ID:**
```
https://github.com/victor/vinyl-dash
```

**Backlink URL:**
```
https://vinyl-dash.vercel.app/
```
(Or your GitHub README URL if not deployed)

**Email:**
```
your-email@example.com
```

## Important Notes

1. **Backlink Must Be Active:** GetSongBPM will verify that the backlink exists and is accessible. Make sure:
   - The link is visible (not hidden)
   - The page is publicly accessible
   - The link actually goes to https://getsongbpm.com

2. **Backlink Requirement:** This is **mandatory**. Failure to include an active backlink may result in account suspension without notice.

3. **If You Haven't Deployed Yet:**
   - Use your GitHub repository URL as the website URL
   - Add the backlink to your README.md
   - Use the GitHub README URL as the backlink URL
   - You can update these later when you deploy

4. **After Deployment:**
   - Update your registration with the deployed URL
   - Use the deployed application URL as the backlink URL

## Verification

After registration, GetSongBPM may check:
- That your website URL is accessible
- That your backlink URL contains a working link to GetSongBPM.com
- That the backlink is visible and not hidden

Make sure both URLs are publicly accessible before submitting your registration.

