const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const DEFAULT_REGION = process.env.AWS_REGION || 'ap-south-1';
const IMAGE_FETCH_TIMEOUT_MS = Number(process.env.IMAGE_FETCH_TIMEOUT_MS || 8000);
const IMAGE_FETCH_MAX_RETRIES = Number(process.env.IMAGE_FETCH_MAX_RETRIES || 2);

const s3Client = new S3Client({ region: DEFAULT_REGION });
const bucketName = process.env.AWS_BUCKET_NAME || process.env.AWS_S3_BUCKET || '';

function ensureBucketConfigured() {
  if (!bucketName) {
    throw new Error('Missing AWS bucket configuration. Set AWS_BUCKET_NAME or AWS_S3_BUCKET.');
  }
}

function buildS3Url(key) {
  return `https://${bucketName}.s3.${DEFAULT_REGION}.amazonaws.com/${key}`;
}

/**
 * Uploads a readable stream directly to S3.
 * @param {stream.Readable} readStream
 * @param {string} key
 * @returns {Promise<string>} The uploaded object URL
 */
async function uploadStreamToS3(readStream, key, contentType = 'application/pdf') {
  ensureBucketConfigured();
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucketName,
      Key: key,
      Body: readStream,
      ContentType: contentType,
    },
  });

  await upload.done();
  
  return buildS3Url(key);
}

/**
 * Uploads a Buffer directly to S3 (used for DOCX files generated via Packer.toBuffer()).
 * @param {Buffer} buffer
 * @param {string} key
 * @param {string} contentType
 * @returns {Promise<string>} The uploaded object URL
 */
async function uploadBufferToS3(buffer, key, contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
  ensureBucketConfigured();
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    },
  });

  await upload.done();

  return buildS3Url(key);
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
  const signedUrl = await getSignedImageUrl(url);
  let lastError = null;

  for (let attempt = 0; attempt <= IMAGE_FETCH_MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(signedUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
        throw new Error(`Resource is not an image (content-type: ${contentType})`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === IMAGE_FETCH_MAX_RETRIES;
      if (isLastAttempt) {
        break;
      }
      const backoffMs = 250 * (2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(`Image fetch failed after ${IMAGE_FETCH_MAX_RETRIES + 1} attempts: ${lastError?.message || 'Unknown error'}`);
}

module.exports = {
  s3Client,
  uploadStreamToS3,
  uploadBufferToS3,
  fetchImageFromS3Url,
  getSignedImageUrl,
};
