@echo off
REM JOJO+ Phishing Simulation - open the ADMIN app in your existing Chrome profile.
REM Uses the profile already signed in as dev.mis.tfp@gmail.com (Chrome "Profile 11").
set "URL=https://script.google.com/macros/s/AKfycbzdPMQHI0NEGys7MhMFbJWEZbWc41M99wllvzDT76Q8rv-enPYVCd9KL7jhV5fRLkPD/exec"
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
echo Opening JOJO+ (ADMIN / dev.mis.tfp) ...
echo %URL%
if exist "%CHROME%" (
  start "" "%CHROME%" --profile-directory="Profile 11" "%URL%"
) else (
  REM Fallback: default browser if Chrome is not at the expected path
  start "" "%URL%"
)
