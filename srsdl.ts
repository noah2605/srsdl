/* 
 * TODO
 * up to <config> downloads at the same time(?)
 * range edits/array edits for episode
 * transseasonal edits
 * 
*/

import fs from 'fs';
import cp from 'child_process';
import prompts from 'prompts';
import { Queue } from './Queue';

// Interfaces for JSON Descriptor File
interface Descriptor {
    series: Series[],
    sav: string,
    format: string,
    filename: string,
    maxdownloads: number
}
interface Series {
    name: string,
    lang: string,
    seasons: Season[]
}
interface Season {
    name: string,
    episodes: string[]
}
// Check if descriptor exists
if (!fs.existsSync("./descriptor.json")) {
    console.error("No descriptor found. Exiting.");
    process.exit();
}
var descriptor: Descriptor = JSON.parse(fs.readFileSync("./descriptor.json", { encoding: "utf-8" }));

async function main(args: string[]) {
    if (!args || !args[0]) { // If no operation is specified
        console.error("No operation specified, 'srsdl help' for help");
        return;
    }
    let request = args[0];
    // Switch operation to execute

    // Variables declared here so typescript doesn't complain about the switch context
    let identifiers: string[];
    let series: Series | undefined;
    let season: Season | undefined;
    let path: string;

    switch (request) {
        case "dl":
        case "download":
            download(args[1]);
            break;

        case "help":
            console.log([
                'COMMAND LIST:',
                '\nsrsdl dl <series>/<season?>: Download a Season of a Series or an entire Series', // Implemented
                'srsdl help: Shows this', // Implemented
                'srsdl list <series?>/<season?>: Shows all Series in descriptor or if specified seasons/episodes in series/season', // Implemented
                'srsdl add series: Creates a new series in descriptor with dialog', // Implemented
                'srsdl edit <series> <key> <value>: Edits an existing series', // Implemented
                'srsdl clear <series>/<season?>: Clears all episode links from a season', // Implemented
                'srsdl add season <series>: Creates new season in existing series in descriptor with dialog', // Implemented
                'srsdl edit <series>/<season> <key> <value>: Edits an existing season', // Implemented
                'srsdl add episode <series>/<season> <JSON>: Adds single or Array of episode(s) to season', // Implemented
                'srsdl add episode <series>/<season> -f/j <Text file> <seperator?=newline>: f for file with seperator, j with json file', // Implemented
                'srsdl edit <series>/<season> episodes <operation>', // Implemented
                '\tOperations are the following:\n\t\tclear <number>,\n\t\tmove <number1> <number2>,\n\t\tedit <number> <content>,\n\t\tswitch <number1> <number2>',
                'srsdl remove <series>/<season?>', // Implemented
                'srsdl config location: configures save location', // Implemented
                'srsdl config maxdownloads: configures maximum number of simultaneous downloads', // Implemented
                'srsdl config format: configures format for folder structure', // Implemented
                'srsdl config filename: configures format for filename', // Implemented
                '\tWhole format is by default $lang/$series/$season/$episode.mp4',
                '\t\tAvailable variables for format are $lang, $series, $season and\n\t\t$episode (padded to 2, only for filename format)',
                '\nREQUIREMENTS:\n',
                'youtube-dl: https://youtube-dl.org',
                'nodejs: https://nodejs.org',
                'ts-node/tsc: https://npmjs.org/package/ts-node (DEV)'
            ].join('\n'));
            break;

        case "add":
            if (args[1] == 'series') {
                (async () => {
                    const response = await prompts([{
                        type: 'text',
                        name: 'name',
                        message: 'Enter the name of the series: '
                    }, {
                        type: 'text',
                        name: 'lang',
                        message: 'Enter the language: '
                    }]);

                    descriptor.series.push({ name: response.name, lang: response.lang, seasons: [] });
                    save();
                })();
            }
            else if (args[1] == 'season') {
                if (args[2])
                    series = descriptor.series
                        .find(x => x.name.toLowerCase() == args[2].toLowerCase());
                else {
                    await (async () => {
                        const response = await prompts({
                            type: 'text',
                            name: 'series',
                            message: 'Enter the name of the series parent: '
                        });
                        series = descriptor.series
                            .find(x => x.name.toLowerCase() == response.series.toLowerCase());
                    })();
                }
                if (!series) {
                    console.error("Series not found");
                    return;
                }
                (async () => {
                    const response = await prompts({
                        type: 'text',
                        name: 'name',
                        message: 'Enter the name of the season (default s<number>): '
                    });
                    descriptor
                        .series[descriptor.series.findIndex(x => x == series)]
                        .seasons.push({ name: (!response.name || response.name == "") ? `s${series.seasons.length}` : response.name, episodes: [] });
                    save();
                })();
            }
            else if (args[1] == "episode") {
                path = args[2];
                if (!path || path == "") {
                    console.error("Empty Request");
                    return;
                }
                identifiers = path.split('/');
                series = descriptor.series.find(x => x.name.toLowerCase() == identifiers[0].toLowerCase());
                if (!series) {
                    console.error("series name not found");
                    return;
                }
                if (!identifiers[1]) {
                    console.error('No season given');
                }
                else {
                    season = series.seasons.find(x => x.name.toLowerCase() == identifiers[1].toLowerCase());
                    if (!season) {
                        console.error("Season \"" + identifiers[1] + "\" not found in series \"" + series.name + "\"");
                        return;
                    }
                    addEpisodes(series, season, args.slice(3));
                }
            }
            else {
                console.log('None or unknown option given');
            }
            break;
        case "edit":
            path = args[1];
            if (!path || path == "") {
                console.error("Empty Request");
                return;
            }
            identifiers = path.split('/');
            series = descriptor.series.find(x => x.name.toLowerCase() == identifiers[0].toLowerCase());
            if (!series) {
                console.error("series name not found");
                return;
            }
            let key = args[2];
            let value = args[3];
            if (!key || !value) {
                console.log('No key or value given');
            }
            if (!identifiers[1]) {
                let sk = key as keyof Series;
                let sv = value as string & Season[];
                if (!sk || !sv) {
                    console.error("Key didn't match any keys");
                    return;
                }
                descriptor.series[descriptor.series.indexOf(series)][sk] = sv;
                save();
            }
            else {
                let sk = key as keyof Season;
                let sv = value as string & string[];
                if (!sk || !sv) {
                    console.error("Key didn't match any keys");
                    return;
                }
                season = series.seasons.find((x, i) => (x.name ?? `s${i}`).toLowerCase() == identifiers[1].toLowerCase());
                if (!season) {
                    console.error("Season \"" + identifiers[1] + "\" not found in series \"" + series.name + "\"");
                    return;
                }
                if (sk == "episodes") {
                    let _episodes = season.episodes;
                    if (!args[4] || args[4] == "") {
                        console.log("Insufficient number of arguments");
                    }
                    if (args[3] != "clear" && (!args[5] || args[5] == "")) {
                        console.log("Insufficient number of arguments");
                    }
                    let index = Number(args[4]);
                    if (!index || isNaN(index)) {
                        console.error("ERROR: Not a number");
                        return;
                    }
                    let index2: number;
                    switch (args[3]) {
                        case "clear":
                            _episodes[index - 1] = "";
                            break;
                        case "move":
                            index2 = Number(args[5]);
                            if (!index2 || isNaN(index2)) {
                                console.error("ERROR: Not a number");
                                return;
                            }
                            _episodes[index2 - 1] = _episodes[index - 1];
                            _episodes[index - 1] = "";
                            break;
                        case "switch":
                            index2 = Number(args[5]);
                            if (!index2 || isNaN(index2)) {
                                console.error("ERROR: Not a number");
                                return;
                            }
                            _episodes[index2 - 1] = season.episodes[index - 1];
                            _episodes[index - 1] = season.episodes[index2 - 1];
                            break;

                        case "edit":
                            _episodes[index - 1] = args[5];
                            break;
                    }
                    descriptor.series[descriptor.series.indexOf(series)]
                        .seasons[series.seasons.indexOf(season)].episodes = _episodes;
                }
                else {
                    descriptor.series[descriptor.series.indexOf(series)]
                        .seasons[series.seasons.indexOf(season)][sk] = sv;
                }
                save();
            }
            console.log("Done.");
            break;

        case "clear":
            path = args[1];
            if (!path || path == "") {
                console.error("Empty Request");
                return;
            }
            identifiers = path.split('/');
            series = descriptor.series.find(x => x.name.toLowerCase() == identifiers[0].toLowerCase());
            if (!series) {
                console.error("series name not found");
                return;
            }
            if (!identifiers[1]) {
                console.log("INFO: No season specified, clearing all");
                let srs = (series ?? descriptor.series[0]) as Series; // i hate you typescript stfu about undefineds i checked everything above idiot
                series.seasons.forEach(s => { descriptor.series[descriptor.series.indexOf(srs)].seasons[srs.seasons.indexOf(s)].episodes = []; });
            }
            else {
                season = series.seasons.find((x, i) => (x.name ?? `s${i}`).toLowerCase() == identifiers[1].toLowerCase());
                if (!season) {
                    console.error("Season \"" + identifiers[1] + "\" not found in series \"" + series.name + "\"");
                    return;
                }
                descriptor.series[descriptor.series.indexOf(series)].seasons[series.seasons.indexOf(season)].episodes = [];
            }
            console.log("Done.");
            save();
            break;
        case "remove":
            path = args[1];
            if (!path || path == "") {
                console.error("Empty Request");
                return;
            }
            identifiers = args[1].split('/');
            if (!identifiers[1]) {
                let id = descriptor.series
                    .findIndex(x => x.name.toLowerCase() == identifiers[0].toLowerCase());
                if (id < 0) {
                    console.error("Series not found");
                    return;
                }
                descriptor.series.splice(id, 1);
            }
            else {
                series = descriptor.series[descriptor.series
                    .findIndex(x => x.name.toLowerCase() == identifiers[0].toLowerCase())]
                let id = series.seasons.findIndex(x => x.name.toLowerCase() == identifiers[1].toLowerCase());
                if (id < 0) {
                    console.error("Season not found");
                    return;
                }
                descriptor.series[descriptor.series.indexOf(series)]
                    .seasons.splice(id, 1);
            }
            save();
            console.log("Done.");
            break;
        case "list":
            console.log(entries(args[1]));
            break;
        case "config":
            switch (args[1]) {
                case "location":
                    (async () => {
                        const response = await prompts({
                            type: 'text',
                            name: 'sav',
                            message: 'Enter the location for files (relative or absolute): '
                        });
                        let s = (response.sav + '/').split('/').join('/');
                        descriptor.sav = s.startsWith('/') ? s : (s.startsWith('./') ? s : ('./' + s));
                        save();
                    })();
                    break;
                case "format":
                    (async () => {
                        const response = await prompts({
                            type: 'text',
                            name: 'format',
                            message: 'Enter the format (type srsdl help for info): '
                        });
                        descriptor.format = response.format;
                        save();
                    })();
                    break;
                case "filename":
                    (async () => {
                        const response = await prompts({
                            type: 'text',
                            name: 'filename',
                            message: 'Enter the format for the filename (type srsdl help for info): '
                        });
                        descriptor.filename = response.filename;
                        save();
                    })();
                    break;
                    case "maxdl":
                    case "maxdownloads":
                        (async () => {
                            const response = await prompts({
                                type: "number",
                                name: 'mxdl',
                                message: 'Enter max simultaneous downloads: '
                            });
                            descriptor.maxdownloads = response.mxdl;
                            save();
                        })();
                        break;
                default:
                    console.error("Unknown config option");
                    break;
            }
            break;
        default:
            console.log("Unknown option: " + args[0]);
            break;
    }
}
function addEpisodes(series: Series, season: Season, pars: string[]) {
    if (!pars || !pars[0] || pars[0] == "") {
        console.error('ERROR: No episode links specified');
        return;
    }
    if (pars[0] == "-j") {
        if (pars[1]) {
            let episodes = JSON.parse(fs.readFileSync(pars[1], 'utf-8')) as string[];
            if (!episodes || !episodes[0] || episodes[0] == "") {
                console.error("Invalid JSON");
                return;
            }
            descriptor
                .series[descriptor.series.indexOf(series)]
                .seasons[series.seasons.indexOf(season)]
                .episodes = season.episodes.concat(episodes);
        }
    }
    else if (pars[0] == "-f") {
        if (pars[1]) {
            let seperator = '\n';
            if (pars[2]) seperator = pars[2];
            let episodes = fs.readFileSync(pars[1], 'utf-8').split(seperator);
            if (!episodes || !episodes[0] || episodes[0] == "") {
                console.error("Invalid or empty file content");
                return;
            }
            descriptor
                .series[descriptor.series.indexOf(series)]
                .seasons[series.seasons.indexOf(season)]
                .episodes = season.episodes.concat(episodes);
        }
        else {
            console.error('No file specified');
            return;
        }
    }
    else {
        if (pars[0].trim().startsWith('[')) {
            let episodes = JSON.parse(pars[0]) as string[];
            if (!episodes || !episodes[0] || episodes[0] == "") {
                console.error("Invalid JSON");
                return;
            }
            descriptor
                .series[descriptor.series.indexOf(series)]
                .seasons[series.seasons.indexOf(season)]
                .episodes = season.episodes.concat(episodes);
        }
        else {
            descriptor
                .series[descriptor.series.indexOf(series)]
                .seasons[series.seasons.indexOf(season)]
                .episodes.push(pars[0]);
        }
    }
    console.log(`Done. Season now has ${descriptor
        .series[descriptor.series.indexOf(series)]
        .seasons[series.seasons.indexOf(season)]
        .episodes.length} episodes.`);
    save();
}

