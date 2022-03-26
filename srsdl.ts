/* 
 * TODO
 * - Commands
 * 
 * 
 * 
 * 
 * 
 * 
 * 
*/

import fs from 'fs';
import cp from 'child_process';
import prompts from 'prompts';

// Interfaces for JSON Descriptor File
interface Descriptor {
    series: Series[],
    sav: string,
    format: string
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

function main(args: string[]) {
    if (!args || !args[0]) { // If no operation is specified
        console.error("No operation specified, 'srsdl help' for help");
        return;
    }
    let request = args[0];
    // Switch operation to execute
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
                'srsdl list <series?>: Shows all Series in descriptor or if specified seasons in series', // Implemented
                'srsdl add series: Creates a new series in descriptor with dialog', // Implemented
                'srsdl edit <series> <key> <value>: Edits an existing series', // Implemented
                'srsdl clear <series>/<season?>: Clears all episode links from a season', // Implemented
                'srsdl add season <series>: Creates new season in existing series in descriptor with dialog', // Implemented
                'srsdl edit <series>/<season> <key> <value>: Edits an existing season', // Implemented
                'srsdl add episode <series>/<season> <JSON>: Adds single or Array of episode(s) to season',
                'srsdl add episode <series>/<season> -f/j <Text file> <seperator?=newline>',
                'srsdl edit <series>/<season> episodes <operation>',
                '\tOperations are the following:\n\t\tclear <number>,\n\t\tmove <number1> <number2>,\n\t\tedit <number> <content>,\n\t\tswitch <number1> <number2>',
                'srsdl remove <series>/<season?>', // Implemented
                'srsdl location <path (relative or absolute)> <format>',
                '\tFormat is by default $Lang/$Series/$Season/',
                '\nREQUIREMENTS:\n',
                'youtube-dl: https://youtube-dl.org',
                'nodejs: https://nodejs.org',
                'ts-node: https://npmjs.org/package/ts-node'
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
                series = descriptor.series
                    .find(x => x.name.toLowerCase() == args[2].toLowerCase());
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
                descriptor.series[descriptor.series.indexOf(series)]
                    .seasons[series.seasons.indexOf(season)][sk] = sv;
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
            save();
            break;
        case "remove":
            path = args[1];
            if (!path || path == "") {
                console.error("Empty Request");
                return;
            }
            identifiers = args[1].split('/');
            if (!identifiers[1])
                descriptor.series.splice(descriptor.series
                    .findIndex(x => x.name.toLowerCase() == identifiers[0].toLowerCase()), 1);
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
        default:
            console.log("Unknown option: " + args[0]);
            break;
    }
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
    let path = `./out/${series.lang}/${series.name}/${season.name}`;
    fs.mkdirSync(path, { recursive: true });
    retries = new Array(season.episodes.length).fill(0);
    for (let i = 1; i <= season.episodes.length; i++) {
        if (!season.episodes[i - 1] || season.episodes[i - 1] == "") {
            console.log(`INFO: Skipped episode ${i}, no link given`);
            continue;
        }
        if (!fs.existsSync(`${path}/${i.toString(10).padStart(2, '0')}.mp4`))
            callYTDL(season, series, i, path)
        else {
            console.log("INFO: Skipped episode " + i + ", the file exists already in the specified directory");
        }
    }
}

var retries: number[] = [];

function callYTDL(season: Season, series: Series, i: number, path: string) {
    cp.exec(`youtube-dl ${season.episodes[i - 1]} --no-check-certificate -o "${path}/${i.toString(10).padStart(2, '0')}.mp4"`,
        (err, stdout, stderr) => {
            if (err) {
                if (retries[i - 1] > 10) {
                    console.error(`ERROR: Download of episode ${i} failed. Restart the process to try again`);
                    return;
                }
                console.error(`ERROR: Download of episode ${i} failed... Retrying in a minute, Try ${retries[i - 1]} of 10`);
                retries[i - 1]++;
                setTimeout(() => callYTDL(season, series, i, path), 60000);
                return;
            }
            console.log(`INFO: Episode ${i} downloaded`);
        });
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
        let series = descriptor.series.find(x => x.name.toLowerCase() == identifier.toLowerCase());
        if (!series) {
            console.error("ERROR: Series not found");
            return;
        }
        return [
            `Seasons: ${series.seasons.length}`,
            ``,
            `List of Seasons: \n${series.seasons.map((x: Season) => `${x.name}: ${x.episodes.length} episodes`).join(",\n")}`,
            `Episodes: ${series.seasons.map((x: Season) => x.episodes.length).reduce((pv, cv) => pv + cv, 0)}`
        ].join('\n');
    }
}
let save = () => { fs.writeFileSync('./descriptor.json', JSON.stringify(descriptor)); };

main(process.argv.slice(process.argv.findIndex(x => x.toLowerCase().includes('srsdl')) + 1));