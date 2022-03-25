/* 
 * TODO
 * - Progress bar
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

// Interfaces for JSON Descriptor File
interface Descriptor {
    series: Series[]
}
interface Series {
    name: string,
    lang: string,
    seasons: Season[]
}
interface Season {
    name?: string,
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
    switch (request) {
        case "dl": 
        case "download": 
            download(args[1]);
            break;

        case "help": 
            console.log([
                '\nsrsdl dl <series>/<season?>: Download a Season of a Series or an entire Series', // Implemented
                'srsdl help: Shows this', // Implemented
                'srsdl list: Shows all Series in descriptor', // Implemented
                'srsdl add series: Creates a new series in descriptor with dialog',
                'srsdl edit <series> <key> <value>: Edits an existing series',
                'srsdl clear <series>/<season?>: Clears all episode links from a season',
                'srsdl add season <series>: Creates new season in existing series in descriptor with dialog',
                'srsdl edit <series>/<season> <key> <value>: Edits an existing season',
                'srsdl add episode <series>/<season> <JSON>: Adds single or Array of episode(s) to season',
                'srsdl add episode <series>/<season> -f/j <Text file> <seperator?=newline>',
                'srsdl edit <series>/<season> episodes <operation>',
                '\tOperations are the following: clear <number>, move <number1> <number2>, edit <number> <content>, switch <number1> <number2>',
                'srsdl remove <series>/<season?>'
            ].join('\n'));
            break;

        case "add":
            if (args[1] == 'series') {
                
            }
            else if (args[1] == 'season') {

            }
            else {
                console.log('None or unknown option given');
            }
            break;

        case "list":
            console.log(entries());
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
    let path = `./${series.lang}/${series.name}/${season.name}`;
    fs.mkdirSync(path, { recursive: true });
    retries = new Array(season.episodes.length).fill(0);
    for (let i = 1; i <= season.episodes.length; i++) {
        if (!season.episodes[i - 1] || season.episodes[i - 1] == "") {
            console.log(`INFO: Skipped episode ${i}, no link given`);
            continue;
        }
        if (!fs.existsSync(`${path}/${i.toString(10).padStart(2, '0')}.mp4`))
            callYTDL(season, series, i, path)
        else
            console.log("INFO: Skipped episode " + i + ", the file exists already in the specified directory");
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
                console.log(err);
                console.error(`ERROR: Download of episode ${i} failed... Retrying in a minute, Try ${retries[i - 1]} of 10`);
                retries[i - 1]++;
                setTimeout(() => callYTDL(season, series, i, path), 60000);
                return;
            }
            console.log(`INFO: Episode ${i} downloaded`);
        });
}

function entries() {
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
}

main(process.argv.slice(process.argv.findIndex(x => x.toLowerCase().includes('srsdl')) + 1));

fs.writeFileSync('./descriptor.json', JSON.stringify(descriptor));