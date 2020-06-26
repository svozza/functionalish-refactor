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

const generatePreviews = async ({ StreamName: streamName }) => {
    try {
        // Retrieve Clip
        const now = new Date();
        const endpoint = await kvs.getDataEndpoint({ StreamName: streamName, APIName:"GET_CLIP" }).promise();
        const kvam = new AWS.KinesisVideoArchivedMedia({
            region: "eu-west-1",
            endpoint: endpoint.DataEndpoint
        });
        let clip = await kvam.getClip({
            StreamName: streamName,
            ClipFragmentSelector: {
                "FragmentSelectorType": "SERVER_TIMESTAMP",
                "TimestampRange": {"StartTimestamp": new Date(now.getTime() - 5*1000), "EndTimestamp": now}
            }
        }).promise();
        // For FFMPEG screenshots we must use local file instead of a buffer
        const workdir = `/tmp`;
        const vidFile = `/${workdir}/${streamName}.mp4`;
        const thumbFile = `/${workdir}/${streamName}.jpg`;
        await writeFile(vidFile, clip.Payload);
        await new Promise((resolve, reject) => ffmpeg(vidFile)
            .screenshots({ count: 1, timemarks: [ '00:00:01.000' ], folder: workdir, filename: `${streamName}.jpg`})
            .on('end', resolve)
            .on('error', reject)
        );
        await Promise.all([thumbFile, vidFile].map(f => uploadThumbnail(streamName, f)));
        console.log("Uploaded Previews")
    } catch(err) {
        console.error(`Unable to generate thumbnail for ${streamName}: ${err}`);
    }
}

const uploadThumbnail = async (streamName, f) => {
    const buffer = await readFile(f);
    return s3.upload({ Bucket: process.env.BUCKET, Key: `public/previews/${streamName}.${f.split(".")[1]}`, Body: buffer }).promise();
}

exports.handler = async (event) => {
    const streams = await kvs.listStreams().promise();
    await Promise.all(streams.StreamInfoList.filter(s => s.Status === "ACTIVE").map(generatePreviews));
};