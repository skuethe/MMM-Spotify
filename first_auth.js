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
            console.log("Error in authentication flow!");
            reject();
        });
    });
}

async function authorizations(configurations) {
    for (const configuration of configurations) {
        try {
            await authorize(configuration);
            console.log('Authorization finished');
        } catch (e) {
            console.log('ERROR: ', e);
        }
    }
}

authorizations(configurations).then(result => {
    console.log('Authorization process finished!', result);
}, reason => {
    console.log('Authorization process failed!:', reason);
});
