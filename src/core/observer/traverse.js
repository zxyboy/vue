/* @flow */

import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
// 递归遍历对象，触发所有转换的getter，以便对象内的每个嵌套属性都作为“深层”依赖项收集。
export function traverse (val: any) {
  _traverse(val, seenObjects)
  seenObjects.clear()
}

function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  // val是数组
  const isA = Array.isArray(val)
  // val不是数组&& 不是对象 || val被冰冻 || val是VNode
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }
  // 到这里： val一定是数组 或者 对象
  // 如果val上有观察者
  if (val.__ob__) {
    // 取出观察者依赖的id
    const depId = val.__ob__.dep.id
    // seem中包含这个depId，则退出，防止重复操作
    if (seen.has(depId)) {
      return
    }
    // 如果不包含观察者依赖的id，则添加到seen集合中
    seen.add(depId)
  }
  // 数组处理
  if (isA) {
    i = val.length
    // 递归调用： 处理数组的每一项
    while (i--) _traverse(val[i], seen)
  } else {
    // 对象处理
    // 获取对象可枚举的属性（字段）
    keys = Object.keys(val)
    i = keys.length
    // 递归调用： 处理对象的属性
    while (i--) _traverse(val[keys[i]], seen)
  }
}
