const test = require('tape')

const formatProperties = require('./format-properties')

const userData = (input) => {
  return {
    getUserData: () => input
  }
}

test('When formatProperties is required ', t => {
  t.equal(typeof formatProperties, 'function', 'it should export a function')
  t.end()
})

test('When given no properties to update', t => {
  const emptyPageInstance = {}
  t.deepEqual(formatProperties(emptyPageInstance, userData({})), {}, 'it should do nothing')
  t.end()
})

test('When updating a page', t => {
  const emptyPageInstance = {}
  t.deepEqual(formatProperties(emptyPageInstance, userData({})), {}, 'it should do nothing')

  const contentProps = [
    'title',
    'heading',
    'lede',
    'legend',
    'label',
    'hint'
  ]
  contentProps.forEach(prop => {
    const pageInstance = {[prop]: '{x}'}
    t.deepEqual(formatProperties(pageInstance, userData({x: 'value'})), {[prop]: 'value'}, `it should update ${prop} properties`)
  })

  const pageInstance = {body: '{x}'}
  t.deepEqual(formatProperties(pageInstance, userData({x: 'value'})), {body: '<p>value</p>'}, 'it should update body properties')

  const pageInstanceWithHtml = {label: {html: '{x}'}}
  t.deepEqual(formatProperties(pageInstanceWithHtml, userData({x: 'value'})), {label: {html: '<p>value</p>'}}, 'it should update nested html properties')

  t.end()
})

test('When updating a page', t => {
  const emptyPageInstance = {}
  t.deepEqual(formatProperties(emptyPageInstance, userData({})), {}, 'it should do nothing')

  const contentProps = [
    'body',
    'html'
  ]
  contentProps.forEach(prop => {
    const pageInstance = {[prop]: '{x}'}
    t.deepEqual(formatProperties(pageInstance, userData({x: 'value'})), {[prop]: '<p>value</p>'}, `it should update ${prop} properties`)
  })

  const pageInstance = {body: '{x}'}
  t.deepEqual(formatProperties(pageInstance, userData({x: 'value'})), {body: '<p>value</p>'}, 'it should update body properties')

  const pageInstanceWithHtml = {label: {html: '{x}'}}
  t.deepEqual(formatProperties(pageInstanceWithHtml, userData({x: 'value'})), {label: {html: '<p>value</p>'}}, 'it should update nested html properties')

  t.end()
})

// 'title',
// 'heading',
// 'body',
// 'lede',
// 'legend',
// 'label',
// 'hint',
// 'html'