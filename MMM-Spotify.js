//
// Module : MMM-Spotify
//
Module.register("MMM-Spotify", {
  default: {
    defaultPlayer: "RASPOTIFY",

    updateInterval: 2000,
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
      isChanged = true
    }

    if (isChanged) {
      this.currentPlayback = current
      this.updateDom()
    }
  },

  getDom: function(){
    var m = document.createElement("div")
    m.id = "SPOTIFY"
    if (this.currentPlayback) {
      if (this.currentPlayback.is_playing) {
        m.className = "playing"
      } else {
        m.className = "pausing"
      }
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
    if (this.currentPlayback) {
      cover_img.src = this.currentPlayback.item.album.images[0].url
      back.style.backgroundImage = `url(${this.currentPlayback.item.album.images[0].url})`
    }
    cover.appendChild(cover_img)
    fore.appendChild(cover)

    var info = document.createElement("div")
    info.id = "SPOTIFY_INFO"

    var title = document.createElement("div")
    title.id = "SPOTIFY_TITLE"

    var artist = document.createElement("div")
    artist.id = "SPOTIFY_ARTIST"

    var device = document.createElement("div")
    device.id = "SPOTIFY_DEVICE"

    var progress = document.createElement("div")
    progress_ms = "PROGRESS_BAR"
    
//    var time_ms = this.currentPlayback.progress_ms
    

    if (this.currentPlayback) {
      title.innerHTML = `<i class="fas fa-music"></i>` + " " + this.currentPlayback.item.name
      artist.innerHTML = `<i class="fas fa-user-circle"></i>` + "  " + this.currentPlayback.item.artists[0].name
      device.innerHTML = `<i class="fas fa-volume-up"></i>` + " " + this.currentPlayback.device.name
      progress.innerHTML  = `<i class="fas fa-clock"></i>` + " " +  Math.floor(this.currentPlayback.progress_ms / 60000) + ":" + ((this.currentPlayback.progress_ms % 60000) / 1000).toFixed(0)    }

    info.appendChild(title)
    info.appendChild(artist)
    info.appendChild(device)
    info.appendChild(progress)
    fore.appendChild(info)
    m.appendChild(fore)
    return m
  },
})
