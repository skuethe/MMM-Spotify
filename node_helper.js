//
// Module : MMM-Spotify
//

"use strict"
const fs = require("fs")
const path = require("path")
const Spotify = require("./Spotify.js")

var NodeHelper = require("node_helper")

module.exports = NodeHelper.create({
  start: function () {
    this.config = null
    this.spotifyConfig = null
    this.spotify = null
    this.timer = null
    this.firstStart = true
    this.unallowedDevice = false
    this.suspended = false
  },

  doSpotifyConfig: function (configuration, account) {
    if (!isNaN(account) && Array.isArray(configuration)) {
      this.sendSocketNotification("CURRENT_ACCOUNT", account)
      return configuration[account] // only wanted account or first
    }
    if (Array.isArray(configuration)) {
      let found
      configuration.forEach((jsAccount,number) => {
        if (jsAccount.USERNAME == account) found = number
      })
      if (typeof found === "undefined") found = 0
      this.sendSocketNotification("CURRENT_ACCOUNT", found)
      return configuration[found]
    }
    // not update required not an array (single account)
    return configuration
  },

  initAfterLoading: function (config, account) {
    this.suspended = false
    this.config = config
    if (!account) {
      account = this.config.accountDefault
      console.log("[SPOTIFY] MMM-Spotify Version:",  require('./package.json').version)
    }
    let file = path.resolve(__dirname, "spotify.config.json")
    if (fs.existsSync(file)) {
      try {
        this.spotifyConfig = this.doSpotifyConfig(JSON.parse(fs.readFileSync(file)), account)
      } catch (e) {
        return console.log("[SPOTIFY] ERROR: spotify.config.json", e.name)
      }
      if (!this.spotifyConfig) return console.log("[SPOTIFY] ERROR: Account not found")
      this.spotify = new Spotify(this.spotifyConfig, this.config.debug)
    }
    else return console.log("[SPOTIFY] ERROR: spotify.config.json file missing !")
    this.updatePulse().then(() => {
      if (this.config.debug) console.log("[SPOTIFY] Started with Account:", (this.spotify.config.USERNAME ? this.spotify.config.USERNAME : "default"))
      if (this.firstStart && this.config.onStart) this.onStart()
      this.firstStart = false
    })
  },

  updatePulse: async function () {
    let idle = false
    if (!this.spotify) return console.log("[SPOTIFY] updatePulse ERROR: Account not found")
    try {
      let result = await this.updateSpotify(this.spotify)
      this.sendSocketNotification("CURRENT_PLAYBACK", result)
      if (this.unallowedDevice) idle = true
    } catch (e) {
      idle = true
      this.sendSocketNotification("CURRENT_NOPLAYBACK")
    }
    // Only re-run if moudle is NOT suspended
    // This breaks multi module instances, but saves performance and power consumption, so we reduce heat
    if (!this.suspended) {
      this.timer = setTimeout(() => {
        this.updatePulse()
      }, idle ? this.config.idleInterval : this.config.updateInterval)
    }
  },

  updateSpotify: function (spotify) {
    return new Promise((resolve, reject) => {
      spotify.getCurrentPlayback((code, error, result) => {
        if (result === "undefined" || code !== 200) {
          reject();
        } else {
          resolve(result);
        }
      })
    })
  },

  onStart: function () {
    let onStart = this.config.onStart
    if (onStart.deviceName) this.spotify.transferByName(onStart.deviceName)
    setTimeout(() => {
      onStart.position_ms = 0
      if (onStart.search) {
        var param = {
          q: onStart.search.keyword,
          type: onStart.search.type,
        }
        var condition = {
          random: onStart.search.random,
          autoplay: true,
        }
        this.searchAndPlay(param, condition)
      } else if (onStart.spotifyUri.match("track")) {
        this.spotify.play({uris: [onStart.spotifyUri]})
      } else if (onStart.spotifyUri) {
        this.spotify.play({context_uri: onStart.spotifyUri})
      }
    }, 5000)
  },

  account: function(account) {
    this.sendSocketNotification("CURRENT_NOPLAYBACK")
    clearTimeout(this.timer)
    this.timer= null
    this.spotifyConfig = null
    this.spotify = null
    this.initAfterLoading(this.config, account)
  },

  getAccounts: function(cb) {
    let file = path.resolve(__dirname, "spotify.config.json")
    if (fs.existsSync(file)) {
      try {
        let result = []
        let configuration = JSON.parse(fs.readFileSync(file))
        if (Array.isArray(configuration)) {
          configuration.forEach((jsAccount,number) => {
            let accountEntry = { "name": jsAccount.USERNAME, "id": number }
            result.push(accountEntry)
          })
          if (typeof result !== "undefined" && result.length > 0) cb(result)
        }
      } catch (e) {
        return console.log("[SPOTIFY] ERROR fetching accounts from spotify.config.json", e.name)
      }
    }
  },

  socketNotificationReceived: function (noti, payload) {
    if (noti == "INIT") {
      this.initAfterLoading(payload)
      this.sendSocketNotification("INITIALIZED")
      return
    }
    if (noti == "ACCOUNT") {
      this.account(payload)
    }
    if (noti == "GET_ACCOUNTS") {
      this.getAccounts((result) => {
        this.sendSocketNotification("LIST_ACCOUNTS", result)
      })
    }
    if (noti == "UNALLOWED_DEVICE") {
      this.unallowedDevice = payload
    }
    if (noti == "SUSPENDING") {
      this.suspended = true
    }
    if(this.spotify && !this.unallowedDevice){
      if (noti == "GET_DEVICES") {
        this.spotify.getDevices((code, error, result) => {
          this.sendSocketNotification("LIST_DEVICES", result)
        })
      }
      if (noti == "PLAY") {
        this.spotify.play(payload, (code, error, result) => {
          if ((code !== 204) && (code !== 202)) {
            //console.log(error)
            return
          }
          this.sendSocketNotification("DONE_PLAY", result)
        })
      }
      if (noti == "PAUSE") {
        this.spotify.pause((code, error, result) => {
          this.sendSocketNotification("DONE_PAUSE", result)
        })
      }
      if (noti == "NEXT") {
        this.spotify.next((code, error, result) => {
          this.sendSocketNotification("DONE_NEXT", result)
        })
      }
      if (noti == "PREVIOUS") {
        this.spotify.previous((code, error, result) => {
          this.sendSocketNotification("DONE_PREVIOUS", result)
        })
      }
      if (noti == "VOLUME") {
        this.spotify.volume(payload, (code, error, result) => {
          this.sendSocketNotification("DONE_VOLUME", result)
        })
      }
      if (noti == "TRANSFER") {
        this.spotify.transferByName(payload, (code, error, result) => {
          this.sendSocketNotification("DONE_TRANSFER", result)
        })
      }
      if (noti == "TRANSFERBYID") {
        this.spotify.transfer(payload, (code, error, result) => {
          this.sendSocketNotification("DONE_TRANSFERBYID", result)
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
    }
    if (noti == "SEARCH_AND_PLAY") {
      this.searchAndPlay(payload.query, payload.condition)
      return
    }
  },

  searchAndPlay: function (param, condition) {
    if (!param.type) {
      param.type = "artist,track,album,playlist"
    } else {
      param.type = param.type.replace(/\s/g, '')
    }
    if (!param.q) {
      param.q = "something cool"
    }
    var pickup = (items, random, retType) => {
      var ret = {}
      var r = (random)
        ? items[Math.floor(Math.random() * items.length)]
        : items[0]
        if (r.uri) {
          ret[retType] = (retType == "uris") ? [r.uri] : r.uri
          return ret
        } else {
          console.log("[SPOTIFY] Unplayable item: ", r)
          return false
      }
    }
    this.spotify.search(param, (code, error, result) => {
      //console.log(code, error, result)
      var foundForPlay = null
      if (code == 200) { //When success
        const map = {
          "tracks": "uris",
          "artists": "context_uri",
          "albums": "context_uri",
          "playlists": "context_uri"
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
          this.spotify.play(foundForPlay, (code, error, result) => {
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
        //console.log(code, error, result)
        this.sendSocketNotification("DONE_SEARCH_ERROR")
      }
    })
  }
})
