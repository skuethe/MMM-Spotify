//
// Module : MMM-Spotify
//

Module.register("MMM-Spotify", {
  defaults: {
    debug: false,
    style: "default", // "default", "mini" available.
    control: "default", //"default", "hidden" available
    logoMinimalist: "center", // "hidden", "center"
    updateInterval: 1000,
    accountDefault: 0, // default account number, attention : 0 is the first account
    allowDevices: [],
    iconify: "https://code.iconify.design/1/1.0.6/iconify.min.js",
    //iconify: null,
    //When you use this module with `MMM-CalendarExt` or any other `iconify` used modules together, Set this null.

    onStart: null,
    deviceDisplay: "Listening on"
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
    this.disconnected = false
    this.firstLaunch = true
    this.timer = null
    this.ads = false
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
          this.updateCurrentPlayback(payload)
        } else {
          this.currentPlayback = null
          this.updateDom()
        }
        break
      case "CURRENT_NOPLAYBACK":
        this.updatePlayback(false)
        this.disconnected = true
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
    if (!this.disconnected && !status) this.sendNotification("SPOTIFY_DISCONNECTED")
  },

  updateCurrentPlayback: function (current) {
    if (!current) return
    if (!this.currentPlayback) {
      this.updateSongInfo(current.item)
      this.updatePlaying(current.is_playing)
      this.updateDevice(current.device)
      if (current.device) this.updateVolume(current.device.volume_percent)
      this.updateShuffle(current.shuffle_state)
      this.updateRepeat(current.repeat_state)
      if (current.is_playing && current.item) this.updateProgress(current.progress_ms, current.item.duration_ms)
      this.updatePlayback(current.is_playing)
    } else {
      if (this.disconnected && current.currently_playing_type) {
        this.sendNotification("SPOTIFY_CONNECTED")
        this.disconnected = false
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
      // prevent crash for device change
      if (current.item && this.currentPlayback.item &&
        (this.currentPlayback.item.id !== current.item.id)) {
          this.updateSongInfo(current.item)
      }
      if (current.device && this.currentPlayback.device &&
        (this.currentPlayback.device.id !== current.device.id)) {
          this.updateDevice(current.device)
      }
      if (current.device && this.currentPlayback.device &&
        (this.currentPlayback.device.volume_percent !== current.device.volume_percent)) {
          this.updateVolume(current.device.volume_percent)
      }
      if (this.currentPlayback.repeat_state !== current.repeat_state) {
        this.updateRepeat(current.repeat_state)
      }
      if (this.currentPlayback.shuffle_state !== current.shuffle_state) {
        this.updateShuffle(current.shuffle_state)
      }
      if (current.progress_ms && current.item && current.item.duration_ms && 
        (this.currentPlayback.progress_ms !== current.progress_ms)) {
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
  ) {
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

  updateDevice: function (device) {
    const deviceContainer = document.querySelector("#SPOTIFY_DEVICE .text")
    const deviceIcon = document.getElementById("SPOTIFY_DEVICE_ICON")

    deviceContainer.textContent = (this.config.style == "default" && !this.enableMiniBar) ? this.config.deviceDisplay + ' ' + device.name : device.name
    deviceIcon.className = this.getFAIconClass(device.type)

    this.sendNotification("SPOTIFY_UPDATE_DEVICE", device)
  },

  updateVolume: function (volume_percent) {
    if (!this.enableMiniBar) return
    const volumeContainer = document.querySelector("#SPOTIFY_VOLUME .text")
    const volumeIcon = document.getElementById("SPOTIFY_VOLUME_ICON")

    volumeContainer.textContent = volume_percent + "%"
    volumeIcon.className = this.getVolumeIconClass(volume_percent)

    this.sendNotification("SPOTIFY_UPDATE_VOLUME", volume_percent)
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

    if (this.config.control !== "hidden" || this.enableMiniBar) {
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
    let img_index = 0
    // cover data is stored in 3 sizes. let's fetch the appropriate size to reduce 
    // bandwidth usage bsed on player style
    if (this.config.style !== "default") {
      img_index = this.enbaleMiniBar ? 2 : 1
    }
    const img_url = playbackItem.album.images[img_index].url

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
    album.textContent = this.enableMiniBar ? "- " + playbackItem.album.name + " -": playbackItem.album.name

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
      case 'Spotify':
        return 'fab fa-spotify fa-sm';
      case 'Title':
        return 'fa fa-music fa-sm';
      case 'Artist':
        return 'fa fa-user fa-sm';
      case 'Album':
        return 'fa fa-folder fa-sm';
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

    if (this.config.style === 'default' && !this.enableMiniBar) {
      const currentTime = this.getHTMLElementWithID('div', "SPOTIFY_PROGRESS_CURRENT")
      currentTime.innerText = "--:--"

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

  getMinimalistBarDom: function (container) {
    container.appendChild(this.getProgressContainer())

    const misc = this.getHTMLElementWithID('div', "SPOTIFY_MISC")
    misc.appendChild(this.getHTMLElementWithID('div', "SPOTIFY_BACKGROUND"))
    misc.appendChild(this.getDeviceContainer())

    const info = this.getHTMLElementWithID('div', "SPOTIFY_INFO")
    info.className = 'marquee';

    const infoElements = [
      "SPOTIFY_TITLE",
      "SPOTIFY_ALBUM",
      "SPOTIFY_ARTIST",
    ]

    infoElements.forEach(key => {
      const element = this.getHTMLElementWithID('div', key)
      element.appendChild(this.getEmptyTextHTMLElement())
      info.appendChild(element)
    })

    misc.appendChild(info)

    const infoFooter = this.getHTMLElementWithID('div', "SPOTIFY_INFO_FOOTER")
    infoFooter.appendChild(this.getVolumeContainer())

    if (this.config.logoMinimalist === "center") {
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
    foreground.appendChild(
      this.getControlButton(
        "SPOTIFY_CONTROL_PLAY",
        'mdi:play-circle-outline', () => { this.clickPlay() },
      ),
    )

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
      m.classList.add("inactive")
      return this.getMinimalistBarDom(m)
    }

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
  scanConfig: function () {
    this.enableMiniBar = false
    this.myPosition = null
    let myConfig = config.modules.find( name => {
      if (name.module == 'MMM-Spotify') return name
    })
    this.myPosition = myConfig.position
    if (this.myPosition == "bottom_bar" || this.myPosition == "top_bar") this.enableMiniBar = true
  }
})
