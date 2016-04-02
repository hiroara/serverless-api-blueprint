Serverless API Blueprint
=============================

This is API Documentation generator plugin for [Serverless](http://www.serverless.com/) project.
API Documentations are generated as [API Blueprint](https://apiblueprint.org/) format.

This can embed `event.json` as request body and actual response to docs to help your API development.

## Getting Started

You can install with following steps. (Requirement: Serverless v0.5 or higher)

### Install the plugin

    npm install --save git+https://github.com/hiroara/serverless-api-blueprint.git

### Configure your project

All configurations are defined under `apib` namespace.

#### Project level (`s-project.json`)

- `targets`
  - Definitions of target directoreis to generate docs.
  - Default: empty
- `targets.<target name>.format`
  - Format type defined in API Blueprint
  - Supported values are `1A` only.
  - Default: `1A`
- `targets.<target name>.name`
  - Readable name of the API
  - Default: Target name
- `targets.<target name>.description`
  - Description of the API
  - Default: Blank
- `targets.<target name>.resourceGroups`
  - Definitions of resource groups
  - Each keys represent name of each resource groups
  - Default: Empty
- `targets.<target name>.resourceGroups.<name>.description`
  - Description of the resource group
  - Default: Blank
- `targets.<target name>.resourceGroups.<name>.resources`
  - Description of the resource group
  - Each keys represent path of each resources
  - Default: Blank
- `targets.<target name>.resourceGroups.<name>.resources.<resource path>.name`
  - Name of the resource
  - Default: <function path>
- `targets.<target name>.dataStructures`
  - Definitions of data structures
  - Each keys represent name of each data structure
  - Default: Empty
- `targets.<target name>.dataStructures.<structure name>.type` - Data type of data structures
  - Default: `object`
- `targets.<target name>.dataStructures.<structure name>.attributes`
  - Attributes definitions
  - Can contain additional information
- `targets.<target name>.dataStructures.<structure name>.attributes.<parameter name>.type`
  - Parameter type as expected by the API
  - Default: `string`
- `targets.<target name>.dataStructures.<structure name>.attributes.<parameter name>.required`
  - Specifier of a required parameter
  - Default: `string`
- `targets.<target name>.dataStructures.<structure name>.attributes.<parameter name>.example`
  - Example value of the parameter
  - Default: None
- `targets.<target name>.dataStructures.<structure name>.attributes.<parameter name>.default`
  - Default value of the parameter
  - Default: None
- `targets.<target name>.dataStructures.<structure name>.attributes.<parameter name>.description`
  - Description of the parameter
  - Default: Blank
- `targets.<target name>.dataStructures.<structure name>.attributes.<parameter name>.additionalDescription`
  - Additional description of the parameter
  - Default: None

```
{
  ...
  "custom": {
    "apib": {
      "targets": {
        "restApi": {
          "format": "1A",
          "name": "Awesome REST API",
          "description": "This is Awesome REST API!",
          "resourceGroups": {
            ...
            "Users": {
              "description": "Users registered in this service.",
              "resources": {
                "users/me": {
                  "name": "Resource Owner User"
                }
              }
            },
            ...
          },
          "dataStructures": {
            ...
            "Attachment": {
              "type": "object",
              "attributes": {
                ...
                "name": {
                  "type": "string",
                  "description": "File name",
                  "example": "default.jpg"
                }
                ...
              }
            }
            ...
          }
        }
      }
    }
  },
  ...
}
```

#### Function level (`<targetDir>/[<subFolders>]/<functionDir>/s-function.json`)

Functions on Serverless framework are used as actions.

This plugin often uses each functions on Serverless framework as multiple actions on API Blueprint, because each functions can have multiple endpoints.

- `name`
  - Readable name of actions
  - Default: Function name (defined in `s-function.json` at path `name`)
- `description`
  - Description of actions
  - Default: Blank
- `request`
  - Indicator of whether or not to generate request example
  - Can contain additional information
  - Default: `false` (Do not generate)
- `request.contentType`
  - Content type of the request
  - Default: `application/json`
- `request.eventStructure`
  - Definition of structure of `event.json`
  - I recommend to define with `s-templates.json`
- `request.eventStructure.body`
  - Path of request body in `event.json`
  - Default: Root of json
- `response`
  - Indicator of whether or not to generate response example
  - Can contain additional information
  - Default: `false` (Do not generate)
- `response.contentType`
  - Content type of the request
  - Default: `application/json`
- `parameters` or `attributes`
  - Parameter or Attributes definitions
  - Can contain additional information
  - Defined in same way as `dataStructures.<name>.attributes`
  - Default: Empty

```
{
  ...
  "custom": {
    "apib": {
      "name": "Update an Cool Resource",
      "description": "Update specific cool resource. You should call this API!",
      "request": {
        "contentType": "application/json",
        "eventStructure": {
          "body": "body"
        }
      },
      "response": true,
      "pathParameters": {
        "cool_resource_id": {
          "example": "dummy-resource-id",
          "description": "Identifier of Target Resource",
          "required": true
        }
      },
      "attributes": {
        ...
        "username": {
          "type": "string",
          "example": "test_user",
          "description": "Name or email of the user",
          "additionalDescription": "This parameter will be recognized whether name or email automatically.",
          "required": true
        },
        ...
      }
    }
  },
  ...
}
```


## Usage

You can generate docs following command.

    sls apib generate

Or execute with `--targets` or `-t` option (comma separated).

    sls apib generate --target restApiV1,restApiV2

Enjoy!
