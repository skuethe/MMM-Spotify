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
      if (code !== 200) {
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

    if (noti == "SEARCH_AND_PLAY") {
      this.searchAndPlay(payload.query, payload.condition)
    }
  },

  searchAndPlay: function(param, condition) {
    console.log(param, condition)
    var pickup = (items, random, retType)=>{
      var ret = {}
      var r = null
      r = (random) ? items[Math.floor(Math.random() * items.length)] : items[0]
      ret[retType] = (retType == "uris") ? [r.uri] : r.uri
      return ret
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
            if (result[section]) {
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
          // nothing found
          this.sendSocketNotification("DONE_SEARCH_NOTHING")
        }
      } else { //when fail
        console.log(code, error, result)
        this.sendSocketNotification("DONE_SEARCH_ERROR")
      }
    })
  }
})
