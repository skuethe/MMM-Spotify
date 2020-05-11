//
// Module : MMM-Spotify
//

"use strict"
const fs = require("fs")
const path = require("path")
const Spotify = require("./Spotify.js")

var NodeHelper = require("node_helper")

let updateOldSingleSpotifyConfigurationToNewMultipleSpotifyConfiguration = function (configuration) {
    if (Array.isArray(configuration)) {
        // not update required
        return configuration;
    }

    return [configuration];
};

module.exports = NodeHelper.create({
    start: function () {
        this.config = null; // Configuration come from MM config file.
        this.spotifyConfigurations = []; // Configuration from spotify.config.json file.
        this.spotify = null;
        this.spotifies = [];
        let file = path.resolve(__dirname, "spotify.config.json");
        if (fs.existsSync(file)) {
            let parsedConfigurations = JSON.parse(fs.readFileSync(file));
            this.spotifyConfigurations = updateOldSingleSpotifyConfigurationToNewMultipleSpotifyConfiguration(parsedConfigurations);
            this.spotifyConfigurations.forEach(configuration => {
                this.spotifies.push(new Spotify(configuration));
            });
        }
    },

    initAfterLoading: function (config) {
        this.config = config
        // this.updatePulse()
        this.findCurrentSpotify().then(r => {
            //console.log('[MMM-Spotify] Starting');
        });
    },

    findCurrentSpotify: async function () {
        let playing = false;
        for (const spotify of this.spotifies) {
            try {
                let result = await this.updateSpotify(spotify);
                this.spotify = spotify;
                playing = true;
                this.sendSocketNotification("CURRENT_PLAYBACK", result);
            } catch (e) {
                // console.log('This spotify is not playing:', spotify.config.USERNAME)
            }
        }
        if (!playing) {
            this.sendSocketNotification("CURRENT_PLAYBACK_FAIL", null);
            setTimeout(() => {
                this.findCurrentSpotify();
            }, this.config.updateInterval);
        } else {
            this.updatePulse();
        }
    },

    updateSpotify: function (spotify) {
        return new Promise((resolve, reject) => {
            spotify.getCurrentPlayback((code, error, result) => {
                if (code !== 200 || typeof result === "undefined") {
                    reject();
                } else {
                    resolve(result);
                }
            });
        });
    },

    updatePulse: function () {
        this.spotify.getCurrentPlayback((code, error, result) => {
            if (code !== 200 || typeof result == "undefined") {
                this.sendSocketNotification("CURRENT_PLAYBACK_FAIL", null);
                this.spotify = null;
                this.findCurrentSpotify();
            } else {
                this.sendSocketNotification("CURRENT_PLAYBACK", result);
                setTimeout(() => {
                    this.updatePulse()
                }, this.config.updateInterval)
            }
        })
    },

    socketNotificationReceived: function (noti, payload) {
        if (noti == "INIT") {
            this.initAfterLoading(payload)
            this.sendSocketNotification("INITIALIZED")
            return
        }

        if(this.spotify){
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
                    this.spotify.play({uris: [payload.spotifyUri]})
                } else if (payload.spotifyUri) {
                    this.spotify.play({context_uri: payload.spotifyUri})
                }
                if (payload.deviceName) this.spotify.transferByName(payload.deviceName)
                return
            }
            
            const allControlNotifications = {
                "GET_DEVICES": "LIST_DEVICES",
                "PAUSE": "DONE_PAUSE",
                "NEXT": "DONE_NEXT",
                "PREVIOUS": "DONE_PREVIOUS",
                "VOLUME": "DONE_VOLUME",
                "TRANSFER": "DONE_TRANSFER",
                "REPEAT": "DONE_REPEAT",
                "SHUFFLE": "DONE_SHUFFLE",
                "REPLAY": "DONE_REPLAY",
            };

            if (Object.keys(allControlNotifications).includes(noti)) {
                this.spotify.pause((code, error, result) => {
                    if ((code !== 204) && (code !== 202)){
                        //console.log(error)
                    }
                    this.sendSocketNotification(allControlNotifications[noti], result)
                    return
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
                console.log(code, error, result)
                this.sendSocketNotification("DONE_SEARCH_ERROR")
            }
        })
    }
})
