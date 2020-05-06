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

  updateProgress: function (
    current,
    end = document.getElementById("SPOTIFY_PROGRESS_END"),
    curbar = document.getElementById("SPOTIFY_PROGRESS_CURRENT"),
    now = document.getElementById("SPOTIFY_PROGRESS_BAR_NOW")
  ) {
    var msToTime = (duration) => {
      var ret = ""
      var milliseconds = parseInt((duration % 1000) / 100)
        , seconds = parseInt((duration / 1000) % 60)
        , minutes = parseInt((duration / (1000 * 60)) % 60)
        , hours = parseInt((duration / (1000 * 60 * 60)) % 24)
      if (hours > 0) {
        hours = (hours < 10) ? "0" + hours : hours
        ret = ret + hours + ":"
      }
      minutes = (minutes < 10) ? "0" + minutes : minutes
      seconds = (seconds < 10) ? "0" + seconds : seconds
      return ret + minutes + ":" + seconds
    }
    var songDur = current.item.duration_ms
    var cur = current.progress_ms
    var pros = (cur / songDur) * 100

    end.innerHTML = msToTime(songDur)
    curbar.innerHTML = msToTime(cur)
    now.style.width = pros + "%"
  },

  updateShuffle: function (newPlayback) {
    var shuffle = document.getElementById("SPOTIFY_CONTROL_SHUFFLE")
    var si = document.createElement("span")
    si.className = "iconify"
    si.dataset.icon = "mdi:shuffle"
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
    const p = document.getElementById("SPOTIFY_CONTROL_PLAY")

    if (newPlayback.is_playing) {
      s.classList.add("playing")
      s.classList.remove("pausing")
      s.classList.remove("inactive")
      p.className = "playing"
    } else {
      s.classList.add("pausing")
      s.classList.remove("playing")
      s.classList.remove("inactive")
      p.className = "pausing"
    }

    const icon = newPlayback.is_playing 
      ? "mdi:play-circle-outline" 
      : "mdi:pause-circle-outline";

    p.innerHTML = ""
    p.appendChild(
      this.getIconContainer('iconify', "SPOTIFY_CONTROL_PLAY_ICON", icon),
    )
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
    if (this.currentPlayback.is_playing) {
      this.sendSocketNotification("PAUSE")
    } else {
      this.sendSocketNotification("PLAY")
    }
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
    if (this.currentPlayback.progress_ms < 3000) {
      this.sendSocketNotification("PREVIOUS")
    } else {
      this.sendSocketNotification("REPLAY")
    }
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
    const device = this.getHTMLElementWithID('div', 'SPOTIFY_DEVICE')
    device.appendChild(
      this.getIconContainer(this.getFAIconClass('default'), "SPOTIFY_DEVICE_ICON"),
    )
    device.appendChild(this.getEmptyTextHTMLElement())

    return device;
  },

  getControlsContainer() {
    const control = this.getHTMLElementWithID('div', "SPOTIFY_CONTROL")

    const shuffle = this.getHTMLElementWithID('div', "SPOTIFY_CONTROL_SHUFFLE")
    shuffle.addEventListener("click", () => { this.clickShuffle() })
    shuffle.className = "off"

    shuffle.appendChild(this.getIconContainer('iconify', null, 'mdi:shuffle'))

    const repeat = this.getHTMLElementWithID('div', "SPOTIFY_CONTROL_REPEAT")
    repeat.addEventListener("click", () => { this.clickRepeat() })
    repeat.className = "off"
    repeat.appendChild(this.getIconContainer('iconify', null, 'mdi:repeat-off'))

    const backward = this.getHTMLElementWithID('div', "SPOTIFY_CONTROL_BACKWARD")
    backward.addEventListener("click", () => { this.clickBackward() })

    backward.appendChild(this.getIconContainer('iconify', null, 'mdi:skip-previous'))

    const forward = this.getHTMLElementWithID('div', "SPOTIFY_CONTROL_FORWARD")
    forward.addEventListener("click", () => { this.clickForward() })
    forward.appendChild(this.getIconContainer('iconify', null, 'mdi:skip-next'))

    const play = this.getHTMLElementWithID('div', "SPOTIFY_CONTROL_PLAY")
    play.addEventListener("click", () => { this.clickPlay() })
    play.appendChild(
      this.getIconContainer('iconify', "SPOTIFY_CONTROL_PLAY_ICON", 'mdi:play-circle-outline'),
    )

    control.appendChild(shuffle)
    control.appendChild(backward)
    control.appendChild(play)
    control.appendChild(forward)
    control.appendChild(repeat)

    return control;
  },

  getInfoContainer() {
    const info = this.getHTMLElementWithID('div', "SPOTIFY_INFO")
    const title = this.getHTMLElementWithID('div', "SPOTIFY_TITLE")

    title.appendChild(this.getIconContainer(this.getFAIconClass('Title')))
    title.appendChild(this.getEmptyTextHTMLElement())

    const album = this.getHTMLElementWithID('div', "SPOTIFY_ALBUM")
    album.appendChild(this.getIconContainer(this.getFAIconClass('Album')))
    album.appendChild(this.getEmptyTextHTMLElement())

    const artist = this.getHTMLElementWithID('div', "SPOTIFY_ARTIST")
    artist.appendChild(this.getIconContainer(this.getFAIconClass('Artist')))
    artist.appendChild(this.getEmptyTextHTMLElement())

    info.appendChild(title)
    info.appendChild(album)
    info.appendChild(artist)
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
    var m = this.getHTMLElementWithID('div', "SPOTIFY")

    if (this.config.style !== "default") {
      m.classList.add(this.config.style)
    }

    if (this.config.control !== "default") {
      m.classList.add(this.config.control)
    }

    m.classList.add("noPlayback")
    m.appendChild(this.getHTMLElementWithID('div', "SPOTIFY_BACKGROUND"))

    var fore = this.getHTMLElementWithID('div', "SPOTIFY_FOREGROUND")
    var cover = this.getHTMLElementWithID('div', "SPOTIFY_COVER")
    var cover_img = this.getHTMLElementWithID('img', "SPOTIFY_COVER_IMAGE")

    cover_img.src = "./modules/MMM-Spotify/resources/spotify-xxl.png"
    cover.appendChild(cover_img)

    fore.appendChild(cover)

    var misc = this.getHTMLElementWithID('div', "SPOTIFY_MISC")
    misc.appendChild(this.getInfoContainer())
    misc.appendChild(this.getProgressContainer())
    misc.appendChild(this.getControlsContainer())

    fore.appendChild(misc)

    m.appendChild(fore)
    return m
  },
})
