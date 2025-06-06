const fs = require("fs")
const path = require("path")
const axios = require("axios")
const opn = require("open")
const express = require("express")
const moment = require("moment")
let _Debug = (...args) => { /* do nothing */ }

class Spotify {
  constructor(config, debug = false, first = false) {
    if (first) this.app = express()
    this.version = require('./package.json').version
    this.default = {
      USERNAME: "",
      CLIENT_ID: "",
      CLIENT_SECRET: "",
      AUTH_DOMAIN: "http://127.0.0.1",
      AUTH_PATH: "/callback",
      AUTH_PORT: "8888",
      SCOPE: "user-read-private app-remote-control playlist-read-private streaming user-read-playback-state user-modify-playback-state",
      TOKEN: "./token.json",
      updateInterval: 1000,
      idleInterval: 10000,
    }
    this.token = null
    this.setup = first
    this.config = Object.assign({}, this.default, config)
    this.logMessage = "[SPOTIFY - " + this.config.USERNAME + "]"
    if (debug) _Debug = (...args) => { console.debug(this.logMessage, ...args) }

    this.authorizationSeed = 'Basic ' + (
      Buffer.from(
        this.config.CLIENT_ID + ':' + this.config.CLIENT_SECRET
      ).toString('base64')
    )
    this.initFromToken()
    _Debug("Spotify version", this.version, " Initialized...")
  }

  updateSpotify(spotify) {
    return new Promise((resolve, reject) => {
      this.getCurrentPlayback((code, error, result) => {
        if (result === "undefined" || code !== 200) {
          reject()
        } else {
          resolve(result)
        }
      })
    })
  }

  writeToken(output, cb = null) {
    let token = Object.assign({}, output)
    token.expires_at = Date.now() + ((token.expires_in - 60) * 1000)
    this.token = token
    let file = path.resolve(__dirname, this.config.TOKEN)
    fs.writeFileSync(file, JSON.stringify(token))
    _Debug("Token file was created")
    _Debug("Token will expire at: ", moment(this.token.expires_at).format("LLLL"))
    if (cb) cb(this.token.access_token)
  }

  initFromToken() {
    let file = path.resolve(__dirname, this.config.TOKEN)
    if (fs.existsSync(file)) {
      this.token = JSON.parse(fs.readFileSync(file))
    }
    else {
      if (!this.setup) console.log(this.logMessage, "Token file not found!", file)
    }
  }

  isExpired() {
    return (Date.now() >= this.token.expires_at);
  }

  handleRequestError(error) {
    if (error.response) {
      console.error(this.logMessage, "Invalid response")
      console.error(this.logMessage, "Response error code:", error.response.status)
      console.error(this.logMessage, "Response error text:", error.response.statusText)
      _Debug("Response error data:", error.response.data)
      _Debug("Response error headers:", error.response.headers)
    } else if (error.request) {
      console.error(this.logMessage, "Invalid request")
      _Debug("Request:", error.request)
    } else {
      console.error(this.logMessage, error.message)
    }
    _Debug(error.toJSON())
    _Debug(error.config)
  }

