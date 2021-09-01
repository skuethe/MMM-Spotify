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

function authorize(configuration) {
  return new Promise((resolve, reject) => {
    new Spotify(configuration, true, true).authFlow()
      .then((result) => {
        console.log(result)
        resolve(result)
      })
      .catch((error) => {
        console.error("[SPOTIFY - " + configuration.USERNAME + "] Error in authentication:")
        reject(error)
        return
      })
  })
}

async function authorizations(configurations) {
  for (const configuration of configurations) {
    try {
      await authorize(configuration)
    } catch (error) {
      if (error) console.error("[SPOTIFY]", error)
      reject("authorization failed")
      return
    }
  }
}

authorizations(configurations)
  .then((result) => {
    console.log("[SPOTIFY] Authorization process finished!")
  })
  .catch((error) => {
    console.error("[SPOTIFY] Authorization process failed!")
  })
