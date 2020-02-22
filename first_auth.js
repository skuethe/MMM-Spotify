const fs = require("fs");
const path = require("path");
const Spotify = require("./Spotify.js");

let file = path.resolve(__dirname, "spotify.config.json");
let configurations = [];

if (fs.existsSync(file)) {
    let configurators = JSON.parse(fs.readFileSync(file));
    configurators.forEach(configurator => {
        configurations.push(configurator);
    });
}

function authorize(configuration) {
    return new Promise((resolve, reject) => {
        let Auth = new Spotify(configuration);
        Auth.authFlow(() => {
            console.log(configuration.USERNAME, "\nCurrent accessToken:\n", Auth.accessToken());
            console.log("First authorization is finished. Check ", configuration.TOKEN);
            resolve();
        }, () => {
            console.error("Error in authentication flow!");
            reject();
        });
    });
}

async function authorizations(configurations) {
    for (const configuration of configurations) {
        await authorize(configuration);
    }
}

authorizations(configurations).then(result => {
    console.log('Authorization process finished!', result);
});
