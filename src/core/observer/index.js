/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import {arrayMethods} from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'
// 拿到arrayMethods上所有自身属性的属性名（包括不可枚举属性但不包括 Symbol 值作为名称的属性）组成的数组
const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
// 变量：控制是否开启响应式
export let shouldObserve: boolean = true

// 外部可以通过该方法赋值shouldObserve值
export function toggleObserving(value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
// 观察者对象
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor(value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    // 给value对象添加 __ob__ 观察者属性， 属性值为：当前Observer对象
    def(value, '__ob__', this)
    // 数组
    if (Array.isArray(value)) {
      // 数组上是否包含 '__proto__' 属性
      if (hasProto) {
        protoAugment(value, arrayMethods)
      } else {
        // 数据对象value新增属性，属性名为数组arrayKeys中的每一项，属性值为arrayMethods中对应的属性值
        // 也就是添加了数组的7个方法
        copyAugment(value, arrayMethods, arrayKeys)
      }
      // 数据对象添加响应式，7个方法：push、pop、shift、unshift、splice、sort、reverse
      this.observeArray(value)
    } else {
      // 对象
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  // 遍历对象，将对象上的所有属性添加响应式
  walk(obj: Object) {
    // 得到obj上所有可以枚举的属性名组成的数组
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      // 将obj上所有可以枚举的属性名，添加响应式
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  // 将items数组上每一个元素，
  observeArray(items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
// 将src对象的原型指向target对象
function protoAugment(target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */

/* istanbul ignore next */
// 将src对象的属性添加到target对象上
function copyAugment(target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
// Q：这个方法的作用是什么？
// A: 为数据对象添加观察者，如果数据对象已经有观察者了，那么就直接返回该观察者
export function observe(value: any, asRootData: ?boolean): Observer | void {
  // 如果value不是对象或者是VNode实例，直接返回
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  // 如果value上有__ob__属性，且该属性值是Observer实例，那么ob就是该Observer实例
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    // 如果shouldObserve为true，且不是服务端渲染，且value是数组或者是纯对象，且value是可扩展的，且value上没有_isVue属性
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    // 创建一个Observer实例
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
// 给obj上的key赋值value，并定义响应式属性
export function defineReactive(
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  const dep = new Dep()

  const property = Object.getOwnPropertyDescriptor(obj, key)
  // 如果属性描述符是不可配置的，则直接返回
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set
  // 如果没有getter，且有setter，并且仅传入obj和key ，则直接返回
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }
  // 如果val是对象，那么就为val添加观察者
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter() {
      // 如果有getter，那么就调用getter方法，否则直接返回val
      const value = getter ? getter.call(obj) : val
      // 如果Dep.target存在，那么就将Dep.target添加到dep的subs数组中
      if (Dep.target) {
        dep.depend()
        // 如果childOb存在，那么就将Dep.target添加到childOb的subs数组中
        if (childOb) {
          childOb.dep.depend()
          // 如果value是数组，那么就将Dep.target添加到value每一项的__ob__的dep的subs数组中
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter(newVal) {
      // 如果有getter，那么就调用getter方法，否则直接返回val
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      // 如果新值和旧值相等，或者新值和旧值都是NaN，那么直接返回
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      // 如果没有setter，直接返回
      if (getter && !setter) return
      // 如果有setter，那么就调用setter方法，否则直接将新值赋值给val
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      // 如果新值是对象，那么就为新值添加观察者
      childOb = !shallow && observe(newVal)
      // 通知dep，触发依赖更新
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
// 给target上的key赋值val，并触发依赖更新
export function set(target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // 如果target是数组，且key是有效的数组索引，那么就将val插入到target的key位置
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  // 如果key在target上，且不是原型上的属性，那么就直接将val赋值给target的key属性
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  // 获取target上的__ob__属性
  const ob = (target: any).__ob__
  // 如果target是Vue实例或者是Vue实例的根数据对象，那么就直接返回val
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  // 如果ob不存在，那么就直接将val赋值给target的key属性
  if (!ob) {
    target[key] = val
    return val
  }
  // 将val定义为响应式属性
  defineReactive(ob.value, key, val)
  // 通知ob，触发依赖更新
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
// 删除target上的key，并触发依赖更新
export function del(target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // 如果target是数组，且key是有效的数组索引，那么就将target的key位置的元素删除
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  // 获取target上的__ob__属性
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  // 如果key不在target上，或者是原型上的属性，那么直接返回
  if (!hasOwn(target, key)) {
    return
  }
  // 删除target上的key属性
  delete target[key]
  // 如果ob不存在，直接返回
  if (!ob) {
    return
  }
  // 通知ob，触发依赖更新
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
// 如果value是数组，那么就将Dep.target添加到value的每一项的__ob__的dep的subs数组中
function dependArray(value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    // 如果e是对象，且e有__ob__属性，那么就将e.__ob__.dep添加到Dep.target的subs数组中
    e && e.__ob__ && e.__ob__.dep.depend()
    // 如果e是数组，那么就递归调用dependArray方法
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