function download(path: string) {
    if (!path || path == "") {
        console.error("Empty Request");
        return;
    }
    let identifiers = path.split('/');
    let series = descriptor.series.find(x => x.name.toLowerCase() == identifiers[0].toLowerCase());
    if (!series) {
        console.error("series name not found");
        return;
    }
    if (!identifiers[1]) {
        console.log("INFO: No season specified, downloading all");
        series.seasons.forEach(s => downloadSeason(series ?? descriptor.series[0], s));
    }
    else {
        let season = series.seasons.find((x, i) => (x.name ?? `s${i}`).toLowerCase() == identifiers[1].toLowerCase());
        if (!season) {
            console.error("Season \"" + identifiers[1] + "\" not found in series \"" + series.name + "\"");
            return;
        }
        downloadSeason(series, season);
    }
}

function downloadSeason(series: Series, season: Season) {
    if (!series || !season) return;
    let path = `${descriptor.sav}/${descriptor.format.replace('$lang', series.lang).replace('$series', series.name).replace('$season', season.name)}`.split('/').filter(x => x != "").join('/');
    fs.mkdirSync(path, { recursive: true });
    retries = new Array(season.episodes.length).fill(0);
    for (let i = 1; i <= season.episodes.length; i++) {
        let epp = `${descriptor.filename.replace('$episode', i.toString(10).padStart(2, '0')).replace('$lang', series.lang).replace('$series', series.name).replace('$season', season.name)}`.split('/').filter(x => x != "").join('/');
        if (!fs.existsSync(`${path}/${epp}.mp4`))
            queueYTDL(season, series, i, path, epp)
        else {
            console.log("INFO: Skipped episode " + i + " of " + season.name + ", the file exists already in the specified directory");
        }
    }
}

