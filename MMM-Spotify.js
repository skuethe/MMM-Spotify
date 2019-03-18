//
// Module : MMM-Spotify
//
Module.register("MMM-Spotify", {
  default: {
    style: "default", // "default", "mini" available.
    updateInterval: 1000,
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

  getStyles: function() {
    return ["MMM-Spotify.css", "font-awesome5.css"]
  },

  start: function() {
    this.currentPlayback = null
  },

  notificationReceived: function(noti, payload, sender) {
    if (noti == "DOM_OBJECTS_CREATED") {
      this.sendSocketNotification("INIT", this.config)
      this.onStart()
    }
    switch(noti) {
      case "SPOTIFY_SEARCH":
        var pl = {
          query: {
            q:"michael+jackson",
            type:"artist",
          },
          condition: {
            random:false,
            autoplay:true,
          }
        }
        this.sendSocketNotification("SEARCH_AND_PLAY", pl)
        break
      case "SPOTIFY_PLAY":
        var pl = {context_uri:"spotify:playlist:37i9dQZF1DX9EM98aZosoy"}
        this.sendSocketNotification("PLAY", pl)
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
        var pl = 50
        this.sendSocketNotification("VOLUME", pl)
        break
    }
  },

  socketNotificationReceived: function(noti, payload) {
    switch(noti) {
      case "INITIALIZED":
        break
      case "CURRENT_PLAYBACK":
        this.updateCurrentPlayback(payload)
        break
    }
  },

  onStart: function() {
    if (!this.config.onStart) return
    this.sendSocketNotification("ONSTART", this.config.onStart)
  },

  updateProgress: function(
    current,
    end = document.getElementById("SPOTIFY_PROGRESS_END"),
    curbar = document.getElementById("SPOTIFY_PROGRESS_CURRENT"),
    now = document.getElementById("SPOTIFY_PROGRESS_BAR_NOW")
  ) {
    var msToTime = (duration) => {
      var ret = ""
      var milliseconds = parseInt((duration%1000)/100)
        , seconds = parseInt((duration/1000)%60)
        , minutes = parseInt((duration/(1000*60))%60)
        , hours = parseInt((duration/(1000*60*60))%24)
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

  updateCurrentPlayback: function(current) {
    if (!current) return
    var isChanged = false
    if (!this.currentPlayback) {
      isChanged = true
    } else if (this.currentPlayback.is_playing !== current.is_playing) {
      isChanged = true
    } else if (this.currentPlayback.item.id !== current.item.id) {
      isChanged = true
    } else if (this.currentPlayback.device.id !== current.device.id) {
      isChanged = true
    } else if (this.currentPlayback.progress_ms !== current.progress_ms)  {
      //isChanged = true  //It would make too many updateDom.
      //It's better to manipulate Dom directly
      this.currentPlayback = current
      this.updateProgress(current)
    }

    if (isChanged) {
      this.currentPlayback = current
      this.updateDom()
    }
  },

  getDom: function(){
    var m = document.createElement("div")
    m.id = "SPOTIFY"
    if (this.config.style !== "default") {
      m.classList.add(this.config.style)
    }

    var back = document.createElement("div")
    back.id = "SPOTIFY_BACKGROUND"
    m.appendChild(back)

    var fore = document.createElement("div")
    fore.id = "SPOTIFY_FOREGROUND"

    var cover = document.createElement("div")
    cover.id = "SPOTIFY_COVER"

    var cover_img = document.createElement("img")
    cover_img.id = "SPOTIFY_COVER_IMAGE"
    cover_img.src = "./modules/MMM-Spotify/resources/spotify-xxl.png"
    cover.appendChild(cover_img)
    fore.appendChild(cover)

    if (this.currentPlayback) {
      var info = document.createElement("div")
      info.id = "SPOTIFY_INFO"

      var title = document.createElement("div")
      title.id = "SPOTIFY_TITLE"

      var artist = document.createElement("div")
      artist.id = "SPOTIFY_ARTIST"

      var device = document.createElement("div")
      device.id = "SPOTIFY_DEVICE"

      var progress = document.createElement("div")
      progress.id = "SPOTIFY_PROGRESS"
      var currentTime = document.createElement("div")
      currentTime.id = "SPOTIFY_PROGRESS_CURRENT"
      currentTime.innerHTML = "--:--"
      var songTime = document.createElement("div")
      songTime.id = "SPOTIFY_PROGRESS_END"
      songTime.innerHTML = "--:--"
      var time = document.createElement("div")
      time.id = "SPOTIFY_PROGRESS_TIME"
      time.appendChild(currentTime)
      time.appendChild(songTime)
      progress.appendChild(time)
      var bar = document.createElement("div")
      bar.id = "SPOTIFY_PROGRESS_BAR"
      var barNow = document.createElement("div")
      barNow.id = "SPOTIFY_PROGRESS_BAR_NOW"
      bar.appendChild(barNow)
      progress.appendChild(bar)

      this.updateProgress(this.currentPlayback, songTime, currentTime, barNow)

      if (this.currentPlayback.is_playing) {
        m.classList.add("playing")
        m.classList.remove("pausing")
      } else {
        m.classList.add("pausing")
        m.classList.remove("playing")
      }
      if (this.currentPlayback.item) {
        cover_img.src = this.currentPlayback.item.album.images[0].url
        back.style.backgroundImage = `url(${this.currentPlayback.item.album.images[0].url})`
        //progress.innerHTML  = `<i class="fas fa-clock"></i>` + " " +  Math.floor(this.currentPlayback.progress_ms / 60000) + ":" + (((this.currentPlayback.progress_ms % 60000) / 1000).toFixed(0)-1) + " / " + Math.floor(this.currentPlayback.item.duration_ms / 60000) + ":" + (((this.currentPlayback.item.duration_ms % 60000) / 1000).toFixed(0)-1)  }
        title.innerHTML = `<i class="fas fa-music"></i>` + " " + this.currentPlayback.item.name
        var artists = this.currentPlayback.item.artists
        var artistName = ""
        for (var x = 0; x < artists.length; x++) {
          if (!artistName) {
            artistName = artists[x].name
          } else {
            artistName += ", " + artists[x].name
          }
        }
        artist.innerHTML = `<i class="fas fa-user-circle"></i>` + "  " + artistName
      }
      device.innerHTML = `<i class="fas fa-volume-up"></i>` + " " + this.currentPlayback.device.name

      info.appendChild(progress)
      info.appendChild(title)
      info.appendChild(artist)
      info.appendChild(device)
      fore.appendChild(info)
    }

    m.appendChild(fore)
    return m
  },
})
