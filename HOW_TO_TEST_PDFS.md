HOW TO TEST PDFS : 

#START THE DEV SERVER
npm run dev:reports

#POST THE JSON TO THE SERVER
curl -X POST http://localhost:3847/ -H "Content-Type: application/json" -d @sample_sqs_message.json

#REPONSE LIKE:
{"ok":true,"reportHash":"8a5527e0602560d95ddec076fe55f945e5086acb578bb11f876d5a0a4b149856","format":"pdf","localPath":"/Users/tempus/Desktop/overwatch/overwatch-pdf-creation/local-reports/output/8a5527e0602560d95ddec076fe55f945e5086acb578bb11f876d5a0a4b149856.pdf","downloadPath":"/reports/8a5527e0602560d95ddec076fe55f945e5086acb578bb11f876d5a0a4b149856.pdf","downloadUrl":"http://127.0.0.1:3847/reports/8a5527e0602560d95ddec076fe55f945e5086acb578bb11f876d5a0a4b149856.pdf","wget":"wget -O 8a5527e0602560d95ddec076fe55f945e5086acb578bb11f876d5a0a4b149856.pdf http://127.0.0.1:3847/reports/8a5527e0602560d95ddec076fe55f945e5086acb578bb11f876d5a0a4b149856.pdf"}⏎                                             

#YOU CAN FIND THESE REPORTS IN ./local-reports/output
OR

#GET THE PDF FROM THE SERVER OUTPUT
curl http://localhost:3847/reports/69971de6d954acef4dc30207.pdf

#GET THE DOCX FROM THE SERVER OUTPUT
curl http://localhost:3847/reports/69971de6d954acef4dc30207.docx