var queue: Queue<[string, string, number]> = new Queue<[string, string, number]>();
var queued: number = 0;
var retries: number[] = [];

function queueYTDL(season: Season, series: Series, i: number, path: string, epp: string) {
    if (!season.episodes[i - 1] || season.episodes[i - 1] == "") {
        console.error("WARNING: Empty/invalid episode link, skipping episode " + i + " of " + season.name);
        return;
    }
    queue.enqueue([`youtube-dl ${season.episodes[i - 1]} --no-check-certificate -o "${path}/${epp}.mp4"`, `${path}/${epp}.mp4`, i]);

    callYTDL();
}

function callYTDL() {
    if (queued < descriptor.maxdownloads) {
        let q = queue.dequeue();
        if (!q) return;
        let [call, e, i] :[string, string, number] = q;
        cp.exec(call,
            (err, stdout, stderr) => {
                if (err) {
                    if (retries[i - 1] > 10) {
                        console.error(`ERROR: Download of episode "${e}" failed. Restart the process to try again`);
                        queued--;
                        callYTDL();
                        return;
                    }
                    console.error(`ERROR: Download of "${e}" failed... Requeueing, Try ${retries[i - 1]} of 10`);
                    retries[i - 1]++;
                    queued--;
                    queue.enqueue([call, e, i]);
                    callYTDL();
                    return;
                }
                console.log(`INFO: Episode ${e} downloaded`);
                queued--;
                callYTDL();
            });
        queued++;
    }
}

