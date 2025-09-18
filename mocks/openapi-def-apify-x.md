https://ampcode.com/threads/T-f3b07613-f10a-4b83-a6c6-f6d71c7a0f59

```javascript
{
  "openapi": "3.0.1",
  "info": {
    "title": "🏯 Tweet Scraper V2 - X / Twitter Scraper",
    "description": "⚡️ Lightning-fast search, URL, list, and profile scraping, with customizable filters. At $0.40 per 1000 tweets, and 30-80 tweets per second, it is ideal for researchers, entrepreneurs, and businesses! Get comprehensive insights from Twitter (X) now!",
    "version": "0.0",
    "x-build-id": "hfcEpYmu7h5Zm8u7f"
  },
  "servers": [
    {
      "url": "https://api.apify.com/v2"
    }
  ],
  "paths": {
    "/acts/apidojo~tweet-scraper/run-sync-get-dataset-items": {
      "post": {
        "operationId": "run-sync-get-dataset-items-apidojo-tweet-scraper",
        "x-openai-isConsequential": false,
        "summary": "Executes an Actor, waits for its completion, and returns Actor's dataset items in response.",
        "tags": [
          "Run Actor"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/inputSchema"
              }
            }
          }
        },
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Enter your Apify token here"
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    },
    "/acts/apidojo~tweet-scraper/runs": {
      "post": {
        "operationId": "runs-sync-apidojo-tweet-scraper",
        "x-openai-isConsequential": false,
        "summary": "Executes an Actor and returns information about the initiated run in response.",
        "tags": [
          "Run Actor"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/inputSchema"
              }
            }
          }
        },
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Enter your Apify token here"
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/runsResponseSchema"
                }
              }
            }
          }
        }
      }
    },
    "/acts/apidojo~tweet-scraper/run-sync": {
      "post": {
        "operationId": "run-sync-apidojo-tweet-scraper",
        "x-openai-isConsequential": false,
        "summary": "Executes an Actor, waits for completion, and returns the OUTPUT from Key-value store in response.",
        "tags": [
          "Run Actor"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/inputSchema"
              }
            }
          }
        },
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Enter your Apify token here"
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "inputSchema": {
        "type": "object",
        "properties": {
          "startUrls": {
            "title": "Start URLs",
            "type": "array",
            "description": "Twitter (X) URLs. Paste the URLs and get the results immediately. Tweet, Profile, Search or List URLs are supported.",
            "items": {
              "type": "string"
            }
          },
          "searchTerms": {
            "title": "Search Terms",
            "type": "array",
            "description": "Search terms you want to search from Twitter (X). You can refer to https://github.com/igorbrigadir/twitter-advanced-search.",
            "items": {
              "type": "string"
            }
          },
          "twitterHandles": {
            "title": "Twitter handles",
            "type": "array",
            "description": "Twitter handles that you want to search on Twitter (X)",
            "items": {
              "type": "string"
            }
          },
          "conversationIds": {
            "title": "Conversation IDs",
            "type": "array",
            "description": "Conversation IDs that you want to search on Twitter (X)",
            "items": {
              "type": "string"
            }
          },
          "maxItems": {
            "title": "Maximum number of items on output",
            "type": "integer",
            "description": "Maximum number of items that you want as output."
          },
          "sort": {
            "title": "Sort By",
            "enum": [
              "Top",
              "Latest"
            ],
            "type": "string",
            "description": "Sorts search results by the given option. Only works with search terms and search URLs."
          },
          "tweetLanguage": {
            "title": "Tweet language",
            "enum": [
              "ab",
              "aa",
              "af",
              "ak",
              "sq",
              "am",
              "ar",
              "an",
              "hy",
              "as",
              "av",
              "ae",
              "ay",
              "az",
              "bm",
              "ba",
              "eu",
              "be",
              "bn",
              "bi",
              "bs",
              "br",
              "bg",
              "my",
              "ca",
              "ch",
              "ce",
              "ny",
              "zh",
              "cu",
              "cv",
              "kw",
              "co",
              "cr",
              "hr",
              "cs",
              "da",
              "dv",
              "nl",
              "dz",
              "en",
              "eo",
              "et",
              "ee",
              "fo",
              "fj",
              "fi",
              "fr",
              "fy",
              "ff",
              "gd",
              "gl",
              "lg",
              "ka",
              "de",
              "el",
              "kl",
              "gn",
              "gu",
              "ht",
              "ha",
              "he",
              "hz",
              "hi",
              "ho",
              "hu",
              "is",
              "io",
              "ig",
              "id",
              "ia",
              "ie",
              "iu",
              "ik",
              "ga",
              "it",
              "ja",
              "jv",
              "kn",
              "kr",
              "ks",
              "kk",
              "km",
              "ki",
              "rw",
              "ky",
              "kv",
              "kg",
              "ko",
              "kj",
              "ku",
              "lo",
              "la",
              "lv",
              "li",
              "ln",
              "lt",
              "lu",
              "lb",
              "mk",
              "mg",
              "ms",
              "ml",
              "mt",
              "gv",
              "mi",
              "mr",
              "mh",
              "mn",
              "na",
              "nv",
              "nd",
              "nr",
              "ng",
              "ne",
              "no",
              "nb",
              "nn",
              "ii",
              "oc",
              "oj",
              "or",
              "om",
              "os",
              "pi",
              "ps",
              "fa",
              "pl",
              "pt",
              "pa",
              "qu",
              "ro",
              "rm",
              "rn",
              "ru",
              "se",
              "sm",
              "sg",
              "sa",
              "sc",
              "sr",
              "sn",
              "sd",
              "si",
              "sk",
              "sl",
              "so",
              "st",
              "es",
              "su",
              "sw",
              "ss",
              "sv",
              "tl",
              "ty",
              "tg",
              "ta",
              "tt",
              "te",
              "th",
              "bo",
              "ti",
              "to",
              "ts",
              "tn",
              "tr",
              "tk",
              "tw",
              "ug",
              "uk",
              "ur",
              "uz",
              "ve",
              "vi",
              "vo",
              "wa",
              "cy",
              "wo",
              "xh",
              "yi",
              "yo",
              "za",
              "zu"
            ],
            "type": "string",
            "description": "Restricts tweets to the given language, given by an ISO 639-1 code."
          },
          "onlyVerifiedUsers": {
            "title": "Only verified users",
            "type": "boolean",
            "description": "If selected, only returns tweets by users who are verified."
          },
          "onlyTwitterBlue": {
            "title": "Only Twitter Blue",
            "type": "boolean",
            "description": "If selected, only returns tweets by users who are Twitter Blue subscribers."
          },
          "onlyImage": {
            "title": "Only image",
            "type": "boolean",
            "description": "If selected, only returns tweets that contain images."
          },
          "onlyVideo": {
            "title": "Only video",
            "type": "boolean",
            "description": "If selected, only returns tweets that contain videos."
          },
          "onlyQuote": {
            "title": "Only quote",
            "type": "boolean",
            "description": "If selected, only returns tweets that are quotes."
          },
          "author": {
            "title": "Tweet author",
            "type": "string",
            "description": "Returns tweets sent by the given user. It should be a Twitter (X) Handle."
          },
          "inReplyTo": {
            "title": "In reply to",
            "type": "string",
            "description": "Returns tweets that are replies to the given user. It should be a Twitter (X) Handle."
          },
          "mentioning": {
            "title": "Mentioning",
            "type": "string",
            "description": "Returns tweets mentioning the given user. It should be a Twitter (X) Handle."
          },
          "geotaggedNear": {
            "title": "Geotagged near",
            "type": "string",
            "description": "Returns tweets sent near the given location."
          },
          "withinRadius": {
            "title": "Within radius",
            "type": "string",
            "description": "Returns tweets sent within the given radius of the given location."
          },
          "geocode": {
            "title": "Geocode",
            "type": "string",
            "description": "Returns tweets sent by users located within a given radius of the given latitude/longitude."
          },
          "placeObjectId": {
            "title": "Place object ID",
            "type": "string",
            "description": "Returns tweets tagged with the given place."
          },
          "minimumRetweets": {
            "title": "Minimum retweets",
            "type": "integer",
            "description": "Returns tweets with at least the given number of retweets."
          },
          "minimumFavorites": {
            "title": "Minimum favorites",
            "type": "integer",
            "description": "Returns tweets with at least the given number of favorites."
          },
          "minimumReplies": {
            "title": "Minimum replies",
            "type": "integer",
            "description": "Returns tweets with at least the given number of replies."
          },
          "start": {
            "title": "Start date",
            "type": "string",
            "description": "Returns tweets sent after the given date."
          },
          "end": {
            "title": "End date",
            "type": "string",
            "description": "Returns tweets sent before the given date."
          },
          "includeSearchTerms": {
            "title": "Include Search Terms",
            "type": "boolean",
            "description": "If selected, a field will be added to each tweets about the search term that was used to find it."
          },
          "customMapFunction": {
            "title": "Custom map function",
            "type": "string",
            "description": "Function that takes each of the objects as argument and returns data that will be mapped by the function itself. This function is not intended for filtering, please don't use it for filtering purposes or you will get banned automatically."
          }
        }
      },
      "runsResponseSchema": {
        "type": "object",
        "properties": {
          "data": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "actId": {
                "type": "string"
              },
              "userId": {
                "type": "string"
              },
              "startedAt": {
                "type": "string",
                "format": "date-time",
                "example": "2025-01-08T00:00:00.000Z"
              },
              "finishedAt": {
                "type": "string",
                "format": "date-time",
                "example": "2025-01-08T00:00:00.000Z"
              },
              "status": {
                "type": "string",
                "example": "READY"
              },
              "meta": {
                "type": "object",
                "properties": {
                  "origin": {
                    "type": "string",
                    "example": "API"
                  },
                  "userAgent": {
                    "type": "string"
                  }
                }
              },
              "stats": {
                "type": "object",
                "properties": {
                  "inputBodyLen": {
                    "type": "integer",
                    "example": 2000
                  },
                  "rebootCount": {
                    "type": "integer",
                    "example": 0
                  },
                  "restartCount": {
                    "type": "integer",
                    "example": 0
                  },
                  "resurrectCount": {
                    "type": "integer",
                    "example": 0
                  },
                  "computeUnits": {
                    "type": "integer",
                    "example": 0
                  }
                }
              },
              "options": {
                "type": "object",
                "properties": {
                  "build": {
                    "type": "string",
                    "example": "latest"
                  },
                  "timeoutSecs": {
                    "type": "integer",
                    "example": 300
                  },
                  "memoryMbytes": {
                    "type": "integer",
                    "example": 1024
                  },
                  "diskMbytes": {
                    "type": "integer",
                    "example": 2048
                  }
                }
              },
              "buildId": {
                "type": "string"
              },
              "defaultKeyValueStoreId": {
                "type": "string"
              },
              "defaultDatasetId": {
                "type": "string"
              },
              "defaultRequestQueueId": {
                "type": "string"
              },
              "buildNumber": {
                "type": "string",
                "example": "1.0.0"
              },
              "containerUrl": {
                "type": "string"
              },
              "usage": {
                "type": "object",
                "properties": {
                  "ACTOR_COMPUTE_UNITS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_WRITES": {
                    "type": "integer",
                    "example": 1
                  },
                  "KEY_VALUE_STORE_LISTS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_INTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_EXTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_RESIDENTIAL_TRANSFER_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_SERPS": {
                    "type": "integer",
                    "example": 0
                  }
                }
              },
              "usageTotalUsd": {
                "type": "number",
                "example": 0.00005
              },
              "usageUsd": {
                "type": "object",
                "properties": {
                  "ACTOR_COMPUTE_UNITS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_WRITES": {
                    "type": "number",
                    "example": 0.00005
                  },
                  "KEY_VALUE_STORE_LISTS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_INTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_EXTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_RESIDENTIAL_TRANSFER_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_SERPS": {
                    "type": "integer",
                    "example": 0
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```