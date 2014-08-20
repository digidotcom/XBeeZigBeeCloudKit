Write-Host "Verifying that Python is installed."
$python_error = @()
gcm python -ErrorAction silentlycontinue -ErrorVariable python_error
if ($python_error.count -gt 0) {
    Write-Host "Python must be installed and on the PATH."
    exit 1
}

Write-Host "Checking if cURL is installed."
$curl_error = @()
gcm curl -ErrorAction silentlycontinue -ErrorVariable curl_error
if ($curl_error.count -lt 1) {
    $curl_installed = True
} else {
    Write-Host "cURL is not installed."
}

Function ReloadPath {
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine")
}

Function Download($url, $destfile) {
    if ($curl_installed) {
        curl $url --compressed -o $destfile
    }
    else {
        # http://teusje.wordpress.com/2011/02/19/download-file-with-powershell/
        $webclient = New-Object System.Net.WebClient
    $file = "$(pwd)\$destfile"
        $webclient.DownloadFile($url, $file)
    }
    Write-Host "Downloaded to $destfile"
}

Function InstallPip {
    $pip_error = @()
    gcm pip -ErrorAction silentlycontinue -ErrorVariable pip_error
    if ($pip_error.count -lt 1) {
        # Pip is already installed.
        Write-Host "`n`nPip is already installed, no need to install it again."
        return
    }
    Write-Host "`n`nDownloading Python Pip installation scripts..."
    Download "https://bitbucket.org/pypa/setuptools/raw/bootstrap/ez_setup.py" ez_setup.py
    Download "https://raw.github.com/pypa/pip/master/contrib/get-pip.py" get-pip.py

    Write-Host "Running ez_setup.py"
    Start-Process python -ArgumentList @("ez_setup.py") -Wait -NoNewWindow

    Write-Host "Running get-pip.py"
    Start-Process python -ArgumentList @("get-pip.py") -Wait -NoNewWindow

    Write-Host "`nPython installation completed. Removing scripts..."
    rm -ErrorAction 0 get-pip.py, ez_setup.py
}

Function InstallGEvent {
    Write-Host "`n`nDownloading greenlet installer..."
    Download "https://pypi.python.org/packages/2.7/g/greenlet/greenlet-0.4.1.win32-py2.7.exe" greenlet.exe

    Start-Process greenlet.exe -Wait
    Write-Host "greenlet installed. Removing installer..."
    rm -ErrorAction 0 greenlet.exe

    Write-Host "`n`nDownloading gevent installer..."
    Download "https://pypi.python.org/packages/2.7/g/gevent/gevent-0.13.8.win32-py2.7.exe" gevent-installer.exe
    Write-Host "`nInstalling gevent..."
    Start-Process gevent-installer.exe -Wait

    Write-Host "gevent installation completed. Removing installer..."
    rm -ErrorAction 0 gevent-installer.exe
}

Function InstallPsycopg2 {
    Write-Host "`n`nDownloading 32-bit psycopg2..."
    Download "http://www.stickpeople.com/projects/python/win-psycopg/2.5.1/psycopg2-2.5.1.win32-py2.7-pg9.2.4-release.exe" psycopg2.exe

    Write-Host "Installing psycopg2"
    Start-Process psycopg2.exe -Wait
    Write-Host "psycopg2 installed. Removing installer..."
    rm -ErrorAction 0 psycopg2.exe
}

Function InstallPyCrypto {
    Write-Host "`n`nDownloading 32-bit PyCrypto..."
    Download "http://www.voidspace.org.uk/downloads/pycrypto26/pycrypto-2.6.win32-py2.7.exe" pycrypto.exe

    Write-Host "Installing PyCrypto"
    Start-Process pycrypto.exe -Wait
    Write-Host "PyCrypto installed. Removing installer..."
    rm -ErrorAction 0 pycrypto.exe
}

Function GetForemanPath {
    return (gcm heroku | select -ExpandProperty Definition | Select -First 1 | Foreach {(resolve-path (join-path $_ "..\..\ruby*\bin")).Path})
}

Function AddForemanToPath {
    ReloadPath
    $errors = @()
    gcm foreman -ErrorAction silentlycontinue -ErrorVariable errors
    if ($errors.count -lt 1) {
        # Foreman is already on the path
        Write-Host "`n`nforeman is already on the PATH"
        return
    }
    Write-Host "`n`nAdding foreman to PATH..."
    # Make an environment variable for the path
    $ForemanPath = "$(GetForemanPath)\"
    # Add ForemanPath to PATH
    [Environment]::SetEnvironmentVariable("Path", $Env:Path + ";$ForemanPath", "Machine")
}

