'use strict'


const path = require('path')
const BbPromise = require('bluebird') // Serverless uses Bluebird Promises and we recommend you do to because they provide more than your average Promise :)
const fs = BbPromise.promisifyAll(require('fs'))

const util = require('util')
const mkdirp = BbPromise.promisify(require('mkdirp'))
const chalk = require('chalk')

const _ = require('lodash')
const Handlebars = require('handlebars')
Handlebars.registerHelper('indent', (data, level) => {
  if (!_.isString(data)) { return }
  const indent = _.times(level, () => ' ').join('')
  return new Handlebars.SafeString(data.replace(/(^|\n)/g, '$1' + indent).replace(/ *$/g, ''))
})
Handlebars.registerHelper('default', (value, defaultValue) => {
  return new Handlebars.SafeString(value || defaultValue)
})
Handlebars.registerHelper('oneLine', (value) => {
  if (_.isString(value)) {
    return value.replace(/\n/g, '\\n')
  } else {
    return value
  }
})

function matchPath(path1, path2) {
  return path1.replace(/^\//, '') === path2.replace(/^\//, '')
}

function filterFunctions(functions, resourceGroups) {
  const resourcePaths = _.flatMap(resourceGroups, (group) => _.keys(group.resources))
  return _.chain(functions).values()
    .filter(func => _.has(func.custom, 'apib') && !_.result(func.custom, 'apib.ignore') && _.some(func.endpoints.map(endpoint => endpoint.path), _.partial(_.includes, resourcePaths)))
    .value()
}

module.exports = function(S) { // Always pass in the ServerlessPlugin Class

  /**
   * Adding/Manipulating Serverless classes
   * - You can add or manipulate Serverless classes like this
   *
   * S.classes.Project.newStaticMethod     = function() { console.log("A new method!") }
   * S.classes.Project.prototype.newMethod = function() { S.classes.Project.newStaticMethod() }
   *
   */


  /**
   * Extending the Plugin Class
   * - Here is how you can add custom Actions and Hooks to Serverless.
   * - This class is only required if you want to add Actions and Hooks.
   */

  class APIBlueprintPlugin extends S.classes.Plugin {

    /**
     * Constructor
     * - Keep this and don't touch it unless you know what you're doing.
     */

    constructor() {
      super()
    }

    /**
     * Define your plugins name
     * - We recommend adding prefixing your personal domain to the name so people know the plugin author
     */

    static getName() {
      return 'com.ari-hiro.' + APIBlueprintPlugin.name
    }

    /**
     * Register Actions
     * - If you would like to register a Custom Action or overwrite a Core Serverless Action, add this function.
     * - If you would like your Action to be used programatically, include a "handler" which can be called in code.
     * - If you would like your Action to be used via the CLI, include a "description", "context", "action" and any options you would like to offer.
     * - Your custom Action can be called programatically and via CLI, as in the example provided below
     */

    registerActions() {

      S.addAction(this._generateDocs.bind(this), {
        handler:       'generateDocs',
        description:   'Generate API Documentation formatted as API Blueprint.',
        context:       'apib',
        contextAction: 'generate',
        options:       [
          {
            option:      'region',
            shortcut:    'r',
            description: 'region you want to list env vars for',
          },
          {
            option:      'stage',
            shortcut:    's',
            description: 'stage you want to list env vars for',
          },
          {
            option:      'targets',
            shortcut:    't',
            description: 'target names',
          },
          {
            option:      'out',
            shortcut:    'o',
            description: 'output directory path',
          },
          {
            option:      'cache',
            shortcut:    'c',
            description: 'cache directory path',
          },
        ],
        parameters: [ // Use paths when you multiple values need to be input (like an array).  Input looks like this: "serverless custom run module1/function1 module1/function2 module1/function3.  Serverless will automatically turn this into an array and attach it to evt.options within your plugin
          /*
          {
            parameter: 'paths',
            description: 'One or multiple paths to your function',
            position: '0->' // Can be: 0, 0-2, 0->  This tells Serverless which params are which.  3-> Means that number and infinite values after it.
          }
          */
        ],
      })

      return BbPromise.resolve()
    }

    /**
     * Register Hooks
     * - If you would like to register hooks (i.e., functions) that fire before or after a core Serverless Action or your Custom Action, include this function.
     * - Make sure to identify the Action you want to add a hook for and put either "pre" or "post" to describe when it should happen.
     */

    registerHooks() {
      return BbPromise.resolve()
    }

    _generateDocs(evt) {

      const _this = this
      this.project = S.getProject()
      this.stage = evt.options.stage || _.chain(this.project.stages).keys().sort().first().value()
      this.region = evt.options.region || _.chain(this.project.stages[this.stage].regions).keys().sort().first().value()
      this.cache = evt.options.cache

      return new BbPromise(function (resolve) {

        _this._logHeader('Parse configurations')

        return BbPromise.mapSeries(_.toPairs(_this.project.custom.apib.targets),
          pair => _this._parseTarget.apply(_this, pair)
        ).then(componentData => {

          _this._logHeader('\nGenerate documentations')

          const output = path.resolve('.', evt.options.out ? evt.options.out : 'docs')

          BbPromise.map(['./templates/index.hbs', './templates/attributes.hbs', './templates/parameters.hbs', './templates/attributes-item.hbs'], templatePath => {
            return fs.readFileAsync(path.join(__dirname, templatePath), 'utf8')
          })
            .spread((indexTemplate, attributesTemplate, parametersTemplate, attributesItemTemplate) => {
              Handlebars.registerPartial('attributes', attributesTemplate)
              Handlebars.registerPartial('parameters', parametersTemplate)
              Handlebars.registerPartial('attributesItem', attributesItemTemplate)
              return { index: Handlebars.compile(indexTemplate, { noEscape: true }) }
            })
            .then(templates => {
              return componentData.map((data) => {
                return {
                  name: data.name,
                  path: path.join(output, data.name + '.apib'),
                  body: templates.index(data).replace(/ +$/gm, ''),
                }
              })
            })
            .then(docs => {
              return BbPromise.all(docs.map(doc => {
                _this._logSuccess(chalk.green(util.format('Generate docs for component "%s" at "%s"...', doc.name, doc.path)))
                return mkdirp(path.dirname(doc.path))
                  .then(() => fs.writeFileAsync(doc.path, doc.body))
              }))
            })
            .then(() => _this._logSuccess('\nAPI Docs are generated successfully!'))
            .then(resolve)
        })
      })
    }

    _parseTarget(key, target) {
      this._logSuccess(util.format('=> Target: %s', key))
      const format = _.result(target, 'format') || '1A'
      if (format != '1A') { throw util.format('Unsupported format: "%s"', format) }
      const resourceGroups = _.result(target, 'resourceGroups')
      const targetDir = path.join(S.config.projectPath, key, path.sep)
      const funcs = _.filter(this.project.functions, func => func.getFilePath().indexOf(targetDir) === 0)
      const dataStructures = _.mapValues(_.result(target, 'dataStructures') || {}, (structure) => _.defaults(structure, { type: 'object' }))
      return BbPromise.mapSeries(filterFunctions(funcs, resourceGroups), _.bind(this._generateActions, this))
        .then(_.flatten)
        .then(resources => {
          return {
            name: key,
            displayName: target.name || key,
            description: _.result(target, 'description'),
            format: format,
            resourceGroups: _.mapValues(resourceGroups, (group) => {
              return _.assign(group, {
                resources: _.mapValues(group.resources, (r, path) => _.defaults(r, {
                  path: path.replace(/^\/?/, '/'),
                  actions: _.chain(resources).filter(resource => matchPath(resource.path, path)).flatMap(resource => resource.actions).value(),
                })),
              })
            }),
            dataStructures: dataStructures,
          }
        })
    }

    _generateActions(func) {
      const funcPath = path.dirname(func.getFilePath())
      const funcData = this._parseFunction(func.toObjectPopulated({ stage: this.stage, region: this.region }), funcPath)
      const endpoints = func.endpoints.map(_.bind(this._parseEndpoint, this))
      return funcData.then((data) => this._getFunctionResult(func, funcPath, data.event).then(result => [result, data]))
        .spread((result, data) => {
          const actionData = this._buildActionData(this._assignRequestData(data, result.request), result.response)
          return _.chain(endpoints).groupBy(endpoint => endpoint.path).map((actions, path) => {
            return {
              name: funcPath,
              path: path,
              actions: actions.map(action => _.assign(action, actionData)),
            }
          }).value()
        })
    }

    _parseFunction(func, funcPath) {
      this._logSuccess('  => Function: ' + funcPath)
      return fs.readFileAsync(path.join(funcPath, 'event.json'), 'utf8')
        .then(event => {
          return {
            name: func.name,
            displayName: _.result(func.custom, 'apib.name') || func.name,
            description: _.result(func.custom, 'apib.description') || func.description,
            request: _.result(func.custom, 'apib.request'),
            response: _.result(func.custom, 'apib.response'),
            parameters: _.result(func.custom, 'apib.parameters'),
            pathParameters: _.result(func.custom, 'apib.pathParameters'),
            attributes: _.result(func.custom, 'apib.attributes'),
            event: JSON.parse(event),
          }
        })
    }
    _parseEndpoint(endpoint) {
      this._logSuccess('    => Endpoint: ' + endpoint.method + ' ' + endpoint.path)
      return {
        method: endpoint.method,
        path: endpoint.path,
      }
    }

    _assignRequestData(data, event) {
      return _.tap(data, data => {
        if (data.request === true) { data.request = {} }
        if (data.request != null) {
          _.defaults(data.request, { contentType: 'application/json' })

          const bodyPath = _.result(data.request, 'eventStructure.body')
          const pathParamsPath = _.result(data.request, 'eventStructure.pathParams')

          if (_.isObject(data.pathParameters)) {
            this._assignExamples(data.pathParameters, this._getEventData(event, pathParamsPath))
          }

          if (data.request.contentType !== 'application/json') {
            data.request.body = this._prettyJSONStringify(event)
          } else if (data.attributes == null && data.parameters == null) {
            data.request.body = this._prettyJSONStringify(this._getEventData(event, bodyPath))
          } else {
            _.each([data.attributes, data.parameters], (attrs) => {
              this._assignExamples(attrs, this._getEventData(event, bodyPath))
            })
          }
        }
      })
    }

    _getFunctionResult(func, funcPath, event) {
      return this._getCacheOfFunction(funcPath)
        .catch(() => this._invokeFunction(func, funcPath, event))
    }
    _getCachePath(funcPath, filename) {
      if (filename == null) {
        return path.join(this.cache, path.relative(S.config.projectPath, funcPath))
      } else {
        return path.join(this.cache, path.relative(S.config.projectPath, funcPath), filename)
      }
    }
    _getCacheOfFunction(funcPath) {
      if (this.cache == null) { return BbPromise.reject('Caching is disabled.') }
      return BbPromise.props({
        request: fs.readFileAsync(this._getCachePath(funcPath, 'request.json'), 'utf8').then(JSON.parse),
        response: fs.readFileAsync(this._getCachePath(funcPath, 'response.json'), 'utf8').then(JSON.parse),
      })
    }
    _writeCacheOfFunction(funcPath, event, response) {
      mkdirp(this._getCachePath(funcPath)).then(() => {
        return BbPromise.all([
          fs.writeFileAsync(this._getCachePath(funcPath, 'request.json'), JSON.stringify(event)),
          fs.writeFileAsync(this._getCachePath(funcPath, 'response.json'), JSON.stringify(response)),
        ])
      }).catch((error) => {
        this._logFailure(error)
        return fs.unlinkAsync(this._getCachePath(funcPath)).finally(() => { throw error })
      })
    }
    _invokeFunction(func, funcPath, event) {
      this._logSuccess(util.format('>>> Invoke function: %s', funcPath))
      return S.actions.functionRun({ options: { name: func.name, stage: this.stage, region: this.region } })
        .tap(() => this._logSuccess(util.format('<<< Finish function: %s', funcPath)))
        .tap(resp => this.cache != null ? this._writeCacheOfFunction(funcPath, event, resp) : null)
        .then(resp => { return { response: resp, request: event } })
    }

    _buildActionData(data, response) {
      return _.chain(data).clone().tap(data => {
        if (data.response && !_.isObject(data.response)) { data.response = {} }
        let responseBody = response.data.result.response
        if (_.isString(_.result(data.response, 'eventStructure.body'))) {
          responseBody = _.result(responseBody, data.response.eventStructure.body)
        }
        if (data.response != null) {
          _.defaults(data.response, { contentType: 'application/json' })
          _.assign(data.response, {
            status: response.data.result.status,
            statusCode: this._statusCodeFor(response.data.result.status),
            body: this._prettyJSONStringify(responseBody),
          })
        }
      }).value()
    }

    _statusCodeFor(status) {
      switch(status) {
      case 'success': return 200
      default: throw util.format('Unsupported response status: %s', status)
      }
    }

    _assignExamples(parameters, data) {
      return _.chain(parameters).keys().tap(keys => {
        _.chain(keys)
          .filter(key => (parameters[key].type || 'string') === 'string')
          .each(key => {
            const value = data[key]
            parameters[key].example = _.isObject(value) ? JSON.stringify(value) : value
          })
          .value()
      }).value()
    }
    _getEventData(eventData, path) {
      return path == null ? eventData : _.result(eventData, path, {})
    }

    _prettyJSONStringify(obj) {
      return JSON.stringify(obj, null, 2)
    }

    _logHeader(msg) {
      console.log(chalk.black.bgGreen.bold(msg))
    }
    _logSuccess(msg) {
      console.log(chalk.green(msg))
    }
    _logFailure(msg) {
      console.log(chalk.red(msg))
    }
  }

  // Export Plugin Class
  return APIBlueprintPlugin

}

// Godspeed!
