It looks like you're running into a PowerShell Execution Policy issue on Windows. This is a security feature that prevents scripts (like the npm.ps1 script used to run npm commands) from executing by default.

The error message File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system confirms this.

To fix this, you need to change the execution policy for your PowerShell session or user. Here's how:

Open PowerShell as Administrator: Search for "PowerShell" in the Windows Start menu, right-click it, and select "Run as administrator".
Check Current Policies (Optional): You can see your current policies by running:
powershell
CopyInsert in Terminal
Get-ExecutionPolicy -List
Set Execution Policy: To allow scripts signed by a trusted publisher (which npm usually is) or local scripts, run the following command. This is often a good balance between security and usability:
powershell
CopyInsert in Terminal
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
You might be prompted to confirm; press Y and Enter.
-Scope CurrentUser applies this change only to your user account and doesn't require administrator privileges for this specific scope, but opening PowerShell as Admin initially is generally safer for making system changes if needed. If CurrentUser doesn't work, you might need LocalMachine (which definitely requires Admin).
Another option is Unrestricted, but this is less secure as it allows any script to run. Use RemoteSigned if possible.
Important: I cannot run the Set-ExecutionPolicy command for you due to security restrictions. You must run it yourself in an Administrator PowerShell window.

Once you have successfully changed the execution policy, please try running the npm install command again in your terminal within the project directory (e:\Projects\hestami-ai\frontend\sveltekit\hestami-ai-ui).

Let me know if you're able to run the command and install the dependencies!