  refreshToken(cb = null) {
    _Debug("Refreshing Token...")
    let refresh_token = this.token.refresh_token
    let requestData = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh_token
    })
    let requestConfig = {
      url: "https://accounts.spotify.com/api/token",
      method: "post",
      data: requestData.toString(),
      headers: {
        Authorization: this.authorizationSeed
      },
      validateStatus: function (status) {
        return status == 200
      }
    }
    axios(requestConfig)
      .then((response) => {
        _Debug("API Response:", response.status)
        response.data.refresh_token = refresh_token
        this.writeToken(response.data, cb)
      })
      .catch((error) => {
        console.error(this.logMessage, "Failed to refresh Token.")
        this.handleRequestError(error)
      })
  }

  accessToken() {
    return (this.token.access_token) ? this.token.access_token : null
  }

  doRequest(api, type, queryParam, bodyParam, cb) {
    if (!this.token) {
      console.error(this.logMessage, "Token error!", this.config.TOKEN)
      return
    }
    let requestConfig = {
      baseURL: "https://api.spotify.com",
      url: api,
      method: type,
      headers: {
        Authorization: "Bearer " + this.token.access_token
      }
    }
    if (typeof queryParam !== "undefined") requestConfig.params = queryParam
    if (typeof bodyParam !== "undefined") requestConfig.data = bodyParam
    let req = (newAccessToken) => {
      if (typeof newAccessToken !== "undefined") requestConfig.headers.Authorization = "Bearer " + newAccessToken
      axios(requestConfig)
        .then((response) => {
          if (api !== "/v1/me/player" && type !== "GET") _Debug("API Response:", response.status, "; Requested:", api)
          if (cb) cb(response.status, null, response.data)
        })
        .catch((error) => {
          console.error(this.logMessage, "Failed to request API:", api)
          this.handleRequestError(error)
          if (cb) {
            let errorStatus = ((typeof error.response.status !== "undefined") ? error.response.status : "408")
            let errorData = ((typeof error.response.data !== "undefined") ? error.response.data : {})
            let retryTimerInSeconds = ((typeof error.response.headers["retry-after"] !== "undefined") ? error.response.headers["retry-after"] : 5)

            console.log(this.logMessage, "Will retry in", retryTimerInSeconds, "seconds ...")
            setTimeout(() => { cb(errorStatus, error, errorData) }, retryTimerInSeconds * 1000)
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
    this.doRequest("/v1/me/player", "GET", { additional_types: "episode,track" }, null, cb)
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
    this.doRequest("/v1/me/player/seek", "PUT", { position_ms: 0 }, null, (code, error, body) => {
      this.doRequest("/v1/me/player/previous", "POST", null, null, cb)
    })
  }

  search(param, cb) {
    param.limit = 50
    this.doRequest("/v1/search", "GET", param, null, cb)
  }

  transfer(req, cb) {
    if (req.device_ids.length > 1) req.device_ids = [req.device_ids[0]]
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

  async waitForFileExists(filePath, currentTime = 0, timeout = 0) {
    if (fs.existsSync(filePath)) return this.logMessage + " Authentication successful"
    if (currentTime >= timeout) throw new Error("Token file was not created (\"" + filePath + "\")")
    await new Promise((resolve, reject) => setTimeout(() => resolve(true), 1000))
    return this.waitForFileExists(filePath, currentTime + 1000, timeout)
  }

  async authFlow() {
    let self = this
    let redirect_uri = this.config.AUTH_DOMAIN + ":" + this.config.AUTH_PORT + this.config.AUTH_PATH
    let logMsg = this.logMessage + " AUTH:"
    let file = path.resolve(__dirname, this.config.TOKEN)
    let waitForFileTimeout = 0

    if (!this.config.CLIENT_ID) {
      throw new Error(logMsg + " CLIENT_ID doesn't exist.")
    }

    if (this.token) {
      return logMsg + " You already have a token - no need to authenticate."
    }

    let server = this.app.get(this.config.AUTH_PATH, (req, res) => {
      let code = req.query.code || null
      let requestData = new URLSearchParams({
        code: code,
        redirect_uri: redirect_uri,
        grant_type: "authorization_code"
      })
      let requestConfig = {
        url: "https://accounts.spotify.com/api/token",
        method: "post",
        data: requestData.toString(),
        headers: {
          Authorization: this.authorizationSeed
        },
        validateStatus: function (status) {
          return status == 200
        }
      }
      axios(requestConfig)
        .then((response) => {
          this.writeToken(response.data)
          _Debug("AUTH: stopping express app now")
          server.close()
          res.send(this.config.TOKEN + " should now be created. Please close the browser to continue.")
        })
        .catch((error) => {
          console.error(logMsg, "Error in request.")
          this.handleRequestError(error)
          // throw error
        })
    }).listen(this.config.AUTH_PORT, () => {
      _Debug("AUTH: express app started and listening on port", this.config.AUTH_PORT)
    })

    let urlParams = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.CLIENT_ID,
      scope: this.config.SCOPE,
      redirect_uri: redirect_uri,
      state: Date.now(),
      show_dialog: true
    }).toString()
    let url = "https://accounts.spotify.com/authorize?" + urlParams
    if (this.config.AUTH_DOMAIN == this.default.AUTH_DOMAIN) {
      console.log(logMsg, "Opening browser for authentication on Spotify...")
      await opn(url, { wait: true })
        .catch((error) => {
          server.close()
          console.error(logMsg, "Failed to open the URL in your default browser.")
          console.error(logMsg, "If you are using an environment without UI (docker f.e.) have a look at:\n", "\n\thttps://github.com/skuethe/MMM-Spotify#custom-callback\n")
          throw error
        })
    } else {
      console.log(logMsg, "Using custom callback URL. Copy + paste the following URL into your browser:\n\n\t", url, "\n")
      console.log(logMsg, "This process will timeout after 5 minutes!")
      waitForFileTimeout = 60000 * 5
    }

    return await this.waitForFileExists(file, 0, waitForFileTimeout)
      .catch((error) => {
        server.close()
        throw error
      })
  }
}

module.exports = Spotify
