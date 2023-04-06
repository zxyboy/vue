/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools
} from '../util/index'
// 最大更新数量
export const MAX_UPDATE_COUNT = 100
// 一个队列，用来存放watcher
const queue: Array<Watcher> = []
// 一个队列，用来存放已经激活的组件
const activatedChildren: Array<Component> = []
// 一个对象，用来存放watcher的id
let has: { [key: number]: ?true } = {}
// 一个对象，用来存放watcher的id和更新次数
let circular: { [key: number]: number } = {}
// 是否正在等待刷新
let waiting = false
// 是否正在刷新
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 */
// 重置调度器的状态: 重置队列、重置已激活的组件、重置watcher的id、重置watcher的id和更新次数、重置是否正在等待刷新、重置是否正在刷新、重置index
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

/**
 * Flush both queues and run the watchers.
 */
// 刷新队列和运行watcher
function flushSchedulerQueue () {
  // 设置正在刷新为true
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  // 翻译以上英文成中文：
  // 1. 组件是从父组件更新到子组件的。 (因为父组件总是在子组件之前创建)
  // 2. 一个组件的用户watcher在它的渲染watcher之前运行 (因为用户watcher总是在渲染watcher之前创建)
  // 3. 如果一个组件在父组件的watcher运行期间被销毁，那么它的watcher可以被跳过
  // 将队列中的watcher按照id进行排序: 从小到大
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  // 翻译以上英文成中文：
  // 不要缓存长度，因为在我们运行现有的watcher时，可能会推送更多的watcher
  // 遍历队列中的watcher
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    // 如果watcher存在before方法，则执行before方法
    if (watcher.before) {
      watcher.before()
    }
    // 获取watcher的id
    id = watcher.id
    // 将watcher的id从has中删除
    has[id] = null
    // 执行watcher的run方法
    watcher.run()
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  // 翻译以上英文成中文：
  // 在重置状态之前，保留队列的副本
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()
  // 重置调度器的状态
  resetSchedulerState()

  // call component updated and activated hooks
  // 翻译以上英文成中文：
  // 调用组件更新和激活的钩子
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}
// 调用组件更新和激活的钩子
function callUpdatedHooks (queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    if (vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
      // 调用组件更新的钩子
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}
// 调用组件更新和激活的钩子
function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 */
// 将watcher放入队列中
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  // 如果watcher已经存在队列中，直接返回

  // 如果watcher已经不存在队列中
  if (has[id] == null) {
    // 保存watcher的id
    has[id] = true
    // 如果队列不是正在刷新， 则将watcher放入队列中
    if (!flushing) {
      queue.push(watcher)
    } else {
      // if already flushing, splice the watcher based on its id
      // 翻译成中文： if already flushing, splice the watcher based on its id
      // 如果队列正在刷新，那么就根据watcher的id将watcher插入到队列中
      // if already past its id, it will be run next immediately.
      // 翻译成中文：if already past its id, it will be run next immediately.
      // 如果watcher的id已经存在队列中，那么就会立即执行

      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      // 根据watcher的id的大小，将watcher插入到队列中
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    // 如果没有在等待刷新，那么就将waiting设置为true
    if (!waiting) {
      waiting = true

      if (process.env.NODE_ENV !== 'production' && !config.async) {
        flushSchedulerQueue()
        return
      }
      nextTick(flushSchedulerQueue)
    }
  }
}
