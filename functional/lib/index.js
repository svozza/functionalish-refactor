const C = require('crocks');
const R = require('ramda');

const {Async, ReaderT} = C;

const {fromPromise} = Async;

const ReaderAsync = ReaderT(Async);

function listStreams() {
    return ReaderAsync(fromPromise(({kvs}) => kvs.listStreams().promise()));
}

function getEndpoint(apiName) {
    return ReaderAsync(fromPromise(({kvs, streamName}) =>
        kvs.getDataEndpoint({ StreamName: streamName, APIName: apiName}).promise())
    );
}

function getClip(endpoint) {
    return ReaderAsync(({streamName, KinesisVideoArchivedMedia, region}) => {
        const now = new Date();
        const kvam = new KinesisVideoArchivedMedia({
            region,
            endpoint: endpoint.DataEndpoint
        });

        const getClipAsync = fromPromise(params => kvam.getClip(params).promise());

        return getClipAsync({
            StreamName: streamName,
            ClipFragmentSelector: {
                FragmentSelectorType: 'SERVER_TIMESTAMP',
                TimestampRange: {StartTimestamp: new Date(now.getTime() - 5 * 1000), EndTimestamp: now}
            }
        });
    });
}

const screenshot = clip => {
    return ReaderAsync(({streamName, ffmpeg, fs}) => {
        const workdir = `/tmp`;
        const vidFile = `${workdir}/${streamName}.mp4`;
        const thumbFile = `${workdir}/${streamName}.jpg`;

        const writeFileAsync = fromPromise((file, payload) => fs.writeFile(file, payload));

        return writeFileAsync(vidFile, clip.Payload)
            .chain(() => {
                return Async((reject, resolve) => ffmpeg(vidFile)
                    .screenshots({ count: 1, timemarks: [ '00:00:01.000' ], folder: workdir, filename: `${streamName}.jpg`})
                    .on('end', resolve)
                    .on('error', reject))
            })
            .map(() => [thumbFile, vidFile]);
    });
};

function uploadThumbnail(file) {
    return ReaderAsync(({streamName, s3, Bucket, fs}) => {
        const readFileAsync = fromPromise(file => fs.readFile(file));
        const uploadAsync = fromPromise(params => s3.upload(params).promise());

        return readFileAsync(file)
            .chain(buffer =>
                uploadAsync({Bucket, Key: `public/previews/${streamName}.${file.split('.')[1]}`, Body: buffer })
            );
    });
}

function generatePreviews(streamName) {
    return getEndpoint('API_NAME' )
        .chain(getClip)
        .chain(screenshot)
        .chain(R.traverse(ReaderAsync.of, uploadThumbnail))
        .local(e => ({streamName, ...e}))
        .map(R.tap(() => console.log("Uploaded Previews...")))
}

module.exports = {
    handler: function (event) {
        return listStreams()
            .map(R.prop('StreamInfoList'))
            .map(R.filter(s => s.Status === "ACTIVE"))
            .map(R.map(s => s.StreamName))
            .chain(R.traverse(ReaderAsync.of, generatePreviews))
    }
}
