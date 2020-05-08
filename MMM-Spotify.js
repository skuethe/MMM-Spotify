//
// Module : MMM-Spotify
//

Module.register("MMM-Spotify", {
  defaults: {
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
    this.conected = false
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
        this.conected = true
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
        if (this.conected) this.sendNotification("SPOTIFY_DISCONNECTED")
        this.conected = false
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
  },

  updateCurrentPlayback: function (current) {
    if (!current) return
    if (!this.currentPlayback) {
      this.updateSongInfo(current)
      this.updatePlaying(current)
      this.updateDevice(current)
      this.updateShuffle(current)
      this.updateRepeat(current)
      this.updateProgress(current)
    } else {
      if (this.currentPlayback.is_playing !== current.is_playing) {
        this.updateSongInfo(current)
        this.updatePlaying(current)
      }
      if (this.currentPlayback.item.id !== current.item.id) {
        this.updateSongInfo(current)
      }
      if (this.currentPlayback.device.id !== current.device.id) {
        this.updateDevice(current)
      }
      if (this.currentPlayback.repeat_state !== current.repeat_state) {
        this.updateRepeat(current)
      }
      if (this.currentPlayback.shuffle_state !== current.shuffle_state) {
        this.updateShuffle(current)
      }
      if (this.currentPlayback.progress_ms !== current.progress_ms) {
        this.updateProgress(current)
      }
    }

    this.currentPlayback = current
  },

  msToTime(duration){
    var ret = ""
    var seconds = parseInt((duration / 1000) % 60)
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
    current,
    end = document.getElementById("SPOTIFY_PROGRESS_END"),
    curbar = document.getElementById("SPOTIFY_PROGRESS_CURRENT"),
    now = document.getElementById("SPOTIFY_PROGRESS_BAR_NOW")
  ) {
    var songDur = current.item.duration_ms
    var cur = current.progress_ms
    var pros = (cur / songDur) * 100

    end.innerHTML = this.msToTime(songDur)
    curbar.innerHTML = this.msToTime(cur)
    now.style.width = pros + "%"
  },

  updateShuffle: function (newPlayback) {
    if (this.config.control === "hidden") return;

    var shuffle = document.getElementById("SPOTIFY_CONTROL_SHUFFLE")
    var si = document.createElement("span")
    si.className = "iconify"
    if (newPlayback.shuffle_state) {
      shuffle.className = "on"
      si.dataset.icon = "mdi:shuffle"
    } else {
      shuffle.className = "off"
      si.dataset.icon = "mdi:shuffle-disabled"
    }
    shuffle.innerHTML = ""
    shuffle.appendChild(si)
  },

  updateRepeat: function (newPlayback) {
    if (this.config.control === "hidden") return;

    var repeat = document.getElementById("SPOTIFY_CONTROL_REPEAT")
    var ri = document.createElement("span")
    ri.className = "iconify"
    ri.dataset.inline = "false"
    repeat.className = newPlayback.repeat_state
    const ris = {
      "off": "mdi:repeat-off",
      "track": "mdi:repeat-once",
      "context": "mdi:repeat"
    }
    ri.dataset.icon = ris[newPlayback.repeat_state]
    repeat.innerHTML = ""
    repeat.appendChild(ri)
  },

  updateDevice: function (newPlayback) {
    var device = document.querySelector("#SPOTIFY_DEVICE .text")
    var deviceIcon = document.getElementById("SPOTIFY_DEVICE_ICON")

    device.textContent = 'Listening on ' + newPlayback.device.name
    deviceIcon.className = this.getFAIconClass(newPlayback.device.type)

    this.sendNotification("SPOTIFY_UPDATE_DEVICE", newPlayback.device)
  },

  updatePlaying: function (newPlayback) {
    const s = document.getElementById("SPOTIFY")
    s.classList.remove("inactive")

    if (newPlayback.is_playing) {
      s.classList.add("playing")
      s.classList.remove("pausing")
    } else {
      s.classList.add("pausing")
      s.classList.remove("playing")
    }

    if (this.config.control !== "hidden") {
      const p = document.getElementById("SPOTIFY_CONTROL_PLAY")
      p.className = newPlayback.is_playing ? "playing" : "pausing"
      const icon = newPlayback.is_playing
        ? "mdi:play-circle-outline"
        : "mdi:pause-circle-outline";

      p.innerHTML = ""
      p.appendChild(
        this.getIconContainer('iconify', "SPOTIFY_CONTROL_PLAY_ICON", icon),
      )
    }

    this.sendNotification("SPOTIFY_UPDATE_PLAYING", newPlayback.is_playing)
  },

  updateSongInfo: function (newPlayback) {
    if (!newPlayback) return
    if (!newPlayback.item) return

    var sDom = document.getElementById("SPOTIFY")
    sDom.classList.remove("noPlayback")

    var cover_img = document.getElementById("SPOTIFY_COVER_IMAGE")
    cover_img.src = newPlayback.item.album.images[0].url

    var back = document.getElementById("SPOTIFY_BACKGROUND")
    back.style.backgroundImage = `url(${newPlayback.item.album.images[0].url})`

    var title = document.querySelector("#SPOTIFY_TITLE .text")
    title.textContent = newPlayback.item.name

    var album = document.querySelector("#SPOTIFY_ALBUM .text")
    album.textContent = newPlayback.item.album.name

    var artist = document.querySelector("#SPOTIFY_ARTIST .text")
    var artists = newPlayback.item.artists
    var artistName = ""

    for (var x = 0; x < artists.length; x++) {
      if (!artistName) {
        artistName = artists[x].name
      } else {
        artistName += ", " + artists[x].name
      }
    }
    artist.textContent = artistName
    this.sendNotification("SPOTIFY_UPDATE_SONG_INFO", newPlayback.item)
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
      case 'Speaker':
        return 'fa fa-headphones fa-sm';
      case 'Smartphone':
        return 'fas fa-mobile fa-sm';
      case 'TV':
        return 'fas fa-tv fa-sm';
      default:
        return 'fa fa-desktop fa-sm';
    }
  },

  getFAIconClass(iconType) {
    return 'iconify ' + this.getFAIcon(iconType);
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
    button.appendChild(this.getIconContainer('iconify', null, icon))

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
