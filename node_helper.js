//
// Module : MMM-Spotify
//

"use strict"
const fs = require("fs")
const path = require("path")
const Spotify = require("./Spotify.js")

var NodeHelper = require("node_helper")

module.exports = NodeHelper.create({
  start: function() {
    this.config = null
    this.spotifyConfig = null
    this.spotify = null
    var file = path.resolve(__dirname, "spotify.config.json")
    if (fs.existsSync(file)) {
      this.spotifyConfig = JSON.parse(fs.readFileSync(file))
      this.spotify = new Spotify(this.spotifyConfig)
    }
  },

  initAfterLoading: function(config) {
    this.config = config
    this.updatePulse()
  },

  updatePulse: function() {
    this.spotify.getCurrentPlayback((code, error, result) => {
      if (code !== 200 || typeof result == "undefined") {
        this.sendSocketNotification("CURRENT_PLAYBACK_FAIL", null)
      } else {
        this.sendSocketNotification("CURRENT_PLAYBACK", result)
      }
    })
    setTimeout(()=>{
      this.updatePulse()
    }, this.config.updateInterval)
  },

  socketNotificationReceived: function(noti, payload) {
    if (noti == "INIT") {
      this.initAfterLoading(payload)
      this.sendSocketNotification("INITIALIZED")
    }

    if (noti == "ONSTART") {
      payload.position_ms = 0
      if (payload.search) {
        var param = {
          q: payload.search.keyword,
          type: payload.search.type,
        }
        var condition = {
          random: payload.search.random,
          autoplay: true,
        }
        this.searchAndPlay(param, condition)

      } else if (payload.spotifyUri.match("track")) {
        this.spotify.play({uris:[payload.spotifyUri]})
      } else if (payload.spotifyUri) {
        this.spotify.play({context_uri:payload.spotifyUri})
      }
      if (payload.deviceName) this.spotify.transferByName(payload.deviceName)
    }

    if (noti == "GET_DEVICES") {
      this.spotify.getDevices((code, error, result)=>{
        this.sendSocketNotification("LIST_DEVICES", result)
      })
    }

    if (noti == "PLAY") {
      this.spotify.play(payload, (code, error, result)=>{
        if (code !== 204) {
          console.log(error)
          return
        }
        this.sendSocketNotification("DONE_PLAY", result)
      })
    }

    if (noti == "PAUSE") {
      this.spotify.pause((code, error, result)=>{
        this.sendSocketNotification("DONE_PAUSE", result)
      })
    }

    if (noti == "NEXT") {
      this.spotify.next((code, error, result)=>{
        this.sendSocketNotification("DONE_NEXT", result)
      })
    }

    if (noti == "PREVIOUS") {
      this.spotify.previous((code, error, result)=>{
        this.sendSocketNotification("DONE_PREVIOUS", result)
      })
    }

    if (noti == "VOLUME") {
      this.spotify.volume(payload, (code, error, result)=>{
        this.sendSocketNotification("DONE_VOLUME", result)
      })
    }

    if (noti == "SEARCH_AND_PLAY") {
      this.searchAndPlay(payload.query, payload.condition)
    }

    if (noti == "TRANSFER") {
      this.spotify.transferByName(payload, (code, error, result)=>{
        this.sendSocketNotification("DONE_TRANSFER", result)
      })
    }

    if (noti == "REPEAT") {
      this.spotify.repeat(payload, (code, error, result) => {
        this.sendSocketNotification("DONE_REPEAT", result)
      })
    }

    if (noti == "SHUFFLE") {
      this.spotify.shuffle(payload, (code, error, result) => {
        this.sendSocketNotification("DONE_SHUFFLE", result)
      })
    }

    if (noti == "REPLAY") {
      this.spotify.replay((code, error, result) => {
        this.sendSocketNotification("DONE_REPLAY", result)
      })
    }
  },

  searchAndPlay: function(param, condition) {
    if (!param.type) {
      param.type = "artist,track,album,playlist"
    } else {
      param.type = param.type.replace(/\s/g,'')
    }
    if (!param.q) {
      param.q = "something cool"
    }

    var pickup = (items, random, retType)=>{
      var ret = {}
      var r = null
      r = (random) ? items[Math.floor(Math.random() * items.length)] : items[0]
      if (r.uri) {
        ret[retType] = (retType == "uris") ? [r.uri] : r.uri
        return ret
      } else {
        console.log("[SPOTIFY] Unplayable item: ", r)
        return false
      }
    }
    this.spotify.search(param, (code, error, result)=>{
      //console.log(code, error, result)
      var foundForPlay = null
      if (code == 200) { //When success
        const map = {
          "tracks" : "uris",
          "artists" : "context_uri",
          "albums" : "context_uri",
          "playlists" : "context_uri"
        }
        //console.log(result)
        for (var section in map) {
          if (map.hasOwnProperty(section) && !foundForPlay) {
            var retType = map[section]
            if (result[section] && result[section].items.length > 1) {
              foundForPlay = pickup(result[section].items, condition.random, retType)
            }
          }
        }
        //console.log(foundForPlay)
        if (foundForPlay && condition.autoplay) {
          this.spotify.play(foundForPlay, (code, error, result)=>{
            if (code !== 204) {
              return
            }
            this.sendSocketNotification("DONE_SEARCH_AUTOPLAY", result)
          })
        } else {
          // nothing found or not play.
          this.sendSocketNotification("DONE_SEARCH_NOTHING")
        }
      } else { //when fail
        console.log(code, error, result)
        this.sendSocketNotification("DONE_SEARCH_ERROR")
      }
    })
  }
})