Function FetchHerokuExe {
    Write-Host "`n`nDownloading the Heroku Toolbelt installer..."
    Download "https://s3.amazonaws.com/assets.heroku.com/heroku-toolbelt/heroku-toolbelt.exe" heroku-toolbelt.exe
    Write-Host "Heroku Toolbelt downloaded"
}
Function RunHerokuExe {
    Write-Host "`n`nInstalling the Heroku Toolbelt..."
    Start-Process heroku-toolbelt.exe -Wait
    Write-Host "Heroku Toolbelt installed"
}
Function FixForemanInstall {
    # http://stackoverflow.com/a/15726134
    Write-Host "`n`nFixing installation of foreman... Answer 'Y' to any prompts.`n"
    Start-Process gem -ArgumentList @("uninstall", "foreman") -NoNewWindow -Wait
    Start-Process gem -ArgumentList @("install", "foreman", "-v", "0.61") -NoNewWindow -Wait
}
Function InstallHerokuIfNeeded {
    $errors = @()
    gcm heroku -ErrorAction silentlycontinue -ErrorVariable errors
    if ($errors.count -lt 1) {
        # Heroku is already installed.
        Write-Host "`n`nHeroku Toolbelt is already installed."
    }
    else {
        FetchHerokuExe
        RunHerokuExe
        # Set up the PATH
        AddForemanToPath
        ReloadPath
    }
    FixForemanInstall
}

Function FetchNodeExe {
    Write-Host "`n`nDownloading the 32-bit Node.js installer to node-installer.msi..."
    Download "http://nodejs.org/dist/v0.10.22/node-v0.10.22-x86.msi" node-installer.msi
    Write-Host "NodeJS installer downloaded"
}
Function RunNodeExe {
    Write-Host "`n`nRunning the NodeJS installer..."
    Start-Process node-installer.msi -Wait
    Write-Host "NodeJS installer finished."
}
Function InstallNodeIfNeeded {
    $errors = @()
    gcm node -ErrorAction silentlycontinue -ErrorVariable errors
    if ($errors.count -lt 1) {
        # Node is already installed.
        Write-Host "`n`nNode.js is already installed."
        return
    }
    else {
        FetchNodeExe
        RunNodeExe
    }
}

Function Cleanup {
    Write-Host "`n`nDeleting the installers that were downloaded..."
    rm -ErrorAction 0 node-installer.msi, heroku-toolbelt.exe
    Write-Host "Installers deleted."
}

Function RunNpmInstallGlobal {
    $npmerr = @()
    gcm npm -ErrorAction silentlycontinue -ErrorVariable npmerr
    if ($npmerr.count -gt 0) {
        Write-Warning "`n`nnpm is not on the PATH. Cannot run npm install -g bower or npm install -g grunt-cli. You must do this manually."
        return
    }

    Write-Host "`n`nRunning npm install -g bower"
    Start-Process npm -ArgumentList @("install", "-g", "bower") -Wait -NoNewWindow
    Write-Host "`n`nRunning npm install -g grunt-cli"
    Start-Process npm -ArgumentList @("install", "-g", "grunt-cli") -Wait -NoNewWindow

    Write-Host "Finished installing Grunt and Bower."
}
Function RunNpmInstall {
    $npmerr = @()
    gcm npm -ErrorAction silentlycontinue -ErrorVariable npmerr
    if ($npmerr.count -gt 0) {
        Write-Warning "`n`n`nnpm is not on the PATH. Cannot run npm install! You must do this manually."
        return
    }
    Write-Host "`n`nRunning npm install"
    Start-Process npm -ArgumentList @("install") -Wait -NoNewWindow
    Write-Host "npm install ended"
}

Function RunPipInstall {
    Write-Host "`n`nRunning pip install -r requirements.WINDOWS.txt"
    Start-Process pip -ArgumentList @("install", "-r", "requirements.WINDOWS.txt") -Wait -NoNewWindow
    Write-Host "pip install ended. Removing any leftover sources..."
    # Installing pip requires downloading setuptools.
    rm -ErrorAction 0 setuptools-*.tar.gz
}

Function SetLocalEnvironmentVariables {
    # Need to set these so Django knows it's running locally and not in Heroku.
    Write-Host "`n`nSetting DJANGO_DEBUG and DJANGO_LOCAL_DEV to 1 in environment."
    $env:DJANGO_DEBUG = "1"
    $env:DJANGO_LOCAL_DEV = "1"
    [Environment]::SetEnvironmentVariable("DJANGO_DEBUG", $env:DJANGO_DEBUG, "Machine")
    [Environment]::SetEnvironmentVariable("DJANGO_LOCAL_DEV", $env:DJANGO_LOCAL_DEV, "Machine")
}

Function SetupProcfile {
    # Need to copy Procfile.WINDOWS to Procfile
    Write-Host "`n`nCopying Procfile.WINDOWS to Procfile..."
    cp Procfile.WINDOWS Procfile
}

Function RunSyncdb {
    Write-Host "`n`nRunning python manage.py syncdb..."
    Start-Process python -ArgumentList @("manage.py", "syncdb") -Wait -NoNewWindow
}


###################################################################################################
# Start the installation process.


Function Green ($output) { Write-Host $output -foreground green }
Green "`nDigi International"
Green "XBee ZigBee Cloud Kit"
Green "Automatic setup script for Windows."

# Reload the PATH just to be on the safe side.
ReloadPath

InstallPip
InstallGEvent
InstallPsycopg2
InstallPyCrypto

InstallHerokuIfNeeded

InstallNodeIfNeeded

# Remove downloaded installers
Cleanup

# Reload the PATH so that any executables we've installed can be found.
ReloadPath

# Install things
RunPipInstall

RunNpmInstallGlobal
ReloadPath

RunNpmInstall

# Set the environment up
SetLocalEnvironmentVariables
SetupProcfile

RunSyncdb

Green "Installation script completed. You should now be able to run 'foreman start' to launch the server."
