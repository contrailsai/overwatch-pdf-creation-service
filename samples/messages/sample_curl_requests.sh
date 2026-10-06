curl -X POST http://localhost:4000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "PMO-Data-Search",
    "reportType": "Detailed",
    "database_name": "PMO-Data-Search",
    "postIds": [
        "69cfbdd188ea1e6548d821de",
        "69cfbe0c88ea1e6548d822bf",
        "69cfbe2f88ea1e6548d8234c",
        "69cfbe5888ea1e6548d823ff"
    ],
    "project": {
      "project_name": "PMO",
      "mongo_db_map": "PMO-Data-Search",
      "project_details": {
        "do_takedowns": false,
        "description": "data finding service for PMO",
        "labels": [
            {
            "name": "anti-india-propaganda",
            "description": "",
            "severity": "high"
            },
            {
            "name": "hate-speech",
            "description": "",
            "severity": "medium"
            },
            {
            "name": "misinformation",
            "description": "",
            "severity": "medium"
            },
            {
            "name": "nsfw",
            "description": "",
            "severity": "medium"
            },
            {
            "name": "fraud",
            "description": "",
            "severity": "high"
            },
            {
            "name": "asset-misuse",
            "description": "",
            "severity": "low"
            },
            {
            "name": "satire",
            "description": "",
            "severity": "low"
            },
            {
            "name": "terrorism",
            "description": "",
            "severity": "high"
            },
            {
            "name": "violence",
            "description": "",
            "severity": "medium"
            }
        ],
        "legal_codes": []
      }
    }
  }'

curl http://localhost:4000/job-status/1