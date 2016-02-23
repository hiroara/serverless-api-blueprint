'use strict'

/**
 * Serverless Plugin Boilerplate
 * - Useful example/starter code for writing a plugin for the Serverless Framework.
 * - In a plugin, you can:
 *    - Create a Custom Action that can be called via the CLI or programmatically via a function handler.
 *    - Overwrite a Core Action that is included by default in the Serverless Framework.
 *    - Add a hook that fires before or after a Core Action or a Custom Action
 *    - All of the above at the same time :)
 *
 * - Setup:
 *    - Make a Serverless Project dedicated for plugin development, or use an existing Serverless Project
 *    - Make a "plugins" folder in the root of your Project and copy this codebase into it. Title it your custom plugin name with the suffix "-dev", like "myplugin-dev"
 *    - Run "npm link" in your plugin, then run "npm link myplugin" in the root of your project.
 *    - Start developing!
 *
 * - Good luck, serverless.com :)
 */

module.exports = function(ServerlessPlugin) { // Always pass in the ServerlessPlugin Class

  const path = require('path')
  const util = require('util')
  const _ = require('lodash')
  const BbPromise = require('bluebird') // Serverless uses Bluebird Promises and we recommend you do to because they provide more than your average Promise :)
  const fs = BbPromise.promisifyAll(require('fs'))
  const Handlebars = require('handlebars')
  const mkdirp = BbPromise.promisify(require('mkdirp'))
  const chalk = require('chalk')

  /**
   * ServerlessPluginBoierplate
   */

  class ServerlessPluginBoilerplate extends ServerlessPlugin {

    /**
     * Constructor
     * - Keep this and don't touch it unless you know what you're doing.
     */

    constructor(S) {
      super(S)
    }

    /**
     * Define your plugins name
     * - We recommend adding prefixing your personal domain to the name so people know the plugin author
     */

    static getName() {
      return 'com.ari-hiro.' + ServerlessPluginBoilerplate.name
    }

    /**
     * Register Actions
     * - If you would like to register a Custom Action or overwrite a Core Serverless Action, add this function.
     * - If you would like your Action to be used programatically, include a "handler" which can be called in code.
     * - If you would like your Action to be used via the CLI, include a "description", "context", "action" and any options you would like to offer.
     * - Your custom Action can be called programatically and via CLI, as in the example provided below
     */

    registerActions() {

      this.S.addAction(this._generateDocs.bind(this), {
        handler:       'generateDocs',
        description:   'Generate API Documentation formatted as API Blueprint.',
        context:       'apib',
        contextAction: 'generate',
        options:       [
          {
            option:      'targets',
            shortcut:    't',
            description: 'target components',
          },
          {
            option:      'out',
            shortcut:    'o',
            description: 'output directory path',
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

      let _this = this

      return new BbPromise(function (resolve) {

        _this._logHeader('Parse configurations')

        const targetComponents = _this._getTargetComponents(
          _this._getTargets(evt, _this.S.state.project.custom),
          _this.S.state.project.components
        )

        return BbPromise.mapSeries(targetComponents,
          component => _this._parseComponent.call(_this, component)
        ).then(componentData => {

          _this._logHeader('\nGenerate documentations')

          const output = path.resolve('.', evt.options.out ? evt.options.out : 'docs')

          BbPromise.map(['./templates/index.hbs'], templatePath => {
            return fs.readFileAsync(path.join(__dirname, templatePath), 'utf8')
          })
            .spread((indexTemplate) => { return { index: Handlebars.compile(indexTemplate, { noEscape: true }) } })
            .then(templates => {
              return componentData.map((data) => {
                return {
                  name: data.name,
                  path: path.join(output, data.name + '.apib'),
                  body: templates.index(data),
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

    _getTargets(evt, projectCustom) {
      return evt.options.targets ?
        evt.options.targets.split(',') : _.result(projectCustom, 'apib.targets')
    }
    _getTargetComponents(targets, components) {
      return targets ? targets.map(target =>
        _.tap(components[target], component => {
          if (component == null) { throw util.format('Unknown target named "%s"', target) }
        })
      ) : _.values(components)
    }

    _parseComponent(component) {
      this._logSuccess(util.format('=> Component: %s', component.name))
      const format = _.result(component.custom, 'apib.format') || '1A'
      if (format != '1A') { throw util.format('Unsupported format: "%s"', format) }
      return BbPromise.mapSeries(_.values(component.modules), module => this._parseModule(module, component.name))
        .then(_.flatten)
        .then(resources => {
          return {
            name: component.name,
            displayName: _.result(component.custom, 'apib.name') || component.name,
            description: _.result(component.custom, 'apib.description'),
            format: format,
            resources: resources,
          }
        })
    }
    _parseModule(module, ns) {
      this._logSuccess('  => Module: ' + module.name)
      const data = {
        name: module.name,
        displayName: _.result(module.custom, 'apib.name') || module.name,
        description: _.result(module.custom, 'apib.description'),
      }
      const modulePath = [ns, module.name].join('/')
      return BbPromise.mapSeries(_.values(module.functions), func =>
        this._parseFunction(func, modulePath)
      )
        .then(_.flatten)
        .then(resources => resources.map(resource => _.assign(resource, data)))
    }
    _parseFunction(func, ns) {
      this._logSuccess('    => Function: ' + func.name)
      const funcPath = [ns, func.name].join('/')
      const endpoints = func.endpoints.map(endpoint => this._generateDocsOfEndpoint(endpoint))
      const data = fs.readFileAsync(path.join(this.S.config.projectPath, funcPath, 'event.json'), 'utf8')
        .then(requestBody => _.tap({
          name: func.name,
          displayName: _.result(func.custom, 'apib.name') || func.name,
          description: _.result(func.custom, 'apib.description'),
          request: _.result(func.custom, 'apib.request'),
          response: _.result(func.custom, 'apib.response'),
        }, data => {
          if (data.request === true) { data.request = {} }
          if (data.request != null) {
            _.defaults(data.request, { contentType: 'application/json' })
            data.request.body = requestBody
          }
        }))
      return BbPromise.join(this._invokeFunction(funcPath), data)
        .spread((result, data) => {
          const actionData = this._buildActionData(data, result)
          return _.chain(endpoints).groupBy(endpoint => endpoint.path).map((actions, path) => {
            return {
              path: path,
              actions: actions.map(action => _.assign(action, actionData)),
            }
          }).value()
        })
    }
    _generateDocsOfEndpoint(endpoint) {
      this._logSuccess('      => Endpoint: ' + endpoint.method + ' ' + endpoint.path)
      return {
        method: endpoint.method,
        path: endpoint.path,
      }
    }

    _invokeFunction(funcPath) {
      this._logSuccess(util.format('>>> Invoke function: %s', funcPath))
      return this.S.actions.functionRun({ options: { path: funcPath } })
        .tap(() => this._logSuccess(util.format('<<< Finish function: %s', funcPath)))
    }

    _buildActionData(data, functionResult) {
      return _.chain(data).clone().tap(data => {
        if (data.response === true) { data.response = {} }
        if (data.response != null) {
          _.defaults(data.response, { contentType: 'application/json' })
          _.assign(data.response, {
            status: functionResult.data.result.status,
            statusCode: this._statusCodeFor(functionResult.data.result.status),
            body: this._prettyJSONStringify(functionResult.data.result.response, 2),
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

    _prettyJSONStringify(obj, indent) {
      const indentString = _.times(indent, _.constant(' ')).join('')
      return JSON.stringify(obj, null, 2)
        .split('\n')
        .map(line => indentString + line).join('\n')
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
  return ServerlessPluginBoilerplate

}

// Godspeed!
