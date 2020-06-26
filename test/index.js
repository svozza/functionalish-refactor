const rewire = require('rewire');
const stream = require('stream');
const imperative = rewire('../imperative');
const functionalish = rewire('../functionalish');

describe('index', () => {

    const mockKvs = {
        listStreams() {
            return {
                async promise() {
                    return {StreamInfoList: [{Status: 'ACTIVE'}]}
                }
            }
        },
        getDataEndpoint() {
            return {
                async promise() {
                    return {DataEndpoint: 'blah'}
                }
            }
        }
    };

    const mockS3 = {
        upload() {
            return {
                async promise() {
                    return 'uploaded'
                }
            }
        }
    };

    const mockAws = {
        KinesisVideoArchivedMedia: function() {
            return {
                getClip() {
                    return {
                        async promise() {
                            return {Payload: 'payload'}
                        }
                    }
                }
            }
        }
    };

    const mockedStream = new stream.Readable();
    mockedStream._read = function(size) {};

    setTimeout(() => {
        mockedStream.emit('data', 'Hello data!');
        mockedStream.emit('end');
    }, 500);

    const mockFfmpeg = () => {
        return {
            screenshots: () => mockedStream
        };
    };

    const mockReadFile = async () => {
        return 'buffer';
    };

    functionalish.__set__('AWS', mockAws);
    functionalish.__set__('kvs', mockKvs);
    functionalish.__set__('s3', mockS3);
    functionalish.__set__('ffmpeg', mockFfmpeg);
    functionalish.__set__('readFile', mockReadFile);

    describe('handler', () => {

        it('should work', async () => {
            return functionalish.handler();
        });

    });

});

