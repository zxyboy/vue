/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
// 一个观察者解析一个表达式，收集依赖，并且当表达式的值改变时触发回调。
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  // 标识当前watcher实例是否是脏的
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    // 判断是否是渲染函数
    if (isRenderWatcher) {
      vm._watcher = this
    }
    // 将当前的watcher实例添加到vm._watchers数组中
    vm._watchers.push(this)
    // options
    // 如果有options参数，就将options参数中的deep、user、lazy、sync、before属性赋值给当前watcher实例
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      this.before = options.before
    } else {
      // 如果没有options参数，就将deep、user、lazy、sync属性赋值为false
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  // 调用getter方法，获取表达式的值
  get () {
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 调用getter方法，获取表达式的值
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        // 如果是深度观察，就调用traverse方法，遍历value
        traverse(value)
      }
      popTarget()
      // 清除依赖
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  // 将当前的watcher添加到dep.subs数组中
  addDep (dep: Dep) {
    const id = dep.id
    // 如果当前watcher实例的depIds中没有id，就将dep添加到当前watcher实例的newDeps数组中
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      // 如果当前watcher实例的depIds中没有id，就将当前watcher实例添加到dep.subs数组中
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  // 清除依赖
  cleanupDeps () {

    let i = this.deps.length
    // 遍历当前watcher实例的deps数组
    while (i--) {
      const dep = this.deps[i]
      // 如果当前watcher实例的newDepIds中没有dep.id，就将当前watcher实例从dep.subs数组中移除
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  // 当依赖发生变化时，会调用update方法
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      // 如果是同步观察，就调用run方法
      this.run()
    } else {
      // 如果是异步观察，就调用queueWatcher方法，将当前watcher实例添加到watcher队列中
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  // 调用run方法
  run () {
    // 如果当前watcher实例没有被销毁，就调用get方法，获取表达式的值
    if (this.active) {
      const value = this.get()
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        // 如果是user，就调用cb方法，执行回调函数, 可以有错误处理
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          // 如果不是user，就调用cb方法，执行回调函数
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  // 调用get方法，获取表达式的值
  evaluate () {
    this.value = this.get()
    // 将dirty设置为false
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  // 调用depend方法，收集依赖
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {

    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      // 如果当前watcher实例没有被销毁，就将当前watcher实例从vm._watchers数组中移除
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        // 将当前watcher实例从dep.subs数组中移除
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
