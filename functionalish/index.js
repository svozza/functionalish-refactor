const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);
const AWS = require('aws-sdk');
const fs = require("fs");
const util = require('util');
const s3 = new AWS.S3();
const kvs = new AWS.KinesisVideo({region: "eu-west-1",});
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const getClip = streamName => async endpoint => {
    const now = new Date();
    const kvam = new AWS.KinesisVideoArchivedMedia({
        region: "eu-west-1",
        endpoint: endpoint.DataEndpoint
    });
    return kvam.getClip({
        StreamName: streamName,
        ClipFragmentSelector: {
            "FragmentSelectorType": "SERVER_TIMESTAMP",
            "TimestampRange": {"StartTimestamp": new Date(now.getTime() - 5 * 1000), "EndTimestamp": now}
        }
    }).promise();
};

const screenshot = streamName => async clip => {
    const workdir = `/tmp`;
    const vidFile = `/${workdir}/${streamName}.mp4`;
    const thumbFile = `/${workdir}/${streamName}.jpg`;
    await writeFile(vidFile, clip.Payload);
    await new Promise((resolve, reject) => ffmpeg(vidFile)
        .screenshots({ count: 1, timemarks: [ '00:00:01.000' ], folder: workdir, filename: `${streamName}.jpg`})
        .on('end', resolve)
        .on('error', reject)
    );
    return [thumbFile, vidFile];
};

const uploadThumbnail = streamName => async f => {
    const buffer = await readFile(f);
    return s3.upload({ Bucket: process.env.BUCKET, Key: `public/previews/${streamName}.${f.split(".")[1]}`, Body: buffer }).promise();
};

const map = f => xs => xs.map(f);

const all = ps => Promise.all(ps);

const pipe = (...fs) => fs.reduce((f, g) => x => g(f(x)));

const filter = p => xs => xs.filter(p);

const generatePreviews = async ({ StreamName: streamName }) => {
    return kvs.getDataEndpoint({ StreamName: streamName, APIName: 'API_NAME' }).promise()
        .then(getClip(streamName))
        .then(screenshot(streamName))
        .then(map(uploadThumbnail(streamName)))
        .then(all)
        .catch(err => {
            console.error(`Unable to generate thumbnail for ${streamName}: ${err}`)
            throw err // we want process to fail
        });
};

exports.handler = async (event) => {
    const {StreamInfoList} = await kvs.listStreams().promise();
    return pipe(
        filter(s => s.Status === "ACTIVE"),
        map(generatePreviews),
        all
    )(StreamInfoList);
};