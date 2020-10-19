#!/bin/bash
# +----------------+
# | npm preinstall |
# +----------------+

# get the installer directory
Installer_get_current_dir () {
  SOURCE="${BASH_SOURCE[0]}"
  while [ -h "$SOURCE" ]; do
    DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
    SOURCE="$(readlink "$SOURCE")"
    [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
  done
  echo "$( cd -P "$( dirname "$SOURCE" )" && pwd )"
}

Installer_dir="$(Installer_get_current_dir)"

# move to installler directory
cd "$Installer_dir"

source utils.sh

# module name
Installer_module="MMM-Spotify"

echo

# Let's start !
Installer_info "Welcome to $Installer_module"
Installer_info "This module will be redirected to @skuethe/MMM-Spotify"

echo
# switch branch
Installer_info "Installing @skuethe Sources..."
cd ../..
rm -rf MMM-Spotify
git clone https://github.com/skuethe/MMM-Spotify 2>/dev/null || Installer_error "Installing Error !"
cd MMM-Spotify

echo
Installer_info "Installing..."
npm install
