# Entity Extraction Backend for Hardware Troubleshooting
This project is a light backend service made with Express.js, to extract device, component, and issue infor from user input using regex matching. 
It is intended to work as an entity extraction layer for IBM watsonx Assistant

### This project is hosted on Vercel and exposed as a serverless API. It can be accessed via:
POST endpoint: https://mai-entity-extraction.vercel.app/extract  
GET endpoint: https://mai-entity-extraction.vercel.app/health  

To use the /extract endpoint, send a JSON payload with a text field in the body:
```
{
  "text": "my laptop battery drains fast"
}
```

## This also serves as a student id generator for Account Management action on watsonx
GET endpoint: https://mai-entity-extraction.vercel.app/studentId