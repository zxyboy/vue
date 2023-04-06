/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
// 以数组原型为原型，创建对象：arrayMethods
export const arrayMethods = Object.create(arrayProto)
// 数据中能够响应式的方法，这些方法会被Vue自动Patch，以实现响应式需求
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  // 数据原生方法
  const original = arrayProto[method]
  // def函数，给arrayMethods对象定义属性
  def(arrayMethods, method, function mutator (...args) {
    // 调用原生方法，获取结果
    const result = original.apply(this, args)
    // 获取Observer实例
    const ob = this.__ob__
    // 表示新增的数据
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted)
    // notify change
    ob.dep.notify()
    return result
  })
})
