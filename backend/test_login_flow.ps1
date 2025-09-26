# ==============================
# test_login_flow.ps1
# ==============================

$base    = "http://127.0.0.1:5000"
$email   = "jwtuser@example.com"
$password= "pass123"

# Set this to $true ONLY if you kept DEV_DEBUG = True in auth.py
# It uses /_dev_current_otp to fetch the OTP for local testing
$useDevOtp = $false

function Post-Json {
    param(
        [string]$path,
        [hashtable]$body
    )
    $json = $body | ConvertTo-Json -Compress
    return Invoke-RestMethod -Uri ($base + $path) -Method Post -Body $json -ContentType "application/json"
}

Write-Host "==> Registering user: $email"
try {
    $reg = Post-Json "/register" @{ email = $email; password = $password }
    Write-Host "   Register response:" ($reg | ConvertTo-Json)
} catch {
    # If the user already exists, that's fine — continue
    $resp = $_.Exception.Response
    if ($resp -and $resp.StatusCode.Value__ -eq 400) {
        Write-Host "   User may already exist. Continuing..."
    } else {
        Write-Host "   Registration error:" $_.Exception.Message -ForegroundColor Red
        break
    }
}

Write-Host "`n==> Logging in (OTP will be printed in Flask console)"
try {
    $login = Post-Json "/login" @{ email = $email; password = $password }
    Write-Host "   Login response:" ($login | ConvertTo-Json)
} catch {
    Write-Host "   Login error:" $_.Exception.Message -ForegroundColor Red
    break
}

# Get OTP
$otp = $null
if ($useDevOtp) {
    Write-Host "`n==> Fetching current OTP via /_dev_current_otp (DEV only)"
    try {
        $otpResp = Post-Json "/_dev_current_otp" @{ email = $email }
        $otp = $otpResp.otp
        Write-Host "   DEV OTP is: $otp (use quickly)"
    } catch {
        Write-Host "   Could not fetch DEV OTP; falling back to manual entry." -ForegroundColor Yellow
    }
}

if (-not $otp) {
    $otp = Read-Host "`nEnter the OTP shown in your Flask console"
}

Write-Host "`n==> Verifying OTP..."
try {
    $verify = Post-Json "/verify-otp" @{ email = $email; otp = $otp }
    Write-Host "   Verify response:" ($verify | ConvertTo-Json)
} catch {
    Write-Host "   Verify error:" $_.Exception.Message -ForegroundColor Red
    break
}

# Extract token (if provided)
$token = $null
try { $token = $verify.token } catch {}

if (-not $token) {
    Write-Host "   No token returned; cannot call /me. (Did OTP verification fail?)" -ForegroundColor Yellow
    break
}

Write-Host "`n==> Calling /me with JWT token..."
try {
    $me = Invoke-RestMethod -Uri ($base + "/me") -Method Get -Headers @{ Authorization = "Bearer $token" }
    Write-Host "   /me response:" ($me | ConvertTo-Json)
} catch {
    Write-Host "   /me error:" $_.Exception.Message -ForegroundColor Red
    break
}

Write-Host "`n✅ Flow complete."
