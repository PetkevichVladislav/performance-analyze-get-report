const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
require('dotenv').config();

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_STORAGE_CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME;

app.http('get-report', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Request received:', request);

        const query = new URLSearchParams(request.query);
        const guid = query.get('guid') || (request.body && request.body.guid);

        if (!guid) {
            return { status: 400, body: "GUID is required." };
        }

        const blobName = `report_${guid}.json`;
        
        try {
            if (!AZURE_STORAGE_CONNECTION_STRING) {
                throw new Error('Azure Storage Connection string is not specified');
            }
            if (!AZURE_STORAGE_CONTAINER_NAME) {
                throw new Error('Azure Storage container name is not specified');
            }
            context.log(`Http function processed request for URL "${request.url}"`);

            const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
            const containerClient = blobServiceClient.getContainerClient(AZURE_STORAGE_CONTAINER_NAME);
            const client = containerClient.getBlockBlobClient(blobName);
            const downloadBlockBlobResponse = await client.download(0);
            const reportFile = await streamToString(downloadBlockBlobResponse.readableStreamBody);

            return { status: 200, body: reportFile };
        } catch (error) {
            if (error.statusCode === 404) {
                context.log('Report not found:', blobName);
                return { status: 404, body: `Blob "${blobName}" not found in container "${AZURE_STORAGE_CONTAINER_NAME}".` };
            } else {
                context.log('Error downloading report:', error.message);
                return { status: 500, body: `Error downloading report: ${error.message}` };
            }
        }
    }
});

async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => {
            chunks.push(data.toString());
        });
        readableStream.on("end", () => {
            resolve(chunks.join(""));
        });
        readableStream.on("error", reject);
    });
}
