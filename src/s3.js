const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const stream = require('stream');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1', // Defaulting to the region from the logs
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const bucketName = process.env.AWS_S3_BUCKET;

/**
 * Uploads a readable stream directly to S3.
 * @param {stream.Readable} readStream
 * @param {string} key
 * @returns {Promise<string>} The uploaded object URL
 */
async function uploadStreamToS3(readStream, key) {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucketName,
      Key: key,
      Body: readStream,
      ContentType: 'application/pdf',
    },
  });

  await upload.done();
  
  // Return standard S3 URL format
  return `https://${bucketName}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;
}

/**
 * Extracts bucket and key from a standard S3 URL.
 * Assumes format: https://bucket-name.s3.region.amazonaws.com/path/to/key
 */
function parseS3Url(url) {
  try {
    const parsed = new URL(url);
    const hostParts = parsed.hostname.split('.');
    if (hostParts.length >= 3 && hostParts[1] === 's3') {
      const bucket = hostParts[0];
      // remove the leading slash from the path
      const key = parsed.pathname.substring(1);
      return { bucket, key };
    }
  } catch (error) {
    console.error('Error parsing S3 URL:', url);
  }
  return null;
}

/**
 * Generates a signed URL for an S3 object.
 */
async function getSignedImageUrl(url, expiresIn = 3600) {
  const parsed = parseS3Url(url);
  if (!parsed) {
    return url; // Fallback to original if not a standard S3 URL
  }
  
  const command = new GetObjectCommand({
    Bucket: parsed.bucket,
    Key: parsed.key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Fetches an object from S3 and returns a readable stream or buffer.
 * Needed if we have to download raw images from S3 to cache via sharp.
 * But maybe the URLs in the DB are already public S3 URLs or signed URLs.
 * If we need to fetch them from HTTP, we can just use `fetch`.
 */
async function fetchImageFromS3Url(url) {
  // First, attempt to sign the URL if it's an S3 URL
  const signedUrl = await getSignedImageUrl(url);
  
  // Fetch using the signed URL
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

module.exports = {
  s3Client,
  uploadStreamToS3,
  fetchImageFromS3Url,
  getSignedImageUrl,
};
