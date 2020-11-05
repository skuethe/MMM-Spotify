//
// Module : MMM-Spotify
//

Module.register("MMM-Spotify", {
  defaults: {
    debug: false,
    style: "default", // "default", "mini" available.
    moduleWidth: 360, // width of the module
    control: "default", //"default", "hidden" available
    showAccountButton: true,
    showDeviceButton: true,
    useExternalModal: false, // if you want to use MMM-Modal for account and device popup selection instead of the build-in one (which is restricted to the album image size)
    updateInterval: 1000,
    idleInterval: 10000,
    accountDefault: 0, // default account number, attention : 0 is the first account
    allowDevices: [],
    iconify: "https://code.iconify.design/1/1.0.6/iconify.min.js",
    //iconify: null,
    //When you use this module with `MMM-CalendarExt` or any other `iconify` used modules together, Set this null.
    onStart: null,
    notificationsOnSuspend: [],
    notificationsOnResume: [],
    deviceDisplay: "Listening on",
    volumeSteps: 5, // in percent, the steps you want to increase or decrese volume when using the "SPOTIFY_VOLUME_{UP,DOWN}" notifications
    miniBarConfig: {
      album: true,
      scroll: true,
      logo: true,
    }
    //If you want to play something on start; set like this.
    /*
    onStart: {
      deviceName: "Web Player (Chrome)", //if null, current(last) activated device will be.
      spotifyUri : "spotify:playlist:37i9dQZF1DX9EM98aZosoy", //when search is set, sportifyUri will be ignored.
      search: {
        type: "artist, track", // `artist`, track`, `album`, `playlist` available
        keyword: "michael+jackson",
        random:true,
      }
    }
    */
  },

  getScripts: function () {
    this.scanConfig()
    r = ["https://cdn.materialdesignicons.com/5.2.45/css/materialdesignicons.min.css"]
    if (this.config.iconify) {
      r.push(this.config.iconify)
    }
    return r
  },

  getStyles: function () {
    return ["MMM-Spotify.css", 'font-awesome.css']
  },

  start: function () {
    this.currentPlayback = null
    this.connected = false
    this.firstLaunch = true
    this.timer = null
    this.ads = false
    this.volume = 50
    this.currentAccount = this.config.accountDefault
    this.devices = []
    this.accounts = []
    this.externalModal = null
  },

  notificationReceived: function (noti, payload, sender) {
    if (noti === "DOM_OBJECTS_CREATED") {
      this.sendSocketNotification("INIT", this.config)
    }
    switch (noti) {
      case "SPOTIFY_SEARCH":
        var pl = {
          query: {
            q: payload.query,
            type: payload.type,
          },
          condition: {
            random: payload.random,
            autoplay: true,
          }
        }
        this.sendSocketNotification("SEARCH_AND_PLAY", pl)
        break
      case "SPOTIFY_PLAY":
        this.sendSocketNotification("PLAY", payload)
        break
      case "SPOTIFY_PAUSE":
        this.sendSocketNotification("PAUSE")
        break
      case "SPOTIFY_NEXT":
        this.sendSocketNotification("NEXT")
        break
      case "SPOTIFY_PREVIOUS":
        this.sendSocketNotification("PREVIOUS")
        break
      case "SPOTIFY_VOLUME":
        this.sendSocketNotification("VOLUME", payload)
        break
      case "SPOTIFY_VOLUME_UP":
        var volume = (this.volume + this.config.volumeSteps);
        (volume > 100) ? volume = 100 : volume
        this.sendSocketNotification("VOLUME", volume)
        break
      case "SPOTIFY_VOLUME_DOWN":
        var volume = (this.volume - this.config.volumeSteps);
        (volume < 0) ? volume = 0 : volume
        this.sendSocketNotification("VOLUME", volume)
        break
      case "SPOTIFY_TRANSFER":
        this.sendSocketNotification("TRANSFER", payload)
        break
      case "SPOTIFY_SHUFFLE":
        this.clickShuffle()
        break
      case "SPOTIFY_REPEAT":
        this.clickRepeat()
        break
      case "SPOTIFY_TOGGLE":
        this.clickPlay()
        break
      case "SPOTIFY_ACCOUNT":
        this.sendSocketNotification("ACCOUNT",payload)
        break
    }
  },

  socketNotificationReceived: function (noti, payload) {
    switch (noti) {
      case "INITIALIZED":
        break
      case "CURRENT_PLAYBACK":
        if (
          (this.config.allowDevices.length === 0)
          || (this.config.allowDevices.length >= 1 && this.config.allowDevices.includes(payload.device.name))
        ) {
          this.volume = payload.device.volume_percent
          this.sendSocketNotification("UNALLOWED_DEVICE", false)
          this.updateCurrentPlayback(payload)
        } else {
          this.sendSocketNotification("UNALLOWED_DEVICE", true)
          this.updatePlayback(false)
        }
        break
      case "CURRENT_NOPLAYBACK":
        this.updatePlayback(false)
        break
      case "CURRENT_ACCOUNT":
        this.currentAccount = payload
        break
      case "LIST_DEVICES":
        this.updateDeviceList(payload)
        break
      case "LIST_ACCOUNTS":
        this.updateAccountList(payload)
        break
    }
    if (noti.search("DONE_") > -1) {
      this.sendNotification(noti)
    }
  },

  updatePlayback: function (status) {
    var dom = document.getElementById("SPOTIFY")
    if (this.enableMiniBar) {
      this.timer = null
      clearTimeout(this.timer)
      let pos = ((this.myPosition === "bottom_bar") ? "bottom" : "top")
      if (status) {
        dom.classList.remove(pos+"Out")
        dom.classList.add(pos+"In")
        dom.classList.remove("inactive")
      }
      else {
        dom.classList.remove(pos+"In")
        dom.classList.add(pos+"Out")
        this.timer = setTimeout(() => dom.classList.add("inactive") , 500)
      }
    } else {
      if (status) dom.classList.remove("inactive")
      else dom.classList.add("inactive")
    }
    if (this.connected && !status) {
      this.connected = false
      this.sendNotification("SPOTIFY_DISCONNECTED")
    }
    if (!this.connected && status) {
      this.connected = true
      this.sendNotification("SPOTIFY_CONNECTED")
      if (this.config.showDeviceButton) {
        this.sendSocketNotification("GET_DEVICES")
      }
      if (this.config.showAccountButton) {
        this.sendSocketNotification("GET_ACCOUNTS")
      }
    }
  },

  updateCurrentPlayback: function (current) {
    if (!current) return
    if (!this.currentPlayback) {
      this.updateSongInfo(current.item)
      this.updatePlaying(current.is_playing)
      this.updateDevice(current.device)
      this.updatePlayback(current.is_playing)
      if (current.device) this.updateVolume(current.device.volume_percent)
      this.updateShuffle(current.shuffle_state)
      this.updateRepeat(current.repeat_state)
      if (current.is_playing && current.item) this.updateProgress(current.progress_ms, current.item.duration_ms)
    } else {
      if (!this.connected && current.is_playing) {
        this.updatePlayback(true)
      }
      /** for Ads **/
      if (current.currently_playing_type == "ad") {
        this.ads = true
        current.is_playing = false
      }
      if (this.currentPlayback.is_playing !== current.is_playing) {
        this.updatePlaying(current.is_playing)
      }
      if (current.currently_playing_type == "ad") {
        // simulate pause for ads
        this.currentPlayback.is_playing = false
        return
      }
      if (this.ads) {
        // end of ads -> reset currentPlayback
        this.currentPlayback = null
        this.ads = false
        return
      }

      /** prevent all error -> reset currentPlayback **/
      if (!current.item || !current.device || !current.progress_ms || !current.item.duration_ms) return this.currentPlayback = null

      /** All is good so ... live update **/
      if (this.currentPlayback.item.id !== current.item.id) {
        this.updateSongInfo(current.item)
      }
      if (this.currentPlayback.device.id !== current.device.id) {
        this.updateDevice(current.device)
        if (this.config.showDeviceButton) {
          this.sendSocketNotification("GET_DEVICES")
        }
      }
      if (this.currentPlayback.device.volume_percent !== current.device.volume_percent) {
        this.updateVolume(current.device.volume_percent)
      }
      if (this.currentPlayback.repeat_state !== current.repeat_state) {
        this.updateRepeat(current.repeat_state)
      }
      if (this.currentPlayback.shuffle_state !== current.shuffle_state) {
        this.updateShuffle(current.shuffle_state)
      }
      if (this.currentPlayback.progress_ms !== current.progress_ms) {
        this.updateProgress(current.progress_ms, current.item.duration_ms)
      }
    }
    this.currentPlayback = current
  },

  msToTime(duration) {
    let ret = ""
    let seconds = parseInt((duration / 1000) % 60)
      , minutes = parseInt((duration / (1000 * 60)) % 60)
      , hours = parseInt((duration / (1000 * 60 * 60)) % 24)
    if (hours > 0) {
      hours = (hours < 10) ? "0" + hours : hours
      ret = ret + hours + ":"
    }
    minutes = (minutes < 10) ? "0" + minutes : minutes
    seconds = (seconds < 10) ? "0" + seconds : seconds
    return ret + minutes + ":" + seconds
  },

  updateProgress: function ( progressMS, durationMS ) {
    const bar = document.getElementById("SPOTIFY_PROGRESS_BAR");
    bar.value = progressMS;

    if (bar.max != durationMS) {
      bar.max = durationMS;
    }

    if (this.enableMiniBar) {
      const current = document.getElementById("SPOTIFY_PROGRESS_COMBINED");
      current.innerText = this.msToTime(progressMS) + ' / ' + this.msToTime(durationMS);
      return;
    }

    if (this.config.style === 'default' && !this.enableMiniBar) {
      const current = document.getElementById("SPOTIFY_PROGRESS_CURRENT");
      current.innerText = this.msToTime(progressMS);

      const end = document.getElementById("SPOTIFY_PROGRESS_END");
      const duration = this.msToTime(durationMS);

      if (end.innerText != duration) {
        end.innerText = duration;
      }
    }
  },

  updateShuffle: function (shuffleState) {
    if (this.config.control === "hidden" || this.enableMiniBar) return;

    const shuffle = document.getElementById("SPOTIFY_CONTROL_SHUFFLE")
    shuffle.className = shuffleState
      ? "on"
      : "off"

    const icon = shuffleState
      ? "mdi:shuffle"
      : "mdi:shuffle-disabled";
    
    shuffle.innerHTML = ""
    shuffle.appendChild(
      this.getIconContainer('iconify', "SPOTIFY_CONTROL_SHUFFLE_ICON", icon),
    )
  },

  updateRepeat: function (repeatState) {
    if (this.config.control === "hidden" || this.enableMiniBar) return;

    const repeat = document.getElementById("SPOTIFY_CONTROL_REPEAT")
    repeat.className = repeatState
    const ris = {
      "off": "mdi:repeat-off",
      "track": "mdi:repeat-once",
      "context": "mdi:repeat"
    }
    repeat.innerHTML = ""
    repeat.appendChild(
      this.getIconContainer('iconify', null, ris[repeatState]),
    )
  },

  updateAccountList: function (payload) {
    var self = this

    // let's start clean
    this.accounts = []
    const accountList = document.getElementById("SPOTIFY_ACCOUNT_LIST")
    if (typeof accountList !== "undefined" && accountList) {
      while (accountList.hasChildNodes()) {
        accountList.removeChild(accountList.firstChild);
      }
    }

    if (typeof payload !== "undefined" && payload.length > 0) {
      for (var i = 0; i < payload.length; i++) {
        if (this.config.useExternalModal) this.accounts.push(payload[i])
        else {
          var account = this.getHTMLElementWithID("div", "SPOTIFY_ACCOUNT" + i)

          var text = document.createElement("span")
          text.className = "text"
          text.textContent = payload[i].name
          if (payload[i].id == this.currentAccount) text.textContent += " (active)"

          account.appendChild(this.getIconContainer(this.getFAIconClass("Account"), "SPOTIFY_ACCOUNT" + i + "_ICON"))
          account.appendChild(text)
          account.accountId = payload[i].id
          account.addEventListener("click", function() { self.clickAccountTransfer(this.accountId) })

          accountList.appendChild(account)
        }
      }
    }

  },

  updateDevice: function (device) {
    const deviceContainer = document.querySelector("#SPOTIFY_DEVICE .text")
    const deviceIcon = document.getElementById("SPOTIFY_DEVICE_ICON")

    deviceContainer.textContent = (this.config.style == "default" || this.enableMiniBar) ? this.config.deviceDisplay + ' ' + device.name : device.name
    deviceIcon.className = this.getFAIconClass(device.type)

    this.sendNotification("SPOTIFY_UPDATE_DEVICE", device)
  },

  updateDeviceList: function (payload) {
    var self = this

    // let's start clean
    this.devices = []
    const deviceList = document.getElementById("SPOTIFY_DEVICE_LIST")
    if (typeof deviceList !== "undefined" && deviceList) {
      while (deviceList.hasChildNodes()) {
        deviceList.removeChild(deviceList.firstChild);
      }
    }

    if (typeof payload.devices !== "undefined" && payload.devices.length > 0) {
      for (var i = 0; i < payload.devices.length; i++) {
        if(payload.devices[i].is_restricted) continue
        if(this.config.allowDevices.length >= 1 && !this.config.allowDevices.includes(payload.devices[i].name)) continue

        if (this.config.useExternalModal) this.devices.push(payload.devices[i])
        else {
          var device = this.getHTMLElementWithID("div", "SPOTIFY_DEVICE" + i)

          var text = document.createElement("span")
          text.className = "text"
          text.textContent = payload.devices[i].name
          if (payload.devices[i].is_active) text.textContent += " (active)"

          device.appendChild(this.getIconContainer(this.getFAIconClass(payload.devices[i].type), "SPOTIFY_DEVICE" + i + "_ICON"))
          device.appendChild(text)
          device.deviceId = payload.devices[i].id
          device.addEventListener("click", function() { self.clickDeviceTransfer(this.deviceId) })

          deviceList.appendChild(device)
        }
      }
    }

  },

  updateVolume: function (volume_percent) {
    this.sendNotification("SPOTIFY_UPDATE_VOLUME", volume_percent)
    //if (!this.enableMiniBar) return
    const volumeContainer = document.querySelector("#SPOTIFY_VOLUME .text")
    const volumeIcon = document.getElementById("SPOTIFY_VOLUME_ICON")

    volumeContainer.textContent = volume_percent + "%"
    volumeIcon.className = this.getVolumeIconClass(volume_percent)
  },

  getVolumeIconClass(volume_percent) {
    let iconClass = 'VOL_OFF';
    if (volume_percent === 0) {
      return this.getFAIconClass(iconClass);
    }

    if (volume_percent < 40) {
      iconClass = 'VOL_LOW';
    } else {
      iconClass = volume_percent > 70 ? 'VOL_HIGH' : 'VOL_MID'
    }

    return this.getFAIconClass(iconClass);
  },

  updatePlaying: function (isPlaying) {
    if (isPlaying && this.firstLaunch) {
      this.sendNotification("SPOTIFY_CONNECTED")
      this.firstLaunch = false
    }
    const s = document.getElementById("SPOTIFY")

    if (isPlaying) {
      s.classList.add("playing")
      s.classList.remove("pausing")
    } else {
      s.classList.add("pausing")
      s.classList.remove("playing")
    }

    if (this.config.control !== "hidden") {
      const p = document.getElementById("SPOTIFY_CONTROL_PLAY")
      p.className = isPlaying ? "playing" : "pausing"
      const icon = isPlaying
        ? "mdi:pause"
        : "mdi:play";

      p.innerHTML = ""
      p.appendChild(
        this.getIconContainer('iconify', "SPOTIFY_CONTROL_PLAY_ICON", icon),
      )
    }
    this.sendNotification("SPOTIFY_UPDATE_PLAYING", isPlaying)
  },

  updateSongInfo: function (playbackItem) {
    if (!playbackItem) return

    const sDom = document.getElementById("SPOTIFY")
    sDom.classList.remove("noPlayback")

    const cover_img = document.getElementById("SPOTIFY_COVER_IMAGE")
    let img_index = 0
    // cover data is stored in 3 sizes. let's fetch the appropriate size to reduce 
    // bandwidth usage bsed on player style
    if (this.config.style !== "default") {
      img_index = this.enbaleMiniBar ? 2 : 1
    }
    var img_url
    var display_name
    if (playbackItem.album){
      img_url = playbackItem.album.images[img_index].url
      display_name = playbackItem.album.name
    }
    else{
      img_url = playbackItem.images[img_index].url
      display_name = playbackItem.show.name
    }

    

    if (img_url !== cover_img.src) {
      const back = document.getElementById("SPOTIFY_BACKGROUND")
      back.classList.remove('fade-in')
      back.offsetWidth = cover_img.offsetWidth;
      back.classList.add('fade-in')
      back.style.backgroundImage = `url(${img_url})`
      
      cover_img.classList.remove('fade-in')
      cover_img.offsetWidth = cover_img.offsetWidth;
      cover_img.classList.add('fade-in')
      cover_img.src = img_url
    }

    const title = document.querySelector("#SPOTIFY_TITLE .text")
    title.textContent = playbackItem.name

    if ((this.enableMiniBar && this.config.miniBarConfig.album) || !this.enableMiniBar) {
      const album = document.querySelector("#SPOTIFY_ALBUM .text")
      album.textContent = display_name
    }

    const artist = document.querySelector("#SPOTIFY_ARTIST .text")
    const artists = playbackItem.artists
    let artistName = ""
    if (playbackItem.album){
      for (let x = 0; x < artists.length; x++) {
        if (!artistName) {
          artistName = artists[x].name
        } else {
          artistName += ", " + artists[x].name
        }
      }
    } else{
      artistName = playbackItem.show.publisher
    }
    artist.textContent = artistName
    this.sendNotification("SPOTIFY_UPDATE_SONG_INFO", playbackItem)
  },

  clickPlay: function () {
    this.currentPlayback.is_playing
      ? this.sendSocketNotification("PAUSE")
      : this.sendSocketNotification("PLAY")
  },

  clickRepeat: function () {
    var c = this.currentPlayback.repeat_state
    var n = ""
    if (c === "off") n = "track"
    if (c === "track") n = "context"
    if (c === "context") n = "off"
    this.sendSocketNotification("REPEAT", n)
  },

  clickShuffle: function () {
    this.sendSocketNotification("SHUFFLE", !this.currentPlayback.shuffle_state)
  },

  clickBackward: function () {
    this.currentPlayback.progress_ms < 3000
      ? this.sendSocketNotification("PREVIOUS")
      : this.sendSocketNotification("REPLAY")
  },

  clickForward: function () {
    this.sendSocketNotification("NEXT")
  },

  clickAccountList: function () {
    if (this.config.useExternalModal) {
      this.getExternalModal("ACCOUNTS")
    } else {
      const accountList = document.getElementById("SPOTIFY_ACCOUNT_LIST")
      const deviceList = document.getElementById("SPOTIFY_DEVICE_LIST")
      const main = document.getElementById("SPOTIFY")

      deviceList.classList.add("hidden")

      if (accountList.classList.contains("hidden")) {
        accountList.classList.remove("hidden")
        main.classList.add("modal")
      } else {
        accountList.classList.add("hidden")
        main.classList.remove("modal")
      }
    }
  },

  clickAccountTransfer: function (accountId) {
    this.sendSocketNotification("ACCOUNT", accountId)
    this.clickAccountList()
  },

  clickDeviceList: function () {
    if (this.config.useExternalModal) {
      this.getExternalModal("DEVICES")
    } else {
      const deviceList = document.getElementById("SPOTIFY_DEVICE_LIST")
      const accountList = document.getElementById("SPOTIFY_ACCOUNT_LIST")
      const main = document.getElementById("SPOTIFY")

      accountList.classList.add("hidden")

      if (deviceList.classList.contains("hidden")) {
        deviceList.classList.remove("hidden")
        main.classList.add("modal")
      } else {
        deviceList.classList.add("hidden")
        main.classList.remove("modal")
      }
    }
  },

  clickDeviceTransfer: function (deviceId) {
    var transferPayload = { device_ids: [ deviceId ] }
    this.sendSocketNotification("TRANSFERBYID", transferPayload)
    this.clickDeviceList()
  },

  getFAIcon(iconType) {
    switch (iconType) {
      case 'Spotify':
        return 'fab fa-spotify fa-sm';
      case 'Title':
        return 'fa fa-music fa-sm';
      case 'Artist':
        return 'fa fa-user fa-sm';
      case 'Album':
        return 'fa fa-folder fa-sm';
      // Account Icons
      case 'Account':
        return 'mdi mdi-account';
      // Volume Icons
      case 'VOL_HIGH':
        return 'mdi mdi-volume-high';
      case 'VOL_MID':
        return 'mdi mdi-volume-medium';
      case 'VOL_LOW':
        return 'mdi mdi-volume-low';
      case 'VOL_OFF':
        return 'mdi mdi-volume-off';
      // Device Icons
      case 'Tablet':
        return 'fas fa-tablet fa-sm';
      case 'GameConsole':
        return 'fas fa-gamepad fa-sm';
      case 'AVR':
      case 'STB':
        return 'mdi mdi-audio-video';
      case 'AudioDongle':
      case 'CastVideo':
        return 'mdi mdi-cast-connected';
      case 'CastAudio':
      case 'Speaker':
        return 'mdi mdi-cast-audio';
      case 'Automobile':
        return 'fas fa-car fa-sm';
      case 'Smartphone':
        return 'fas fa-mobile fa-sm';
      case 'TV':
        return 'fas fa-tv fa-sm';
      case 'Unknown':
      case 'Computer':
        return 'fa fa-desktop fa-sm';
      default:
        return 'fa fa-headphones fa-sm';
    }
  },

  getFAIconClass(iconType) {
    return 'infoicon ' + this.getFAIcon(iconType);
  },

  getIconContainer(className, id, icon) {
    const iconContainer = document.createElement("i")
    iconContainer.className = className
    iconContainer.dataset.inline = "false"
    iconContainer.id = id
    iconContainer.dataset.icon = icon

    return iconContainer;
  },

  getHTMLElementWithID(type, id) {
    const divElement = document.createElement(type)
    divElement.id = id
    return divElement;
  },

  getEmptyTextHTMLElement() {
    const text = document.createElement("span")
    text.className = "text"
    text.textContent = ""

    return text;
  },

  getDeviceContainer() {
    const device = this.getHTMLElementWithID('div', "SPOTIFY_DEVICE")
    device.appendChild(
      this.getIconContainer(this.getFAIconClass('default'), "SPOTIFY_DEVICE_ICON"),
    )
    device.appendChild(this.getEmptyTextHTMLElement())

    return device;
  },

  getVolumeContainer() {
    const volume = this.getHTMLElementWithID('div', "SPOTIFY_VOLUME")
    volume.appendChild(
      this.getIconContainer(this.getFAIconClass('VOL_OFF'), "SPOTIFY_VOLUME_ICON"),
    )
    volume.appendChild(this.getEmptyTextHTMLElement())

    return volume;
  },

  getSpotifyLogoContainer() {
    const logo = this.getHTMLElementWithID('div', "SPOTIFY_LOGO")
    logo.appendChild(
      this.getIconContainer(this.getFAIconClass('Spotify'), "SPOTIFY_LOGO_ICON"),
    )
    const text = document.createElement("span")
    text.className = "text"
    text.textContent = "Spotify"
    logo.appendChild(text)

    return logo;
  },

  getControlButton(id, icon, action) {
    const button = this.getHTMLElementWithID('div', id)
    button.className = "off"
    button.addEventListener("click", action)
    button.appendChild(this.getIconContainer('iconify', id + "_ICON", icon))

    return button;
  },

  getControlsContainer() {
    const control = this.getHTMLElementWithID('div', "SPOTIFY_CONTROL")
    // No need to generate buttons if they will be hidden
    if (this.config.control === "hidden") return control;
    
    const orderedButtonConfig = {
      "SPOTIFY_CONTROL_ACCOUNTS": {
        icon: 'mdi:account-switch',
        action: () => { this.clickAccountList() },
      },
      "SPOTIFY_CONTROL_SHUFFLE" : {
        icon: 'mdi:shuffle',
        action: () => { this.clickShuffle() },
      },
      "SPOTIFY_CONTROL_BACKWARD": {
        icon: 'mdi:skip-previous',
        action: () => { this.clickBackward() },
      },
      "SPOTIFY_CONTROL_PLAY": {
        icon: 'mdi:play',
        action: () => { this.clickPlay() },
      },
      "SPOTIFY_CONTROL_FORWARD": {
        icon: 'mdi:skip-next',
        action: () => { this.clickForward() },
      },
      "SPOTIFY_CONTROL_REPEAT": {
        icon: 'mdi:repeat-off',
        action: () => { this.clickRepeat() },
      },
      "SPOTIFY_CONTROL_DEVICES": {
        icon: 'mdi:speaker-wireless',
        action: () => { this.clickDeviceList() },
      }
    }

    for (const [key, config] of Object.entries(orderedButtonConfig)) {
      if (!this.config.showAccountButton && key === "SPOTIFY_CONTROL_ACCOUNTS") continue
      if (!this.config.showDeviceButton && key === "SPOTIFY_CONTROL_DEVICES") continue
      control.appendChild(
        this.getControlButton(key, config['icon'], config['action'])
      );
    }

    return control;
  },

  getInfoContainer() {
    const info = this.getHTMLElementWithID('div', "SPOTIFY_INFO")
    const infoElementsWithIcon = {
      "SPOTIFY_TITLE": 'Title',
      "SPOTIFY_ALBUM": 'Album',
      "SPOTIFY_ARTIST": 'Artist',
    }

    for (const [key, iconType] of Object.entries(infoElementsWithIcon)) {
      const element = this.getHTMLElementWithID('div', key)
      element.appendChild(this.getIconContainer(this.getFAIconClass(iconType)))
      element.appendChild(this.getEmptyTextHTMLElement())
      info.appendChild(element)
    }

    info.appendChild(this.getVolumeContainer())
    info.appendChild(this.getDeviceContainer())
    return info;
  },

  getProgressContainer() {
    const progress = this.getHTMLElementWithID('div', "SPOTIFY_PROGRESS")

    if (this.config.style === 'default' && !this.enableMiniBar) {
      const currentTime = this.getHTMLElementWithID('div', "SPOTIFY_PROGRESS_CURRENT")
      currentTime.innerTexttrue = "--:--"

      const songTime = this.getHTMLElementWithID('div', "SPOTIFY_PROGRESS_END")
      songTime.innerText = "--:--"

      const time = this.getHTMLElementWithID('div', "SPOTIFY_PROGRESS_TIME")
      time.appendChild(currentTime)
      time.appendChild(songTime)

      progress.appendChild(time)
    }

    const bar = this.getHTMLElementWithID('progress', "SPOTIFY_PROGRESS_BAR")
    bar.value = 0;
    bar.max = 100;

    progress.appendChild(bar)
    return progress;
  },

  getCoverContainer: function () {
    const cover_img = this.getHTMLElementWithID('img', "SPOTIFY_COVER_IMAGE")
    cover_img.className = 'fade-in'
    cover_img.src = "./modules/MMM-Spotify/resources/spotify-xxl.png"

    const cover = this.getHTMLElementWithID('div', "SPOTIFY_COVER")
    cover.appendChild(cover_img)
    return cover
  },

  getModalContainer: function () {
    const modal = this.getHTMLElementWithID('div', "SPOTIFY_MODAL")

    if (this.config.showAccountButton) {
      const accountList = this.getHTMLElementWithID("div", "SPOTIFY_ACCOUNT_LIST")
      accountList.classList.add("hidden")
      modal.appendChild(accountList)
    }

    if (this.config.showDeviceButton) {
      const deviceList = this.getHTMLElementWithID("div", "SPOTIFY_DEVICE_LIST")
      deviceList.classList.add("hidden")
      modal.appendChild(deviceList)
    }

    return modal;
  },

  getExternalModal: function (contentType) {
    var self = this

    if (contentType === "ACCOUNTS") {
      if (typeof this.accounts !== "undefined" && this.accounts.length > 0) {
        if (this.externalModal == contentType) {
          this.sendNotification("CLOSE_MODAL")
          this.externalModal = null
        } else {
          this.sendNotification("OPEN_MODAL", {
            template: "modalTemplate.njk",
            data: {
              type: contentType,
              currentAccount: this.currentAccount,
              list: this.accounts,
            },
            options: {
              callback(success) {
                const modalList = document.getElementById("SPOTIFY_MODAL_LIST")
                if (typeof modalList !== "undefined" && modalList) {
                  var children = modalList.children
                  for (var i = 0; i < children.length; i++) {
                    children[i].accountId = children[i].dataset.id
                    children[i].addEventListener("click", function() { self.clickAccountTransfer(this.accountId) })
                  }
                }
              }
            }
          })
          this.externalModal = contentType
        }
      }
    } else if (contentType === "DEVICES") {
      if (typeof this.devices !== "undefined" && this.devices.length > 0) {
        if (this.externalModal == contentType) {
          this.sendNotification("CLOSE_MODAL")
          this.externalModal = null
        } else {
          this.sendNotification("OPEN_MODAL", {
            template: "modalTemplate.njk",
            data: {
              type: contentType,
              list: this.devices,
            },
            options: {
              callback(success) {
                const modalList = document.getElementById("SPOTIFY_MODAL_LIST")
                if (typeof modalList !== "undefined" && modalList) {
                  var children = modalList.children
                  for (var i = 0; i < children.length; i++) {
                    children[i].deviceId = children[i].dataset.id
                    children[i].addEventListener("click", function() { self.clickDeviceTransfer(this.deviceId) })
                  }
                }
              }
            }
          })
          this.externalModal = contentType
        }
      }
    }
  },

  getMinimalistBarDom: function (container) {
    container.appendChild(this.getProgressContainer())

    const misc = this.getHTMLElementWithID('div', "SPOTIFY_MISC")
    misc.classList.add(this.config.control == "hidden" ? "nocontrol" : "control")
    misc.appendChild(this.getHTMLElementWithID('div', "SPOTIFY_BACKGROUND"))
    misc.appendChild(this.getDeviceContainer())

    const info = this.getHTMLElementWithID('div', "SPOTIFY_INFO")
    if (this.config.miniBarConfig.scroll) info.className = 'marquee';

    const infoElements = [
      "SPOTIFY_TITLE",
      "SPOTIFY_ALBUM",
      "SPOTIFY_ARTIST",
    ]

    infoElements.forEach((key, index) => {
      if (key == "SPOTIFY_ALBUM" && !this.config.miniBarConfig.album) return
      if (index > 0) {
        const bulletElement = this.getHTMLElementWithID("span", "TEXT_BULLET");
        bulletElement.innerHTML = "&#8226;"
        info.appendChild(bulletElement)
      }
      const element = this.getHTMLElementWithID('div', key)
      element.appendChild(this.getEmptyTextHTMLElement())
      info.appendChild(element)
    })

    misc.appendChild(info)

    const infoFooter = this.getHTMLElementWithID('div', "SPOTIFY_INFO_FOOTER")
    infoFooter.appendChild(this.getVolumeContainer())

    if (this.config.miniBarConfig.logo) {
      infoFooter.appendChild(this.getSpotifyLogoContainer())
    }

    const totalTime = this.getHTMLElementWithID('div', "SPOTIFY_PROGRESS_COMBINED")
    totalTime.className = 'text'
    totalTime.innerText = "--:-- / --:--"

    infoFooter.appendChild(totalTime)

    misc.appendChild(infoFooter)

    const foreground = this.getHTMLElementWithID('div', "SPOTIFY_FOREGROUND")
    foreground.appendChild(this.getCoverContainer())
    foreground.appendChild(misc)
    if (this.config.control !== "hidden") {
      foreground.appendChild(
        this.getControlButton(
          "SPOTIFY_CONTROL_PLAY",
          'mdi:play-circle-outline', () => { this.clickPlay() },
        ),
      )
    }

    container.appendChild(foreground)

    return container
  },

  getDom: function () {
    const m = this.getHTMLElementWithID('div', "SPOTIFY")
    if (this.config.style !== "default" && !this.enableMiniBar) {
      m.classList.add(this.config.style)
    }

    m.classList.add("noPlayback")
    if (this.enableMiniBar) {
      m.classList.add("minimalistBar")
      m.classList.add(this.config.miniBarConfig.scroll ? "Scroll" : "noScroll")
      m.classList.add("inactive")
      return this.getMinimalistBarDom(m)
    }

    if (this.config.moduleWidth !== "undefined" && (this.config.moduleWidth > 0 && this.config.moduleWidth != 360)) {
      m.style.setProperty("--sp-width", this.config.moduleWidth + "px");
    }

    m.appendChild(this.getHTMLElementWithID('div', "SPOTIFY_BACKGROUND"))

    const cover_img = this.getHTMLElementWithID('img', "SPOTIFY_COVER_IMAGE")
    cover_img.className = 'fade-in'
    cover_img.src = "./modules/MMM-Spotify/resources/spotify-xxl.png"

    const cover = this.getHTMLElementWithID('div', "SPOTIFY_COVER")
    cover.appendChild(cover_img)
    if ((this.config.showDeviceButton || this.config.showAccountButton) && !this.config.useExternalModal) {
      cover.appendChild(this.getModalContainer());
    }


    const misc = this.getHTMLElementWithID('div', "SPOTIFY_MISC")
    misc.appendChild(this.getInfoContainer())
    misc.appendChild(this.getProgressContainer())
    misc.appendChild(this.getControlsContainer())

    const fore = this.getHTMLElementWithID('div', "SPOTIFY_FOREGROUND")
    fore.appendChild(cover)
    fore.appendChild(misc)

    m.appendChild(fore)
    return m
  },

  scanConfig: function () {
    this.enableMiniBar = false
    this.myPosition = this.data.position
    if (this.myPosition == "bottom_bar" || this.myPosition == "top_bar") this.enableMiniBar = true
  },

  suspend: function() {
    console.log(this.name + " is suspended.")
    this.sendSocketNotification("SUSPENDING")
    if (typeof this.config.notificationsOnSuspend === "object" && this.config.notificationsOnSuspend.length > 0) {
      for (let i = 0; i < this.config.notificationsOnSuspend.length; i++) {
        this.sendNotification(this.config.notificationsOnSuspend[i].notification, this.config.notificationsOnSuspend[i].payload)
      }
    }
  },

  resume: function() {
    console.log(this.name + " is resumed.")
    this.sendSocketNotification("INIT", this.config)
    if (typeof this.config.notificationsOnResume === "object" && this.config.notificationsOnResume.length > 0) {
      for (let i = 0; i < this.config.notificationsOnResume.length; i++) {
        this.sendNotification(this.config.notificationsOnResume[i].notification, this.config.notificationsOnResume[i].payload)
      }
    }
  },

})
