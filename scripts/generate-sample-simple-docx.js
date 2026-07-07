/**
 * Throwaway helper: generate sample Simple Case + Simple Profile DOCX files
 * to eyeball the output (esp. the borderless, centered image).
 *
 * Run: node scripts/generate-sample-simple-docx.js
 * Output: ./local-reports/output/sample-*.docx
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const { generateSimpleCaseDocxBuffer } = require('../src/components/docx/SimpleCaseReportDocx');
const { generateSimpleProfileDocxBuffer } = require('../src/components/docx/SimpleProfileReportDocx');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'local-reports', 'output');

async function makeSampleImage() {
  const tmpPath = path.join(os.tmpdir(), `sample_simple_${Date.now()}.jpg`);
  await sharp({
    create: { width: 600, height: 380, channels: 3, background: { r: 37, g: 99, b: 235 } },
  })
    .jpeg({ quality: 80 })
    .toFile(tmpPath);
  return tmpPath;
}

const project = {
  project_name: 'Sample Project',
  project_details: { labels: [], legal_codes: [] },
};

const post = {
  _id: '6a21768dedbcf91f9a6b3e1f',
  original_url: 'https://x.com/Itsbiyaaa_/status/2051543021800624445',
  review_details: {
    reasoning:
      'The post claims that former Prime Minister Imran Ahmed Niazi has an apartment in One Constitution Avenue Apartments, citing Hassan Ayub. Reports indicate he sold his apartment in 2022.',
    simple_report_description:
      'The post makes a false claim that former Prime Minister Imran Ahmed Niazi currently owns an apartment in One Constitution Avenue Apartments. Reports indicate he sold his apartment in 2022. Such content is misinformation but does not meet the criteria for blocking under Section 69A of the IT Act.',
  },
};

const secondPost = {
  _id: '6a21768dedbcf91f9a6b3e20',
  original_url: 'https://x.com/example/status/123456789',
  review_details: {
    reasoning: 'Fallback reasoning used when simple_report_description is absent.',
  },
};

const profile = {
  _id: 'profile-sample',
  username: 'Itsbiyaaa_',
  profile_url: 'https://x.com/Itsbiyaaa_',
  metadata: {
    full_name: 'Biyaaa',
    follower_count: 1,
    location: 'Unknown',
  },
};

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const imagePath = await makeSampleImage();

  const caseBuffer = await generateSimpleCaseDocxBuffer(post, project, imagePath);
  const caseOut = path.join(OUTPUT_DIR, 'sample-simple-case.docx');
  fs.writeFileSync(caseOut, caseBuffer);

  const profileBuffer = await generateSimpleProfileDocxBuffer(
    profile,
    [post, secondPost],
    project,
    [imagePath, imagePath],
  );
  const profileOut = path.join(OUTPUT_DIR, 'sample-simple-profile.docx');
  fs.writeFileSync(profileOut, profileBuffer);

  fs.unlinkSync(imagePath);

  console.log('Wrote sample DOCX files:');
  console.log(`  SimpleCase    -> ${caseOut} (${caseBuffer.length} bytes)`);
  console.log(`  SimpleProfile -> ${profileOut} (${profileBuffer.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
