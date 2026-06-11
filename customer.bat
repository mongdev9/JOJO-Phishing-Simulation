@echo off
REM JOJO+ Phishing Simulation - open the app as a CUSTOMER in your existing Chrome profile.
REM Uses the profile already signed in as ai.sunart.srisumal@gmail.com (Chrome "Profile 1"),
REM which is seeded as the TFP customer. Opens in a separate window from run.bat (admin).
set "URL=https://script.google.com/macros/s/AKfycbzdPMQHI0NEGys7MhMFbJWEZbWc41M99wllvzDT76Q8rv-enPYVCd9KL7jhV5fRLkPD/exec"
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
echo Opening JOJO+ (CUSTOMER / ai.sunart.srisumal) ...
echo %URL%
if exist "%CHROME%" (
  start "" "%CHROME%" --profile-directory="Profile 1" "%URL%"
) else (
  REM Fallback: default browser if Chrome is not at the expected path
  start "" "%URL%"
)
