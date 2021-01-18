const fs = require('fs').promises;
const ffmpeg = require('fluent-ffmpeg');
const AWS = require('aws-sdk');
const C = require('crocks');
const R = require('ramda');
const fs = require("fs");
const util = require('util');
const {handler} = require('./lib');

const s3 = new AWS.S3();
const kvs = new AWS.KinesisVideo({region: "eu-west-1"});

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
                fs
            })
            .toPromise();
    }
};
