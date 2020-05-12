//
// Module : MMM-Spotify
//

Module.register("MMM-Spotify", {
  defaults: {
    debug: false,
    style: "default", // "default", "mini" available.
    control: "default", //"default", "hidden" available
    updateInterval: 1000,
    allowDevices: [],
    iconify: "https://code.iconify.design/1/1.0.0-rc7/iconify.min.js",
    //iconify: null,
    //When you use this module with `MMM-CalendarExt` or any other `iconify` used modules together, Set this null.

    onStart: null,
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
    r = []
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
    this.disconnected = false
  },

  notificationReceived: function (noti, payload, sender) {
    if (noti === "DOM_OBJECTS_CREATED") {
      this.sendSocketNotification("INIT", this.config)
      //console.log(this.config)
      //this.loadExternalScript(this.config.iconify)
      this.onStart()
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
    }
  },

  socketNotificationReceived: function (noti, payload) {
    switch (noti) {
      case "INITIALIZED":
        break
      case "CURRENT_PLAYBACK":
        this.disconnected = false
        if (
          (this.config.allowDevices.length === 0)
          || (this.config.allowDevices.length >= 1 && this.config.allowDevices.includes(payload.device.name))
        ) {
          this.updateCurrentPlayback(payload)
        } else {
          this.currentPlayback = null
          this.updateDom()
        }
        break
      case "CURRENT_PLAYBACK_FAIL":
        this.updateNoPlayback()
        this.disconnected = true
    }
    if (noti.search("DONE_") > -1) {
      this.sendNotification(noti)
    }
  },

  onStart: function () {
    if (!this.config.onStart) return
    this.sendSocketNotification("ONSTART", this.config.onStart)
  },

  updateNoPlayback: function () {
    var dom = document.getElementById("SPOTIFY")
    dom.classList.add("inactive")
    if (!this.disconnected) this.sendNotification("SPOTIFY_DISCONNECTED")
  },

  updateCurrentPlayback: function (current) {
    if (!current) return
    if (!this.currentPlayback) {
      this.updateSongInfo(current.item)
      this.updatePlaying(current.is_playing)
      this.updateDevice(current.device)
      this.updateShuffle(current.shuffle_state)
      this.updateRepeat(current.repeat_state)
      this.updateProgress(current.progress_ms, current.item.duration_ms)
    } else {
      /** for Ads **/
      if (current.currently_playing_type == "ad") current.is_playing = false
      if (this.currentPlayback.is_playing !== current.is_playing) {
        this.updatePlaying(current.is_playing)
        if (current.currently_playing_type == "ad") this.currentPlayback.is_playing = false
      }
      if (!current.item) return
      if (this.currentPlayback.item.id !== current.item.id) {
        this.updateSongInfo(current.item)
      }
      if (this.currentPlayback.device.id !== current.device.id) {
        this.updateDevice(current.device)
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


  updateProgress: function (
    progressMS,
    durationMS,
    end = document.getElementById("SPOTIFY_PROGRESS_END"),
    curbar = document.getElementById("SPOTIFY_PROGRESS_CURRENT"),
    now = document.getElementById("SPOTIFY_PROGRESS_BAR_NOW")
  ) {
    var pros = (progressMS / durationMS) * 100

    curbar.innerHTML = this.msToTime(progressMS)
    now.style.width = pros + "%"

    if (end.innerHTML != this.msToTime(durationMS)) {
      end.innerHTML = this.msToTime(durationMS)
    }
  },

  updateShuffle: function (shuffleState) {
    if (this.config.control === "hidden") return;

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
    if (this.config.control === "hidden") return;

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

  updateDevice: function (device) {
    const deviceContainer = document.querySelector("#SPOTIFY_DEVICE .text")
    const deviceIcon = document.getElementById("SPOTIFY_DEVICE_ICON")

    deviceContainer.textContent = 'Listening on ' + device.name
    deviceIcon.className = this.getFAIconClass(device.type)

    this.sendNotification("SPOTIFY_UPDATE_DEVICE", device)
  },

  updatePlaying: function (isPlaying) {
    const s = document.getElementById("SPOTIFY")
    s.classList.remove("inactive")

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
        ? "mdi:play-circle-outline"
        : "mdi:pause-circle-outline";

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
    const img_url = playbackItem.album.images[0].url

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

    const album = document.querySelector("#SPOTIFY_ALBUM .text")
    album.textContent = playbackItem.album.name

    const artist = document.querySelector("#SPOTIFY_ARTIST .text")
    const artists = playbackItem.artists
    let artistName = ""

    for (let x = 0; x < artists.length; x++) {
      if (!artistName) {
        artistName = artists[x].name
      } else {
        artistName += ", " + artists[x].name
      }
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

  getFAIcon(iconType) {
    switch (iconType) {
      case 'Title':
        return 'fa fa-music fa-sm';
      case 'Artist':
        return 'fa fa-user fa-sm';
      case 'Album':
        return 'fa fa-folder fa-sm';
      // Device Icons
      case 'Tablet':
        return 'fas fa-tablet fa-sm';
      case 'GameConsole':
        return 'fas fa-gamepad fa-sm';
      case 'AVR':
      case 'STB':
      case 'AudioDongle':
      case 'CastVideo':
      case 'CastAudio':
      case 'Speaker':
        return 'fa fa-headphones fa-sm';
      // check why not working // return 'fab fa-chromecast fa-sm';
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
      "SPOTIFY_CONTROL_SHUFFLE" : {
        icon: 'mdi:shuffle',
        action: () => { this.clickShuffle() },
      },
      "SPOTIFY_CONTROL_BACKWARD": {
        icon: 'mdi:skip-previous',
        action: () => { this.clickBackward() },
      },
      "SPOTIFY_CONTROL_PLAY": {
        icon: 'mdi:play-circle-outline',
        action: () => { this.clickPlay() },
      },
      "SPOTIFY_CONTROL_FORWARD": {
        icon: 'mdi:skip-next',
        action: () => { this.clickForward() },
      },
      "SPOTIFY_CONTROL_REPEAT": {
        icon: 'mdi:repeat-off',
        action: () => { this.clickRepeat() },
      }
    }

    for (const [key, config] of Object.entries(orderedButtonConfig)) {
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

    info.appendChild(this.getDeviceContainer())
    return info;
  },

  getProgressContainer() {
    const progress = this.getHTMLElementWithID('div', "SPOTIFY_PROGRESS")
    const currentTime = this.getHTMLElementWithID('div', "SPOTIFY_PROGRESS_CURRENT")
    currentTime.innerHTML = "--:--"

    const songTime = this.getHTMLElementWithID('div', "SPOTIFY_PROGRESS_END")
    songTime.innerHTML = "--:--"

    const time = this.getHTMLElementWithID('div', "SPOTIFY_PROGRESS_TIME")
    time.appendChild(currentTime)
    time.appendChild(songTime)

    progress.appendChild(time)

    const bar = this.getHTMLElementWithID('div', "SPOTIFY_PROGRESS_BAR")
    bar.appendChild(this.getHTMLElementWithID('div', "SPOTIFY_PROGRESS_BAR_NOW"))

    progress.appendChild(bar)
    return progress;
  },

  getDom: function () {
    const m = this.getHTMLElementWithID('div', "SPOTIFY")
    if (this.config.style !== "default") {
      m.classList.add(this.config.style)
    }
    if (this.config.control !== "default") {
      m.classList.add(this.config.control)
    }

    m.classList.add("noPlayback")
    m.appendChild(this.getHTMLElementWithID('div', "SPOTIFY_BACKGROUND"))

    const cover_img = this.getHTMLElementWithID('img', "SPOTIFY_COVER_IMAGE")
    cover_img.className = 'fade-in'
    cover_img.src = "./modules/MMM-Spotify/resources/spotify-xxl.png"

    const cover = this.getHTMLElementWithID('div', "SPOTIFY_COVER")
    cover.appendChild(cover_img)

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
})
