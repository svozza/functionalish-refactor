const fs = require('fs').promises;
const ffmpeg = require('fluent-ffmpeg');
const AWS = require('aws-sdk');
const {handler} = require('./lib');

const s3 = new AWS.S3();
const kvs = new AWS.KinesisVideo();

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

const {KinesisVideoArchivedMedia} = AWS;

module.exports = {
    handler: async (event) => {
        return handler(event)
            .runWith({
                kvs,
                KinesisVideoArchivedMedia,
                s3,
                ffmpeg,
                Bucket: process.env.BUCKET || 'MyBucket',
                fs,
                region: process.env.AWS_REGION || 'eu-west-1'
            })
            .toPromise();
    }
};