function entries(identifier: string) {
    if (!identifier || identifier == "") {
        let seasons = (descriptor.series.map((x: Series) => x.seasons.length) as number[])
            .reduce((pv, cv) => cv + pv, 0);
        let mean = seasons / descriptor.series.length;
        let variance = (descriptor.series.map((x: Series) => x.seasons.length) as number[])
            .reduce((pv, cv) => pv + (cv - mean) * (cv - mean), 0)
        return [
            `Series: ${descriptor.series.length}`,
            ``,
            `List of Series: \n${descriptor.series.map((x: Series) => x.name).join(",\n")}`,
            `Seasons: ${seasons}`,
            `With Mean per Series of ${mean}`,
            `And Standard Variance of ${variance}`
        ].join('\n');
    } else {
        let series = descriptor.series.find(x => x.name.toLowerCase() == identifier.split('/')[0].toLowerCase());
        if (!series) {
            console.error("ERROR: Series not found");
            return;
        }
        if (identifier.split('/').length == 1) return [
            `Seasons: ${series.seasons.length}`,
            ``,
            `List of Seasons: \n${series.seasons.map((x: Season) => `${x.name}: ${x.episodes.length} episodes`).join(",\n")}`,
            `Episodes: ${series.seasons.map((x: Season) => x.episodes.length).reduce((pv, cv) => pv + cv, 0)}`
        ].join('\n');
        else {
            let season = series.seasons.find(x => x.name.toLowerCase() == identifier.split('/')[1].toLowerCase());
            if (!season) {
                console.error("ERROR: Seeason not found");
                return;
            }
            return [
                `Season: ${season.name}`,
                `Member of ${series.name}`,
                `List of Episodes: \n${season.episodes.map((x, i) => `\t${i}: ${x}`).join(",\n")}`,
                `Episodes: ${season.episodes.length}`
            ].join('\n');
        }
    }
}
declare global {
    interface Array<T> { trim(this: Array<T>): Array<T> }
}

