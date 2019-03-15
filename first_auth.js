const fs = require("fs")
const path = require("path")
const Spotify = require("./Spotify.js")

var file = path.resolve(__dirname, "spotify.config.json")
var config = null

if (fs.existsSync(file)) {
  config = JSON.parse(fs.readFileSync(file))
}

var Auth = new Spotify(config)
Auth.authflow(()=>{
  console.log("\nCurrent accessToken:\n", Auth.accessToken())
  console.log("First authorization is finished. Check token.json")
  process.exit()
})
