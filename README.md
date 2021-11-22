# MMM-Spotify

Spotify controller for MagicMirror. Multiples accounts supported!

- [Screenshot](#screenshot)
- [Main Features](#main-features)
- [Restrictions](#restrictions)
- [Install](#install)
  1. [Module install](#1-module-install)
  2. [Setup Spotify](#2-setup-spotify)
  3. [Setup your module](#3-setup-your-module)
      - [Single account](#single-account)
      - [Multi account](#multi-account)
      - [Custom callback](#custom-callback)
  4. [Get auth](#4-get-auth)
- [Configuration](#configuration)
  - [Simple](#simple)
  - [Detail & Default](#detail--default)
  - [`onStart` feature](#onstart-feature)
- [Control with notifications](#control-with-notifications)
- [Notification send](#notification-send)
- [Credit](#credit)


## Screenshot

![default](screenshots/spotify_default.png)
![mini](screenshots/spotify_mini.png)

## Main Features

- Showing Current playback on any devices
- Playing Controllable by Notification & touch (Play, pause, next, previous, volume)
- Spotify Controllable by Notification & touch (change device, change account, search and play)
- Multiple accounts supported

## Restrictions

- This is NOT a full blown Spotify client with integrated player! If you want to use your Pi also as playback device via soundcard, have a look at [Raspotify](https://github.com/dtcooper/raspotify)
- Starting specific songs, playlists etc. is limited! This can only be done by the notifications described below but NOT via the UI / Buttons
- Some of Spotify's API calls we are using are limited to premium accounts only! If you are using a free account, you will probably run into problems at some point
- The Spotify API is rate-limited and only a limited number of clients can make requests to the API. It is recommended to use a separate Spotify app for each client to avoid rate limitations

## Install

### 0. Prevent

Do not install MagicMirror or this module as root user ! (`sudo`)

### 1. Module install

```sh
cd ~/MagicMirror/modules
git clone https://github.com/skuethe/MMM-Spotify
cd MMM-Spotify
npm install
```

### 2. Setup Spotify

You should be a premium member of Spotify

1. Go to https://developer.spotify.com
2. Navigate to **DASHBOARD** > **Create an app** (fill information as your thought)
3. Setup the app created, (**EDIT SETTINGS**)
   - Redirect URIs. : `http://localhost:8888/callback`
   - That's all you need. Just save it.
4. Now copy your **Client ID** and **Client Secret** to any memo

Hint:  
If you are running `MM²` inside an environment without a UI (Docker f.e.), you need to configure a [custom callback](#custom-callback) URL.
This custom callback URL needs to be adapted when editing the app in the Spotify developer dashboard.


### 3. Setup your module

#### Single account

```sh
cd ~/MagicMirror/modules/MMM-Spotify
cp spotify.config.json.example-single spotify.config.json
vim spotify.config.json
```

Edit the `spotify.config.json` with the editor of your choice. Modify the entries as hinted below, hen save it.

```json
[
  {
      "USERNAME": "A_NAME_TO_IDENTIFY_YOUR_ACCOUNT",
      "CLIENT_ID": "PUT_YOUR_SPOTIFY_APP_CLIENT_ID",
      "CLIENT_SECRET": "PUT_YOUR_SPOTIFY_APP_CLIENT_SECRET",
      "TOKEN": "./USERNAME_token.json"
  }
]
```

#### Multi account

```sh
cd ~/MagicMirror/modules/MMM-Spotify
cp spotify.config.json.example-multi spotify.config.json
vim spotify.config.json
```

Open the `spotify.config.json` then modify it as described. You can create a configuration object for each account you want to use. Save the file.
Make sure that `TOKEN` is referencing different file names, as these files will be created.

```json
[
  {
      "USERNAME": "A_NAME_TO_IDENTIFY_THE_FIRST_ACCOUNT",
      "CLIENT_ID": "PUT_SPOTIFY_APP_CLIENT_ID_OF_FIRST_ACCOUNT",
      "CLIENT_SECRET": "PUT_SPOTIFY_APP_CLIENT_SECRET_OF_FIRST_ACCOUNT",
      "TOKEN": "./FIRSTUSERNAME_token.json"
  },
  {
      "USERNAME": "ANOTHER_NAME_TO_IDENTIFY_THE_SECOND_ACCOUNT",
      "CLIENT_ID": "PUT_SPOTIFY_APP_CLIENT_ID_OF_SECOND_ACCOUNT",
      "CLIENT_SECRET": "PUT_SPOTIFY_APP_CLIENT_SECRET_OF_SECOND_ACCOUNT",
      "TOKEN": "./SECONDUSERNAME_token.json"
  }
]
```

#### Custom callback

If you are running MagicMirror in an environment without UI (Docker f.e.), you need to provide a custom callback URL in your account file, which points to your devices IP address.  
This can be configured inside the `spotify.config.json` file.

An example:
- you have `MM²` running inside a docker container, which is running on your Raspberry Pi
- your Pi's local network IP is: `192.168.0.100`
- some other application / container is already using port `8888` on your Pi, so you need to use something other than the default (which is `8888`). For example: `8889`

```sh
cd ~/magicmirror/mounts/modules/MMM-Spotify
cp spotify.config.json.example-callback spotify.config.json
vim spotify.config.json
```

```json
[
  {
      "USERNAME": "A_NAME_TO_IDENTIFY_YOUR_ACCOUNT",
      "CLIENT_ID": "PUT_YOUR_SPOTIFY_APP_CLIENT_ID",
      "CLIENT_SECRET": "PUT_YOUR_SPOTIFY_APP_CLIENT_SECRET",
      "TOKEN": "./token.json",
      "AUTH_DOMAIN": "http://192.168.0.100",
      "AUTH_PORT": "8889"
  }
]
```

**Docker specific**: make sure you pass the port specified by `AUTH_PORT` directly to the container running `MM²`.  
In our case, a possible `docker-compose.yml` file could look like this:

```yaml
version: '3'

services:
  magicmirror:
    container_name: mm
    image: karsten13/magicmirror:latest
    ports:
      - "8080:8080"
      - "8889:8889"
    volumes:
      - ../mounts/config:/opt/magic_mirror/config
      - ../mounts/modules:/opt/magic_mirror/modules
      - ../mounts/css:/opt/magic_mirror/css
    restart: unless-stopped
    command: 
      - npm
      - run
      - server
```

This change needs to also be made if you run `MM²` in docker but keep the default `AUTH_PORT` of `8888`:

```yaml
[...]

    ports:
      - "8080:8080"
      - "8888:8888"

[...]
```

Also make sure you configured the custom callback URL inside the Spotify App (see: [Setup Spotify](#2-setup-spotify)).


### 4. Get auth

In RPI Desktop, log in in a Terminal (you can use VNC).  

If you are running inside Docker (or any other environment without UI), be sure to configure a [Custom callback](#custom-callback) fist.
The `first_auth.js` script will then not open your default browser, but output an URL, which you need to open in your workstation on the same network.

```sh
cd ~/MagicMirror/modules/MMM-Spotify
node first_auth.js
```

Then the allowance dialog popup will be opened:

- You MUST login in the SAME ORDER you put your users in the configuration file (when using multiple accounts)
- It helps to not save your login in the browser session (when using multiple accounts)
- Allow the application to access your Spotify API
- Close the browser
- Another browser session will start when using multiple accounts -> repeat steps

That's all - now all the specific json files where created.  


## Configuration

### Simple

```js
{
  module: "MMM-Spotify",
  position: "bottom_left",
  config: {
    debug: false,
  }
}
```

### Detail & Default

```js
{
  module: "MMM-Spotify",
  position: "bottom_left", // "bottom_bar" or "top_bar" for miniBar
  config: {
    debug: false, // debug mode
    style: "default", // "default" or "mini" available (inactive for miniBar)
    moduleWidth: 360, // width of the module in px
    control: "default", // "default" or "hidden"
    showAlbumLabel: true, // if you want to show the label for the current song album
    showVolumeLabel: true, // if you want to show the label for the current volume
    showAccountName: false, // also show the current account name in the device label; usefull for multi account setup
    showAccountButton: true, // if you want to show the "switch account" control button
    showDeviceButton: true, // if you want to show the "switch device" control button
    useExternalModal: false, // if you want to use MMM-Modal for account and device popup selection instead of the build-in one (which is restricted to the album image size)
    updateInterval: 1000, // update interval when playing
    idleInterval: 30000, // update interval on idle
    defaultAccount: 0, // default account number, attention : 0 is the first account
    defaultDevice: null, // optional - if you want the "SPOTIFY_PLAY" notification to also work from "idle" status, you have to define your default device here (by name)
    allowDevices: [], //If you want to limit devices to display info, use this. f.e. allowDevices: ["RASPOTIFY", "My Home speaker"],
    onStart: null, // disable onStart feature with `null`
    // if you want to send custom notifications when suspending the module, f.e. switch MMM-Touch to a different "mode"
    notificationsOnSuspend: [
      {
        notification: "TOUCH_SET_MODE",
        payload: "myNormalMode",
      },
      {
        notification: "WHATEVERYOUWANT",
        payload: "sendMe",
      }
    ],
    // if you want to send custom notifications when resuming the module, f.e. switch MMM-Touch to a different "mode"
    notificationsOnResume: [
      {
        notification: "TOUCH_SET_MODE",
        payload: "mySpotifyControlMode",
      },
    ],
    deviceDisplay: "Listening on", // text to display in the device block (default style only)
    volumeSteps: 5, // in percent, the steps you want to increase or decrese volume when reacting on the "SPOTIFY_VOLUME_{UP,DOWN}" notifications
    // miniBar is no longer supported, use at your own "risk". Will be removed in a future version
    miniBarConfig: {
      album: true, // display Album name in miniBar style
      scroll: true, // scroll title / artist / album in miniBar style
      logo: true, // display Spotify logo in miniBar style
    }
  }
}
```

### `onStart` feature

You can control Spotify on start of MagicMirror (By example; Autoplay specific playlist when MM starts)

```js
  onStart: {
    deviceName: "RASPOTIFY", //if null, current(last) activated device will be.
    spotifyUri: "spotify:track:3ENXjRhFPkH8YSH3qBXTfQ",
    //when search is set, sportifyUri will be ignored.
    search: {
      type: "playlist", // `artist`, track`, `album`, `playlist` and its combination(`artist,playlist,album`) be available
      keyword: "death metal",
      random:true,
    }
  }
```

When `search` field exists, `spotifyUri` will be ignored.

## Control with notifications

- `SPOTIFY_SEARCH` : search items with query and play it. `type`, `query`, `random` be payloads

```json
  this.sendNotification("SPOTIFY_SEARCH", {"type": "artist,playlist", "query": "michael+jackson", "random": false})
```

- `SPOTIFY_PLAY` : playing specific SpotifyUri. There could be two types of uri - `context_uri` and `uris`. 
  - `context_uri:String` : Spotify URI of the context to play. Valid contexts are albums, artists, playlists.
  - `uris:[]`: A JSON array of the Spotify track URIs to play

```json
   this.sendNotification("SPOTIFY_PLAY", {"context_uri": "spotify:album:1Je1IMUlBXcx1Fz0WE7oPT"})
//OR
   this.sendNotification("SPOTIFY_PLAY", {
     "uris": ["spotify:track:4iV5W9uYEdYUVa79Axb7Rh", "spotify:track:1301WleyT98MSxVHPZCA6M"]
   })
```

The SPOTIFY_PLAY notification can also be used as `resume` feature of stopped/paused player, when used without payloads.  
In addition, if you have `defaultDevice` configured, you can start playback from Spotify's "disconnected" mode (where Spotify does not have an active device in your account).

- `SPOTIFY_PAUSE` : pausing current playback.

```json
  this.sendNotification("SPOTIFY_PAUSE")
```

- `SPOTIFY_TOGGLE` : toggling for playing/pausing

```json
  this.sendNotification("SPOTIFY_TOGGLE")
```

- `SPOTIFY_NEXT` : next track of current playback.

```json
  this.sendNotification("SPOTIFY_NEXT")
```

- `SPOTIFY_PREVIOUS` : previous track of current playback.

```json
  this.sendNotification("SPOTIFY_PREVIOUS")
```

- `SPOTIFY_VOLUME` : setting volume of current playback. payload will be volume (0 - 100)

```json
  this.sendNotification("SPOTIFY_VOLUME", 50)
```

- `SPOTIFY_VOLUME_UP` : increasing volume in this.config.volumeSteps steps. Maximum 100. Useful in combination with touch

```json
  this.sendNotification("SPOTIFY_VOLUME_UP")
```

- `SPOTIFY_VOLUME_DOWN` : decreasing volume in this.config.volumeSteps steps. Minimum 0. Useful in combination with touch

```json
  this.sendNotification("SPOTIFY_VOLUME_DOWN")
```

- `SPOTIFY_TRANSFER` : change device of playing with device name (e.g: RASPOTIFY)

```json
  this.sendNotification("SPOTIFY_TRANSFER", "RASPOTIFY")
```

- `SPOTIFY_SHUFFLE` : toggle shuffle mode.

```json
  this.sendNotification("SPOTIFY_SHUFFLE")
```

- `SPOTIFY_REPEAT` : change repeat mode. (`off` -> `track` -> `context`)

```json
this.sendNotification("SPOTIFY_REPEAT")
```

- `SPOTIFY_ACCOUNT`: change account. payload is the `USERNAME` defined in your account in `spotify.config.json` file

```json
this.sendNotification("SPOTIFY_ACCOUNT", "premium")
```

payload could be the number of the account. attention: for first account, number is `0`

```json
this.sendNotification("SPOTIFY_ACCOUNT", 0)
```

## Notification send

- `SPOTIFY_CONNECTED`: Spotify is connected to a device
- `SPOTIFY_DISCONNECTED`: Spotify is disconnected

It can be used with MMM-pages for example (for show or hide the module)


## Credit

- Biggest thanks to @eouia for all his work and inspiration
- Special thanks to @ejay-ibm so much for taking the time to cowork to make this module.
- Thanks to @KamisamaPT for helping design
