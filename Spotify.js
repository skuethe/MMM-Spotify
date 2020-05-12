//
// Module : MMM-Spotify
// Developers : Seongnoh Sean Yi (eouia0819@gmail.com)
//              bugsounet (bugsounet@bugsnana.fr)
//


const fs = require("fs")
const path = require("path")
const request = require("request")
const querystring = require("querystring")
const opn = require("open")
const express = require("express")
const app = express()
var _Debug = (...args) => { /* do nothing */ }
var _Verbose = (...args) => { /* do nothing */ }

class Spotify {
  constructor(config = null, debug = false, first = false, verbose = false) {
    if (config == null) {
      config = {
        "USERNAME": "",
        "CLIENT_ID": "",
        "CLIENT_SECRET": "",
        "AUTH_DOMAIN": "http://localhost",
        "AUTH_PATH": "/callback",
        "AUTH_PORT": "8888",
        "SCOPE": "user-read-private app-remote-control playlist-read-private streaming user-read-playback-state user-modify-playback-state",
        "TOKEN": "./token.json",
      }
    }
    this.redirect_uri = null
    this.token = null
    this.state = ""
    this.config = config
    if (debug) _Debug = (...args) => { console.log("[SPOTIFY]", ...args) }
    if (verbose) _Verbose = (...args) => { console.log("[SPOTIFY]", ...args) }

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
    if (!first) this.initFromToken()
    _Debug("Initialized")
  }

  writeToken(output, cb = null) {
    var token = Object.assign({}, output)
    token.expires_at = Date.now() + ((token.expires_in - 60) * 1000)
    this.token = token
    var file = path.resolve(__dirname, this.config.TOKEN)
    fs.writeFileSync(file, JSON.stringify(token))
    _Debug("Token is written.")
    if (cb) {
      cb()
    }
  }

  authFlow(afterCallback = () => {}, error = () => {}) {
    if (!this.config.CLIENT_ID) {
      let msg = `[SPOTIFY_AUTH] CLIENT_ID doesn't exist.`;
      error(msg);
      return;
    }

    if (this.token) {
      let msg = `[SPOTIFY_AUTH] You already have a token. no need to auth.`;
      error(msg);
      return;
    }

    _Verbose('Creating server', this.config);
    let server = app.get(this.config.AUTH_PATH, (req, res) => {
      let code = req.query.code || null;
      let authOptions = {
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
      };

      request.post(authOptions, (requestError, response, body) => {
        if (requestError || response.statusCode !== 200) {
          let msg = `[SPOTIFY_AUTH] Error in request`;
          error(msg);
          return;
        }
        this.writeToken(body);
        server.close();
        res.send(`${this.config.TOKEN} would be created. Check it`);
        afterCallback();
      });
    }).listen(this.config.AUTH_PORT);

    let url = "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: 'code',
        client_id: this.config.CLIENT_ID,
        scope: this.config.SCOPE,
        redirect_uri: this.redirect_uri,
        state: this.state,
        show_dialog: true
      });

    _Verbose('Opening URL.(' + url + ')');
    opn(url).catch(() => {
      console.log('[SPOTIFY] Failed to automatically open the URL. Copy/paste this in your browser:\n', url);
    });
  }

  initFromToken() {
    var file = path.resolve(__dirname, this.config.TOKEN)
    if (fs.existsSync(file)) {
      this.token = JSON.parse(fs.readFileSync(file))
      if (this.isExpired()) {
        _Debug("Token is expired. It will be refreshed")
        this.refreshToken()
      } else {
        _Debug("Token is fresh.")
      }
    }
  }

  isExpired() {
    return (Date.now() >= this.token.expires_at);
  }

  refreshToken(cb = null) {
    _Debug("Token refreshing...")
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
      if (
        response !== 'undefined' &&
        !error &&
        response.statusCode === 200
      ) {
        body.refresh_token = this.token.refresh_token
        this.writeToken(body, cb)
      } else {
        _Debug("Token refreshing failed.")
      }
    })
  }

  accessToken() {
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

    var req = () => {
      request(authOptions, (error, response, body) => {
        if (error) {
          _Debug("API Request fail on :", api)
        } else {
          if (api !== "/v1/me/player" && type !== "GET") {
            _Debug("API Requested:", api)
          }
        }
        if (cb) {
          if (response && response !== 'undefined' && response.statusCode) {
            cb(response.statusCode, error, body)
          } else {
            _Debug("Invalid response")
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
    this.doRequest("/v1/me/player/next", "POST", null, null, (code, error, body) => {
      this.doRequest("/v1/me/player/seek", "PUT", { position_ms: 0 }, null, cb)
    })

  }

  previous(cb) {
    /*
    this.doRequest("/v1/me/player/previous", "POST", null, null, (code, error, body)=>{
      this.doRequest("/v1/me/player/seek", "PUT", null, {position_ms:0}, cb)
    })
    */
    this.doRequest("/v1/me/player/seek", "PUT", { position_ms: 0 }, null, (code, error, body) => {
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
    this.getDevices((code, error, result) => {
      if (code == 200) {
        let devices = result.devices
        for (let i = 0; i < devices.length; i++) {
          if (devices[i].name == device_name) {
            this.transfer({ device_ids: [devices[i].id] }, cb)
            return
          }
        }
      } else {
        cb(code, error, result)
      }
    })
  }

  volume(volume = 50, cb) {
    this.doRequest("/v1/me/player/volume", "PUT", { volume_percent: volume }, null, cb)
  }

  repeat(state, cb) {
    this.doRequest("/v1/me/player/repeat", "PUT", { state: state }, null, cb)
  }

  shuffle(state, cb) {
    this.doRequest("/v1/me/player/shuffle", "PUT", { state: state }, null, cb)
  }

  replay(cb) {
    this.doRequest("/v1/me/player/seek", "PUT", { position_ms: 0 }, null, cb)
  }
}

module.exports = Spotify
