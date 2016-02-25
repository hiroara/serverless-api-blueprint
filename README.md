Serverless API Blueprint
=============================

This is API Documentation generator plugin for [Serverless](http://www.serverless.com/) project.
API Documentations are generated as [API Blueprint](https://apiblueprint.org/) format.

This can embed `event.json` as request body and actual response to docs to help your API development.

## Getting Started

You can install with following steps.

### Install the plugin

    npm install --save git+https://github.com/hiroara/serverless-api-blueprint.git

### Configure your project

All configurations are defined under `apib` namespace.

#### Project level (`s-project.json`)

- `targets`
  - Names of target components to generate docs.
  - Default: All components

```
{
  ...
  "custom": {
    "apib": {
      "targets": ["restApi"]
    }
  },
  ...
}
```

#### Component level (`<componentDir>/s-component.json`)

Each components on Serverless framework are used as an independent API.

Thus each API Documentations are generated per component.

- `format`
  - Format type defined in API Blueprint
  - Supported values are `1A` only.
  - Default: `1A`
- `name`
  - Readable name of the API
  - Default: Component name (defined in `s-component.json` at path `name`)
- `description`
  - Description of the API
  - Default: Blank

```
{
  ...
  "custom": {
    "apib": {
      "format": "1A",
      "name": "Awesome REST API",
      "description": "This is Awesome REST API!"
    }
  },
  ...
}
```

#### Module level (`<componentDir>/<moduleDir>/s-module.json`)

Modules on Serverless framework are used as resource groups.

This plugin uses modules as parent definitions of each endpoints.

For examples, there are endpoints defined in a module with different methods and same path.
Then these endpoints are described as same resource defined with informations of the module.

But these endpoints are defined with difference paths, then it will generate multiple resources with informations of same module.

- `name`
  - Readable name of resource groups
  - Default: Component name (defined in `s-component.json` at path `name`)
- `description`
  - Description of resources
  - Default: Blank
- `resources`
  - Resource definitions
  - Default: Empty
- `resources.<path>.name`
  - Name of the resource
  - Default: `<module name>`

```
{
  ...
  "custom": {
    "apib": {
      "name": "Cool Resource Group",
      "description": "This is very cool resource!",
      "resources": {
        "awesomethings": "Awesome Things"
      }
    }
  },
  ...
}
```

#### Function level (`<componentDir>/<moduleDir>/<actionDir>/s-action.json`)

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
  - Default: Empty
- `parameters.<parameter name>.type` or `attributes.<parameter name>.type`
  - Parameter type as expected by the API
  - Default: `string`
- `parameters.<parameter name>.required` or `attributes.<parameter name>.required`
  - Specifier of a required parameter
  - Default: `string`
- `parameters.<parameter name>.example` or `attributes.<parameter name>.example`
  - Example value of the parameter
  - Default: None
- `parameters.<parameter name>.default` or `attributes.<parameter name>.default`
  - Default value of the parameter
  - Default: None
- `parameters.<parameter name>.description` or `attributes.<parameter name>.description`
  - Description of the parameter
  - Default: Blank
- `parameters.<parameter name>.additionalDescription` or `attributes.<parameter name>.additionalDescription`
  - Additional description of the parameter
  - Default: None

```
{
  ...
  "custom": {
    "apib": {
      "name": "Create an Cool Resource",
      "description": "Create an cool resource. You should call this API!",
      "request": {
        "contentType": "application/json",
        "eventStructure": {
          "body": "body"
        }
      },
      "response": true,
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
