const fs = require("fs")
const path = require("path")
const Spotify = require("./Spotify.js")

let file = path.resolve(__dirname, "spotify.config.json")
let configurations = []

if (fs.existsSync(file)) {
    let configurators = JSON.parse(fs.readFileSync(file))
    configurators.forEach(configurator => {
        configurations.push(configurator)
    })
}
else return console.log("[SPOTIFY] Error: please configure your spotify.config.json file")

function authorize(configuration) {
    return new Promise((resolve, reject) => {
        let Auth = new Spotify(configuration,true, true)
        Auth.authFlow(() => {
            console.log("[SPOTIFY] First authorization is finished for " + configuration.USERNAME + ". Check ", configuration.TOKEN)
            resolve()
        }, () => {
            console.log("[SPOTIFY] Error in authentication")
            reject()
        })
    })
}

async function authorizations(configurations) {
    for (const configuration of configurations) {
        try {
            await authorize(configuration)
        } catch (e) {
          if (e) console.log('[SPOTIFY] ERROR: ', e)
        }
    }
}

authorizations(configurations).then(result => {
    console.log('[SPOTIFY] Authorization process finished!')
}, reason => {
    console.log('[SPOTIFY] Authorization process failed!:', reason)
})
