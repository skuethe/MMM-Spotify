//
// Module : MMM-Spotify
// Developer : Seongnoh Sean Yi (eouia0819@gmail.com)
//


const fs = require("fs")
const path = require("path")
const request = require("request")
const querystring = require("querystring")
const opn = require("open")
const express = require("express")
const app = express()


class Spotify {
  constructor (config = null) {
    if (config == null) {
      config = {
        "CLIENT_ID" : "",
        "CLIENT_SECRET" : "",
        "AUTH_DOMAIN" : "http://localhost",
        "AUTH_PATH" : "/callback",
        "AUTH_PORT" : "8888",
        "SCOPE" : "user-read-private app-remote-control playlist-read-private streaming user-read-playback-state user-modify-playback-state",
        "TOKEN" : "./token.json",
      }
    }
    this.redirect_uri = null
    this.token = null
    this.state = ""
    this.config = config

    var redirect_uri = this.config.AUTH_DOMAIN
    redirect_uri += ":" + this.config.AUTH_PORT
    redirect_uri += this.config.AUTH_PATH
    this.redirect_uri = redirect_uri
    this.state = Date.now()
    this.authorizationSeed = 'Basic ' + (
      Buffer.from(
        this.config.CLIENT_ID + ':' + this.config.CLIENT_SECRET
      ).toString('base64')
    )
    this.initFromToken()
  }

  writeToken(output, cb = null) {
    var token = Object.assign({}, output)
    token.expires_at = Date.now() + ((token.expires_in - 60) * 1000)
    this.token = token
    var file = path.resolve(__dirname, this.config.TOKEN)
    fs.writeFileSync(file, JSON.stringify(token))
    console.log("[SPOTIFY_AUTH] Token is written.")
    if (cb) {
      cb()
    }
  }

  authflow (afterCallback = ()=>{}) {
    if (!this.config.CLIENT_ID) {
      console.log(`[SPOTIFY_AUTH] CLIENT_ID doesn't exist.`)
      return false
    }

    if (this.token) {
      console.log(`[SPOTIFY_AUTH] You already have token. No need to auth.`)
      return false
    }

    var server = app.get(this.config.AUTH_PATH, (req, res)=>{
      var code = req.query.code || null;
      var authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        form: {
          code: code,
          redirect_uri: this.redirect_uri,
          grant_type: 'authorization_code'
        },
        headers: {
          'Authorization': this.authorizationSeed
        },
        json: true
      }
      request.post(authOptions, (error, response, body) => {
        if (!error && response.statusCode === 200) {
          var access_token = body.access_token
          var refresh_token = body.refresh_token
          this.writeToken(body)
          server.close()
          res.send(`${this.config.TOKEN} would be created. Check it.`)
          afterCallback()
        } else {
          console.error("[SPOTIFY_AUTH] Error:", error, body)
        }
      })
    }).listen(this.config.AUTH_PORT)

