# Entity Extraction Backend for Hardware Troubleshooting
This project is a light backend service made with Express.js & Fuse.js, to extract device, component, and issue information from user input. 
It is intended to work as an entity extraction layer for IBM watsonx Assistant.

### How the extraction process works
1. Data used to identify devices, components, and issues are stored in the issueDefinitions.json
2. First, it uses regular experessions with word boundaries (`\b`) to identify the device
3. If a specific component exists, it is also identified in the same manner from the user's text. (Case insensitive)
4. Once a device and component is identified, it narrows down list of possible items
5. Fuse.js library is used to find most relevent issue keyword from the filtered list within user input. Hence flexbilitiy of phrasing and misspellings are allowed.
6. The detected device, component, and best matched issue with description and solution is returned.

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