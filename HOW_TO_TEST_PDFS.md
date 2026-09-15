HOW TO TEST PDFS :

#START THE DEV SERVER
npm run dev:reports

#POST THE JSON TO THE SERVER (legacy sample tenants still work if those DBs exist)
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @sample_sqs_message.json

# Schema v3 / Ambani-Data-v2 samples (lowercase `posts` + `profiles` + `case_events`)
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @sample_sqs_message_ambani_v2.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @sample_sqs_message_ambani_v2_single.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @sample_sqs_message_ambani_v2_profile.json

# SEBI Meta Ads (Ads + Ad_profiles in SEBI-Data-Search)
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @sample_sqs_message_sebi_ads_summary.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @sample_sqs_message_sebi_ads_detailed.json

# SEBI Ad Profiles (Ad_profiles → reviewed Ads → reviewed Domains)
# Always reportType Summary. 1 id → dossier PDF; 2+ ids → catalog PDF.
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @sample_sqs_message_sebi_ad_profiles_detailed.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @sample_sqs_message_sebi_ad_profiles_summary.json

# SEBI Domains (Domains in SEBI-Data-Search). Detailed bare vs scam hashes must differ.
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @sample_sqs_message_sebi_domains_summary.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @sample_sqs_message_sebi_domains_detailed.json
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @sample_sqs_message_sebi_domains_detailed_bare.json

#RESPONSE LIKE:
{"ok":true,"reportHash":"8a5527e0602560d95ddec076fe55f945e5086acb578bb11f876d5a0a4b149856","format":"pdf","localPath":"/Users/tempus/Desktop/overwatch/overwatch-pdf-creation/local-reports/output/8a5527e0602560d95ddec076fe55f945e5086acb578bb11f876d5a0a4b149856.pdf","downloadPath":"/reports/8a5527e0602560d95ddec076fe55f945e5086acb578bb11f876d5a0a4b149856.pdf","downloadUrl":"http://127.0.0.1:3847/reports/8a5527e0602560d95ddec076fe55f945e5086acb578bb11f876d5a0a4b149856.pdf","wget":"wget -O 8a5527e0602560d95ddec076fe55f945e5086acb578bb11f876d5a0a4b149856.pdf http://127.0.0.1:3847/reports/8a5527e0602560d95ddec076fe55f945e5086acb578bb11f876d5a0a4b149856.pdf"}

#YOU CAN FIND THESE REPORTS IN ./local-reports/output
OR

#GET THE PDF FROM THE SERVER OUTPUT
curl http://localhost:3847/reports/<reportHash>.pdf

#GET THE DOCX FROM THE SERVER OUTPUT
curl http://localhost:3847/reports/<reportHash>.docx
