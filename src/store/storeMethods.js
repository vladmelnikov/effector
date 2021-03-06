//@flow
import $$observable from 'symbol-observable'

import {step, Kind, createNode, createGraph} from 'effector/stdlib'

import invariant from 'invariant'
import {startPhaseTimer, stopPhaseTimer} from 'effector/perf'

import {linkGraphs, type Event} from 'effector/event'
import type {Store, ThisStore} from './index.h'
import type {Subscriber} from '../effector/index.h'

export function reset(storeInstance: ThisStore, event: Event<any>) {
  return on.call(this, storeInstance, event, () => storeInstance.defaultState)
}
export function getState(storeInstance: ThisStore) {
  return storeInstance.plainState.current
}
export function off(storeInstance: ThisStore, event: Event<any>) {
  const currentSubscription = storeInstance.subscribers.get(event)
  if (currentSubscription === undefined) return
  currentSubscription()
  storeInstance.subscribers.delete(event)
}
const readName = (e: *): string => {
  switch (e.kind) {
    case Kind.store:
      return e.shortName
    default:
      return e.getType()
  }
}
export function on(storeInstance: ThisStore, event: any, handler: Function) {
  const e: Event<any> = event
  const meta = {
    fullName: storeInstance.compositeName?.fullName,
    section: storeInstance.id,
  }
  storeInstance.subscribers.set(
    e,
    linkGraphs({
      from: e.graphite,
      to: createGraph({
        node: [
          step.compute({
            fn(newValue) {
              const lastState = getState(storeInstance)
              return handler(lastState, newValue, readName(e))
            },
            meta,
          }),
          step.filter({
            fn(data) {
              const lastState = getState(storeInstance)
              return data !== lastState && data !== undefined
            },
            meta,
          }),
        ],
        child: [storeInstance.graphite],
      }),
    }),
  )
  return this
}
export function observable(storeInstance: ThisStore) {
  const result = {
    subscribe(observer: Subscriber<any>) {
      invariant(
        typeof observer === 'object' && observer !== null,
        'Expected the observer to be an object.',
      )

      function observeState(state) {
        if (observer.next) {
          observer.next(state)
        }
      }
      return subscribe(storeInstance, observeState)
    },
  }
  //$off
  result[$$observable] = function() {
    return this
  }
  return result
}
export function watch(
  storeInstance: ThisStore,
  eventOrFn: Event<*> | Function,
  fn?: Function,
) {
  const kind = String(eventOrFn?.kind || '__')
  const message = 'watch requires function handler'
  switch (kind) {
    case 'store':
    case 'event':
    case 'effect':
      invariant(typeof fn === 'function', message)
      return eventOrFn.watch(payload =>
        //$todo
        fn(getState(storeInstance), payload, readName(eventOrFn)),
      )
    case '__':
    default:
      invariant(typeof eventOrFn === 'function', message)
      return subscribe(storeInstance, eventOrFn)
  }
}
export function subscribe(storeInstance: ThisStore, listener: Function) {
  invariant(
    typeof listener === 'function',
    'Expected the listener to be a function',
  )
  let stopPhaseTimerMessage = 'Got initial error'
  let lastCall = getState(storeInstance)

  startPhaseTimer(storeInstance, 'subscribe')
  try {
    listener(lastCall)
    stopPhaseTimerMessage = 'Initial'
  } catch (err) {
    console.error(err)
  }
  stopPhaseTimer(stopPhaseTimerMessage)
  const meta = {
    fullName: storeInstance.compositeName?.fullName,
    section: storeInstance.id,
  }
  return linkGraphs({
    from: storeInstance.graphite,
    to: createNode(
      step.compute({
        fn: n => n,
      }),
      step.run({
        fn(args) {
          let stopPhaseTimerMessage = null
          startPhaseTimer(storeInstance, 'subscribe')
          if (args === lastCall) {
            stopPhaseTimer(stopPhaseTimerMessage)
            return
          }
          lastCall = args
          try {
            listener(args)
          } catch (err) {
            console.error(err)
            stopPhaseTimerMessage = 'Got error'
          }
          stopPhaseTimer(stopPhaseTimerMessage)
        },
        meta,
      }),
    ),
  })
}
export function thru(fn: Function) {
  return fn(this)
}
export function dispatch(action: any) {
  return action
}

export function mapStore<A, B>(
  store: Store<A>,
  fn: (state: A, lastState?: B) => B,
  firstState?: B,
): Store<B> {
  startPhaseTimer(store, 'map')
  let lastValue = store.getState()
  let lastResult
  let stopPhaseTimerMessage = 'Got initial error'
  try {
    lastResult = fn(lastValue, firstState)
    stopPhaseTimerMessage = 'Initial'
  } catch (err) {
    console.error(err)
  }
  stopPhaseTimer(stopPhaseTimerMessage)
  const innerStore: Store<any> = this({
    config: {name: '' + store.shortName + ' → *'},
    currentState: lastResult,
    parent: store.domainName,
  })
  const meta = {
    fullName: innerStore.compositeName?.fullName,
    section: store.id,
  }
  linkGraphs({
    from: store.graphite,
    to: createGraph({
      node: [
        step.compute({
          fn(newValue) {
            startPhaseTimer(store, 'map')
            lastValue = newValue
            let stopPhaseTimerMessage = 'Got error'
            const lastState = innerStore.getState()
            let result
            try {
              result = fn(newValue, lastState)
              stopPhaseTimerMessage = null
            } catch (err) {
              console.error(err)
            }
            stopPhaseTimer(stopPhaseTimerMessage)
            return result
          },
          meta,
        }),
        step.filter({
          fn(result) {
            const lastState = innerStore.getState()
            const isChanged = result !== lastState && result !== undefined
            if (isChanged) {
              lastResult = result
            }
            return isChanged
          },
          meta,
        }),
      ],
      child: [innerStore.graphite],
    }),
  })
  return innerStore
}
