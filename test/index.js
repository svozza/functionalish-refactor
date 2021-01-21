const fs = require('fs').promises;
const rewire = require('rewire');
const stream = require('stream');
const imperative = rewire('../imperative');
const functionalish = rewire('../functionalish');
const functional = rewire('../functional/lib');

describe('index', () => {

    const streamName = 'myStream';

    describe('handler', () => {

        const mockKvs = {
            listStreams() {
                return {
                    async promise() {
                        return {StreamInfoList: [{StreamName: streamName, Status: 'ACTIVE'}]}
                    }
                }
            },
            getDataEndpoint({StreamName, APIName}) {
                return {
                    async promise() {
                        if (StreamName !== 'myStream' || APIName !== 'API_NAME') throw new Error('getDataEndpoint params are wrong');
                        return {DataEndpoint: 'myEndpoint'}
                    }
                }
            }
        };

        let calls = 0;
        const mockS3 = {
            upload({Key, Body}) {
                return {
                    async promise() {
                        calls++
                        if (calls === 1 && (Key !== 'public/previews/myStream.jpg')) throw new Error('upload params are wrong');
                        if (calls === 2) {
                            calls = 0;
                            if(Key !== 'public/previews/myStream.mp4') throw new Error('upload params are wrong');
                        }
                        if (Body !== 'buffer') throw new Error('upload params are wrong');
                        return 'uploaded'
                    }
                }
            }
        };

        const mockAws = {
            KinesisVideoArchivedMedia: function ({region, endpoint}) {
                if (region !== 'eu-west-1' || endpoint !== 'myEndpoint') throw new Error('KinesisVideoArchivedMedia are wrong');
                return {
                    getClip({StreamName, ClipFragmentSelector: {FragmentSelectorType, TimestampRange: {StartTimestamp, EndTimestamp}}}) {
                        return {
                            async promise() {
                                if (StreamName !== streamName || FragmentSelectorType !== 'SERVER_TIMESTAMP'
                                    || StartTimestamp == null || EndTimestamp == null) {
                                    throw new Error('getClip params are wrong');
                                }
                                return {Payload: 'payload'}
                            }
                        }
                    }
                }
            }
        };

        const mockedStream = new stream.Readable();
        mockedStream._read = function (size) {
        };

        const mockFfmpeg = () => {
            return {
                screenshots: () => mockedStream
            };
        };

        const mockReadFile = async () => {
            return 'buffer';
        };

        [
            imperative,
            functionalish,
        ].forEach(index => {

            index.__set__({
                AWS: mockAws,
                kvs: mockKvs,
                s3: mockS3,
                ffmpeg: mockFfmpeg,
                readFile: mockReadFile
            });

            it('should work for non-monad implementation', async () => {
                setTimeout(() => {
                    mockedStream.emit('data', 'Hello data!');
                    mockedStream.emit('end');
                }, 500);

                return index.handler({});
            });

        });

        it('should work for functional implementation', async () => {
            setTimeout(() => {
                mockedStream.emit('data', 'Hello data!');
                mockedStream.emit('end');
            }, 500);

            return functional.handler({})
                .runWith({
                    KinesisVideoArchivedMedia: mockAws.KinesisVideoArchivedMedia,
                    kvs: mockKvs,
                    s3: mockS3,
                    ffmpeg: mockFfmpeg,
                    fs: {
                        readFile: mockReadFile,
                        writeFile: fs.writeFile
                    },
                    Bucket: 'MyBucket'
                })
                .toPromise();
        });

    });

});

