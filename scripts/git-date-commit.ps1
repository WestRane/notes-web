function git-date-commit {
    # 1. Pre-commit Phase
    $staging = $true
    while ($staging) {
        Write-Host "`n--- Git Pre-Commit Menu ---" -ForegroundColor Cyan

        $choice = (Read-Host "[s] Status, [d] Diff, [l] Log, [a] Add All, [c] Continue, [q] Quit").Trim().ToLower()
        
        switch ($choice) {
            "s" { git status }
            "d" { 
    		Write-Host "--- Unstaged Changes ---" -ForegroundColor Yellow
    		git diff
    		Write-Host "--- Staged Changes ---" -ForegroundColor Green
    		git diff --cached 
		}
            "l" { 
                Write-Host "`n--- Recent Activity ---" -ForegroundColor Gray

                git log -n 15 --date=format:'%d.%m.%Y' --pretty=format:"%C(yellow)%h%Creset %C(magenta)%ad%Creset %s"
                Write-Host "`n"
            }
            "a" { git add .; Write-Host "Staged all changes." -ForegroundColor Green }
            "c" { $staging = $false } 
            "q" { return }
            default { Write-Host "Invalid option: '$choice'" -ForegroundColor Yellow }
        }
    }

    # 2. Input Phase
    Write-Host "`n--- Commitment Details ---" -ForegroundColor Magenta
    $dateInput = Read-Host "Enter date (DD.MM.YYYY) [Enter for Today]"
    
    if ([string]::IsNullOrWhiteSpace($dateInput)) { 
        $dateInput = Get-Date -Format "dd.MM.yyyy"
        Write-Host "Using today: $dateInput" -ForegroundColor Gray
    }

    if ($dateInput -like "*T*") {
        $message = Read-Host "Enter commit message"
        $formattedDate = $dateInput
    } 
    else {
        $timeInput = Read-Host "Enter time (HH:MM:SS) [Default 12:00:00]"
        if ([string]::IsNullOrWhiteSpace($timeInput)) { $timeInput = "12:00:00" }
        
        $message = Read-Host "Enter commit message"

        $parts = $dateInput -split '\.'
        $day, $month, $year = [int]$parts[0], [int]$parts[1], [int]$parts[2]

        $dt = [DateTime]::new($year, $month, $day)

        $tz = if ([TimeZoneInfo]::Local.IsDaylightSavingTime($dt)) { "+03:00" } else { "+02:00" }

        $formattedDate = "{0:D4}-{1:D2}-{2:D2}T{3}{4}" -f $year, $month, $day, $timeInput, $tz
    }

    # 3. Execution
    $env:GIT_AUTHOR_DATE = $formattedDate
    $env:GIT_COMMITTER_DATE = $formattedDate
    
    git commit -m "$message"

    # Cleanup environment variables
    Remove-Item Env:GIT_AUTHOR_DATE -ErrorAction SilentlyContinue
    Remove-Item Env:GIT_COMMITTER_DATE -ErrorAction SilentlyContinue
    
    Write-Host "`nDone! Commit created for $formattedDate" -ForegroundColor Green
}

Set-Alias gd git-date-commit
