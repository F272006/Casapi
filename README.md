# Casapi: get the Android app (no installs on your computer)

1. Make a free account at github.com and create a new repository (any name).
2. In the repository click **Add file -> Upload files**, drag in everything from this
   folder (including the hidden `.github` folder), and click **Commit changes**.
3. Open the **Actions** tab. The "Build Casapi APK" run starts by itself
   (if not: click it -> **Run workflow**). It takes about 5-8 minutes.
4. Click the finished run, scroll to **Artifacts**, download **Casapi-APK**, unzip it.
5. Send `app-debug.apk` to your phone and open it. Allow "install unknown apps" if asked.

If the Actions tab is empty, the hidden folder did not upload. Click
**Add file -> Create new file**, name it `.github/workflows/build-apk.yml`,
and paste in the contents of that file from this folder.

Alternative with no APK: upload the `www/` folder to Netlify Drop (app.netlify.com/drop)
and use "Add to Home Screen" on the phone.