Array.prototype.trim = function (this: any[]) {
    let _arr: any[] = this;
    let startIndex = 0;
    let endIndex = _arr.length;
    for (let i = 0; i < _arr.length; i++) {
        if (!_arr[i] || _arr[i] == {} || _arr[i] == [] || _arr[i] == "") startIndex++;
        else break;
    }
    for (let i = _arr.length - 1; i > startIndex; i--) {
        if (!_arr[i] || _arr[i] == {} || _arr[i] == [] || _arr[i] == "") endIndex--;
        else break;
    }
    return _arr.slice(startIndex, endIndex);
};

let save = () => {
    for (let i = 0; i < descriptor.series.length; i++) {
        for (let ii = 0; ii < descriptor.series[i].seasons.length; ii++) {
            descriptor.series[i].seasons[ii].episodes =
                descriptor.series[i].seasons[ii].episodes.trim();
        }
        descriptor.series[i].seasons = descriptor.series[i].seasons.trim();
    }
    descriptor.series = descriptor.series.trim();

    fs.writeFileSync('./descriptor.json', JSON.stringify(descriptor));
};

if (!descriptor.sav || descriptor.sav == "") descriptor.sav = "./out/";
if (!descriptor.format || descriptor.format == "") descriptor.format = "$lang/$series/$season/";
if (!descriptor.filename || descriptor.filename == "") descriptor.filename = "$episode";
if (!descriptor.maxdownloads || descriptor.maxdownloads < 1) descriptor.maxdownloads = 1;
save();

main(process.argv.slice(process.argv.findIndex(x => x.toLowerCase().includes('srsdl')) + 1));