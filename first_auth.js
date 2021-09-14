const fs = require("fs")
const path = require("path")
const Spotify = require("./Spotify.js")

let file = path.resolve(__dirname, "spotify.config.json")
let configurations = []

if (fs.existsSync(file)) {
  let configurators = JSON.parse(fs.readFileSync(file))
  configurators.forEach((configurator) => {
    configurations.push(configurator)
  })
}
else return console.log("[SPOTIFY] Error: please configure your spotify.config.json file")

async function authorize(configuration) {
  return await new Spotify(configuration, true, true).authFlow()
    .catch((error) => {
      console.error("[SPOTIFY - " + configuration.USERNAME + "] Error in authentication:")
      throw error
    })
}

async function authorizations(configurations) {
  for (const configuration of configurations) {
    await authorize(configuration)
      .then((result) => {
        console.log(result)
      })
      .catch((error) => {
        console.error("[SPOTIFY - " + configuration.USERNAME + "]", error)
        throw error
    })
  }
  return true
}

authorizations(configurations)
  .then((result) => {
    console.log("[SPOTIFY] Authorization process finished")
  })
  .catch((error) => {
    console.error("[SPOTIFY] Authorization process failed")
  })
