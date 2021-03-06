/**
 * @module propagateSteps
 **/
require('@ministryofjustice/module-alias/register-module')(module)

const jsonPath = require('jsonpath')

const cloneDeep = require('lodash.clonedeep')

const CommonError = require('~/fb-runner-node/error')

class PageNotFoundError extends CommonError {}
class PageHasParentError extends CommonError {}
class PageRepeatableNamespaceError extends CommonError {}

const namespacesSeenMap = {}

/**
 * Add parent ref to all page instances
 *
 * @param {object} instances
 *  Object containing all instances keyed by _id
 *
 * @return {object}
 *  Updated clone of original instances
 **/
function addPageParents (instances) {
  instances = cloneDeep(instances)

  jsonPath.query(instances, '$..[?(@.steps)]')
    .forEach(({ steps, _id }) => {
      steps
        .forEach((step) => {
          if (!instances[step]) {
            throw new PageNotFoundError(`Step "${step}" does not exist`, {
              data: {
                step,
                instances
              }
            })
          }

          if (instances[step]._parent) {
            throw new PageHasParentError(`Step "${step}" already has a parent`, {
              data: {
                step,
                instances
              }
            })
          }

          instances[step]._parent = _id
        })
    })

  return instances
}

/**
 * Recursively propagate stepsHeading to instance steps
 *
 * @param {object} instances
 *  Object containing all instances keyed by _id
 *
 * @param {object} instance
 *  Instance object
 *
 * @return {undefined}
 *  Updating of instances is achieved by setting properties directly on uncloned instances
 **/
const propagateStepsHeading = (instances, instance) => {
  if (instance.steps) {
    instance.steps.forEach(step => {
      const stepInstance = instances[step]
      if (stepInstance.sectionHeading === undefined) {
        stepInstance.sectionHeading = instance.stepsHeading
      }
    })
  }
}

/**
 * Recursively propagate sectionHeading to instance steps
 *
 * @param {object} instances
 *  Object containing all instances keyed by _id
 *
 * @param {object} instance
 *  Instance object
 *
 * @return {undefined}
 *  Updating of instances is achieved by setting properties directly on uncloned instances
 **/
const propagateSectionHeading = (instances, instance) => {
  if (instance.steps) {
    instance.steps.forEach(step => {
      const stepInstance = instances[step]
      if (stepInstance.sectionHeading === undefined) {
        stepInstance.sectionHeading = instance.sectionHeading
      }
      propagateSectionHeading(instances, stepInstance)
    })
  }
}

/**
 * Recursively propagate namespace to instance steps
 *
 * @param {object} instances
 *  Object containing all instances keyed by _id
 *
 * @param {object} instance
 *  Instance object
 *
 * @return {undefined}
 *  Updating of instances is achieved by setting properties directly on uncloned instances
 **/
function propagateNamespaces (instances, instance) {
  if (namespacesSeenMap[instance._id]) {
    return
  }

  namespacesSeenMap[instance._id] = true

  // NB. we propagate only a parent or a mountPoint instance, not both
  if (instance.mountPoint) {
    const mountPointInstance = instances[instance.mountPoint]
    propagateNamespaces(instances, mountPointInstance)
  } else if (instance._parent) {
    propagateNamespaces(instances, instances[instance._parent])
  }

  function recursePropagation (instance) {
    let namePrefix = ''
    const parent = instances[instance._parent] || instances[instance.mountPoint]

    if (parent) {
      if (!instance.namespaceProtect) {
        const {
          $namespaces: parentNamespaces,
          namePrefix: parentNamePrefix
        } = parent

        if (Array.isArray(parentNamespaces)) {
          instance.$namespaces = cloneDeep(parentNamespaces)
        }

        if (parentNamePrefix) {
          namePrefix = parentNamePrefix
        }
      }

      const {
        scope: parentScope
      } = parent

      if (parentScope) {
        instance.scope = instance.scope || parentScope
      }
    }

    if (instance.namespace) {
      const {
        $namespaces = [],
        namespace,
        repeatable = false
      } = instance

      if (!$namespaces.includes(namespace)) $namespaces.push(namespace)

      instance.$namespaces = $namespaces

      namePrefix = namePrefix
        ? `${namePrefix}.${namespace}`
        : namespace

      if (repeatable) {
        namePrefix += `[{${namespace}}]`
      }
    }

    if (namePrefix) {
      instance.namePrefix = namePrefix
    }

    const {
      steps = []
    } = instance

    steps.forEach((step) => {
      const stepInstance = instances[step]

      recursePropagation(stepInstance)
    })
  }

  recursePropagation(instance)
}

/**
 * Recursively propagate namespace to instance steps
 *
 * @param {object} instances
 *  Object containing all instances keyed by _id
 *
 * @param {object} instance
 *  Instance object
 *
 * @return {undefined}
 *  Updating of instances is achieved by setting properties directly on uncloned instances
 **/
const propagateUrls = (instances, instance) => {
  let serviceRoot = ''
  if (instance.mountPoint) {
    const mountPointInstance = instances[instance.mountPoint]
    propagateUrls(instances, mountPointInstance)
    serviceRoot = instances[instance.mountPoint].url
  }
  if (!serviceRoot.endsWith('/')) {
    serviceRoot += '/'
  }
  if (!instance.url) {
    instance.url = `${serviceRoot}${instance._id}`
    instance.$FALLBACKurl = true
  }
  if (instance.repeatable) {
    if (!instance.namespace) {
      throw new PageRepeatableNamespaceError(`${instance._id} is repeatable but has no namespace`, {
        data: {
          _id: instance._id,
          instances
        }
      })
    }
    const namespaceParam = `/:${instance.namespace}`
    if (!instance.url.endsWith(namespaceParam)) {
      instance.url += namespaceParam
    }
  }
  if (instance.url.startsWith('/')) {
    return
  }
  if (!instance._parent) {
    instance.url = `${serviceRoot}${instance.url}`
  } else {
    const parentInstance = instances[instance._parent]
    propagateUrls(instances, parentInstance)
    instance.url = `${parentInstance.url}/${instance.url}`.replace(/^\/\//, '/')
  }
}

/**
 * Propagate steps information through nested instances
 *
 * @param {object} instances
 *  Object of service instances keyed by id
 *
 * @return {object}
 *  Cloned object containing instances with propagated step info
 **/
function propagate (instances) {
  instances = addPageParents(instances)

  jsonPath.query(instances, '$..[?(@.stepsHeading)]')
    .forEach((instance) => {
      propagateStepsHeading(instances, instance)
    })

  jsonPath.query(instances, '$..[?(@.sectionHeading)]')
    .forEach((instance) => {
      propagateSectionHeading(instances, instance)
    })

  jsonPath.query(instances, '$..[?(@._type && @._type.startsWith("page."))]')
    .forEach((instance) => {
      propagateNamespaces(instances, instance)
      propagateUrls(instances, instance)
    })

  return instances
}

module.exports = {
  propagate
}