    var url = "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: 'code',
        client_id: this.config.CLIENT_ID,
        scope: this.config.SCOPE,
        redirect_uri: this.redirect_uri,
        state: this.state,
        show_dialog: true
      })

    console.log('[SPOTIFY_AUTH] Opening URL.(' + url + ')');
    opn(url).catch(() => {
      console.log('[SPOTIFY_AUTH] Failed to automatically open the URL. Copy/paste this in your browser:\n', url);
    })
  }

  initFromToken () {
    var file = path.resolve(__dirname, this.config.TOKEN)
    if (fs.existsSync(file)) {
      this.token = JSON.parse(fs.readFileSync(file))
      if (this.isExpired()) {
        console.log("[SPOTIFY_AUTH] Token is expired. It will be refreshed")
        this.refreshToken()
      } else {
        console.log("[SPOTIFY_AUTH] Token is fresh.")
      }
    }
  }

  isExpired () {
    return (Date.now() > this.token.expires_at) ? true : false
  }

  refreshToken (cb = null) {
    console.log("[SPOTIFY_AUTH] Token refreshing...")
    var refresh_token = this.token.refresh_token
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      headers: {
        'Authorization': this.authorizationSeed
      },
      form: {
        grant_type: 'refresh_token',
        refresh_token: refresh_token
      },
      json: true
    }

    request.post(authOptions, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        body.refresh_token = this.token.refresh_token
        this.writeToken(body, cb)
      } else {
        console.log("[SPOTIFY_AUTH] Token refreshing failed.")
        console.log(error, body)
      }
    })
  }

  accessToken () {
    return (this.token.access_token) ? this.token.access_token : null
  }

  doRequest(api, type, qsParam, bodyParam, cb) {
    var authOptions = {
      url: "https://api.spotify.com" + api,
      method: type,
      headers: {
        'Authorization': "Bearer " + this.token.access_token
      },
      json: true
    }
    if (bodyParam) {
      authOptions.body = bodyParam
    }

    if (qsParam) {
      authOptions.qs = qsParam
    }

    var req = ()=>{
      request(authOptions, (error, response, body) => {
        if (error) {
          console.log(`[SPOTIFY] API Request fail on :`, api)
          console.log(error, body)
        } else {
          if (api !== "/v1/me/player" && type !== "GET") {
            //console.log(`[SPOTIFY] API Requested:`, api)
          }
        }
        if (cb) {
          if(response.statusCode) {
            cb(response.statusCode, error, body)
          } else {
            console.log(`[SPOTIFY] Invalid response`)
            cb('400', error, body)
          }

        }
      })
    }

    if (this.isExpired()) {
      this.refreshToken(req)
    } else {
      req()
    }
  }

  getCurrentPlayback(cb) {
    this.doRequest("/v1/me/player", "GET", null, null, cb)
  }

  getDevices(cb) {
    this.doRequest("/v1/me/player/devices", "GET", null, null, cb)
  }

  play(param, cb) {
    this.doRequest("/v1/me/player/play", "PUT", null, param, cb)
  }

  pause(cb) {
    this.doRequest("/v1/me/player/pause", "PUT", null, null, cb)
  }

  next(cb) {
    this.doRequest("/v1/me/player/next", "POST", null, null, (code, error, body)=>{
      this.doRequest("/v1/me/player/seek", "PUT", {position_ms:0}, null, cb)
    })

  }

  previous(cb) {
    /*
    this.doRequest("/v1/me/player/previous", "POST", null, null, (code, error, body)=>{
      this.doRequest("/v1/me/player/seek", "PUT", null, {position_ms:0}, cb)
    })
    */
    this.doRequest("/v1/me/player/seek", "PUT", {position_ms:0}, null, (code, error, body)=>{
      this.doRequest("/v1/me/player/previous", "POST", null, null, cb)
    })
  }

  search(param, cb) {
    param.limit = 50
    this.doRequest("/v1/search", "GET", param, null, cb)
  }

  transfer(req, cb) {
    if (req.device_ids.length > 1) {
      req.device_ids = [req.device_ids[0]]
    }
    this.doRequest("/v1/me/player", "PUT", null, req, cb)
  }

  transferByName(device_name, cb) {
    this.getDevices((code, error, result)=>{
      if (code == 200) {
        var devices = result.devices
        for (var i = 0; i < devices.length; i++) {
          if (devices[i].name == device_name) {
            this.transfer({device_ids:[devices[i].id]}, cb)
            return
          }
        }
      } else {
        cb(code, error, result)
      }
    })
  }

  volume(volume = 50, cb) {
    this.doRequest("/v1/me/player/volume", "PUT", {volume_percent:volume}, null, cb)
  }

  repeat(state, cb) {
    this.doRequest("/v1/me/player/repeat", "PUT", {state:state}, null, cb)
  }

  shuffle(state, cb) {
    this.doRequest("/v1/me/player/shuffle", "PUT", {state:state}, null, cb)
  }

  replay(cb) {
    this.doRequest("/v1/me/player/seek", "PUT", {position_ms:0}, null, cb)
  }
}

module.exports = Spotify
